import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, Calendar, BookOpen, Settings, LogOut, BarChart3, Trophy, Archive, Layers, Menu, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AttendanceTracker from './AttendanceTracker';
import StudentManager from './StudentManager';
import Statistics from './Statistics';
import GroupManager from './GroupManager';
import StudentRankings from './StudentRankings';
import ArchiveManager from './ArchiveManager';

interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  school: string;
  created_at: string;
}

interface DashboardProps {
  teacher: Teacher;
  onLogout: () => void;
}

type ActiveView = 'overview' | 'groups' | 'attendance' | 'students' | 'rankings' | 'statistics' | 'archive' | 'profile';

const Dashboard: React.FC<DashboardProps> = ({ teacher, onLogout }) => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    totalGroups: 0,
    averageAttendance: 0
  });

  useEffect(() => {
    fetchStats();
  }, [teacher.id]);

  const fetchStats = async () => {
    try {
      // Jami o'quvchilar
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, group_name')
        .eq('teacher_id', teacher.id)
        .eq('is_active', true);

      if (studentsError) throw studentsError;

      // Bugungi davomat
      const today = new Date().toISOString().split('T')[0];
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('id, status')
        .eq('teacher_id', teacher.id)
        .eq('date', today);

      if (attendanceError) throw attendanceError;

      // Faol guruhlar
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id')
        .eq('teacher_id', teacher.id)
        .eq('is_active', true);

      if (groupsError) throw groupsError;

      // O'rtacha davomat (oxirgi 30 kun)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: allAttendance, error: allAttendanceError } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('teacher_id', teacher.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

      if (allAttendanceError) throw allAttendanceError;

      const totalStudents = students?.length || 0;
      const presentToday = attendance?.filter(a => a.status === 'present').length || 0;
      const totalGroups = groups?.length || 0;
      
      const totalRecords = allAttendance?.length || 0;
      const presentRecords = allAttendance?.filter(a => a.status === 'present').length || 0;
      const averageAttendance = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

      setStats({
        totalStudents,
        presentToday,
        totalGroups,
        averageAttendance
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const statsData = [
    {
      title: 'Jami o\'quvchilar',
      value: stats.totalStudents,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Bugun kelgan',
      value: stats.presentToday,
      icon: UserCheck,
      color: 'bg-green-500'
    },
    {
      title: 'Faol guruhlar',
      value: stats.totalGroups,
      icon: BookOpen,
      color: 'bg-purple-500'
    },
    {
      title: 'O\'rtacha davomat',
      value: `${stats.averageAttendance}%`,
      icon: BarChart3,
      color: 'bg-orange-500'
    }
  ];

  const menuItems = [
    { id: 'overview', label: 'Umumiy ko\'rinish', icon: BookOpen },
    { id: 'groups', label: 'Guruhlar', icon: Layers },
    { id: 'students', label: 'O\'quvchilar', icon: Users },
    { id: 'attendance', label: 'Davomat', icon: UserCheck },
    { id: 'rankings', label: 'Reyting', icon: Trophy },
    { id: 'statistics', label: 'Statistika', icon: BarChart3 },
    { id: 'archive', label: 'Arxiv', icon: Archive },
    { id: 'profile', label: 'Profil', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'groups':
        return <GroupManager teacherId={teacher.id} onStatsUpdate={fetchStats} />;
      case 'attendance':
        return <AttendanceTracker teacherId={teacher.id} onStatsUpdate={fetchStats} />;
      case 'students':
        return <StudentManager teacherId={teacher.id} />;
      case 'rankings':
        return <StudentRankings teacherId={teacher.id} />;
      case 'statistics':
        return <Statistics teacherId={teacher.id} />;
      case 'archive':
        return <ArchiveManager teacherId={teacher.id} onStatsUpdate={fetchStats} />;
      case 'profile':
        return (
          <Card className="apple-card p-6">
            <h2 className="text-xl font-semibold mb-6">O'qituvchi profili</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Ism</label>
                <p className="text-lg">{teacher.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-lg">{teacher.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Maktab</label>
                <p className="text-lg">{teacher.school}</p>
              </div>
              {teacher.phone && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefon</label>
                  <p className="text-lg">{teacher.phone}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Ro'yxatdan o'tgan sana</label>
                <p className="text-lg">{new Date(teacher.created_at).toLocaleDateString('uz-UZ')}</p>
              </div>
            </div>
          </Card>
        );
      default:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statsData.map((stat, index) => (
                <Card key={index} className="apple-card p-6">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-xl ${stat.color} mr-4`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="apple-card p-6">
                <h3 className="text-lg font-semibold mb-4">Tezkor amallar</h3>
                <div className="space-y-3">
                  <Button 
                    onClick={() => setActiveView('groups')}
                    className="w-full apple-button-secondary justify-start"
                  >
                    <Layers className="w-4 h-4 mr-2" />
                    Guruh yaratish
                  </Button>
                  <Button 
                    onClick={() => setActiveView('students')}
                    className="w-full apple-button-secondary justify-start"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    O'quvchi qo'shish
                  </Button>
                  <Button 
                    onClick={() => setActiveView('attendance')}
                    className="w-full apple-button-secondary justify-start"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Davomat olish
                  </Button>
                  <Button 
                    onClick={() => setActiveView('statistics')}
                    className="w-full apple-button-secondary justify-start"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Statistika ko'rish
                  </Button>
                </div>
              </Card>

              <Card className="apple-card p-6">
                <h3 className="text-lg font-semibold mb-4">Oxirgi faoliyat</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Platforma ma'lumotlar bazasiga ulandi</span>
                    <span className="text-muted-foreground">Hozir</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Yangi funksiyalar qo'shildi</span>
                    <span className="text-muted-foreground">Bugun</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>TeachPro tizimiga xush kelibsiz!</span>
                    <span className="text-muted-foreground">Bugun</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Qo'llanma */}
            <Card className="apple-card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <h3 className="text-lg font-semibold mb-4 text-blue-900">Qo'llanma</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">1. Guruhlar yarating</h4>
                  <p className="text-blue-700">Birinchi bo'lib sinflaringizni yarating va ularni boshqaring.</p>
                </div>
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">2. O'quvchilarni qo'shing</h4>
                  <p className="text-blue-700">Har bir guruhga o'quvchilarni qo'shing yoki import qiling.</p>
                </div>
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">3. Davomat oling</h4>
                  <p className="text-blue-700">Har kuni o'quvchilaringizning davomatini belgilang.</p>
                </div>
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">4. Statistikani kuzating</h4>
                  <p className="text-blue-700">Davomat statistikasini tahlil qiling va hisobotlar ko'ring.</p>
                </div>
              </div>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="bg-white border-b border-border/50 px-4 py-4 lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              variant="ghost" 
              size="sm"
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">TeachPro</h1>
            </div>
          </div>
          <Button onClick={onLogout} variant="ghost" size="sm">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="bg-white border-b border-border/50 px-4 py-4 hidden lg:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
              variant="ghost" 
              size="sm"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">TeachPro</h1>
              <p className="text-sm text-muted-foreground">Xush kelibsiz, {teacher.name}</p>
            </div>
          </div>
          <Button onClick={onLogout} variant="ghost" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Chiqish
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed lg:relative bg-white border-r border-border/50 min-h-screen p-4 z-50 transition-all duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
          ${sidebarCollapsed ? 'w-20' : 'w-64'}
        `}>
          <nav className="space-y-2 mt-4 lg:mt-0">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id as ActiveView);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-colors ${
                  activeView === item.id
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 p-4 lg:p-6 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-0' : 'lg:ml-0'
        }`}>
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
