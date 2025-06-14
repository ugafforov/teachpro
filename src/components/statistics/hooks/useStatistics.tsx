import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatsData, MonthlyData } from '../types';

export const useStatistics = (teacherId: string, selectedPeriod: string, selectedGroup: string = 'all') => {
  const [stats, setStats] = useState<StatsData>({
    totalStudents: 0,
    totalClasses: 0,
    averageAttendance: 0,
    topStudent: ''
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [extraStats, setExtraStats] = useState<{ totalMonths?: number; bestMonth?: { month: string; percent: number } }>({});

  useEffect(() => {
    fetchStatistics();
  }, [teacherId, selectedPeriod, selectedGroup]);

  // Helper to localize and format Uzbek months
  const formatMonthUz = (jsDate: Date) => {
    const monthNames = [
      'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
      'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
    ];
    return `${monthNames[jsDate.getMonth()]}, ${jsDate.getFullYear()}-yil`;
  };

  // Calculate the total number of months from the first lesson date to today
  const getTotalMonthsSinceFirstLesson = (firstDateStr: string | null) => {
    if (!firstDateStr) return 0;
    const now = new Date();
    const first = new Date(firstDateStr);
    let months = (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth());
    // Include current month for partial months or if first lesson is this month
    if (now.getDate() >= first.getDate()) months += 1;
    months = Math.max(months, 1); // Always at least 1
    return months;
  };

  const getPeriodStartDate = (period: string) => {
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1kun':
        startDate.setDate(now.getDate() - 1);
        break;
      case '1hafta':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1oy':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '2oy':
        startDate.setMonth(now.getMonth() - 2);
        break;
      case '3oy':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '4oy':
        startDate.setMonth(now.getMonth() - 4);
        break;
      case '5oy':
        startDate.setMonth(now.getMonth() - 5);
        break;
      case '6oy':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '7oy':
        startDate.setMonth(now.getMonth() - 7);
        break;
      case '8oy':
        startDate.setMonth(now.getMonth() - 8);
        break;
      case '9oy':
        startDate.setMonth(now.getMonth() - 9);
        break;
      case '10oy':
        startDate.setMonth(now.getMonth() - 10);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }
    
    return startDate.toISOString().split('T')[0];
  };

  const fetchStatistics = async () => {
    try {
      setLoading(true);

      // Build query for active students only (not deleted or archived)
      let studentsQuery = supabase
        .from('students')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (selectedGroup !== 'all') {
        studentsQuery = studentsQuery.eq('group_name', selectedGroup);
      }

      const { data: studentsData, error: studentsError } = await studentsQuery;

      if (studentsError) throw studentsError;

      const totalStudents = studentsData?.length || 0;
      const startDate = getPeriodStartDate(selectedPeriod);

      // Fetch first lesson date for the teacher
      const { data: firstClassRow, error: firstClassError } = await supabase
        .from('attendance_records')
        .select('date')
        .eq('teacher_id', teacherId)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstClassError) throw firstClassError;
      const firstClassDate = firstClassRow?.date || null;

      const totalMonths = getTotalMonthsSinceFirstLesson(firstClassDate);

      // Build query for attendance based on group filter and date range, only for active students
      let attendanceQuery = supabase
        .from('attendance_records')
        .select(`
          date,
          students!inner(is_active, group_name)
        `)
        .eq('teacher_id', teacherId)
        .eq('students.is_active', true)
        .gte('date', startDate);

      if (selectedGroup !== 'all') {
        attendanceQuery = attendanceQuery.eq('students.group_name', selectedGroup);
      }

      const { data: classesData, error: classesError } = await attendanceQuery;

      if (classesError) throw classesError;

      // Get unique dates for total classes
      const uniqueDates = [...new Set(classesData?.map(record => record.date) || [])];
      const totalClasses = uniqueDates.length;

      // Declare topStudent upfront to always have a value
      let topStudent: string = 'Ma\'lumot yo\'q';

      // Calculate average attendance - including late students as present
      if (totalClasses > 0 && totalStudents > 0) {
        let presentQuery = supabase
          .from('attendance_records')
          .select(`
            status,
            students!inner(is_active, group_name)
          `)
          .eq('teacher_id', teacherId)
          .eq('students.is_active', true)
          .in('status', ['present', 'late']) // Include both present and late as attendance
          .gte('date', startDate);

        if (selectedGroup !== 'all') {
          presentQuery = presentQuery.eq('students.group_name', selectedGroup);
        }

        const { data: attendanceData, error: attendanceError } = await presentQuery;

        if (attendanceError) throw attendanceError;

        const totalPresentRecords = attendanceData?.length || 0;
        const totalPossibleAttendance = totalClasses * totalStudents;
        const averageAttendance = totalPossibleAttendance > 0 
          ? (totalPresentRecords / totalPossibleAttendance) * 100 
          : 0;

        // Find top student from active students only
        let topStudentQuery = supabase
          .from('student_scores')
          .select(`
            student_id, 
            total_score, 
            students!inner(name, is_active, group_name)
          `)
          .eq('teacher_id', teacherId)
          .eq('students.is_active', true)
          .order('total_score', { ascending: false })
          .limit(1);

        if (selectedGroup !== 'all') {
          topStudentQuery = topStudentQuery.eq('students.group_name', selectedGroup);
        }

        const { data: topStudentData, error: topStudentError } = await topStudentQuery;

        if (topStudentError) throw topStudentError;

        // Update topStudent only if found
        topStudent = topStudentData?.[0]?.students?.name || 'Ma\'lumot yo\'q';

        setStats({
          totalStudents,
          totalClasses,
          averageAttendance: Math.round(averageAttendance * 100) / 100,
          topStudent
        });
      } else {
        // No classes or students
        setStats({
          totalStudents,
          totalClasses: 0,
          averageAttendance: totalStudents === 0 ? 0 : 100, // If no students, show 0, if students but no classes, show 100%
          topStudent // fixed - this will always be defined
        });
      }

      // Fetch monthly data and use for "Eng yaxshi oy" calculation
      const formattedMonthly = await fetchMonthlyData(totalStudents, true);
      let bestMonth: { month: string; percent: number } | null = null;
      if (formattedMonthly.length > 0) {
        // Find the month with the highest attendance
        const sorted = [...formattedMonthly].sort((a, b) => b.averageAttendance - a.averageAttendance);
        const best = sorted[0];
        // Use a now defined here
        const now = new Date();
        // Parse to JS date
        // Assume month string like 'Sentabr, 2025-yil'
        const [m, y] = best.month.match(/\d{4}/) 
          ? [best.month.replace(/\d{4}.*/, ""), best.month.match(/\d{4}/)?.[0]]
          : [best.month, now.getFullYear().toString()];
        // Map month name to number
        const monthNum = (() => {
          const names = [
            'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
          ];
          return names.findIndex(n =>
            best.month.toLowerCase().includes(n.toLowerCase())
          );
        })();
        let jsMonthDate;
        try {
          jsMonthDate = new Date(Number(y), monthNum >= 0 ? monthNum : 0, 1);
        } catch {
          jsMonthDate = new Date();
        }
        const bestMonthStr = formatMonthUz(jsMonthDate);
        bestMonth = {
          month: bestMonthStr,
          percent: best.averageAttendance,
        };
      }

      // This is for summary/statistics cards: always include topStudent, etc.
      setStats({
        totalStudents,
        totalClasses,
        averageAttendance: Math.round((stats.averageAttendance ?? 0) * 100) / 100,
        topStudent // always defined now
      });

      setExtraStats({
        totalMonths,
        bestMonth: bestMonth ?? undefined,
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Modified to allow getting full monthly data for "Eng yaxshi oy"
  const fetchMonthlyData = async (totalStudents: number, returnData = false) => {
    try {
      const startDate = getPeriodStartDate(selectedPeriod);

      let monthlyQuery = supabase
        .from('attendance_records')
        .select(`
          date, 
          status,
          students!inner(is_active, group_name)
        `)
        .eq('teacher_id', teacherId)
        .eq('students.is_active', true)
        .gte('date', startDate);

      if (selectedGroup !== 'all') {
        monthlyQuery = monthlyQuery.eq('students.group_name', selectedGroup);
      }

      const { data: monthlyAttendance, error } = await monthlyQuery;

      if (error) throw error;

      const monthlyStats: { [key: string]: { classes: Set<string>, present: number } } = {};

      monthlyAttendance?.forEach(record => {
        // Get 2025-09 or 2025 Sentabr
        const date = new Date(record.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyStats[monthKey]) {
          monthlyStats[monthKey] = { classes: new Set(), present: 0 };
        }
        monthlyStats[monthKey].classes.add(record.date);
        // present or late
        if (record.status === 'present' || record.status === 'late') {
          monthlyStats[monthKey].present++;
        }
      });

      // Now format as array with 'Sentabr, 2025'-style strings
      const result: MonthlyData[] = Object.entries(monthlyStats).map(([monthKey, data]) => {
        const [year, monthNum] = monthKey.split("-");
        const jsDate = new Date(Number(year), Number(monthNum) - 1, 1);
        return {
          month: formatMonthUz(jsDate),
          totalClasses: data.classes.size,
          averageAttendance:
            data.classes.size > 0 && totalStudents > 0
              ? (data.present / (data.classes.size * totalStudents)) * 100
              : totalStudents === 0
                ? 0
                : 100,
          totalStudents: totalStudents,
        };
      });

      if (returnData) return result;
      setMonthlyData(result);
      return result;
    } catch (error) {
      console.error('Error fetching monthly data:', error);
      if (returnData) return [];
    }
  };

  return {
    stats: {
      ...stats,
      ...extraStats,
    },
    monthlyData,
    loading,
    refetch: fetchStatistics,
  };
};
