
import { useState, useEffect } from 'react';
import { StatsData, MonthlyData } from '../types';
import {
  fetchActiveStudents,
  fetchFirstClassDate,
  fetchAttendanceRecords,
  fetchPresentAttendance,
  fetchTopStudent,
  fetchMonthlyData
} from '../utils/statisticsApi';
import {
  getTotalMonthsSince,
} from '../utils/statisticsDates';

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
    // eslint-disable-next-line
  }, [teacherId, selectedPeriod, selectedGroup]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);

      // --- Fetch core stats ---
      const studentsData = await fetchActiveStudents(teacherId, selectedGroup);
      const totalStudents = studentsData.length;

      const firstClassDate = await fetchFirstClassDate(teacherId);
      const totalMonths = getTotalMonthsSince(firstClassDate);

      // Attendance records for period
      const classesData = await fetchAttendanceRecords(teacherId, selectedPeriod, selectedGroup);
      const uniqueDates = [...new Set(classesData.map(record => record.date) || [])];
      const totalClasses = uniqueDates.length;

      let topStudent: string = "Ma'lumot yo'q";
      let averageAttendance = 0;

      if (totalClasses > 0 && totalStudents > 0) {
        const attendanceData = await fetchPresentAttendance(teacherId, selectedPeriod, selectedGroup);
        const totalPresentRecords = attendanceData?.length || 0;
        const totalPossibleAttendance = totalClasses * totalStudents;
        averageAttendance = totalPossibleAttendance > 0
          ? (totalPresentRecords / totalPossibleAttendance) * 100
          : 0;
        topStudent = await fetchTopStudent(teacherId, selectedGroup);
      }

      setStats({
        totalStudents,
        totalClasses,
        averageAttendance: Math.round(averageAttendance * 100) / 100,
        topStudent
      });

      // ---- Monthly data ----
      const formattedMonthly = await fetchMonthlyData(teacherId, selectedPeriod, selectedGroup, totalStudents);
      setMonthlyData(formattedMonthly);

      let bestMonth: { month: string; percent: number } | undefined = undefined;
      if (formattedMonthly.length > 0) {
        // Sort by highest avg attendance
        const sorted = [...formattedMonthly].sort((a, b) => b.averageAttendance - a.averageAttendance);
        bestMonth = {
          month: sorted[0].month,
          percent: sorted[0].averageAttendance,
        };
      }

      setExtraStats({
        totalMonths,
        bestMonth,
      });

    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
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
