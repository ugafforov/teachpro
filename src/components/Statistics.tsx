import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, TrendingUp, Trophy, Calendar, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StatisticsProps {
  teacherId: string;
}

interface StatsData {
  totalStudents: number;
  totalClasses: number;
  averageAttendance: number;
  topStudent: string;
}

interface MonthlyData {
  month: string;
  totalClasses: number;
  averageAttendance: number;
  totalStudents: number;
}

const Statistics: React.FC<StatisticsProps> = ({ teacherId }) => {
  const [stats, setStats] = useState<StatsData>({
    totalStudents: 0,
    totalClasses: 0,
    averageAttendance: 0,
    topStudent: ''
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('1oy');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Statistika</h2>
          <p className="text-muted-foreground">Davomat tahlili va statistikalar</p>
        </div>
        <div className="flex gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1oy">1 oy</SelectItem>
              <SelectItem value="12oy">Barcha guruhlar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Asosiy statistika kartalari */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="apple-card p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalStudents}</p>
              <p className="text-sm text-muted-foreground">Jami o'quvchilar</p>
            </div>
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalClasses}</p>
              <p className="text-sm text-muted-foreground">Jami darslar</p>
            </div>
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.averageAttendance.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">O'rtacha davomat</p>
            </div>
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-lg font-bold truncate">{stats.topStudent}</p>
              <p className="text-sm text-muted-foreground">Eng yaxshi o'quvchi</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Oylik statistika */}
      {monthlyData.length > 0 && (
        <Card className="apple-card p-6">
          <h3 className="text-lg font-semibold mb-4">Oylik tahlil</h3>
          <div className="space-y-4">
            {monthlyData.map((month, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{month.month}</p>
                  <p className="text-sm text-muted-foreground">
                    {month.totalClasses} dars • {month.totalStudents} o'quvchi
                  </p>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {month.averageAttendance.toFixed(1)}% davomat
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Statistics;
