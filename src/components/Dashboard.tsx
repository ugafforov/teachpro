
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, Calendar, BookOpen, Settings, LogOut, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AttendanceTracker from './AttendanceTracker';
import StudentManager from './StudentManager';
import Statistics from './Statistics';

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

type ActiveView = 'overview' | 'attendance' | 'students' | 'statistics' | 'profile';

const Dashboard: React.FC<DashboardProps> = ({ teacher, onLogout }) => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    totalGroups: 0
  });

  useEffect(() => {
    fetchStats();
  }, [teacher.id]);

  const fetchStats = async () => {
    try {
      // Get total students
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, group_name')
        .eq('teacher_id', teacher.id);

      if (studentsError) throw studentsError;

      // Get today's attendance
      const today = new Date().toISOString().split('T')[0];
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('teacher_id', teacher.id)
        .eq('date', today)
        .eq('status', 'present');

      if (attendanceError) throw attendanceError;

      const totalStudents = students?.length || 0;
      const presentToday = attendance?.length || 0;
      const totalGroups = new Set(students?.map(s => s.group_name)).size;

      setStats({
        totalStudents,
        presentToday,
        totalGroups
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const statsData = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Present Today',
      value: stats.presentToday,
      icon: UserCheck,
      color: 'bg-green-500'
    },
    {
      title: 'Classes This Week',
      value: 5,
      icon: Calendar,
      color: 'bg-purple-500'
    },
    {
      title: 'Active Groups',
      value: stats.totalGroups,
      icon: BookOpen,
      color: 'bg-orange-500'
    }
  ];

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'attendance', label: 'Attendance', icon: UserCheck },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'attendance':
        return <AttendanceTracker teacherId={teacher.id} onStatsUpdate={fetchStats} />;
      case 'students':
        return <StudentManager teacherId={teacher.id} onStatsUpdate={fetchStats} />;
      case 'statistics':
        return <Statistics teacherId={teacher.id} />;
      case 'profile':
        return (
          <Card className="apple-card p-6">
            <h2 className="text-xl font-semibold mb-6">Teacher Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-lg">{teacher.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-lg">{teacher.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">School</label>
                <p className="text-lg">{teacher.school}</p>
              </div>
              {teacher.phone && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="text-lg">{teacher.phone}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Member Since</label>
                <p className="text-lg">{new Date(teacher.created_at).toLocaleDateString()}</p>
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
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button 
                    onClick={() => setActiveView('attendance')}
                    className="w-full apple-button-secondary justify-start"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Take Attendance
                  </Button>
                  <Button 
                    onClick={() => setActiveView('students')}
                    className="w-full apple-button-secondary justify-start"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Manage Students
                  </Button>
                  <Button 
                    onClick={() => setActiveView('statistics')}
                    className="w-full apple-button-secondary justify-start"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Statistics
                  </Button>
                </div>
              </Card>

              <Card className="apple-card p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Platform connected to database</span>
                    <span className="text-muted-foreground">Just now</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Profile created</span>
                    <span className="text-muted-foreground">Today</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Welcome to TeachPro!</span>
                    <span className="text-muted-foreground">Today</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border/50 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">TeachPro</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {teacher.name}</p>
            </div>
          </div>
          <Button onClick={onLogout} variant="ghost" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-border/50 min-h-screen p-4">
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as ActiveView)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-colors ${
                  activeView === item.id
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
