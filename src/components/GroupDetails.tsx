import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Users, CheckCircle, Clock, XCircle, Gift, Calendar, RotateCcw, Star, AlertTriangle, Archive, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import StudentImport from './StudentImport';
import StudentDetailsPopup from './StudentDetailsPopup';
interface Student {
  id: string;
  name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name: string;
  teacher_id: string;
  created_at: string;
  rewardPenaltyPoints?: number;
  averageScore?: number;
  totalRewards?: number;
  totalPenalties?: number;
  bahoScore?: number;
  mukofotScore?: number;
  jarimaScore?: number;
}
type AttendanceStatus = 'present' | 'late' | 'absent_with_reason' | 'absent_without_reason' | 'absent';
interface AttendanceRecord {
  id: string;
  student_id: string;
  teacher_id: string;
  date: string;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
}
interface GroupDetailsProps {
  groupName: string;
  teacherId: string;
  onBack: () => void;
  onStatsUpdate: () => Promise<void>;
}
const GroupDetails: React.FC<GroupDetailsProps> = ({
  groupName,
  teacherId,
  onBack,
  onStatsUpdate
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showRewardDialog, setShowRewardDialog] = useState<string | null>(null);
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardType, setRewardType] = useState<'reward' | 'penalty'>('reward');
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentPopupOpen, setIsStudentPopupOpen] = useState(false);
  const [showAbsentDialog, setShowAbsentDialog] = useState<string | null>(null);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [absentReason, setAbsentReason] = useState('');
  const [editingScoreCell, setEditingScoreCell] = useState<{studentId: string, type: 'baho' | 'mukofot' | 'jarima'} | null>(null);
  const [scoreInputValue, setScoreInputValue] = useState('');
  const [showScoreChangeDialog, setShowScoreChangeDialog] = useState<{studentId: string, newScore: number, type: 'baho' | 'mukofot' | 'jarima'} | null>(null);
  const [scoreChangeReason, setScoreChangeReason] = useState('');
  const [newStudent, setNewStudent] = useState({
    name: '',
    student_id: '',
    email: '',
    phone: ''
  });
  const {
    toast
  } = useToast();
  useEffect(() => {
    fetchStudents();
    fetchAttendanceForDate(selectedDate);
  }, [groupName, teacherId, selectedDate]);

  // Get current score for student
  const getCurrentScore = (studentId: string): number => {
    return students.find(s => s.id === studentId)?.rewardPenaltyPoints || 0;
  };
  const fetchStudents = async () => {
    try {
      const {
        data: studentsData,
        error: studentsError
      } = await supabase.from('students').select('*').eq('teacher_id', teacherId).eq('group_name', groupName).eq('is_active', true).order('name');
      if (studentsError) throw studentsError;

      // Fetch reward/penalty points for each student
      const studentIds = studentsData?.map(s => s.id) || [];
      if (studentIds.length > 0) {
        const {
          data: scoresData,
          error: scoresError
        } = await supabase.from('student_scores').select('student_id, reward_penalty_points').in('student_id', studentIds).eq('teacher_id', teacherId);
        if (scoresError) throw scoresError;

        // Fetch reward/penalty history to get totals by type
        const {
          data: historyData,
          error: historyError
        } = await supabase.from('reward_penalty_history').select('student_id, points, type').in('student_id', studentIds).eq('teacher_id', teacherId);
        if (historyError) throw historyError;

        // Fetch attendance records to calculate attendance points
        const {
          data: attendanceData,
          error: attendanceError
        } = await supabase.from('attendance_records').select('student_id, status').in('student_id', studentIds).eq('teacher_id', teacherId);
        if (attendanceError) throw attendanceError;

        // Merge all data with student data
        const studentsWithRewards = studentsData?.map(student => {
          const scoreRecord = scoresData?.find(s => s.student_id === student.id);
          const studentHistory = historyData?.filter(h => h.student_id === student.id) || [];
          const studentAttendance = attendanceData?.filter(a => a.student_id === student.id) || [];
          
          // Calculate separate scores for baho, mukofot, jarima based on type field
          let bahoScore = 0;
          let mukofotScore = 0;
          let jarimaScore = 0;

          studentHistory.forEach(record => {
            if (record.type === 'Baho') {
              bahoScore += record.points;
            } else if (record.type === 'Mukofot') {
              mukofotScore += record.points;
            } else if (record.type === 'Jarima') {
              jarimaScore += record.points;
            }
          });

          // Calculate average baho score
          const bahoRecords = studentHistory.filter(h => h.type === 'Baho');
          const averageScore = bahoRecords.length > 0
            ? bahoRecords.reduce((sum, record) => sum + record.points, 0) / bahoRecords.length
            : 0;

          // Calculate attendance points: present = +1, late = +0.5, absent = 0
          const attendancePoints = studentAttendance.reduce((total, record) => {
            if (record.status === 'present') return total + 1;
            if (record.status === 'late') return total + 0.5;
            return total;
          }, 0);

          // Calculate total score: (mukofot - jarima) + attendance points
          const totalRewards = mukofotScore;
          const totalPenalties = jarimaScore;
          const totalScore = mukofotScore - jarimaScore + attendancePoints;

          return {
            ...student,
            rewardPenaltyPoints: totalScore,
            averageScore,
            bahoScore,
            mukofotScore,
            jarimaScore,
            totalRewards,
            totalPenalties
          };
        }) || [];
        setStudents(studentsWithRewards);
      } else {
        setStudents(studentsData || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };
  const fetchAttendanceForDate = async (date: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('attendance_records').select('student_id, status').eq('teacher_id', teacherId).eq('date', date);
      if (error) throw error;
      const attendanceMap: Record<string, AttendanceStatus> = {};
      if (data) {
        data.forEach((record: any) => {
          attendanceMap[record.student_id] = (record.status === 'absent' ? 'absent_without_reason' : record.status) as AttendanceStatus;
        });
      }
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };
  const addStudent = async () => {
    if (!newStudent.name.trim()) {
      return;
    }
    try {
      const {
        error
      } = await supabase.from('students').insert({
        teacher_id: teacherId,
        name: newStudent.name.trim(),
        student_id: newStudent.student_id.trim() || null,
        email: newStudent.email.trim() || null,
        phone: newStudent.phone.trim() || null,
        group_name: groupName
      });
      if (error) throw error;
      await fetchStudents();
      await onStatsUpdate();
      setNewStudent({
        name: '',
        student_id: '',
        email: '',
        phone: ''
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error adding student:', error);
    }
  };
  const markAttendance = async (studentId: string, status: AttendanceStatus, notes?: string | null) => {
    try {
      const {
        data: existingRecord
      } = await supabase.from('attendance_records').select('*').eq('teacher_id', teacherId).eq('student_id', studentId).eq('date', selectedDate).maybeSingle();
      if (existingRecord) {
        if (existingRecord.status === status && (notes ?? existingRecord.notes ?? null) === (existingRecord.notes ?? null)) {
          const {
            error
          } = await supabase.from('attendance_records').delete().eq('id', existingRecord.id);
          if (error) throw error;
          setAttendance(prevAttendance => {
            const newAttendance = {
              ...prevAttendance
            } as Record<string, AttendanceStatus>;
            delete newAttendance[studentId];
            return newAttendance;
          });
        } else {
          const {
            error
          } = await supabase.from('attendance_records').update({
            status: status,
            notes: notes === undefined ? existingRecord.notes ?? null : notes
          }).eq('id', existingRecord.id);
          if (error) throw error;
          setAttendance(prevAttendance => ({
            ...prevAttendance,
            [studentId]: status
          }));
        }
      } else {
        const {
          error
        } = await supabase.from('attendance_records').insert({
          teacher_id: teacherId,
          student_id: studentId,
          date: selectedDate,
          status: status,
          notes: notes ?? null
        });
        if (error) throw error;
        setAttendance(prevAttendance => ({
          ...prevAttendance,
          [studentId]: status
        }));
      }
      await onStatsUpdate();
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };
  const markAllAsPresent = async () => {
    try {
      const attendancePromises = students.map(student => markAttendance(student.id, 'present'));
      await Promise.all(attendancePromises);
    } catch (error) {
      console.error('Error marking all as present:', error);
    }
  };
  const clearAllAttendance = async () => {
    try {
      const {
        error
      } = await supabase.from('attendance_records').delete().eq('teacher_id', teacherId).eq('date', selectedDate);
      if (error) throw error;
      setAttendance({});
      await onStatsUpdate();
    } catch (error) {
      console.error('Error clearing attendance:', error);
    }
  };
  const addReward = async (studentId: string) => {
    if (!rewardPoints) {
      return;
    }
    const points = parseFloat(rewardPoints);
    if (isNaN(points)) {
      return;
    }

    // Validate point limits
    if (rewardType === 'reward' && points > 5) {
      return;
    }
    if (rewardType === 'penalty' && Math.abs(points) > 5) {
      return;
    }
    try {
      const {
        error
      } = await supabase.from('reward_penalty_history').insert([{
        student_id: studentId,
        teacher_id: teacherId,
        points: rewardType === 'penalty' ? -Math.abs(points) : Math.abs(points),
        reason: rewardType === 'reward' ? 'Mukofot' : 'Jarima',
        date: new Date().toISOString().split('T')[0]
      }] as any);
      if (error) throw error;
      setShowRewardDialog(null);
      setRewardPoints('');
      await fetchStudents(); // Refresh to show updated reward points
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error adding reward/penalty:', error);
    }
  };

  const handleScoreCellClick = (studentId: string, type: 'baho' | 'mukofot' | 'jarima') => {
    setEditingScoreCell({studentId, type});
    setScoreInputValue('');
  };

  const handleScoreInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty, negative sign, or valid numbers
    if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
      setScoreInputValue(value);
    }
  };

  const handleScoreSubmit = async (studentId: string, type: 'baho' | 'mukofot' | 'jarima') => {
    if (scoreInputValue === '' || scoreInputValue === '-') {
      setEditingScoreCell(null);
      setScoreInputValue('');
      return;
    }

    const newScore = parseFloat(scoreInputValue);
    if (isNaN(newScore)) {
      setEditingScoreCell(null);
      setScoreInputValue('');
      return;
    }

    // Validate score range (0-5)
    if (newScore < 0 || newScore > 5) {
      toast({
        title: "Xatolik",
        description: "Ball 0 dan 5 gacha bo'lishi kerak",
        variant: "destructive"
      });
      return;
    }

    // Always require reason for score changes
    setShowScoreChangeDialog({ studentId, newScore, type });
  };

  const submitScore = async (studentId: string, newScore: number, reason: string | null, type: 'baho' | 'mukofot' | 'jarima') => {
    try {
      if (!reason || reason.trim() === '') {
        toast({
          title: "Xatolik",
          description: "Izoh kiritish majburiy",
          variant: "destructive"
        });
        return;
      }

      const typeLabel = type === 'baho' ? 'Baho' : type === 'mukofot' ? 'Mukofot' : 'Jarima';

      await supabase.from('reward_penalty_history').insert([{
        student_id: studentId,
        teacher_id: teacherId,
        points: newScore,
        reason: reason,
        type: typeLabel,
        date: selectedDate
      }] as any);

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();

      toast({
        title: "Muvaffaqiyatli",
        description: `${typeLabel} qo'shildi: ${newScore}`,
      });
    } catch (error) {
      console.error('Error submitting score:', error);
      toast({
        title: "Xatolik",
        description: "Ball qo'shishda xatolik yuz berdi",
        variant: "destructive"
      });
    } finally {
      setEditingScoreCell(null);
      setScoreInputValue('');
      setShowScoreChangeDialog(null);
      setScoreChangeReason('');
    }
  };

  const handleScoreKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, studentId: string, type: 'baho' | 'mukofot' | 'jarima') => {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      handleScoreSubmit(studentId, type);
    } else if (e.key === 'Escape') {
      setEditingScoreCell(null);
      setScoreInputValue('');
    }
  };
  const handleStudentClick = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentPopupOpen(true);
  };
  const getButtonStyle = (studentId: string, targetStatus: AttendanceStatus) => {
    const currentStatus = attendance[studentId];
    const normalized = (currentStatus === 'absent' ? 'absent_without_reason' : currentStatus) as AttendanceStatus | undefined;
    const baseStyle = 'w-10 h-10 p-0 border';
    if (targetStatus !== 'absent') {
      const isActive = normalized === targetStatus;
      if (!isActive) {
        return `${baseStyle} border-gray-300 bg-white hover:bg-gray-50 text-gray-600`;
      }
      switch (targetStatus) {
        case 'present':
          return `${baseStyle} border-green-500 bg-green-500 hover:bg-green-600 text-white`;
        case 'late':
          return `${baseStyle} border-orange-500 bg-orange-500 hover:bg-orange-600 text-white`;
        default:
          return `${baseStyle} border-gray-300 bg-white hover:bg-gray-50 text-gray-600`;
      }
    }

    // targetStatus is 'absent' -> show different colors based on reason
    if (normalized === 'absent_with_reason') {
      return `${baseStyle} border-yellow-500 bg-yellow-500 hover:bg-yellow-600 text-white`;
    }
    if (normalized === 'absent_without_reason') {
      return `${baseStyle} border-red-500 bg-red-500 hover:bg-red-600 text-white`;
    }
    return `${baseStyle} border-gray-300 bg-white hover:bg-gray-50 text-gray-600`;
  };
  const getScoreCellStyle = (points: number) => {
    if (points === 0) return 'bg-gray-50 text-gray-400';
    if (points > 0) return 'bg-green-50 text-green-700 border border-green-200';
    return 'bg-red-50 text-red-700 border border-red-200';
  };
  if (loading) {
    return <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button onClick={onBack} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{groupName}</h2>
            <p className="text-muted-foreground">{students.length} o'quvchi</p>
          </div>
        </div>
        <div className="flex gap-2">
          <StudentImport teacherId={teacherId} groupName={groupName} onImportComplete={() => {
          fetchStudents();
          fetchAttendanceForDate(selectedDate);
          if (onStatsUpdate) onStatsUpdate();
        }} />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Yangi o'quvchi qo'shish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="studentName">O'quvchi nomi *</Label>
                  <Input id="studentName" value={newStudent.name} onChange={e => setNewStudent({
                  ...newStudent,
                  name: e.target.value
                })} placeholder="To'liq ism sharif" />
                </div>
                <div>
                  <Label htmlFor="studentId">O'quvchi ID</Label>
                  <Input id="studentId" value={newStudent.student_id} onChange={e => setNewStudent({
                  ...newStudent,
                  student_id: e.target.value
                })} placeholder="Masalan: 2024001" />
                </div>
                <div>
                  <Label htmlFor="studentEmail">Email</Label>
                  <Input id="studentEmail" type="email" value={newStudent.email} onChange={e => setNewStudent({
                  ...newStudent,
                  email: e.target.value
                })} placeholder="student@example.com" />
                </div>
                <div>
                  <Label htmlFor="studentPhone">Telefon</Label>
                  <Input id="studentPhone" value={newStudent.phone} onChange={e => setNewStudent({
                  ...newStudent,
                  phone: e.target.value
                })} placeholder="+998 90 123 45 67" />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={addStudent} className="apple-button flex-1">
                    Qo'shish
                  </Button>
                  <Button onClick={() => setIsAddDialogOpen(false)} variant="outline" className="flex-1">
                    Bekor qilish
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="apple-card">
        <div className="p-6 border-b border-border/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold">Davomat</h3>
              <p className="text-sm text-muted-foreground">
                O'quvchilar davomatini boshqaring
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-40" />
              </div>
              <Button onClick={markAllAsPresent} variant="outline" size="sm" className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Barchani kelgan deb belgilash
              </Button>
              <Button onClick={clearAllAttendance} variant="outline" size="sm" className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Belgilarni tozalash
              </Button>
            </div>
          </div>
        </div>
        {students.length === 0 ? <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
            <p className="text-muted-foreground mb-4">
              Guruhga o'quvchilarni qo'shing
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="apple-button">
              <Plus className="w-4 h-4 mr-2" />
              Birinchi o'quvchini qo'shish
            </Button>
          </div> : <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">O'quvchi</TableHead>
                  <TableHead className="text-center" colSpan={3}>Bugungi davomat</TableHead>
                  <TableHead className="text-center" colSpan={3}>Baho / Mukofot / Jarima</TableHead>
                  <TableHead className="text-center">O'rtacha baho</TableHead>
                  <TableHead className="text-center">Jami mukofot</TableHead>
                  <TableHead className="text-center">Jami jarima</TableHead>
                  <TableHead className="text-center">Jami bal</TableHead>
                  <TableHead className="text-center">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(student => {
                  const currentScore = getCurrentScore(student.id);
                  
                  const renderScoreCell = (type: 'baho' | 'mukofot' | 'jarima', currentValue: number) => {
                    const isEditing = editingScoreCell?.studentId === student.id && editingScoreCell?.type === type;
                    
                    let bgColor = 'bg-white border border-gray-200';
                    let textColor = 'text-gray-400';
                    
                    if (currentValue !== 0) {
                      if (type === 'baho') {
                        bgColor = 'bg-blue-100 border-blue-200';
                        textColor = 'text-blue-700';
                      } else if (type === 'mukofot') {
                        bgColor = 'bg-green-100 border-green-200';
                        textColor = 'text-green-700';
                      } else if (type === 'jarima') {
                        bgColor = 'bg-red-100 border-red-200';
                        textColor = 'text-red-700';
                      }
                    }
                    
                    return (
                      <TableCell className="text-center px-1">
                        {isEditing ? (
                          <Input
                            type="text"
                            value={scoreInputValue}
                            onChange={handleScoreInputChange}
                            onKeyDown={(e) => handleScoreKeyDown(e, student.id, type)}
                            onBlur={() => handleScoreSubmit(student.id, type)}
                            className="w-10 h-10 text-center p-1 text-sm"
                            placeholder="0"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => handleScoreCellClick(student.id, type)}
                            className={`w-10 h-10 rounded flex items-center justify-center text-xs font-semibold transition-colors hover:opacity-80 ${bgColor} ${textColor}`}
                          >
                            {currentValue !== 0 ? (currentValue > 0 ? `+${currentValue}` : currentValue) : (type === 'baho' ? 'B' : type === 'mukofot' ? 'M' : 'J')}
                          </button>
                        )}
                      </TableCell>
                    );
                  };

                  const handleArchive = async (studentId: string) => {
                    try {
                      await supabase.from('students').update({ is_active: false }).eq('id', studentId);
                      await fetchStudents();
                      toast({
                        title: "Muvaffaqiyatli",
                        description: "O'quvchi arxivlandi",
                      });
                    } catch (error) {
                      console.error('Error archiving student:', error);
                    }
                  };

                  const handleDelete = async (studentId: string) => {
                    try {
                      await supabase.from('students').delete().eq('id', studentId);
                      await fetchStudents();
                      toast({
                        title: "Muvaffaqiyatli",
                        description: "O'quvchi o'chirildi",
                      });
                    } catch (error) {
                      console.error('Error deleting student:', error);
                    }
                  };
                  
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <button 
                          onClick={() => handleStudentClick(student.id)} 
                          className="flex items-center space-x-3 hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer w-full text-left"
                        >
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate">{student.name}</h3>
                          </div>
                        </button>
                      </TableCell>
                      
                      <TableCell className="text-center px-1">
                        <Button 
                          size="sm" 
                          onClick={() => markAttendance(student.id, 'present')} 
                          className={getButtonStyle(student.id, 'present')}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      
                      <TableCell className="text-center px-1">
                        <Button 
                          size="sm" 
                          onClick={() => markAttendance(student.id, 'late')} 
                          className={getButtonStyle(student.id, 'late')}
                        >
                          <Clock className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      
                      <TableCell className="text-center px-1">
                        <Button 
                          size="sm" 
                          onClick={() => {
                            setShowReasonInput(false);
                            setAbsentReason('');
                            setShowAbsentDialog(student.id);
                          }} 
                          className={getButtonStyle(student.id, 'absent')}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      
                      {renderScoreCell('baho', student.bahoScore || 0)}
                      {renderScoreCell('mukofot', student.mukofotScore || 0)}
                      {renderScoreCell('jarima', student.jarimaScore || 0)}

                      <TableCell className="text-center">
                        <span className="text-sm font-semibold text-blue-600">
                          {(student.averageScore || 0).toFixed(1)}
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        {(student.totalRewards || 0) > 0 ? (
                          <span className="text-sm font-semibold text-green-600">
                            {(student.totalRewards || 0).toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        {(student.totalPenalties || 0) > 0 ? (
                          <span className="text-sm font-semibold text-red-600">
                            {(student.totalPenalties || 0).toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        {(student.rewardPenaltyPoints || 0) !== 0 ? (
                          <span className={`text-sm font-semibold ${(student.rewardPenaltyPoints || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(student.rewardPenaltyPoints || 0) > 0 ? '+' : ''}{(student.rewardPenaltyPoints || 0).toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleArchive(student.id)}
                            className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(student.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>}
      </Card>

      {/* Absent Dialog */}
      {showAbsentDialog && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {students.find(s => s.id === showAbsentDialog)?.name} - Kelmadi
              </h3>
              <Button variant="ghost" size="sm" onClick={() => {
            setShowAbsentDialog(null);
            setShowReasonInput(false);
            setAbsentReason('');
          }} className="h-8 w-8 p-0">
                <XCircle className="w-4 h-4" />
              </Button>
            </div>

            {!showReasonInput ? <div className="grid grid-cols-2 gap-3">
                <Button onClick={async () => {
            await markAttendance(showAbsentDialog!, 'absent_without_reason', null);
            setShowAbsentDialog(null);
            setShowReasonInput(false);
            setAbsentReason('');
          }} variant="outline" className="h-12">
                  Sababsiz
                </Button>
                <Button onClick={() => setShowReasonInput(true)} variant="outline" className="h-12">
                  Sababli
                </Button>
              </div> : <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Sabab (majburiy)</label>
                  <Input type="text" value={absentReason} onChange={e => setAbsentReason(e.target.value)} placeholder="Sabab kiriting..." autoFocus />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={async () => {
              if (!absentReason.trim()) {
                toast({
                  title: "Xatolik",
                  description: "Sabab kiritish majburiy",
                  variant: "destructive"
                });
                return;
              }
              await markAttendance(showAbsentDialog!, 'absent_with_reason', absentReason.trim());
              setShowAbsentDialog(null);
              setShowReasonInput(false);
              setAbsentReason('');
            }} className="flex-1" disabled={!absentReason.trim()}>
                    Saqlash
                  </Button>
                  <Button onClick={() => setShowReasonInput(false)} variant="outline" className="flex-1">
                    Ortga
                  </Button>
                </div>
              </div>}
          </div>
        </div>}

      {/* Score Change Dialog */}
      {showScoreChangeDialog && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Baho o'zgartirish</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Mavjud baho: {getCurrentScore(showScoreChangeDialog.studentId)}<br/>
              Yangi baho: {showScoreChangeDialog.newScore}
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Izoh (majburiy)</label>
                <Input 
                  type="text" 
                  value={scoreChangeReason} 
                  onChange={e => setScoreChangeReason(e.target.value)} 
                  placeholder="Baho o'zgartirish sababini kiriting..." 
                  autoFocus 
                />
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={() => {
                    if (!scoreChangeReason.trim()) {
                      toast({
                        title: "Xatolik",
                        description: "Izoh kiritish majburiy",
                        variant: "destructive"
                      });
                      return;
                    }
                    submitScore(showScoreChangeDialog.studentId, showScoreChangeDialog.newScore, scoreChangeReason.trim(), showScoreChangeDialog.type);
                  }}
                  className="flex-1" 
                  disabled={!scoreChangeReason.trim()}
                >
                  Saqlash
                </Button>
                <Button 
                  onClick={() => {
                    setShowScoreChangeDialog(null);
                    setScoreChangeReason('');
                    setEditingScoreCell(null);
                    setScoreInputValue('');
                  }} 
                  variant="outline" 
                  className="flex-1"
                >
                  Bekor qilish
                </Button>
              </div>
            </div>
          </div>
        </div>}

      {/* Student Details Popup */}
      <StudentDetailsPopup studentId={selectedStudentId} isOpen={isStudentPopupOpen} onClose={() => {
      setIsStudentPopupOpen(false);
      setSelectedStudentId(null);
    }} teacherId={teacherId} />
    </div>;
};
export default GroupDetails;