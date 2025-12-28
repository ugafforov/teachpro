
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
        .gte('date', startDate)
        .range(0, 10000);

      if (selectedGroup !== 'all') {
        attendanceQuery = attendanceQuery.eq('students.group_name', selectedGroup);
      }

      const { data: classesData, error: classesError } = await attendanceQuery;

      if (classesError) throw classesError;

      // Get unique dates for total classes
      const uniqueDates = [...new Set(classesData?.map(record => record.date) || [])];
      const totalClasses = uniqueDates.length;

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
          .gte('date', startDate)
          .range(0, 10000);

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

        // Find top student dynamically (same rules as rankings)
        const { data: studentsForTop, error: topStudentsError } = await supabase
          .from('students')
          .select('id, name, group_name, created_at')
          .eq('teacher_id', teacherId)
          .eq('is_active', true)
          .range(0, 10000);

        if (topStudentsError) throw topStudentsError;

        const filteredStudentsForTop = selectedGroup === 'all'
          ? (studentsForTop || [])
          : (studentsForTop || []).filter(s => s.group_name === selectedGroup);

        const studentIdSet = new Set(filteredStudentsForTop.map(s => s.id));

        const { data: attendanceForTop, error: topAttendanceError } = await supabase
          .from('attendance_records')
          .select('student_id, status, date')
          .eq('teacher_id', teacherId)
          .gte('date', startDate)
          .range(0, 10000);

        if (topAttendanceError) throw topAttendanceError;

        const { data: rewardsForTop, error: topRewardsError } = await supabase
          .from('reward_penalty_history')
          .select('student_id, points, type, date')
          .eq('teacher_id', teacherId)
          .gte('date', startDate)
          .range(0, 10000);

        if (topRewardsError) throw topRewardsError;

        let topStudent = "Ma'lumot yo'q";
        let maxScore = -Infinity;

        filteredStudentsForTop.forEach((student) => {
          const studentCreatedAt = new Date(student.created_at).toISOString().split('T')[0];
          const minDate = studentCreatedAt > startDate ? studentCreatedAt : startDate;

          const sAttendance = (attendanceForTop || []).filter(a =>
            studentIdSet.has(a.student_id) && a.student_id === student.id && a.date >= minDate
          );

          const attendancePoints = sAttendance.reduce((total, a) => {
            if (a.status === 'present') return total + 1;
            if (a.status === 'late') return total + 0.5;
            return total;
          }, 0);

          const sRewards = (rewardsForTop || []).filter(r =>
            studentIdSet.has(r.student_id) && r.student_id === student.id
          );

          const mukofot = sRewards
            .filter(r => r.type === 'Mukofot')
            .reduce((sum, r) => sum + Number(r.points || 0), 0);
          const jarima = sRewards
            .filter(r => r.type === 'Jarima')
            .reduce((sum, r) => sum + Number(r.points || 0), 0);

          const totalScore = attendancePoints + (mukofot - jarima);

          if (totalScore > maxScore) {
            maxScore = totalScore;
            topStudent = student.name;
          }
        });

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
          averageAttendance: totalStudents === 0 ? 0 : 100, // If no students, show 0, if students but no classes, show 100%
          topStudent: 'Ma\'lumot yo\'q'
        });
      }

      // Fetch monthly data
      await fetchMonthlyData(totalStudents);

    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyData = async (totalStudents: number) => {
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
        .gte('date', startDate)
        .range(0, 10000);

      if (selectedGroup !== 'all') {
        monthlyQuery = monthlyQuery.eq('students.group_name', selectedGroup);
      }

      const { data: monthlyAttendance, error } = await monthlyQuery;

      if (error) throw error;

      // Calculate monthly statistics
      const monthlyStats: { [key: string]: { classes: Set<string>, present: number } } = {};

      monthlyAttendance?.forEach(record => {
        const date = new Date(record.date);
        const uzbekMonths = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
        const month = `${uzbekMonths[date.getMonth()]}, ${date.getFullYear()}`;
        
        if (!monthlyStats[month]) {
          monthlyStats[month] = { classes: new Set(), present: 0 };
        }
        
        monthlyStats[month].classes.add(record.date);
        // Count both present and late as attendance
        if (record.status === 'present' || record.status === 'late') {
          monthlyStats[month].present++;
        }
      });

      const formattedMonthlyData: MonthlyData[] = Object.entries(monthlyStats).map(([month, data]) => ({
        month,
        totalClasses: data.classes.size,
        averageAttendance: data.classes.size > 0 && totalStudents > 0 
          ? (data.present / (data.classes.size * totalStudents)) * 100 
          : totalStudents === 0 ? 0 : 100,
        totalStudents: totalStudents
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
