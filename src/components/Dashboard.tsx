
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, Calendar, BookOpen, Settings, LogOut } from 'lucide-react';
import AttendanceTracker from './AttendanceTracker';
import StudentManager from './StudentManager';

interface Teacher {
  name: string;
  email: string;
  phone: string;
  school: string;
  registeredAt: string;
}

interface DashboardProps {
  teacher: Teacher;
  onLogout: () => void;
}

type ActiveView = 'overview' | 'attendance' | 'students' | 'profile';

const Dashboard: React.FC<DashboardProps> = ({ teacher, onLogout }) => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');

  const stats = [
    {
      title: 'Total Students',
      value: JSON.parse(localStorage.getItem('students') || '[]').length,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Present Today',
      value: JSON.parse(localStorage.getItem('attendanceRecords') || '[]')
        .filter((record: any) => {
          const today = new Date().toDateString();
          return new Date(record.date).toDateString() === today && record.status === 'present';
        }).length,
      icon: UserCheck,
      color: 'bg-green-500'
    },
    {
      title: 'Classes This Week',
      value: 12,
      icon: Calendar,
      color: 'bg-purple-500'
    },
    {
      title: 'Active Groups',
      value: new Set(JSON.parse(localStorage.getItem('students') || '[]').map((s: any) => s.group)).size,
      icon: BookOpen,
      color: 'bg-orange-500'
    }
  ];

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'attendance', label: 'Attendance', icon: UserCheck },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'profile', label: 'Profile', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'attendance':
        return <AttendanceTracker />;
      case 'students':
        return <StudentManager />;
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
                <p className="text-lg">{new Date(teacher.registeredAt).toLocaleDateString()}</p>
              </div>
            </div>
          </Card>
        );
      default:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
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
                </div>
              </Card>

              <Card className="apple-card p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Attendance taken for Group A</span>
                    <span className="text-muted-foreground">2 hours ago</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>5 new students added</span>
                    <span className="text-muted-foreground">1 day ago</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Profile updated</span>
                    <span className="text-muted-foreground">3 days ago</span>
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
