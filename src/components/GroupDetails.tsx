import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Upload, ArrowLeft, Check, X, Clock, Calendar, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface Student {
  id: string;
  name: string;
  group_name: string;
  is_active: boolean;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
}

interface GroupDetailsProps {
  groupName: string;
  teacherId: string;
  onBack: () => void;
  onStatsUpdate: () => Promise<void>;
}

const GroupDetails: React.FC<GroupDetailsProps> = ({ groupName, teacherId, onBack, onStatsUpdate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [bulkImportText, setBulkImportText] = useState('');
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    averageAttendance: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
  }, [groupName, teacherId]);

  useEffect(() => {
    if (students.length > 0) {
      fetchAttendanceRecords();
      fetchStats();
    }
  }, [selectedDate, students]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('group_name', groupName)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('date', selectedDate)
        .in('student_id', students.map(s => s.id));

      if (error) throw error;
      
      // Type assertion to ensure status is properly typed
      const typedRecords: AttendanceRecord[] = (data || []).map(record => ({
        ...record,
        status: record.status as 'present' | 'absent' | 'late'
      }));
      
      setAttendanceRecords(typedRecords);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const studentIds = students.map(s => s.id);
      
      // Bugungi davomat
      const { data: todayAttendance } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('teacher_id', teacherId)
        .eq('date', new Date().toISOString().split('T')[0])
        .in('student_id', studentIds);

      // O'rtacha davomat
      const { data: allAttendance } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('teacher_id', teacherId)
        .in('student_id', studentIds);

      const totalStudents = students.length;
      const presentToday = todayAttendance?.filter(a => a.status === 'present').length || 0;
      const totalRecords = allAttendance?.length || 0;
      const presentRecords = allAttendance?.filter(a => a.status === 'present').length || 0;
      const averageAttendance = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

      setStats({
        totalStudents,
        presentToday,
        averageAttendance
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const addStudent = async () => {
    if (!newStudentName.trim()) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "O'quvchi ismini kiriting",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .insert({
          teacher_id: teacherId,
          name: newStudentName.trim(),
          group_name: groupName
        });

      if (error) throw error;

      await fetchStudents();
      await onStatsUpdate();
      
      setNewStudentName('');
      setIsAddDialogOpen(false);
      
      toast({
        title: "O'quvchi qo'shildi",
        description: `${newStudentName} ${groupName} guruhiga qo'shildi`,
      });
    } catch (error) {
      console.error('Error adding student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchi qo'shishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const processBulkImport = async () => {
    if (!bulkImportText.trim()) {
      toast({
        title: "Ma'lumot yo'q",
        description: "O'quvchi ismlarini kiriting",
        variant: "destructive",
      });
      return;
    }

    const lines = bulkImportText.trim().split('\n');
    const studentsToInsert = lines
      .map(line => line.trim())
      .filter(name => name.length >= 2)
      .map(name => ({
        teacher_id: teacherId,
        name: name,
        group_name: groupName
      }));

    if (studentsToInsert.length > 0) {
      try {
        const { error } = await supabase
          .from('students')
          .insert(studentsToInsert);

        if (error) throw error;

        await fetchStudents();
        await onStatsUpdate();
        
        setBulkImportText('');
        setIsBulkImportOpen(false);
        
        toast({
          title: "Import tugallandi",
          description: `${studentsToInsert.length} o'quvchi ${groupName} guruhiga import qilindi`,
        });
      } catch (error) {
        console.error('Error importing students:', error);
        toast({
          title: "Import muvaffaqiyatsiz",
          description: "O'quvchilarni import qilishda xatolik yuz berdi",
          variant: "destructive",
        });
      }
    }
  };

  const markAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          student_id: studentId,
          teacher_id: teacherId,
          date: selectedDate,
          status: status
        }, {
          onConflict: 'student_id,date'
        });

      if (error) throw error;

      await fetchAttendanceRecords();
      await fetchStats();
      await onStatsUpdate();
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast({
        title: "Xatolik",
        description: "Davomatni yangilashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const getAttendanceStatus = (studentId: string) => {
    const record = attendanceRecords.find(record => record.student_id === studentId);
    return record?.status || null;
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'present': return 'text-green-700 bg-green-100';
      case 'absent': return 'text-red-700 bg-red-100';
      case 'late': return 'text-yellow-700 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getButtonClass = (currentStatus: string | null, buttonStatus: string) => {
    if (currentStatus === buttonStatus) {
      switch (buttonStatus) {
        case 'present': return 'attendance-button attendance-present-active';
        case 'late': return 'attendance-button attendance-late-active';
        case 'absent': return 'attendance-button attendance-absent-active';
        default: return 'attendance-button';
      }
    }
    
    switch (buttonStatus) {
      case 'present': return 'attendance-button attendance-present';
      case 'late': return 'attendance-button attendance-late';
      case 'absent': return 'attendance-button attendance-absent';
      default: return 'attendance-button';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Button onClick={onBack} variant="ghost" size="sm" className="hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{groupName} guruhi</h2>
            <p className="text-gray-600">Guruh tafsilotlari va davomat</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-gray-900">{groupName} guruhiga import qilish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-700">O'quvchi ismlarini kiriting</Label>
                  <Textarea
                    value={bulkImportText}
                    onChange={(e) => setBulkImportText(e.target.value)}
                    placeholder="Ahmadjon Karimov&#10;Farrux Yo'ldoshev&#10;Malika Abdullayeva"
                    rows={8}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={processBulkImport} className="bg-blue-500 hover:bg-blue-600 text-white flex-1">
                    Import qilish
                  </Button>
                  <Button onClick={() => setIsBulkImportOpen(false)} variant="outline" className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50">
                    Bekor qilish
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                O'quvchi qo'shish
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-gray-900">{groupName} guruhiga o'quvchi qo'shish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-gray-700">O'quvchi ismi *</Label>
                  <Input
                    id="name"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="O'quvchining to'liq ismi"
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={addStudent} className="bg-blue-500 hover:bg-blue-600 text-white flex-1">
                    Qo'shish
                  </Button>
                  <Button onClick={() => setIsAddDialogOpen(false)} variant="outline" className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50">
                    Bekor qilish
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistika */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-blue-500 mr-4">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Jami o'quvchilar</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-green-500 mr-4">
              <Check className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Bugun kelgan</p>
              <p className="text-2xl font-bold text-gray-900">{stats.presentToday}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-xl bg-blue-500 mr-4">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">O'rtacha davomat</p>
              <p className="text-2xl font-bold text-gray-900">{stats.averageAttendance}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Davomat olish */}
      <Card className="bg-white border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Davomat olish</h3>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Guruhda o'quvchilar yo'q</h3>
            <p className="text-gray-600 mb-4">
              Birinchi o'quvchini qo'shing
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              O'quvchi qo'shish
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map(student => {
              const status = getAttendanceStatus(student.id);
              return (
                <div key={student.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-700">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900">{student.name}</span>
                    {status && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                        {status === 'present' ? 'Keldi' : status === 'late' ? 'Kech qoldi' : 'Kelmadi'}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => markAttendance(student.id, 'present')}
                      className={getButtonClass(status, 'present')}
                      aria-label="Keldi"
                    >
                      <Check className="w-4 h-4 mx-auto" />
                    </button>
                    <button
                      onClick={() => markAttendance(student.id, 'late')}
                      className={getButtonClass(status, 'late')}
                      aria-label="Kech qoldi"
                    >
                      <Clock className="w-4 h-4 mx-auto" />
                    </button>
                    <button
                      onClick={() => markAttendance(student.id, 'absent')}
                      className={getButtonClass(status, 'absent')}
                      aria-label="Kelmadi"
                    >
                      <X className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default GroupDetails;
