import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Users, CheckCircle, Clock, XCircle, Gift, Calendar, RotateCcw, Star, AlertTriangle } from 'lucide-react';
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
  const [editingScoreCell, setEditingScoreCell] = useState<string | null>(null);
  const [scoreInputValue, setScoreInputValue] = useState('');
  const [showScoreChangeDialog, setShowScoreChangeDialog] = useState<{studentId: string, newScore: number} | null>(null);
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

        // Merge reward points with student data
        const studentsWithRewards = studentsData?.map(student => ({
          ...student,
          rewardPenaltyPoints: scoresData?.find(s => s.student_id === student.id)?.reward_penalty_points || 0
        })) || [];
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

  const handleScoreCellClick = (studentId: string) => {
    const currentScore = getCurrentScore(studentId);
    setEditingScoreCell(studentId);
    setScoreInputValue('');
  };

  const handleScoreInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty, negative sign, or valid numbers
    if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
      setScoreInputValue(value);
    }
  };

  const handleScoreSubmit = async (studentId: string) => {
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

    const currentScore = getCurrentScore(studentId);
    
    // If changing existing score, require reason
    if (currentScore !== 0) {
      setShowScoreChangeDialog({ studentId, newScore });
      return;
    }

    // New score, no reason needed
    await submitScore(studentId, newScore, null);
  };

  const submitScore = async (studentId: string, newScore: number, reason: string | null) => {
    try {
      const currentScore = getCurrentScore(studentId);
      const scoreDiff = newScore - currentScore;

      await supabase.from('reward_penalty_history').insert([{
        student_id: studentId,
        teacher_id: teacherId,
        points: scoreDiff,
        reason: reason || (scoreDiff > 0 ? 'Baho/Mukofot' : 'Jarima'),
        date: selectedDate
      }] as any);

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();

      toast({
        title: "Muvaffaqiyatli",
        description: `Ball qo'shildi: ${scoreDiff > 0 ? '+' : ''}${scoreDiff}`,
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

  const handleScoreKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, studentId: string) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      handleScoreSubmit(studentId);
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
                  <TableHead className="text-center w-[60px]">Keldi</TableHead>
                  <TableHead className="text-center w-[60px]">Kech</TableHead>
                  <TableHead className="text-center w-[60px]">Kelmadi</TableHead>
                  <TableHead className="text-center w-[100px]">Baho/Mukofot/Jarima</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(student => {
                  const currentScore = getCurrentScore(student.id);
                  const isEditing = editingScoreCell === student.id;
                  
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <button 
                          onClick={() => handleStudentClick(student.id)} 
                          className="flex items-center space-x-3 hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer w-full text-left"
                        >
                          <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium">
                              {student.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate">{student.name}</h3>
                            {student.student_id && (
                              <p className="text-xs text-muted-foreground">ID: {student.student_id}</p>
                            )}
                          </div>
                        </button>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <Button 
                          size="sm" 
                          onClick={() => markAttendance(student.id, 'present')} 
                          className={getButtonStyle(student.id, 'present')}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <Button 
                          size="sm" 
                          onClick={() => markAttendance(student.id, 'late')} 
                          className={getButtonStyle(student.id, 'late')}
                        >
                          <Clock className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      
                      <TableCell className="text-center">
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
                      
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="text"
                            value={scoreInputValue}
                            onChange={handleScoreInputChange}
                            onKeyDown={(e) => handleScoreKeyDown(e, student.id)}
                            onBlur={() => handleScoreSubmit(student.id)}
                            className="w-16 h-10 text-center p-1 text-sm"
                            placeholder="0"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => handleScoreCellClick(student.id)}
                            className={`w-16 h-10 rounded flex items-center justify-center text-sm font-semibold transition-colors hover:opacity-80 ${getScoreCellStyle(currentScore)}`}
                          >
                            {currentScore === 0 ? '—' : `${currentScore > 0 ? '+' : ''}${currentScore}`}
                          </button>
                        )}
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
                    submitScore(showScoreChangeDialog.studentId, showScoreChangeDialog.newScore, scoreChangeReason.trim());
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