import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Users, CheckCircle, Clock, XCircle, Gift, Calendar, RotateCcw, Star, AlertTriangle, ShieldQuestion } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import StudentImport from './StudentImport';
import StudentDetailsPopup from './StudentDetailsPopup';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

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

type AttendanceStatus = 'present' | 'absent' | 'late' | 'absent_with_reason';

interface AttendanceRecord {
  id: string;
  student_id: string;
  teacher_id: string;
  date: string;
  status: AttendanceStatus;
  reason?: string | null;
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
  const [attendance, setAttendance] = useState<Record<string, { status: AttendanceStatus; reason?: string | null }>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showRewardDialog, setShowRewardDialog] = useState<string | null>(null);
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

  const commonReasons = ["Kasallik", "Oilaviy sharoit", "Test/Imtihon", "Boshqa"];

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

      // Fetch reward/penalty points for each student
      const studentIds = studentsData?.map(s => s.id) || [];
      if (studentIds.length > 0) {
        const { data: scoresData, error: scoresError } = await supabase
          .from('student_scores')
          .select('student_id, reward_penalty_points')
          .in('student_id', studentIds)
          .eq('teacher_id', teacherId);

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
      const { error } = await supabase
        .from('reward_penalty_history')
        .insert({
          student_id: studentId,
          teacher_id: teacherId,
          points: rewardType === 'penalty' ? -Math.abs(points) : Math.abs(points),
          reason: rewardType === 'reward' ? 'Mukofot' : 'Jarima',
          type: rewardType
        });

      if (error) throw error;

      setShowRewardDialog(null);
      setRewardPoints('');
      await fetchStudents(); // Refresh to show updated reward points
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error adding reward/penalty:', error);
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

  const getButtonStyle = (studentId: string, targetStatus: AttendanceStatus) => {
    const currentStatus = attendance[studentId]?.status;
    const isActive = currentStatus === targetStatus;
    
    const baseStyle = 'w-10 h-10 p-0 border border-gray-300';
    
    if (!isActive) {
      return `${baseStyle} bg-white hover:bg-gray-50 text-gray-600`;
    }
    
    switch (targetStatus) {
      case 'present':
        return `${baseStyle} bg-green-500 hover:bg-green-600 text-white border-green-500`;
      case 'late':
        return `${baseStyle} bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500`;
      case 'absent':
        return `${baseStyle} bg-red-500 hover:bg-red-600 text-white border-red-500`;
      case 'absent_with_reason':
        return `${baseStyle} bg-blue-500 hover:bg-blue-600 text-white border-blue-500`;
      default:
        return `${baseStyle} bg-white hover:bg-gray-50 text-gray-600`;
    }
  };

  const getRewardDisplay = (points: number) => {
    if (points === 0) return null;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        points > 0 
          ? 'bg-green-100 text-green-800 border border-green-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        {points > 0 ? '+' : ''}{points}
      </span>
    );
  };

  const getRewardIcon = (points: number) => {
    if (points === 0) return null;
    if (points > 0) return <Star className="w-4 h-4 text-yellow-500" />;
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onBack} variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ortga qaytish</TooltipContent>
          </Tooltip>
          <div>
            <h2 className="text-2xl font-bold">{groupName}</h2>
            <p className="text-muted-foreground">{students.length} o'quvchi</p>
          </div>
        </div>
        <div className="flex gap-2">
          <StudentImport 
            teacherId={teacherId} 
            groupName={groupName}
            onImportComplete={() => {
              fetchStudents();
              fetchAttendanceForDate(selectedDate);
              if (onStatsUpdate) onStatsUpdate();
            }}
          />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="apple-button">
                    <Plus className="w-4 h-4 mr-2" />
                    O'quvchi qo'shish
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Guruhga yangi o'quvchi qo'shish</TooltipContent>
              </Tooltip>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Yangi o'quvchi qo'shish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="studentName">O'quvchi nomi *</Label>
                  <Input
                    id="studentName"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="To'liq ism sharif"
                  />
                </div>
                <div>
                  <Label htmlFor="studentId">O'quvchi ID</Label>
                  <Input
                    id="studentId"
                    value={newStudent.student_id}
                    onChange={(e) => setNewStudent({ ...newStudent, student_id: e.target.value })}
                    placeholder="Masalan: 2024001"
                  />
                </div>
                <div>
                  <Label htmlFor="studentEmail">Email</Label>
                  <Input
                    id="studentEmail"
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    placeholder="student@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="studentPhone">Telefon</Label>
                  <Input
                    id="studentPhone"
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                  />
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
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={markAllAsPresent}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Barchani kelgan deb belgilash
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Barcha o'quvchilarni “kelgan” sifatida belgilash</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={clearAllAttendance}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Belgilarni tozalash
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Barcha davomat statuslarini tozalash</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
        {students.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
            <p className="text-muted-foreground mb-4">
              Guruhga o'quvchilarni qo'shing
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setIsAddDialogOpen(true)} className="apple-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Birinchi o'quvchini qo'shish
                </Button>
              </TooltipTrigger>
              <TooltipContent>Guruhga yangi o'quvchi qo'shish</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {students.map(student => (
              <div key={student.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleStudentClick(student.id)}
                    className="flex items-center space-x-4 hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center relative">
                      <span className="text-sm font-medium">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </span>
                      {student.rewardPenaltyPoints !== undefined && student.rewardPenaltyPoints !== 0 && (
                        <div className="absolute -top-1 -right-1">
                          {getRewardIcon(student.rewardPenaltyPoints)}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{student.name}</h3>
                        {student.rewardPenaltyPoints !== undefined && getRewardDisplay(student.rewardPenaltyPoints)}
                      </div>
                      {student.student_id && (
                        <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
                      )}
                    </div>
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={() => markAttendance(student.id, 'present')}
                        className={getButtonStyle(student.id, 'present')}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Keldi</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={() => markAttendance(student.id, 'late')}
                        className={getButtonStyle(student.id, 'late')}
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Kechikdi</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={() => markAttendance(student.id, 'absent')}
                        className={getButtonStyle(student.id, 'absent')}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Kelmagan</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={() => handleReasonButtonClick(student)}
                        className={getButtonStyle(student.id, 'absent_with_reason')}
                      >
                        <ShieldQuestion className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sababli kelmagan</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowRewardDialog(student.id)}
                        title="Mukofot/Jarima berish"
                      >
                        <Gift className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mukofot/Jarima berish</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Reward Dialog */}
      {showRewardDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Mukofot/Jarima berish</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setRewardType('reward')}
                  variant={rewardType === 'reward' ? 'default' : 'outline'}
                  className="flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4" />
                  Mukofot
                </Button>
                <Button
                  onClick={() => setRewardType('penalty')}
                  variant={rewardType === 'penalty' ? 'default' : 'outline'}
                  className="flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Jarima
                </Button>
              </div>
              <div>
                <label className="text-sm font-medium">
                  Ball miqdori (maksimum {rewardType === 'reward' ? '+5' : '-5'})
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5"
                  value={rewardPoints}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value <= 5) {
                      setRewardPoints(e.target.value);
                    }
                  }}
                  placeholder="Masalan: 3"
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => addReward(showRewardDialog)}
                  className="flex-1"
                  disabled={!rewardPoints || parseFloat(rewardPoints) > 5 || parseFloat(rewardPoints) <= 0}
                >
                  Saqlash
                </Button>
                <Button
                  onClick={() => {
                    setShowRewardDialog(null);
                    setRewardPoints('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Bekor qilish
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reason Dialog */}
      <Dialog open={isReasonDialogOpen} onOpenChange={setIsReasonDialogOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Sababli kelmaganini belgilash</DialogTitle>
                <DialogDescription>
                    {reasonStudent?.name} uchun dars qoldirish sababini tanlang yoki kiriting. Izoh qoldirish ixtiyoriy.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
                <div className="flex flex-wrap gap-2">
                    {commonReasons.map(reason => (
                        <Button key={reason} variant={reasonText === reason ? "default" : "outline"} onClick={() => setReasonText(reason)}>
                            {reason}
                        </Button>
                    ))}
                </div>
                <div>
                    <Label htmlFor="reason-text" className="sr-only">Izoh</Label>
                    <Textarea
                        id="reason-text"
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        placeholder="Yoki o'zingiz sabab kiriting..."
                        rows={3}
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setIsReasonDialogOpen(false); setReasonText(''); }}>Bekor qilish</Button>
                    <Button onClick={handleSaveReason}>Saqlash</Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* Student Details Popup */}
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
