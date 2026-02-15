import { useState, useEffect, useCallback } from 'react';
import { logError } from '@/lib/errorUtils';
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

    const fetchStatistics = useCallback(async () => {
        try {
            setLoading(true);
            const data = await calculateDashboardStats(teacherId, selectedPeriod, selectedGroup);
            setStats(data.stats);
            setMonthlyData(data.monthlyData);
        } catch (error) {
            logError('useStatistics:fetchStatistics', error);
        } finally {
            setLoading(false);
        }
    }, [teacherId, selectedPeriod, selectedGroup]);

    useEffect(() => {
        fetchStatistics();
    }, [fetchStatistics]);

    return {
        stats,
        monthlyData,
        loading,
        refetch: fetchStatistics
    };
};
