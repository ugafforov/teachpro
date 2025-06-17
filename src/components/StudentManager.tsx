import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, GraduationCap, Search, LayoutGrid, List } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import StudentFilters from './student/StudentFilters';
import StudentGridItem from './student/StudentGridItem';
import StudentListItem from './student/StudentListItem';
import AddStudentDialog from './student/AddStudentDialog';
import EditStudentDialog from './student/EditStudentDialog';
import RewardDialog from './student/RewardDialog';

export interface Student {
  id: string;
  name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name: string;
  teacher_id: string;
  created_at: string;
  rewardPenaltyPoints?: number;
  attendancePercentage?: number;
}

export interface Group {
  id: string;
  name: string;
}

export interface NewStudent {
  name: string;
  student_id: string;
  email: string;
  phone: string;
  group_name: string;
}

interface StudentManagerProps {
  teacherId: string;
  onStatsUpdate: () => Promise<void>;
}

const StudentManager: React.FC<StudentManagerProps> = ({
  teacherId,
  onStatsUpdate,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'group' | 'points' | 'attendance'>('name');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRewardDialogOpen, setIsRewardDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchGroups();
    fetchStudents();
  }, [teacherId]);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, selectedGroup, sortBy]);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('name');

      if (studentsError) throw studentsError;

      // Get reward/penalty points and attendance for each student
      const studentIds = studentsData?.map(s => s.id) || [];
      
      let studentsWithStats = studentsData || [];
      
      if (studentIds.length > 0) {
        // Get scores
        const { data: scoresData, error: scoresError } = await supabase
          .from('student_scores')
          .select('student_id, total_score')
          .in('student_id', studentIds)
          .eq('teacher_id', teacherId);

        if (scoresError) throw scoresError;

        // Get attendance stats
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance_records')
          .select('student_id, status')
          .in('student_id', studentIds)
          .eq('teacher_id', teacherId);

        if (attendanceError) throw attendanceError;

        // Calculate attendance percentages
        const attendanceStats: Record<string, { total: number; present: number }> = {};
        
        attendanceData?.forEach(record => {
          if (!attendanceStats[record.student_id]) {
            attendanceStats[record.student_id] = { total: 0, present: 0 };
          }
          attendanceStats[record.student_id].total++;
          if (record.status === 'present' || record.status === 'late') {
            attendanceStats[record.student_id].present++;
          }
        });

        studentsWithStats = studentsData?.map(student => ({
          ...student,
          rewardPenaltyPoints: scoresData?.find(s => s.student_id === student.id)?.total_score || 0,
          attendancePercentage: attendanceStats[student.id] 
            ? Math.round((attendanceStats[student.id].present / attendanceStats[student.id].total) * 100)
            : 0
        })) || [];
      }

      setStudents(studentsWithStats);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = [...students];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.group_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by group
    if (selectedGroup !== 'all') {
      filtered = filtered.filter(student => student.group_name === selectedGroup);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'group':
          return a.group_name.localeCompare(b.group_name);
        case 'points':
          return (b.rewardPenaltyPoints || 0) - (a.rewardPenaltyPoints || 0);
        case 'attendance':
          return (b.attendancePercentage || 0) - (a.attendancePercentage || 0);
        default:
          return 0;
      }
    });

    setFilteredStudents(filtered);
  };

  const handleAddStudent = async (studentData: any) => {
    try {
      const { error } = await supabase
        .from('students')
        .insert({
          teacher_id: teacherId,
          ...studentData
        });

      if (error) throw error;

      await fetchStudents();
      await onStatsUpdate();
      setIsAddDialogOpen(false);

      toast({
        title: "Muvaffaqiyat",
        description: "O'quvchi muvaffaqiyatli qo'shildi",
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

  const handleEditStudent = async (studentData: any) => {
    if (!selectedStudent) return;

    try {
      const { error } = await supabase
        .from('students')
        .update(studentData)
        .eq('id', selectedStudent.id);

      if (error) throw error;

      await fetchStudents();
      await onStatsUpdate();
      setIsEditDialogOpen(false);
      setSelectedStudent(null);

      toast({
        title: "Muvaffaqiyat",
        description: "O'quvchi ma'lumotlari yangilandi",
      });
    } catch (error) {
      console.error('Error updating student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchi ma'lumotlarini yangilashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const handleReward = async (points: number, type: 'reward' | 'penalty', reason: string) => {
    if (!selectedStudent) return;

    try {
      const { error } = await supabase
        .from('reward_penalty_history')
        .insert({
          student_id: selectedStudent.id,
          teacher_id: teacherId,
          points: type === 'penalty' ? -Math.abs(points) : Math.abs(points),
          reason,
          type,
          date_given: new Date().toISOString().split('T')[0]
        });

      if (error) throw error;

      await fetchStudents();
      await onStatsUpdate();
      setIsRewardDialogOpen(false);
      setSelectedStudent(null);

      toast({
        title: "Muvaffaqiyat",
        description: `${type === 'reward' ? 'Mukofot' : 'Jarima'} muvaffaqiyatli berildi`,
      });
    } catch (error) {
      console.error('Error adding reward/penalty:', error);
      toast({
        title: "Xatolik",
        description: "Mukofot/jarima berishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_active: false })
        .eq('id', studentId);

      if (error) throw error;

      await fetchStudents();
      await onStatsUpdate();

      toast({
        title: "Muvaffaqiyat",
        description: "O'quvchi o'chirildi",
      });
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini o'chirishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
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
        <div>
          <h2 className="text-2xl font-bold text-gray-900">O'quvchilar boshqaruvi</h2>
          <p className="text-gray-600">Barcha o'quvchilaringizni boshqaring</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={viewMode === 'grid' ? 'default' : 'outline'} 
                  onClick={() => setViewMode('grid')} 
                  size="icon"
                >
                  <LayoutGrid />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Setka ko'rinishi</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={viewMode === 'list' ? 'default' : 'outline'} 
                  onClick={() => setViewMode('list')} 
                  size="icon"
                >
                  <List />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ro'yxat ko'rinishi</TooltipContent>
            </Tooltip>
          </div>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-black text-white hover:bg-gray-800"
          >
            <Plus className="w-4 h-4 mr-2" />
            O'quvchi qo'shish
          </Button>
        </div>
      </div>

      <StudentFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedGroup={selectedGroup}
        onGroupChange={setSelectedGroup}
        sortBy={sortBy}
        onSortChange={setSortBy}
        groups={groups}
      />

      {filteredStudents.length === 0 ? (
        <Card className="p-12 text-center bg-white border border-gray-200 rounded-lg">
          <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
          <p className="text-gray-600 mb-4">
            {students.length === 0 
              ? "Birinchi o'quvchingizni qo'shing"
              : "Qidiruv shartlariga mos o'quvchi topilmadi"
            }
          </p>
          {students.length === 0 && (
            <Button 
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-black text-white hover:bg-gray-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              Birinchi o'quvchini qo'shish
            </Button>
          )}
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map((student) => (
            <StudentGridItem
              key={student.id}
              student={student}
              onEdit={(student) => {
                setSelectedStudent(student);
                setIsEditDialogOpen(true);
              }}
              onReward={(student) => {
                setSelectedStudent(student);
                setIsRewardDialogOpen(true);
              }}
              onDelete={handleDeleteStudent}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStudents.map((student) => (
            <StudentListItem
              key={student.id}
              student={student}
              onEdit={(student) => {
                setSelectedStudent(student);
                setIsEditDialogOpen(true);
              }}
              onReward={(student) => {
                setSelectedStudent(student);
                setIsRewardDialogOpen(true);
              }}
              onDelete={handleDeleteStudent}
            />
          ))}
        </div>
      )}

      <AddStudentDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={handleAddStudent}
        groups={groups}
      />

      <EditStudentDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedStudent(null);
        }}
        onEdit={handleEditStudent}
        student={selectedStudent}
        groups={groups}
      />

      <RewardDialog
        isOpen={isRewardDialogOpen}
        onClose={() => {
          setIsRewardDialogOpen(false);
          setSelectedStudent(null);
        }}
        onReward={handleReward}
        student={selectedStudent}
      />
    </div>
  );
};

export default StudentManager;
