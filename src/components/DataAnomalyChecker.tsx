import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Search, Calendar, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { formatDateUz } from '@/lib/utils';

interface DataAnomalyCheckerProps {
  teacherId: string;
}

interface GroupAnomaly {
  groupId: string;
  groupName: string;
  lastAttendanceDate: string | null;
  totalStudents: number;
  daysWithoutAttendance: number;
  hasRecentGaps: boolean;
  gapDetails: { start: string; end: string; days: number }[];
}

const DataAnomalyChecker: React.FC<DataAnomalyCheckerProps> = ({ teacherId }) => {
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<GroupAnomaly[]>([]);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const { toast } = useToast();

  const checkAnomalies = async () => {
    setLoading(true);
    try {
      const groupsQ = query(
        collection(db, 'groups'),
        where('teacher_id', '==', teacherId),
        where('is_active', '==', true)
      );
      const groupsSnap = await getDocs(groupsQ);
      const groups = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const anomalyResults: GroupAnomaly[] = [];
      const today = new Date();

      for (const group of groups) {
        const studentsQ = query(
          collection(db, 'students'),
          where('teacher_id', '==', teacherId),
          where('group_name', '==', group.name),
          where('is_active', '==', true)
        );
        const studentsSnap = await getDocs(studentsQ);
        const studentIds = studentsSnap.docs.map(d => d.id);

        if (studentIds.length === 0) continue;

        const attendanceQ = query(
          collection(db, 'attendance_records'),
          where('teacher_id', '==', teacherId),
          orderBy('date', 'asc')
        );
        const attendanceSnap = await getDocs(attendanceQ);
        const groupAttendance = attendanceSnap.docs
          .map(d => d.data())
          .filter(d => studentIds.includes(d.student_id));

        const attendanceDates = [...new Set(groupAttendance.map(a => a.date))].sort();
        const lastDate = attendanceDates.length > 0 ? attendanceDates[attendanceDates.length - 1] : null;

        const lastAttendanceDate = lastDate ? new Date(lastDate) : null;
        const daysWithout = lastAttendanceDate
          ? Math.floor((today.getTime() - lastAttendanceDate.getTime()) / (1000 * 60 * 60 * 24))
          : -1;

        const gaps: { start: string; end: string; days: number }[] = [];
        for (let i = 1; i < attendanceDates.length; i++) {
          const prevDate = new Date(attendanceDates[i - 1]);
          const currDate = new Date(attendanceDates[i]);
          const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff > 5) {
            gaps.push({
              start: attendanceDates[i - 1],
              end: attendanceDates[i],
              days: daysDiff
            });
          }
        }

        const hasRecentGaps = gaps.some(g => {
          const gapEnd = new Date(g.end);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return gapEnd > thirtyDaysAgo;
        });

        if (daysWithout > 5 || gaps.length > 0) {
          anomalyResults.push({
            groupId: group.id,
            groupName: group.name,
            lastAttendanceDate: lastDate,
            totalStudents: studentIds.length,
            daysWithoutAttendance: daysWithout,
            hasRecentGaps,
            gapDetails: gaps
          });
        }
      }

      anomalyResults.sort((a, b) => b.daysWithoutAttendance - a.daysWithoutAttendance);
      setAnomalies(anomalyResults);
      setLastCheckTime(new Date().toLocaleString('uz-UZ'));

      if (anomalyResults.length === 0) {
        toast({ title: "Tekshiruv yakunlandi", description: "Hech qanday anomaliya topilmadi." });
      } else {
        toast({ title: "Anomaliyalar topildi", description: `${anomalyResults.length} ta guruhda bo'shliqlar aniqlandi`, variant: "destructive" });
      }
    } catch (error) {
      console.error('Error checking anomalies:', error);
      toast({ title: "Xatolik", description: "Anomaliyalarni tekshirishda xatolik yuz berdi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (daysWithout: number) => {
    if (daysWithout > 14) return 'destructive';
    if (daysWithout > 7) return 'default';
    return 'secondary';
  };

  const getSeverityText = (daysWithout: number) => {
    if (daysWithout > 14) return 'Jiddiy';
    if (daysWithout > 7) return 'O\'rtacha';
    return 'Past';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-yellow-500" />Ma'lumotlar anomaliyasini tekshirish</h3>
          <p className="text-sm text-muted-foreground mt-1">Barcha guruhlardagi davomat bo'shliqlarini aniqlash</p>
        </div>
        <Button onClick={checkAnomalies} disabled={loading} className="flex items-center gap-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Tekshirilmoqda...' : 'Tekshirishni boshlash'}
        </Button>
      </div>

      {lastCheckTime && <p className="text-sm text-muted-foreground">Oxirgi tekshiruv: {lastCheckTime}</p>}

      {anomalies.length === 0 && lastCheckTime && (
        <Card className="p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h4 className="text-lg font-medium">Hech qanday anomaliya topilmadi</h4>
          <p className="text-muted-foreground mt-2">Barcha guruhlar normal ishlayapti</p>
        </Card>
      )}

      {anomalies.length > 0 && (
        <div className="space-y-4">
          {anomalies.map((anomaly) => (
            <Card key={anomaly.groupId} className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <h4 className="text-lg font-semibold">{anomaly.groupName}</h4>
                    <Badge variant={getSeverityColor(anomaly.daysWithoutAttendance)}>{getSeverityText(anomaly.daysWithoutAttendance)}</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2"><Calendar className="w-4 h-4" />Oxirgi davomat: {anomaly.lastAttendanceDate ? formatDateUz(anomaly.lastAttendanceDate) : 'Mavjud emas'}</p>
                    <p>O'quvchilar soni: {anomaly.totalStudents}</p>
                    {anomaly.daysWithoutAttendance > 0 && <p className="text-red-600 font-medium">{anomaly.daysWithoutAttendance} kun davomatsiz</p>}
                  </div>
                </div>
                {anomaly.gapDetails.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Bo'shliqlar ({anomaly.gapDetails.length} ta):</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {anomaly.gapDetails.slice(-5).map((gap, idx) => <p key={idx} className="text-xs text-yellow-700 dark:text-yellow-300">{formatDateUz(gap.start)} → {formatDateUz(gap.end)} ({gap.days} kun)</p>)}
                      {anomaly.gapDetails.length > 5 && <p className="text-xs text-yellow-600">... va yana {anomaly.gapDetails.length - 5} ta bo'shliq</p>}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DataAnomalyChecker;
