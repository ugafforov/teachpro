import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen, TrendingUp, Trophy, LogOut, Archive, BarChart3, Trash2, Menu, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GroupManager from './GroupManager';
import StudentManager from './StudentManager';
import Statistics from './Statistics';
import StudentRankings from './StudentRankings';
import ArchiveManager from './ArchiveManager';
import TrashManager from './TrashManager';

interface DashboardProps {
  teacherId: string;
  teacherName?: string;
  onLogout: () => void;
}

interface Stats {
  totalStudents: number;
  totalGroups: number;
  averageAttendance: number;
  topStudent: string;
}

const Dashboard: React.FC<DashboardProps> = ({ teacherId, teacherName, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalGroups: 0,
    averageAttendance: 0,
    topStudent: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [teacherId]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Faqat faol o'quvchilar sonini olish
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (studentsError) throw studentsError;

      // Faqat faol guruhlar sonini olish
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (groupsError) throw groupsError;

      const totalStudents = studentsData?.length || 0;
      const totalGroups = groupsData?.length || 0;

      // O'rtacha davomatni hisoblash (faqat faol o'quvchilar uchun)
      let averageAttendance = 0;
      if (totalStudents > 0) {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance_records')
          .select(`
            status,
            students!inner(is_active)
          `)
          .eq('teacher_id', teacherId)
          .eq('students.is_active', true);

        if (attendanceError) throw attendanceError;

        const totalRecords = attendanceData?.length || 0;
        const presentRecords = attendanceData?.filter(a => a.status === 'present' || a.status === 'late').length || 0;
        averageAttendance = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0;
      }

      // Eng yaxshi o'quvchini topish (faqat faol o'quvchilar orasidan)
      const { data: topStudentData, error: topStudentError } = await supabase
        .from('student_scores')
        .select(`
          student_id, 
          total_score, 
          students!inner(name, is_active)
        `)
        .eq('teacher_id', teacherId)
        .eq('students.is_active', true)
        .order('total_score', { ascending: false })
        .limit(1);

      if (topStudentError) throw topStudentError;

      const topStudent = topStudentData?.[0]?.students?.name || 'Ma\'lumot yo\'q';

      setStats({
        totalStudents,
        totalGroups,
        averageAttendance: Math.round(averageAttendance * 100) / 100,
        topStudent
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupSelect = (groupName: string) => {
    // For now, we can just log the selected group
    // This could be extended to navigate to group details or perform other actions
    console.log('Selected group:', groupName);
  };

  const menuItems = [
    { id: 'overview', label: 'Umumiy ko\'rinish', icon: BookOpen },
    { id: 'groups', label: 'Guruhlar', icon: Users },
    { id: 'students', label: 'O\'quvchilar', icon: Users },
    { id: 'rankings', label: 'Reyting', icon: Trophy },
    { id: 'statistics', label: 'Statistika', icon: BarChart3 },
    { id: 'archive', label: 'Arxiv', icon: Archive },
    { id: 'trash', label: 'Chiqindilar qutisi', icon: Trash2 },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'groups':
        return <GroupManager teacherId={teacherId} onGroupSelect={handleGroupSelect} onStatsUpdate={fetchStats} />;
      case 'students':
        return <StudentManager teacherId={teacherId} onStatsUpdate={fetchStats} />;
      case 'rankings':
        return <StudentRankings teacherId={teacherId} />;
      case 'statistics':
        return <Statistics teacherId={teacherId} />;
      case 'archive':
        return <ArchiveManager teacherId={teacherId} onStatsUpdate={fetchStats} />;
      case 'trash':
        return <TrashManager teacherId={teacherId} onStatsUpdate={fetchStats} />;
      default:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Umumiy ko'rinish</h2>
              <p className="text-muted-foreground">Sinflaringiz va o'quvchilaringiz statistikasi</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="apple-card p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.totalStudents}</p>
                      <p className="text-sm text-muted-foreground">Jami o'quvchilar</p>
                    </div>
                  </div>
                </Card>

                <Card className="apple-card p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.totalGroups}</p>
                      <p className="text-sm text-muted-foreground">Faol guruhlar</p>
                    </div>
                  </div>
                </Card>

                <Card className="apple-card p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.averageAttendance.toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">O'rtacha davomat</p>
                    </div>
                  </div>
                </Card>

                <Card className="apple-card p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold truncate">{stats.topStudent}</p>
                      <p className="text-sm text-muted-foreground">Eng yaxshi o'quvchi</p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            <Card className="p-6 bg-white shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Tezkor harakatlar</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={() => setActiveTab('groups')}
                  variant="outline"
                  className="h-16 flex flex-col gap-2"
                >
                  <Users className="w-5 h-5" />
                  <span>Guruhlarni boshqarish</span>
                </Button>
                <Button
                  onClick={() => setActiveTab('students')}
                  variant="outline"
                  className="h-16 flex flex-col gap-2"
                >
                  <Users className="w-5 h-5" />
                  <span>O'quvchilarni boshqarish</span>
                </Button>
                <Button
                  onClick={() => setActiveTab('statistics')}
                  variant="outline"
                  className="h-16 flex flex-col gap-2"
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>Statistikani ko'rish</span>
                </Button>
              </div>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">TeachPro</h1>
              {teacherName && (
                <p className="text-sm text-gray-600">Xush kelibsiz, {teacherName}</p>
              )}
            </div>
          </div>
        </div>
        
        <Button 
          onClick={onLogout} 
          variant="ghost"
          className="flex items-center space-x-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Chiqish</span>
        </Button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`
          ${sidebarCollapsed ? 'w-16' : 'w-64'} 
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          bg-white shadow-lg h-screen fixed lg:relative z-40 transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? '' : 'top-[73px]'} lg:top-0
        `}>
          <nav className="mt-6 pb-20 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center px-6 py-3 text-left transition-colors ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  } ${sidebarCollapsed ? 'justify-center px-4' : ''}`}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span className="ml-3">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-0' : 'lg:ml-0'}`}>
          <div className="p-4 lg:p-8 bg-white min-h-screen">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
