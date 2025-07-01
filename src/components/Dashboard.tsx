
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Layers, 
  TrendingUp, 
  Calendar,
  BookOpen,
  Trash2,
  Archive,
  Settings,
  BarChart3,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import Statistics from './Statistics';
import GroupManager from './GroupManager';
import StudentManager from './StudentManager';
import AttendanceTracker from './AttendanceTracker';
import StudentRankings from './StudentRankings';
import TrashManager from './TrashManager';
import ArchiveManager from './ArchiveManager';
import GroupDetails from './GroupDetails';

interface Teacher {
  id: string;
  name: string;
  email: string;
  school: string;
  phone?: string;
}

interface Stats {
  totalStudents: number;
  totalGroups: number;
  todayPresent: number;
  thisWeekAvgAttendance: number;
}

const Dashboard: React.FC = () => {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [stats, setStats] = useState<Stats>({ totalStudents: 0, totalGroups: 0, todayPresent: 0, thisWeekAvgAttendance: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('statistics');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { toast } = useToast();

  const menuItems = [
    { id: 'statistics', label: 'Statistika', icon: BarChart3 },
    { id: 'groups', label: 'Guruhlar', icon: Layers },
    { id: 'students', label: 'O\'quvchilar', icon: Users },
    { id: 'attendance', label: 'Davomat', icon: Calendar },
    { id: 'rankings', label: 'Reyting', icon: TrendingUp },
    { id: 'archive', label: 'Arxiv', icon: Archive },
    { id: 'trash', label: 'Chiqindilar qutisi', icon: Trash2 },
  ];

  useEffect(() => {
    fetchTeacherData();
    fetchStats();
  }, []);

  const fetchTeacherData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      if (user) {
        const { data: teacherData, error: teacherError } = await supabase
          .from('teachers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (teacherError) throw teacherError;
        setTeacher(teacherData);
      }
    } catch (error) {
      console.error('Error fetching teacher data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!teacherData) return;

      const teacherId = teacherData.id;

      const [studentsResult, groupsResult, attendanceResult] = await Promise.all([
        supabase.from('students').select('id').eq('teacher_id', teacherId).eq('is_active', true),
        supabase.from('groups').select('id').eq('teacher_id', teacherId).eq('is_active', true),
        supabase.from('attendance_records')
          .select('status')
          .eq('teacher_id', teacherId)
          .eq('date', new Date().toISOString().split('T')[0])
      ]);

      const totalStudents = studentsResult.data?.length || 0;
      const totalGroups = groupsResult.data?.length || 0;
      const todayPresent = attendanceResult.data?.filter(record => 
        record.status === 'present' || record.status === 'late'
      ).length || 0;

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: weekAttendance } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('teacher_id', teacherId)
        .gte('date', oneWeekAgo.toISOString().split('T')[0]);

      const weekPresentCount = weekAttendance?.filter(record => 
        record.status === 'present' || record.status === 'late'
      ).length || 0;
      const weekTotalCount = weekAttendance?.length || 0;
      const thisWeekAvgAttendance = weekTotalCount > 0 ? (weekPresentCount / weekTotalCount) * 100 : 0;

      setStats({
        totalStudents,
        totalGroups,
        todayPresent,
        thisWeekAvgAttendance: Math.round(thisWeekAvgAttendance)
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Xatolik",
        description: "Chiqishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const handleGroupSelect = (groupName: string) => {
    setSelectedGroup(groupName);
    setActiveTab('group-details');
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
    setActiveTab('groups');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">O'qituvchi ma'lumotlari topilmadi</h2>
          <Button onClick={handleSignOut}>Qaytadan kirish</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <div className="flex h-screen max-w-full">
        {/* Mobile menu button */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="bg-white shadow-md"
          >
            {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>

        {/* Sidebar */}
        <div className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:relative inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out flex flex-col`}>
          
          <div className="flex items-center justify-center p-6 border-b border-gray-200">
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">TeachPro</h1>
              <p className="text-sm text-gray-600">{teacher.name}</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {menuItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className="w-full justify-start text-left h-12"
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Button>
              ))}
            </div>
          </nav>

          <div className="border-t border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-2">Maktab: {teacher.school}</div>
            <Button
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Chiqish
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full">
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 w-full max-w-full">
            <div className="max-w-full">
              {activeTab === 'statistics' && (
                <Statistics teacherId={teacher.id} />
              )}
              {activeTab === 'groups' && (
                <GroupManager 
                  teacherId={teacher.id} 
                  onGroupSelect={handleGroupSelect}
                  onStatsUpdate={fetchStats}
                />
              )}
              {activeTab === 'students' && (
                <StudentManager 
                  teacherId={teacher.id}
                  onStatsUpdate={fetchStats}
                />
              )}
              {activeTab === 'attendance' && (
                <AttendanceTracker 
                  teacherId={teacher.id}
                  onStatsUpdate={fetchStats}
                />
              )}
              {activeTab === 'rankings' && (
                <StudentRankings 
                  teacherId={teacher.id}
                />
              )}
              {activeTab === 'archive' && (
                <ArchiveManager 
                  teacherId={teacher.id}
                  onStatsUpdate={fetchStats}
                />
              )}
              {activeTab === 'trash' && (
                <TrashManager 
                  teacherId={teacher.id}
                  onStatsUpdate={fetchStats}
                />
              )}
              {activeTab === 'group-details' && selectedGroup && (
                <GroupDetails
                  groupName={selectedGroup}
                  teacherId={teacher.id}
                  onBack={handleBackToGroups}
                  onStatsUpdate={fetchStats}
                />
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-30 bg-black bg-opacity-50"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
