import { useState, useEffect } from 'react';
import { calculateDashboardStats, StatsData, MonthlyData } from '@/lib/studentScoreCalculator';

export const useStatistics = (teacherId: string, selectedPeriod: string, selectedGroup: string = 'all') => {
    const [stats, setStats] = useState<StatsData>({
        totalStudents: 0,
        totalClasses: 0,
        averageAttendance: 0,
        topStudent: null
    });
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStatistics();
    }, [teacherId, selectedPeriod, selectedGroup]);

    const fetchStatistics = async () => {
        try {
            setLoading(true);
            const data = await calculateDashboardStats(teacherId, selectedPeriod, selectedGroup);
            setStats(data.stats);
            setMonthlyData(data.monthlyData);
        } catch (error) {
            console.error('Error fetching statistics:', error);
        } finally {
            setLoading(false);
        }
    };

    return {
        stats,
        monthlyData,
        loading,
        refetch: fetchStatistics
    };
};
