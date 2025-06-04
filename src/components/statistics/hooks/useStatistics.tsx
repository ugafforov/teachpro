
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatsData, MonthlyData } from '../types';

export const useStatistics = (teacherId: string, selectedPeriod: string) => {
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
  }, [teacherId, selectedPeriod]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);

      // Faqat faol o'quvchilar sonini olish
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (studentsError) throw studentsError;

      const totalStudents = studentsData?.length || 0;

      // Faqat faol o'quvchilarning davomat yozuvlari bo'yicha jami darslar sonini hisoblash
      const { data: classesData, error: classesError } = await supabase
        .from('attendance_records')
        .select(`
          date,
          students!inner(is_active)
        `)
        .eq('teacher_id', teacherId)
        .eq('students.is_active', true);

      if (classesError) throw classesError;

      // Noyob sanalarni topish (faqat faol o'quvchilar uchun)
      const uniqueDates = [...new Set(classesData?.map(record => record.date) || [])];
      const totalClasses = uniqueDates.length;

      // O'rtacha davomatni hisoblash (faqat faol o'quvchilar uchun)
      if (totalClasses > 0 && totalStudents > 0) {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance_records')
          .select(`
            status,
            students!inner(is_active)
          `)
          .eq('teacher_id', teacherId)
          .eq('students.is_active', true)
          .eq('status', 'present');

        if (attendanceError) throw attendanceError;

        const totalPresentRecords = attendanceData?.length || 0;
        const totalPossibleAttendance = totalClasses * totalStudents;
        const averageAttendance = totalPossibleAttendance > 0 
          ? (totalPresentRecords / totalPossibleAttendance) * 100 
          : 0;

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

      // Oylik ma'lumotlarni olish
      await fetchMonthlyData();

    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyData = async () => {
    try {
      const monthsToFetch = selectedPeriod === '1oy' ? 1 : 12;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsToFetch);

      // Faqat faol o'quvchilarning oylik davomat ma'lumotlarini olish
      const { data: monthlyAttendance, error } = await supabase
        .from('attendance_records')
        .select(`
          date, 
          status,
          students!inner(is_active)
        `)
        .eq('teacher_id', teacherId)
        .eq('students.is_active', true)
        .gte('date', startDate.toISOString().split('T')[0]);

      if (error) throw error;

      // Oylik statistikani hisoblash
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
