
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

  useEffect(() => {
    fetchStatistics();
  }, [teacherId, selectedPeriod, selectedGroup]);

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

      // Calculate average attendance
      if (totalClasses > 0 && totalStudents > 0) {
        let presentQuery = supabase
          .from('attendance_records')
          .select(`
            status,
            students!inner(is_active, group_name)
          `)
          .eq('teacher_id', teacherId)
          .eq('students.is_active', true)
          .eq('status', 'present')
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

        const topStudent = topStudentData?.[0]?.students?.name || 'Ma\'lumot yo\'q';

        setStats({
          totalStudents,
          totalClasses,
          averageAttendance: Math.round(averageAttendance * 100) / 100,
          topStudent
        });
      } else {
        setStats({
          totalStudents,
          totalClasses: 0,
          averageAttendance: 0,
          topStudent: 'Ma\'lumot yo\'q'
        });
      }

      // Fetch monthly data
      await fetchMonthlyData();

    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyData = async () => {
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

      // Calculate monthly statistics
      const monthlyStats: { [key: string]: { classes: Set<string>, present: number } } = {};

      monthlyAttendance?.forEach(record => {
        const month = new Date(record.date).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long' });
        
        if (!monthlyStats[month]) {
          monthlyStats[month] = { classes: new Set(), present: 0 };
        }
        
        monthlyStats[month].classes.add(record.date);
        if (record.status === 'present') {
          monthlyStats[month].present++;
        }
      });

      const formattedMonthlyData: MonthlyData[] = Object.entries(monthlyStats).map(([month, data]) => ({
        month,
        totalClasses: data.classes.size,
        averageAttendance: data.classes.size > 0 ? (data.present / (data.classes.size * stats.totalStudents)) * 100 : 0,
        totalStudents: stats.totalStudents
      }));

      setMonthlyData(formattedMonthlyData);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    }
  };

  return {
    stats,
    monthlyData,
    loading,
    refetch: fetchStatistics
  };
};
