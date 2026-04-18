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
  Brain,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { logError } from "@/lib/errorUtils";
import GroupManager from "./GroupManager";
import StudentManager from "./StudentManager";
import StudentRankings from "./StudentRankings";
import ArchiveManager from "./ArchiveManager";
import ExamStudio from "./ExamStudio";
import DataManager from "./DataManager";
import StudentDetailView from "./StudentDetailView";
import StudentProfileLink from "./StudentProfileLink";
import { ExamHub } from "./exam/ExamHub";
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
import AIAnalysisPage from "./AIAnalysisPage";

interface DashboardProps {
  teacherId: string;
  teacherName?: string;
  onLogout: () => void;
}

const VALID_TAB_IDS = new Set([
  "overview",
  "groups",
  "students",
  "exams",
  "rankings",
  "ai-analysis",
  "archive",
  "data",
]);

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
  const [recentActivity, setRecentActivity] = useState<Array<{ id: string; type: string; title: string; timestamp: Date; icon: string; color: string }>>([]);
  const sidebarHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleMenuItemClick = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setMobileMenuOpen(false);

      if (routeStudentId || activeStudentIdRef.current) {
        setActiveStudentId(null);
        activeStudentIdRef.current = null;
        navigate("/", { replace: true });
      }
    },
    [navigate, routeStudentId],
  );

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

  // Close sidebar when AI Analysis page is opened
  useEffect(() => {
    if (activeTab === "ai-analysis") {
      setSidebarCollapsed(true);
    }
  }, [activeTab]);

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

  // Fetch Recent Activity
  useEffect(() => {
    if (!teacherId) return;

    let examActivities: Array<{ id: string; type: string; title: string; timestamp: Date; icon: string; color: string }> = [];
    let scoreActivities: Array<{ id: string; type: string; title: string; timestamp: Date; icon: string; color: string }> = [];

    const syncRecentActivities = () => {
      const combined = [...examActivities, ...scoreActivities]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 8);
      setRecentActivity(combined);
    };

    // Avoid composite-index requirement by sorting in memory.
    const examsQ = query(
      collection(db, "exams"),
      where("teacher_id", "==", teacherId),
    );

    const scoresQ = query(
      collection(db, "exam_results"),
      where("teacher_id", "==", teacherId),
    );

    const unsubExams = onSnapshot(
      examsQ,
      (snapshot) => {
        examActivities = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            type: "exam",
            title: `Imtihon: ${doc.data().exam_name || "Yangi"}`,
            timestamp: doc.data().created_at?.toDate?.() || new Date(),
            icon: "📝",
            color: "text-blue-600/70 dark:text-blue-400/70",
          }))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 5);
        syncRecentActivities();
      },
      (error) => logError("Dashboard:RecentExams", error),
    );

    const unsubScores = onSnapshot(
      scoresQ,
      (scoresSnapshot) => {
        scoreActivities = scoresSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            type: "score",
            title: `Oqish baholash: ${doc.data().student_name || "O'quvchi"}`,
            timestamp: doc.data().submitted_at?.toDate?.() || new Date(),
            icon: "⭐",
            color: "text-amber-600/70 dark:text-amber-400/70",
          }))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 5);
        syncRecentActivities();
      },
      (error) => logError("Dashboard:RecentScores", error),
    );

    return () => {
      unsubExams();
      unsubScores();
    };
  }, [teacherId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(activeTabStorageKey);
      if (saved && VALID_TAB_IDS.has(saved)) {
        setActiveTab(saved);
        return;
      }
    } catch {
      // ignore
    }

    setActiveTab((currentTab: string) =>
      VALID_TAB_IDS.has(currentTab) ? currentTab : "overview",
    );
  }, [activeTabStorageKey]);

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
    setSelectedGroup(groupName);
    try {
      localStorage.setItem(selectedGroupStorageKey, groupName);
    } catch {
      // ignore localStorage errors
    }
  };

  const menuItems = [
    { id: "overview", label: "Boshqaruv paneli", icon: BookOpen },
    { id: "groups", label: "Guruhlar", icon: Users },
    { id: "students", label: "O'quvchilar", icon: Users },
    { id: "exams", label: "Imtihonlar", icon: TrendingUp },
    { id: "rankings", label: "Reyting", icon: Trophy },
    { id: "ai-analysis", label: "AI tahlil", icon: Brain },
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
        return <ExamHub teacherId={teacherId} />;
      case "rankings":
        return <StudentRankings teacherId={teacherId} />;
      case "ai-analysis":
        return (
          <AIAnalysisPage
            role="teacher"
            teacherId={teacherId}
            currentUserId={teacherId}
          />
        );
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
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 text-foreground bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  📚 Boshqaruv paneli
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  Sinflaringiz, o'quvchilar va imtihonlar statistikasi
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="flex-1 sm:w-48 sm:flex-none apple-button-secondary bg-card border border-border/80 hover:border-border transition-colors">
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
                  <SelectTrigger className="flex-1 sm:w-48 sm:flex-none apple-button-secondary bg-card border border-border/80 hover:border-border transition-colors">
                    <SelectValue placeholder="Muddatni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1_day">📅 1 kun</SelectItem>
                    <SelectItem value="1_week">📅 1 hafta</SelectItem>
                    <SelectItem value="1_month">📅 1 oy</SelectItem>
                    <SelectItem value="2_months">📅 2 oy</SelectItem>
                    <SelectItem value="3_months">📅 3 oy</SelectItem>
                    <SelectItem value="6_months">📅 6 oy</SelectItem>
                    <SelectItem value="10_months">📅 10 oy</SelectItem>
                    <SelectItem value="all">📅 Barchasi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Loading State */}
            {statsLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary/30 border-t-primary"></div>
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-8">
                {/* KPI Cards Grid - Enhanced Layout */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Students Card */}
                  <Card className="group relative overflow-hidden apple-card p-3 sm:p-5 bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-950/20 dark:to-blue-900/10 border border-blue-200/40 dark:border-blue-800/40 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Users className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600" />
                    </div>
                    <div className="relative flex items-center space-x-2 sm:space-x-3">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg sm:text-2xl font-black text-foreground tracking-tight">
                          {detailedStats.totalStudents}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-blue-700/70 dark:text-blue-400/70 leading-tight">
                          O'quvchilar
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Classes Card */}
                  <Card className="group relative overflow-hidden apple-card p-3 sm:p-5 bg-gradient-to-br from-emerald-50 to-emerald-50/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-200/40 dark:border-emerald-800/40 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                      <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-600" />
                    </div>
                    <div className="relative flex items-center space-x-2 sm:space-x-3">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg sm:text-2xl font-black text-foreground tracking-tight">
                          {detailedStats.totalClasses}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-400/70 leading-tight">
                          Darslar
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Attendance Card */}
                  <Card className="group relative overflow-hidden apple-card p-3 sm:p-5 bg-gradient-to-br from-amber-50 to-amber-50/50 dark:from-amber-950/20 dark:to-amber-900/10 border border-amber-200/40 dark:border-amber-800/40 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                      <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16 text-amber-600" />
                    </div>
                    <div className="relative flex items-center space-x-2 sm:space-x-3">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg sm:text-2xl font-black text-foreground tracking-tight">
                          {detailedStats.averageAttendance.toFixed(1)}%
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700/70 dark:text-amber-400/70 leading-tight">
                          Davomat
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Top Student Card */}
                  <Card className="group relative overflow-hidden apple-card p-3 sm:p-5 bg-gradient-to-br from-purple-50 to-purple-50/50 dark:from-purple-950/20 dark:to-purple-900/10 border border-purple-200/40 dark:border-purple-800/40 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-2 sm:p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600" />
                    </div>
                    <div className="relative flex items-center space-x-2 sm:space-x-3">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {detailedStats.topStudent ? (
                          <StudentProfileLink
                            studentId={detailedStats.topStudent.id}
                            className="block text-xs sm:text-sm lg:text-base font-black text-foreground leading-tight mb-0.5 truncate hover:text-purple-700 dark:hover:text-purple-400 transition-colors"
                          >
                            {detailedStats.topStudent.name}
                          </StudentProfileLink>
                        ) : (
                          <p className="text-xs sm:text-sm lg:text-base font-black text-foreground leading-tight mb-0.5 truncate">
                            —
                          </p>
                        )}
                        <p className="text-[9px] font-bold uppercase tracking-wider text-purple-700/70 dark:text-purple-400/70 leading-tight">
                          Top faol
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Analytics Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <GroupRankings
                    teacherId={teacherId}
                    selectedPeriod={selectedPeriod}
                  />
                  <MonthlyAnalysis monthlyData={monthlyData} />
                </div>

                {/* Recent Activity Section */}
                {recentActivity.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-border/50">
                    <h3 className="text-lg sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      So'nggi Faoliyat
                    </h3>
                    <div className="space-y-2">
                      {recentActivity.map((activity, index) => {
                        const isRecent = Math.abs(new Date().getTime() - activity.timestamp.getTime()) < 3600000; // Last hour
                        return (
                          <div
                            key={`${activity.id}-${index}`}
                            className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg transition-all duration-300 ${
                              isRecent
                                ? "bg-primary/5 border-l-2 border-primary/50"
                                : "bg-muted/30 border-l-2 border-muted/50"
                            } hover:bg-primary/10 hover:border-l-2 hover:border-primary/70 hover:translate-x-1`}
                          >
                            <div className="text-lg flex-shrink-0">
                              {activity.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {activity.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {activity.timestamp.toLocaleDateString("uz-UZ", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className="flex-shrink-0 bg-primary/10 text-primary hover:bg-primary/20"
                            >
                              {activity.type === "exam" ? "📝 Imtihon" : "⭐ Baholash"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
          transition-all duration-100 ease
          flex flex-col
        `}
          style={{
            top: mobileMenuOpen ? "60px" : undefined,
            height: mobileMenuOpen ? "calc(100% - 60px)" : "100%",
          }}
          onMouseEnter={() => {
            if (sidebarHoverTimeoutRef.current) {
              clearTimeout(sidebarHoverTimeoutRef.current);
              sidebarHoverTimeoutRef.current = null;
            }
            setSidebarCollapsed(false);
          }}
          onMouseLeave={() => {
            sidebarHoverTimeoutRef.current = setTimeout(() => {
              setSidebarCollapsed(true);
            }, 150);
          }}
        >
          <nav className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMenuItemClick(item.id)}
                    className={`w-full flex items-center px-3 py-3 text-left transition-all rounded-lg group ${
                      activeTab === item.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    title={sidebarCollapsed ? item.label : ""}
                    aria-label={item.label}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      activeTab === item.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    }`} />
                    <span
                      className={`ml-3 truncate transition-opacity duration-100 ${sidebarCollapsed ? "lg:opacity-0 lg:w-0 overflow-hidden" : "lg:opacity-100 lg:w-auto"}`}
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
                className={`w-full flex items-center px-3 py-3 text-left transition-colors text-destructive hover:bg-destructive/10 rounded-lg group`}
                title={sidebarCollapsed ? "Chiqish" : ""}
                aria-label="Tizimdan chiqish"
              >
                <LogOut className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <span
                  className={`ml-3 font-medium truncate transition-opacity duration-100 ${sidebarCollapsed ? "lg:opacity-0 lg:w-0 overflow-hidden" : "lg:opacity-100 lg:w-auto"}`}
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
