import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  BookOpen,
  TrendingUp,
  Trophy,
  LogOut,
  Archive,
  Menu,
  Database,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { logError } from "@/lib/errorUtils";
import GroupManager from "./GroupManager";
import StudentManager from "./StudentManager";
import StudentRankings from "./StudentRankings";
import ArchiveManager from "./ArchiveManager";
import ExamManager from "./ExamManager";
import DataManager from "./DataManager";
import StudentDetailView from "./StudentDetailView";
import StudentProfileLink from "./StudentProfileLink";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStatistics } from "@/components/statistics/hooks/useStatistics";
import MonthlyAnalysis from "./statistics/MonthlyAnalysis";
import GroupRankings from "./statistics/GroupRankings";
import ThemeToggle from "./ThemeToggle";

interface DashboardProps {
  teacherId: string;
  teacherName?: string;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  teacherId,
  teacherName,
  onLogout,
}) => {
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
      return saved || "overview";
    } catch {
      return "overview";
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);

  const {
    stats: detailedStats,
    monthlyData,
    loading: statsLoading,
  } = useStatistics(teacherId, selectedPeriod, selectedGroup);

  const handleStudentClick = useCallback(
    (studentId: string) => {
      if (isAnimatingRef.current) return;

      isAnimatingRef.current = true;
      setActiveStudentId(studentId);
      activeStudentIdRef.current = studentId;

      // Navigate without page refresh - no animations
      navigate(`/students/${studentId}`, {
        replace: false,
        state: { from: location.pathname + location.search },
      });

      // Reset animation flag after transition
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 100);
    },
    [navigate, location],
  );

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
    isAnimating: isAnimatingRef.current,
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
    } else if (
      !routeStudentId &&
      activeStudentIdRef.current &&
      !isAnimatingRef.current
    ) {
      // Only clear state if not already handled by back click
      setActiveStudentId(null);
      activeStudentIdRef.current = null;
    }
  }, [routeStudentId]);

  const fetchGroups = useCallback(async () => {
    try {
      const q = query(
        collection(db, "groups"),
        where("teacher_id", "==", teacherId),
        where("is_active", "==", true),
      );
      const snapshot = await getDocs(q);
      const groupsData = snapshot.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
      }));
      setGroups(
        groupsData.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
      );
    } catch (error) {
      logError("Dashboard:fetchGroups", error);
    }
  }, [teacherId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    const validTabIds = new Set([
      "overview",
      "groups",
      "students",
      "exams",
      "rankings",
      "archive",
      "data",
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
      setActiveTab("overview");
    }
  }, [activeTabStorageKey, teacherId]);

  useEffect(() => {
    try {
      localStorage.setItem(activeTabStorageKey, activeTab);
    } catch {
      // ignore
    }

    if (activeTab !== "groups") {
      try {
        localStorage.removeItem(selectedGroupStorageKey);
      } catch {
        // ignore
      }
    }
  }, [activeTab, activeTabStorageKey, selectedGroupStorageKey]);

  const handleGroupSelect = (groupName: string) => {
    // Group selected
  };

  const menuItems = [
    { id: "overview", label: "Umumiy ko'rinish", icon: BookOpen },
    { id: "groups", label: "Guruhlar", icon: Users },
    { id: "students", label: "O'quvchilar", icon: Users },
    { id: "exams", label: "Imtihonlar", icon: TrendingUp },
    { id: "rankings", label: "Reyting", icon: Trophy },
    { id: "archive", label: "Arxiv", icon: Archive },
    { id: "data", label: "Ma'lumotlar", icon: Database },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "groups":
        return (
          <GroupManager
            teacherId={teacherId}
            onGroupSelect={handleGroupSelect}
            onStatsUpdate={async () => {}}
          />
        );
      case "students":
        return (
          <StudentManager
            teacherId={teacherId}
            onStatsUpdate={async () => {}}
          />
        );
      case "exams":
        return <ExamManager teacherId={teacherId} />;
      case "rankings":
        return <StudentRankings teacherId={teacherId} />;
      case "archive":
        return (
          <ArchiveManager
            teacherId={teacherId}
            onStatsUpdate={async () => {}}
          />
        );
      case "data":
        return <DataManager teacherId={teacherId} />;
      default:
        return (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-1 text-foreground">
                  Umumiy ko'rinish
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Sinflaringiz va o'quvchilaringiz statistikasi
                </p>
              </div>
              <div className="flex flex-row gap-2 sm:gap-3">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="flex-1 sm:w-48 sm:flex-none apple-button-secondary bg-card">
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha guruhlar</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.name}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedPeriod}
                  onValueChange={setSelectedPeriod}
                >
                  <SelectTrigger className="flex-1 sm:w-40 sm:flex-none apple-button-secondary bg-card">
                    <SelectValue placeholder="Muddatni tanlang" />
                  </SelectTrigger>
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
              <div className="space-y-6 sm:space-y-8">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  {/* Students Card */}
                  <Card className="group relative overflow-hidden apple-card p-3 sm:p-5 bg-card/80 backdrop-blur-md border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                    <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Users className="w-10 h-10 sm:w-14 sm:h-14 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div className="relative flex items-center space-x-2 sm:space-x-3">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform duration-500 flex-shrink-0">
                        <Users className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-foreground tracking-tight">
                          {detailedStats.totalStudents}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-blue-600/70 dark:text-blue-400/80 leading-tight">
                          Faol o'quvchilar
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Classes Card */}
                  <Card className="group relative overflow-hidden apple-card p-3 sm:p-5 bg-card/80 backdrop-blur-md border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                    <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <BookOpen className="w-10 h-10 sm:w-14 sm:h-14 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="relative flex items-center space-x-2 sm:space-x-3">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform duration-500 flex-shrink-0">
                        <BookOpen className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-foreground tracking-tight">
                          {detailedStats.totalClasses}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/80 leading-tight">
                          O'tilgan darslar
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Attendance Card */}
                  <Card className="group relative overflow-hidden apple-card p-3 sm:p-5 bg-card/80 backdrop-blur-md border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                    <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp className="w-10 h-10 sm:w-14 sm:h-14 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="relative flex items-center space-x-2 sm:space-x-3">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform duration-500 flex-shrink-0">
                        <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-foreground tracking-tight">
                          {detailedStats.averageAttendance.toFixed(1)}%
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600/70 dark:text-amber-400/80 leading-tight">
                          O'rtacha davomat
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Top Student Card */}
                  <Card className="group relative overflow-hidden apple-card p-3 sm:p-5 bg-card/80 backdrop-blur-md border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                    <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Trophy className="w-10 h-10 sm:w-14 sm:h-14 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="relative flex items-center space-x-2 sm:space-x-3">
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform duration-500 flex-shrink-0">
                        <Trophy className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        {detailedStats.topStudent ? (
                          <StudentProfileLink
                            studentId={detailedStats.topStudent.id}
                            className="block text-xs sm:text-base lg:text-lg font-black text-foreground leading-tight mb-0.5 truncate hover:text-purple-600 dark:hover:text-purple-400"
                          >
                            {detailedStats.topStudent.name}
                          </StudentProfileLink>
                        ) : (
                          <p className="text-xs sm:text-base lg:text-lg font-black text-foreground leading-tight mb-0.5 truncate">
                            Ma'lumot yo'q
                          </p>
                        )}
                        <p className="text-[9px] font-bold uppercase tracking-widest text-purple-600/70 dark:text-purple-400/80 leading-tight">
                          Eng faol o'quvchi
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <GroupRankings
                    teacherId={teacherId}
                    selectedPeriod={selectedPeriod}
                  />
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
    <main className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Top Header */}
      <div className="bg-background border-b border-border px-3 sm:px-4 h-[60px] flex items-center justify-between shrink-0 z-50 relative">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex-shrink-0 h-9 w-9 p-0"
            aria-label="Menyuni ochish"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex flex-shrink-0 h-9 w-9 p-0"
            aria-label="Yon panelni yig'ish"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-sm">
                T
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-foreground leading-tight truncate">
                TeachPro
              </h1>
              {teacherName && (
                <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-[140px] sm:max-w-xs">
                  Xush kelibsiz, {teacherName}
                </p>
              )}
            </div>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 dark:bg-black/60 z-30 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <div
          className={`
          ${sidebarCollapsed ? "lg:w-16" : "lg:w-56"}
          ${mobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"}
          bg-card border-r border-border shadow-lg lg:shadow-none
          fixed lg:relative top-0 bottom-0 left-0 z-40
          transition-all duration-300 ease-in-out
          flex flex-col
        `}
          style={{
            top: mobileMenuOpen ? "60px" : undefined,
            height: mobileMenuOpen ? "calc(100% - 60px)" : "100%",
          }}
        >
          <nav className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-3 py-3 text-left transition-all rounded-lg group ${
                      activeTab === item.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    } ${sidebarCollapsed ? "lg:justify-center lg:px-2" : ""}`}
                    title={sidebarCollapsed ? item.label : ""}
                    aria-label={item.label}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      activeTab === item.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    }`} />
                    <span
                      className={`ml-3 truncate ${sidebarCollapsed ? "lg:hidden" : ""}`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border p-3">
              <button
                onClick={onLogout}
                className={`w-full flex items-center px-3 py-3 text-left transition-colors text-destructive hover:bg-destructive/10 rounded-lg group ${
                  sidebarCollapsed ? "lg:justify-center lg:px-2" : ""
                }`}
                title={sidebarCollapsed ? "Chiqish" : ""}
                aria-label="Tizimdan chiqish"
              >
                <LogOut className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <span
                  className={`ml-3 font-medium truncate ${sidebarCollapsed ? "lg:hidden" : ""}`}
                >
                  Chiqish
                </span>
              </button>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto h-full bg-background text-foreground min-w-0">
          <div className="p-3 sm:p-5 lg:p-8">
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
            {!activeStudentId && <div ref={contentRef}>{renderContent()}</div>}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;
