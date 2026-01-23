import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, TrendingUp, Trophy, LogOut, Archive, Menu, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import GroupManager from './GroupManager';
import StudentManager from './StudentManager';
import StudentRankings from './StudentRankings';
import ArchiveManager from './ArchiveManager';
import ExamManager from './ExamManager';
import DataManager from './DataManager';
import StudentDetailView from './StudentDetailView';
import StudentProfileLink from './StudentProfileLink';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStatistics } from '@/components/statistics/hooks/useStatistics';
import MonthlyAnalysis from './statistics/MonthlyAnalysis';
import GroupRankings from './statistics/GroupRankings';

interface DashboardProps {
  teacherId: string;
  teacherName?: string;
  onLogout: () => void;
}


const Dashboard: React.FC<DashboardProps> = ({ teacherId, teacherName, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { studentId: routeStudentId } = useParams<{ studentId?: string }>();

  // When the URL changes (students/:id), we animate between the current view and student profile.
  const contentRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const isAnimatingRef = useRef(false);

  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const activeStudentIdRef = useRef<string | null>(null);

  const activeTabStorageKey = `tp:dashboard:activeTab:${teacherId}`;
  const selectedGroupStorageKey = `tp:groups:selectedGroup:${teacherId}`;

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem(activeTabStorageKey);
      return saved || 'overview';
    } catch {
      return 'overview';
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [groups, setGroups] = useState<Array<{ id: string, name: string }>>([]);

  const { stats: detailedStats, monthlyData, loading: statsLoading } = useStatistics(teacherId, selectedPeriod, selectedGroup);

  const handleStudentClick = useCallback((studentId: string) => {
    if (isAnimatingRef.current) return;
    
    isAnimatingRef.current = true;
    setActiveStudentId(studentId);
    activeStudentIdRef.current = studentId;
    
    // Navigate without page refresh - no animations
    navigate(`/students/${studentId}`, { 
      replace: false,
      state: { from: location.pathname + location.search }
    });
    
    // Reset animation flag after transition
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, 100);
  }, [navigate, location]);

  const handleBackClick = useCallback(() => {
    if (isAnimatingRef.current) return;
    
    isAnimatingRef.current = true;
    
    // Navigate immediately - no animations
    navigate(-1);
    
    // Clear state immediately to prevent conflicts
    setActiveStudentId(null);
    activeStudentIdRef.current = null;
    
    // Reset animation flag after a short delay
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, 100);
  }, [navigate]);

  // Enhanced context for student profile components
  const profileContext = {
    onBack: handleBackClick,
    isAnimating: isAnimatingRef.current
  };

  // Handle route changes for smooth transitions - simplified without animations
  useEffect(() => {
    if (routeStudentId && routeStudentId !== activeStudentIdRef.current) {
      if (isAnimatingRef.current) return;
      
      isAnimatingRef.current = true;
      setActiveStudentId(routeStudentId);
      activeStudentIdRef.current = routeStudentId;
      
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 100);
    } else if (!routeStudentId && activeStudentIdRef.current && !isAnimatingRef.current) {
      // Only clear state if not already handled by back click
      setActiveStudentId(null);
      activeStudentIdRef.current = null;
    }
  }, [routeStudentId]);

  useEffect(() => {
    fetchGroups();
  }, [teacherId]);

  useEffect(() => {
    const validTabIds = new Set([
      'overview',
      'groups',
      'students',
      'exams',
      'rankings',
      'archive',
      'data'
    ]);

    try {
      const saved = localStorage.getItem(activeTabStorageKey);
      if (saved && validTabIds.has(saved)) {
        setActiveTab(saved);
        return;
      }
    } catch {
      // ignore
    }

    if (!validTabIds.has(activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTabStorageKey, teacherId]);

  useEffect(() => {
    try {
      localStorage.setItem(activeTabStorageKey, activeTab);
    } catch {
      // ignore
    }

    if (activeTab !== 'groups') {
      try {
        localStorage.removeItem(selectedGroupStorageKey);
      } catch {
        // ignore
      }
    }
  }, [activeTab, activeTabStorageKey, selectedGroupStorageKey]);

  const fetchGroups = async () => {
    try {
      const q = query(
        collection(db, 'groups'),
        where('teacher_id', '==', teacherId),
        where('is_active', '==', true)
      );
      const snapshot = await getDocs(q);
      const groupsData = snapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
      setGroups(groupsData.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })));
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };


  const handleGroupSelect = (groupName: string) => {
    console.log('Selected group:', groupName);
  };

  const menuItems = [
    { id: 'overview', label: 'Umumiy ko\'rinish', icon: BookOpen },
    { id: 'groups', label: 'Guruhlar', icon: Users },
    { id: 'students', label: 'O\'quvchilar', icon: Users },
    { id: 'exams', label: 'Imtihonlar', icon: TrendingUp },
    { id: 'rankings', label: 'Reyting', icon: Trophy },
    { id: 'archive', label: 'Arxiv', icon: Archive },
    { id: 'data', label: 'Ma\'lumotlar', icon: Database },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'groups':
        return <GroupManager teacherId={teacherId} onGroupSelect={handleGroupSelect} onStatsUpdate={async () => { }} />;
      case 'students':
        return <StudentManager teacherId={teacherId} onStatsUpdate={async () => { }} />;
      case 'exams':
        return <ExamManager teacherId={teacherId} />;
      case 'rankings':
        return <StudentRankings teacherId={teacherId} />;
      case 'archive':
        return <ArchiveManager teacherId={teacherId} onStatsUpdate={async () => { }} />;
      case 'data':
        return <DataManager teacherId={teacherId} />;
      default:
        return (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-1">Umumiy ko'rinish</h2>
                <p className="text-muted-foreground">Sinflaringiz va o'quvchilaringiz statistikasi</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="w-48 apple-button-secondary bg-white"><SelectValue placeholder="Guruhni tanlang" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha guruhlar</SelectItem>
                    {groups.map((group) => <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-40 apple-button-secondary bg-white"><SelectValue placeholder="Muddatni tanlang" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1_day">1 kun</SelectItem>
                    <SelectItem value="1_week">1 hafta</SelectItem>
                    <SelectItem value="1_month">1 oy</SelectItem>
                    <SelectItem value="2_months">2 oy</SelectItem>
                    <SelectItem value="3_months">3 oy</SelectItem>
                    <SelectItem value="6_months">6 oy</SelectItem>
                    <SelectItem value="10_months">10 oy</SelectItem>
                    <SelectItem value="all">Barchasi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {statsLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Students Card */}
                  <Card className="group relative overflow-hidden apple-card p-6 bg-white/50 backdrop-blur-md border-blue-100/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Users className="w-16 h-16 text-blue-600" />
                    </div>
                    <div className="relative flex items-center space-x-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 group-hover:rotate-6 transition-transform duration-500">
                        <Users className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-black text-gray-900 tracking-tight">{detailedStats.totalStudents}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70">Faol o'quvchilar</p>
                      </div>
                    </div>
                  </Card>

                  {/* Classes Card */}
                  <Card className="group relative overflow-hidden apple-card p-6 bg-white/50 backdrop-blur-md border-emerald-100/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <BookOpen className="w-16 h-16 text-emerald-600" />
                    </div>
                    <div className="relative flex items-center space-x-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:rotate-6 transition-transform duration-500">
                        <BookOpen className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-black text-gray-900 tracking-tight">{detailedStats.totalClasses}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/70">O'tilgan darslar</p>
                      </div>
                    </div>
                  </Card>

                  {/* Attendance Card */}
                  <Card className="group relative overflow-hidden apple-card p-6 bg-white/50 backdrop-blur-md border-amber-100/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp className="w-16 h-16 text-amber-600" />
                    </div>
                    <div className="relative flex items-center space-x-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200 group-hover:rotate-6 transition-transform duration-500">
                        <TrendingUp className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1">
                          <p className="text-3xl font-black text-gray-900 tracking-tight">{detailedStats.averageAttendance.toFixed(1)}%</p>
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 border-none ${detailedStats.averageAttendance >= 90 ? 'bg-emerald-100 text-emerald-700' :
                            detailedStats.averageAttendance >= 75 ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                            {detailedStats.averageAttendance >= 90 ? 'A\'lo' : detailedStats.averageAttendance >= 75 ? 'Yaxshi' : 'O\'rtacha'}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600/70">O'rtacha davomat</p>
                      </div>
                    </div>
                  </Card>

                  {/* Top Student Card */}
                  <Card className="group relative overflow-hidden apple-card p-6 bg-white/50 backdrop-blur-md border-purple-100/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Trophy className="w-16 h-16 text-purple-600" />
                    </div>
                    <div className="relative flex items-center space-x-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200 group-hover:rotate-6 transition-transform duration-500">
                        <Trophy className="w-7 h-7 text-white" />
                      </div>
                      <div className="min-w-0">
                        {detailedStats.topStudent ? (
                          <StudentProfileLink
                            studentId={detailedStats.topStudent.id}
                            className="block text-lg font-black text-gray-900 leading-tight mb-0.5 truncate hover:text-purple-700"
                          >
                            {detailedStats.topStudent.name}
                          </StudentProfileLink>
                        ) : (
                          <p className="text-lg font-black text-gray-900 leading-tight mb-0.5 truncate">Ma'lumot yo'q</p>
                        )}
                        <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600/70">Eng faol o'quvchi</p>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <GroupRankings teacherId={teacherId} selectedPeriod={selectedPeriod} />
                  <MonthlyAnalysis monthlyData={monthlyData} />
                </div>
              </div>
            )}


          </div>
        );
    }
  };

  const closeStudentProfile = () => {
    if (isAnimatingRef.current) return;
    
    isAnimatingRef.current = true;
    
    // Simple navigation without animations
    navigate(-1);
    
    setActiveStudentId(null);
    activeStudentIdRef.current = null;
    
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, 100);
  };

  useEffect(() => {
    activeStudentIdRef.current = activeStudentId;
  }, [activeStudentId]);

  // useLayoutEffect(() => {
  //   // Old GSAP animation logic removed
  // }, [routeStudentId]);

  return (
    <main className="h-screen overflow-hidden bg-white flex flex-col">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
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
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`
          ${sidebarCollapsed ? 'w-16' : 'w-56'} 
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          bg-white shadow-lg lg:h-full fixed lg:relative z-40 transition-all duration-300 ease-in-out
          ${mobileMenuOpen ? 'top-0 h-screen' : ''}
        `}>
          <nav className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto py-6">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-6 py-3 text-left transition-colors ${activeTab === item.id
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
            </div>

            <div className="mt-auto border-t border-gray-100 p-2">
              <button
                onClick={onLogout}
                className={`w-full flex items-center px-4 py-3 text-left transition-colors text-red-600 hover:bg-red-50 rounded-lg ${sidebarCollapsed ? 'justify-center px-4' : ''}`}
                title={sidebarCollapsed ? "Chiqish" : ''}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="ml-3 font-medium">Chiqish</span>}
              </button>
            </div>
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
        <div className="flex-1 overflow-y-auto h-full bg-white">
          <div className="p-4 lg:p-8">
            {/* Student Profile (full content) */}
            {activeStudentId && (
              <div ref={profileRef}>
                <StudentDetailView
                  studentId={activeStudentId}
                  teacherId={teacherId}
                  onBack={closeStudentProfile}
                />
              </div>
            )}

            {/* Dashboard content (hidden when profile is open) */}
            {!activeStudentId && (
              <div ref={contentRef}>
                {renderContent()}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;
