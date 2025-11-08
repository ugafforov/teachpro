import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Users, CheckCircle, Clock, XCircle, Gift, Calendar, RotateCcw, Star, AlertTriangle, Archive, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
  const [showScoreChangeDialog, setShowScoreChangeDialog] = useState<{studentId: string, newScore: number, type: 'baho' | 'mukofot' | 'jarima', existingRecordId?: string} | null>(null);
  const [scoreChangeReason, setScoreChangeReason] = useState('');
  const [confirmArchive, setConfirmArchive] = useState<{id: string, name: string} | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{id: string, name: string} | null>(null);
  const [dailyScores, setDailyScores] = useState<Record<string, {baho?: {points: number, id: string}, mukofot?: {points: number, id: string}, jarima?: {points: number, id: string}}>>({});
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

  useEffect(() => {
    if (students.length > 0) {
      fetchDailyScores(selectedDate);
    }
  }, [students.length, selectedDate]);

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

  const fetchDailyScores = async (date: string) => {
    try {
      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) return;

      const { data, error } = await supabase
        .from('reward_penalty_history')
        .select('id, student_id, points, type')
        .in('student_id', studentIds)
        .eq('teacher_id', teacherId)
        .eq('date', date);

      if (error) throw error;

      const scoresMap: Record<string, {baho?: {points: number, id: string}, mukofot?: {points: number, id: string}, jarima?: {points: number, id: string}}>= {};
      
      if (data) {
        data.forEach((record: any) => {
          if (!scoresMap[record.student_id]) {
            scoresMap[record.student_id] = {};
          }
          if (record.type === 'Baho') {
            scoresMap[record.student_id].baho = { points: record.points, id: record.id };
          } else if (record.type === 'Mukofot') {
            scoresMap[record.student_id].mukofot = { points: record.points, id: record.id };
          } else if (record.type === 'Jarima') {
            scoresMap[record.student_id].jarima = { points: record.points, id: record.id };
          }
        });
      }

      setDailyScores(scoresMap);
    } catch (error) {
      console.error('Error fetching daily scores:', error);
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
      
      // Optimistic update
      if (existingRecord) {
        if (existingRecord.status === status && (notes ?? existingRecord.notes ?? null) === (existingRecord.notes ?? null)) {
          setAttendance(prevAttendance => {
            const newAttendance = {
              ...prevAttendance
            } as Record<string, AttendanceStatus>;
            delete newAttendance[studentId];
            return newAttendance;
          });
          
          const {
            error
          } = await supabase.from('attendance_records').delete().eq('id', existingRecord.id);
          if (error) throw error;
        } else {
          setAttendance(prevAttendance => ({
            ...prevAttendance,
            [studentId]: status
          }));
          
          const {
            error
          } = await supabase.from('attendance_records').update({
            status: status,
            notes: notes === undefined ? existingRecord.notes ?? null : notes
          }).eq('id', existingRecord.id);
          if (error) throw error;
        }
      } else {
        setAttendance(prevAttendance => ({
          ...prevAttendance,
          [studentId]: status
        }));
        
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
      }
      
      // Background update without blocking
      onStatsUpdate?.();
    } catch (error) {
      console.error('Error marking attendance:', error);
      // Revert on error
      await fetchAttendanceForDate(selectedDate);
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

    // Check if score already exists for this date
    const existingScore = dailyScores[studentId]?.[type];
    
    if (existingScore) {
      // Existing score - require reason for modification
      setShowScoreChangeDialog({ studentId, newScore, type, existingRecordId: existingScore.id });
    } else {
      // New score - no reason required
      await submitScore(studentId, newScore, null, type);
    }
  };

  const submitScore = async (studentId: string, newScore: number, reason: string | null, type: 'baho' | 'mukofot' | 'jarima', existingRecordId?: string) => {
    try {
      const typeLabel = type === 'baho' ? 'Baho' : type === 'mukofot' ? 'Mukofot' : 'Jarima';

      if (existingRecordId) {
        // Update existing record
        if (!reason || reason.trim() === '') {
          toast({
            title: "Xatolik",
            description: "Izoh kiritish majburiy",
            variant: "destructive"
          });
          return;
        }

        // Optimistic update
        setDailyScores(prev => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            [type]: { points: newScore, id: existingRecordId }
          }
        }));

        await supabase
          .from('reward_penalty_history')
          .update({
            points: newScore,
            reason: reason
          })
          .eq('id', existingRecordId);
      } else {
        // Optimistic update for new record
        const tempId = `temp-${Date.now()}`;
        setDailyScores(prev => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            [type]: { points: newScore, id: tempId }
          }
        }));

        // Insert new record (no reason required for first entry)
        const { data: insertedData } = await supabase.from('reward_penalty_history').insert([{
          student_id: studentId,
          teacher_id: teacherId,
          points: newScore,
          reason: reason,
          type: typeLabel,
          date: selectedDate
        }] as any).select('id').single();

        // Update with real ID
        if (insertedData) {
          setDailyScores(prev => ({
            ...prev,
            [studentId]: {
              ...prev[studentId],
              [type]: { points: newScore, id: insertedData.id }
            }
          }));
        }
      }

      // Move to next student
      const currentIndex = students.findIndex(s => s.id === studentId);
      if (currentIndex < students.length - 1) {
        const nextStudent = students[currentIndex + 1];
        setTimeout(() => {
          setEditingScoreCell({ studentId: nextStudent.id, type });
          setScoreInputValue('');
        }, 0);
      } else {
        setEditingScoreCell(null);
        setScoreInputValue('');
      }

      // Background updates without blocking UI
      Promise.all([
        fetchStudents(),
        onStatsUpdate?.()
      ]);

      toast({
        title: "Muvaffaqiyatli",
        description: `${typeLabel} ${existingRecordId ? "o'zgartirildi" : "qo'shildi"}: ${newScore}`,
      });
    } catch (error) {
      console.error('Error submitting score:', error);
      toast({
        title: "Xatolik",
        description: "Ball qo'shishda xatolik yuz berdi",
        variant: "destructive"
      });
      // Revert optimistic update on error
      await fetchDailyScores(selectedDate);
    } finally {
      setShowScoreChangeDialog(null);
      setScoreChangeReason('');
    }
  };

  const handleScoreKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, studentId: string, type: 'baho' | 'mukofot' | 'jarima') => {
    if (e.key === 'Enter') {
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

  const handleArchive = async (studentId: string) => {
    try {
      // Get full student data
      const { data: studentData, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Update student to inactive (keeps all related data)
      await supabase.from('students').update({ is_active: false }).eq('id', studentId);
      
      // Copy to archived_students for tracking
      const { error: archiveError } = await supabase
        .from('archived_students')
        .insert({
          original_student_id: studentData.id,
          teacher_id: studentData.teacher_id,
          name: studentData.name,
          student_id: studentData.student_id,
          email: studentData.email,
          phone: studentData.phone,
          group_name: studentData.group_name,
          age: studentData.age,
          parent_phone: studentData.parent_phone,
          reward_penalty_points: studentData.reward_penalty_points
        });
      
      if (archiveError) throw archiveError;
      
      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      
      toast({
        title: "Muvaffaqiyatli",
        description: "O'quvchi arxivlandi",
      });
      
      setConfirmArchive(null);
    } catch (error) {
      console.error('Error archiving student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini arxivlashda xatolik yuz berdi",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (studentId: string) => {
    try {
      const { error } = await (supabase as any).rpc('soft_delete_student', {
        p_student_id: studentId
      });
      
      if (error) throw error;

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();

      toast({
        title: "Muvaffaqiyatli",
        description: "O'quvchi chiqindilar qutisiga o'tkazildi",
      });

      setConfirmDelete(null);
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini o'chirishda xatolik yuz berdi",
        variant: "destructive"
      });
    }
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
          fetchDailyScores(selectedDate);
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
                  <TableHead className="text-center px-0" style={{ width: '132px', minWidth: '132px', maxWidth: '132px' }} colSpan={3}>Bugungi davomat</TableHead>
                  <TableHead className="text-center px-0 pl-8" style={{ width: '146px', minWidth: '146px', maxWidth: '146px' }} colSpan={3}>Baho / Mukofot / Jarima</TableHead>
                  <TableHead className="text-center w-[140px]">O'rtacha / Mukofot / Jarima</TableHead>
                  <TableHead className="text-center font-bold w-[100px]">Jami bal</TableHead>
                  <TableHead className="text-center w-[100px]">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(student => {
                  
                  const renderScoreCell = (type: 'baho' | 'mukofot' | 'jarima') => {
                    const isEditing = editingScoreCell?.studentId === student.id && editingScoreCell?.type === type;
                    const dailyScore = dailyScores[student.id]?.[type];
                    const currentValue = dailyScore?.points || 0;
                    
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
                      <TableCell className={`text-center px-0.5 ${type === 'baho' ? 'pl-8' : ''}`} style={{ width: '38px', minWidth: '38px', maxWidth: '38px' }}>
                        {isEditing ? (
                          <Input
                            type="text"
                            value={scoreInputValue}
                            onChange={handleScoreInputChange}
                            onKeyDown={(e) => handleScoreKeyDown(e, student.id, type)}
                            onBlur={() => handleScoreSubmit(student.id, type)}
                            className="w-9 h-9 text-center p-0 text-sm"
                            placeholder="0"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => handleScoreCellClick(student.id, type)}
                            className={`w-9 h-9 rounded flex items-center justify-center text-xs font-semibold transition-colors hover:opacity-80 ${bgColor} ${textColor}`}
                          >
                            {currentValue !== 0 ? (currentValue > 0 ? `+${currentValue}` : currentValue) : (type === 'baho' ? 'B' : type === 'mukofot' ? 'M' : 'J')}
                          </button>
                        )}
                      </TableCell>
                    );
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
                      
                      <TableCell className="text-center px-0.5" style={{ width: '44px', minWidth: '44px', maxWidth: '44px' }}>
                        <Button 
                          size="sm" 
                          onClick={() => markAttendance(student.id, 'present')} 
                          className={getButtonStyle(student.id, 'present')}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      
                      <TableCell className="text-center px-0.5" style={{ width: '44px', minWidth: '44px', maxWidth: '44px' }}>
                        <Button 
                          size="sm" 
                          onClick={() => markAttendance(student.id, 'late')} 
                          className={getButtonStyle(student.id, 'late')}
                        >
                          <Clock className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      
                      <TableCell className="text-center px-0.5" style={{ width: '44px', minWidth: '44px', maxWidth: '44px' }}>
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
                      
                      {renderScoreCell('baho')}
                      {renderScoreCell('mukofot')}
                      {renderScoreCell('jarima')}

                      <TableCell className="text-center w-[140px]">
                        <div className="flex items-center justify-center gap-1 text-sm whitespace-nowrap">
                          <span className="font-semibold text-blue-600">
                            {(student.averageScore || 0).toFixed(1)}
                          </span>
                          <span className="text-gray-400">/</span>
                          <span className={`font-semibold ${(student.totalRewards || 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {(student.totalRewards || 0).toFixed(1)}
                          </span>
                          <span className="text-gray-400">/</span>
                          <span className={`font-semibold ${(student.totalPenalties || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {(student.totalPenalties || 0).toFixed(1)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center w-[100px]">
                        <div className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-primary/10">
                          {(student.rewardPenaltyPoints || 0) !== 0 ? (
                            <span className={`text-sm font-bold ${(student.rewardPenaltyPoints || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(student.rewardPenaltyPoints || 0) > 0 ? '+' : ''}{(student.rewardPenaltyPoints || 0).toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-bold">0</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center w-[100px]">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmArchive({id: student.id, name: student.name})}
                            className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete({id: student.id, name: student.name})}
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
              Mavjud baho: {dailyScores[showScoreChangeDialog.studentId]?.[showScoreChangeDialog.type]?.points || 0}<br/>
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
                    submitScore(showScoreChangeDialog.studentId, showScoreChangeDialog.newScore, scoreChangeReason.trim(), showScoreChangeDialog.type, showScoreChangeDialog.existingRecordId);
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

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={!!confirmArchive} onOpenChange={(open) => !open && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'quvchini arxivlash</AlertDialogTitle>
            <AlertDialogDescription>
              Rostdan ham "{confirmArchive?.name}" ni arxivlamoqchimisiz? Arxivlangan o'quvchini keyin qayta tiklash mumkin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmArchive && handleArchive(confirmArchive.id)}>
              Arxivlash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'quvchini o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              Rostdan ham "{confirmDelete?.name}" ni o'chirmoqchimisiz? O'chirilgan o'quvchini Chiqindilar qutisidan qayta tiklash mumkin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && handleDelete(confirmDelete.id)} className="bg-red-600 hover:bg-red-700">
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};
export default GroupDetails;