import { useState, useEffect, useCallback, useRef } from 'react';
import { logError } from '@/lib/errorUtils';
import { calculateDashboardStats, StatsData, MonthlyData } from '@/lib/studentScoreCalculator';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export const useStatistics = (teacherId: string, selectedPeriod: string, selectedGroup: string = 'all') => {
    const [stats, setStats] = useState<StatsData>({
        totalStudents: 0,
        totalClasses: 0,
        averageAttendance: 0,
        topStudent: null
    });
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
    const [loading, setLoading] = useState(true);
    const hasInitialLoadRef = useRef(false);

    const fetchStatistics = useCallback(async (showLoading = !hasInitialLoadRef.current) => {
        try {
            if (showLoading) {
                setLoading(true);
            }
            const data = await calculateDashboardStats(teacherId, selectedPeriod, selectedGroup);
            setStats(data.stats);
            setMonthlyData(data.monthlyData);
        } catch (error) {
            logError('useStatistics:fetchStatistics', error);
        } finally {
            hasInitialLoadRef.current = true;
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [teacherId, selectedPeriod, selectedGroup]);

    useEffect(() => {
        void fetchStatistics(true);
    }, [fetchStatistics]);

    useEffect(() => {
        if (!teacherId) return;

        let refreshTimer: ReturnType<typeof setTimeout> | null = null;
        const scheduleRefetch = () => {
            if (refreshTimer) {
                clearTimeout(refreshTimer);
            }
            refreshTimer = setTimeout(() => {
                void fetchStatistics(false);
            }, 150);
        };

        const studentsQ = query(collection(db, 'students'), where('teacher_id', '==', teacherId));
        const attendanceQ = query(collection(db, 'attendance_records'), where('teacher_id', '==', teacherId));
        const rewardsQ = query(collection(db, 'reward_penalty_history'), where('teacher_id', '==', teacherId));

        const unsubs = [
            onSnapshot(studentsQ, scheduleRefetch, (error) => logError('useStatistics:studentsSnapshot', error)),
            onSnapshot(attendanceQ, scheduleRefetch, (error) => logError('useStatistics:attendanceSnapshot', error)),
            onSnapshot(rewardsQ, scheduleRefetch, (error) => logError('useStatistics:rewardsSnapshot', error)),
        ];

        return () => {
            unsubs.forEach((unsubscribe) => unsubscribe());
            if (refreshTimer) {
                clearTimeout(refreshTimer);
            }
        };
    }, [teacherId, fetchStatistics]);

    return {
        stats,
        monthlyData,
        loading,
        refetch: () => fetchStatistics(true)
    };
};
