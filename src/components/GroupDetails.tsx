import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import StudentImport from './StudentImport';
import StudentDetailsPopup from './StudentDetailsPopup';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import AttendanceSection from './group/AttendanceSection';
import StudentList from './group/StudentList';
import AddStudentDialog from './group/AddStudentDialog';
import RewardPenaltyDialog from './group/RewardPenaltyDialog';
import AbsentReasonDialog from './group/AbsentReasonDialog';
import GroupDetailsHeader from "./group/GroupDetailsHeader";
import AttendancePanel from "./group/AttendancePanel";
import StudentTable from "./group/StudentTable";
import StudentDialogs from "./group/StudentDialogs";

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
  hasRewardToday?: boolean;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'absent_with_reason';

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
  const [attendance, setAttendance] = useState<Record<string, { status: AttendanceStatus; reason?: string | null }>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showRewardDialog, setShowRewardDialog] = useState<string | null>(null);
  const [isSavingReward, setIsSavingReward] = useState(false);
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardType, setRewardType] = useState<'reward' | 'penalty'>('reward');
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentPopupOpen, setIsStudentPopupOpen] = useState(false);
  const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false);
  const [reasonStudent, setReasonStudent] = useState<Student | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [newStudent, setNewStudent] = useState({
    name: '',
    student_id: '',
    email: '',
    phone: ''
  });
  const { toast } = useToast();

  // NEW: method to refresh students and attendance
  const handleStudentImportComplete = () => {
    fetchStudents();
    fetchAttendanceForDate(selectedDate);
    if (onStatsUpdate) onStatsUpdate();
  };

  useEffect(() => {
    fetchStudents();
    fetchAttendanceForDate(selectedDate);
  }, [groupName, teacherId, selectedDate]);

  const fetchStudents = async () => {
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('group_name', groupName)
        .eq('is_active', true)
        .order('name');

      if (studentsError) throw studentsError;

      const studentIds = studentsData?.map(s => s.id) || [];
      if (studentIds.length > 0) {
        const { data: scoresData, error: scoresError } = await supabase
          .from('student_scores')
          .select('student_id, reward_penalty_points')
          .in('student_id', studentIds)
          .eq('teacher_id', teacherId);

        if (scoresError) throw scoresError;

        // Bugungi sana uchun mukofot/jarima olganlarni tekshirish
        const today = new Date().toISOString().split('T')[0];
        const { data: todayRewards, error: rewardsError } = await supabase
          .from('daily_reward_penalty_summary')
          .select('student_id')
          .in('student_id', studentIds)
          .eq('teacher_id', teacherId)
          .eq('date_given', today);

        if (rewardsError) throw rewardsError;

        const studentsWithRewards = studentsData?.map(student => ({
          ...student,
          rewardPenaltyPoints: scoresData?.find(s => s.student_id === student.id)?.reward_penalty_points || 0,
          hasRewardToday: todayRewards?.some(r => r.student_id === student.id) || false
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
      const { data, error } = await supabase
        .from('attendance_records')
        .select('student_id, status, reason')
        .eq('teacher_id', teacherId)
        .eq('date', date);

      if (error) throw error;

      const attendanceMap: Record<string, { status: AttendanceStatus; reason?: string | null }> = {};
      if (data) {
        data.forEach((record: any) => {
          attendanceMap[record.student_id] = { status: record.status as AttendanceStatus, reason: record.reason };
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
      const { error } = await supabase
        .from('students')
        .insert({
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
      
      setNewStudent({ name: '', student_id: '', email: '', phone: '' });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error adding student:', error);
    }
  };

  const markAttendance = async (studentId: string, status: AttendanceStatus, reason: string | null = null) => {
    try {
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('student_id', studentId)
        .eq('date', selectedDate)
        .maybeSingle();

      if (existingRecord) {
        if (existingRecord.status === status && status !== 'absent_with_reason') {
          const { error } = await supabase
            .from('attendance_records')
            .delete()
            .eq('id', existingRecord.id);

          if (error) throw error;

          setAttendance(prevAttendance => {
            const newAttendance = { ...prevAttendance };
            delete newAttendance[studentId];
            return newAttendance;
          });
        } else {
          const newReason = status === 'absent_with_reason' ? reason : null;
          const { error } = await supabase
            .from('attendance_records')
            .update({ status: status, reason: newReason })
            .eq('id', existingRecord.id);

          if (error) throw error;

          setAttendance(prevAttendance => ({
            ...prevAttendance,
            [studentId]: { status, reason: newReason },
          }));
        }
      } else {
        const newReason = status === 'absent_with_reason' ? reason : null;
        const { error } = await supabase
          .from('attendance_records')
          .insert({
            teacher_id: teacherId,
            student_id: studentId,
            date: selectedDate,
            status: status,
            reason: newReason
          });

        if (error) throw error;

        setAttendance(prevAttendance => ({
          ...prevAttendance,
          [studentId]: { status, reason: newReason },
        }));
      }

      await onStatsUpdate();
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  const markAllAsPresent = async () => {
    try {
      const attendancePromises = students.map(student => 
        markAttendance(student.id, 'present')
      );
      
      await Promise.all(attendancePromises);
    } catch (error) {
      console.error('Error marking all as present:', error);
    }
  };

  const clearAllAttendance = async () => {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('teacher_id', teacherId)
        .eq('date', selectedDate);

      if (error) throw error;

      setAttendance({});
      await onStatsUpdate();
    } catch (error) {
      console.error('Error clearing attendance:', error);
    }
  };

  const addReward = async (studentId: string) => {
    console.log('addReward called with studentId:', studentId, 'points:', rewardPoints, 'type:', rewardType);
    
    if (isSavingReward) return;

    if (!rewardPoints || !studentId) {
      console.log('Missing rewardPoints or studentId');
      return;
    }

    const points = parseFloat(rewardPoints);
    if (isNaN(points) || points <= 0) {
      console.log('Invalid points:', points);
      return;
    }

    if (rewardType === 'reward' && points > 5) {
      toast({ 
        title: "Cheklov", 
        description: "Mukofot maksimum 5 ball bo'lishi mumkin", 
        variant: "destructive" 
      });
      return;
    }
    if (rewardType === 'penalty' && Math.abs(points) > 5) {
      toast({ 
        title: "Cheklov", 
        description: "Jarima maksimum 5 ball bo'lishi mumkin", 
        variant: "destructive" 
      });
      return;
    }

    // Bugungi sana uchun allaqachon mukofot/jarima berilganligini tekshirish
    const student = students.find(s => s.id === studentId);
    if (student?.hasRewardToday) {
      toast({ 
        title: "Cheklov", 
        description: "Bu o'quvchiga bugun allaqachon mukofot/jarima berilgan", 
        variant: "destructive" 
      });
      return;
    }

    setIsSavingReward(true);
    try {
      console.log('Inserting reward/penalty with points:', rewardType === 'penalty' ? -Math.abs(points) : Math.abs(points));
      
      const { error } = await supabase
        .from('reward_penalty_history')
        .insert({
          student_id: studentId,
          teacher_id: teacherId,
          points: rewardType === 'penalty' ? -Math.abs(points) : Math.abs(points),
          reason: rewardType === 'reward' ? 'Mukofot' : 'Jarima',
          type: rewardType,
          date_given: new Date().toISOString().split('T')[0]
        });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Reward/penalty added successfully');
      
      // Dialog'ni yopish va ma'lumotlarni tozalash
      setShowRewardDialog(null);
      setRewardPoints('');
      
      // Ma'lumotlarni yangilash
      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      
      toast({ 
        title: "Muvaffaqiyat", 
        description: `${rewardType === 'reward' ? 'Mukofot' : 'Jarima'} muvaffaqiyatli berildi`, 
      });
    } catch (error) {
      console.error('Error adding reward/penalty:', error);
      if (error.message && error.message.includes('unique_daily_reward_penalty')) {
        toast({ 
          title: "Cheklov", 
          description: "Bu o'quvchiga bugun allaqachon mukofot/jarima berilgan", 
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Xatolik", 
          description: "Mukofot/jarima berishda xatolik yuz berdi", 
          variant: "destructive" 
        });
      }
    } finally {
      setIsSavingReward(false);
    }
  };

  const handleStudentClick = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentPopupOpen(true);
  };

  const handleReasonButtonClick = (student: Student) => {
    setReasonStudent(student);
    const currentAttendance = attendance[student.id];
    if (currentAttendance?.status === 'absent_with_reason') {
        setReasonText(currentAttendance.reason || '');
    } else {
        setReasonText('');
    }
    setIsReasonDialogOpen(true);
  };

  const handleSaveReason = () => {
    if (!reasonStudent) return;
    markAttendance(reasonStudent.id, 'absent_with_reason', reasonText || null);
    setIsReasonDialogOpen(false);
    setReasonStudent(null);
    setReasonText('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GroupDetailsHeader
        groupName={groupName}
        studentCount={students.length}
        onBack={onBack}
        onStudentImport={handleStudentImportComplete}
        isAddDialogOpen={isAddDialogOpen}
        onAddDialogOpenChange={setIsAddDialogOpen}
        newStudent={newStudent}
        onStudentChange={setNewStudent}
        onAddStudent={addStudent}
        teacherId={teacherId}
      />

      <AttendancePanel
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onMarkAllPresent={markAllAsPresent}
        onClearAll={clearAllAttendance}
      />

      <StudentTable
        students={students}
        attendance={attendance}
        onStudentClick={handleStudentClick}
        onMarkAttendance={markAttendance}
        onShowReward={setShowRewardDialog}
        onShowReason={handleReasonButtonClick}
        onAddStudentClick={() => setIsAddDialogOpen(true)}
      />

      <StudentDialogs
        showRewardDialog={showRewardDialog}
        setShowRewardDialog={setShowRewardDialog}
        rewardPoints={rewardPoints}
        setRewardPoints={setRewardPoints}
        rewardType={rewardType}
        setRewardType={setRewardType}
        onRewardSave={addReward}
        isSaving={isSavingReward}
        isReasonDialogOpen={isReasonDialogOpen}
        setReasonDialogOpen={setIsReasonDialogOpen}
        reasonStudent={reasonStudent}
        reasonText={reasonText}
        setReasonText={setReasonText}
        onReasonSave={handleSaveReason}
      />

      <StudentDetailsPopup
        studentId={selectedStudentId}
        isOpen={isStudentPopupOpen}
        onClose={() => {
          setIsStudentPopupOpen(false);
          setSelectedStudentId(null);
        }}
        teacherId={teacherId}
      />
    </div>
  );
};

export default GroupDetails;
