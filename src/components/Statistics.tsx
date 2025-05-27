
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, Calendar, Target, Clock } from 'lucide-react';

interface StatisticsProps {
  teacherId: string;
}

const Statistics: React.FC<StatisticsProps> = ({ teacherId }) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('30');
  const [groups, setGroups] = useState<string[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalStudents: 0,
    averageAttendance: 0,
    presentToday: 0,
    totalClasses: 0,
    trend: 0,
    bestGroup: '',
    worstGroup: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
    fetchStatistics();
  }, [teacherId]);

  useEffect(() => {
    fetchStatistics();
  }, [selectedGroup, selectedTimeRange]);

  const fetchGroups = async () => {
    try {
      const { data: students, error } = await supabase
        .from('students')
        .select('group_name')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (error) throw error;

      const uniqueGroups = [...new Set(students?.map(s => s.group_name) || [])];
      setGroups(uniqueGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      // O'quvchilarni olish
      let studentsQuery = supabase
        .from('students')
        .select('id, name, group_name')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (selectedGroup !== 'all') {
        studentsQuery = studentsQuery.eq('group_name', selectedGroup);
      }

      const { data: students, error: studentsError } = await studentsQuery;
      if (studentsError) throw studentsError;

      const studentIds = students?.map(s => s.id) || [];

      if (studentIds.length === 0) {
        setAttendanceData([]);
        setWeeklyData([]);
        setMonthlyData([]);
        setSummaryStats({
          totalStudents: 0,
          averageAttendance: 0,
          presentToday: 0,
          totalClasses: 0,
          trend: 0,
          bestGroup: '',
          worstGroup: ''
        });
        setLoading(false);
        return;
      }

      // Davomat ma'lumotlarini olish
      const daysAgo = parseInt(selectedTimeRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('date, status, student_id')
        .eq('teacher_id', teacherId)
        .in('student_id', studentIds)
        .gte('date', startDate.toISOString().split('T')[0]);

      if (attendanceError) throw attendanceError;

      // Ma'lumotlarni qayta ishlash
      const dailyAttendance = processDailyAttendance(attendance || [], daysAgo);
      const weeklyAttendance = processWeeklyAttendance(attendance || []);
      const monthlyAttendance = processMonthlyAttendance(attendance || []);
      
      setAttendanceData(dailyAttendance);
      setWeeklyData(weeklyAttendance);
      setMonthlyData(monthlyAttendance);

      // Umumiy statistikani hisoblash
      await calculateSummaryStats(students || [], attendance || []);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processDailyAttendance = (attendance: any[], days: number) => {
    const dailyData: { [key: string]: { present: number; absent: number; late: number; total: number } } = {};
    
    // So'nggi kunlar uchun boshlang'ich ma'lumotlar
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyData[dateKey] = { present: 0, absent: 0, late: 0, total: 0 };
    }
    
    attendance.forEach(record => {
      const date = record.date;
      if (dailyData[date]) {
        dailyData[date][record.status]++;
        dailyData[date].total++;
      }
    });

    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
        rawDate: date,
        present: data.present,
        absent: data.absent,
        late: data.late,
        total: data.total,
        percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
      }))
      .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());
  };

  const processWeeklyAttendance = (attendance: any[]) => {
    const weeklyData: { [key: string]: { present: number; total: number } } = {};
    
    attendance.forEach(record => {
      const date = new Date(record.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { present: 0, total: 0 };
      }
      
      weeklyData[weekKey].total++;
      if (record.status === 'present') {
        weeklyData[weekKey].present++;
      }
    });

    return Object.entries(weeklyData)
      .map(([week, data]) => ({
        week: new Date(week).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
        rawWeek: week,
        present: data.present,
        total: data.total,
        percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
      }))
      .sort((a, b) => new Date(a.rawWeek).getTime() - new Date(b.rawWeek).getTime())
      .slice(-8);
  };

  const processMonthlyAttendance = (attendance: any[]) => {
    const monthlyData: { [key: string]: { present: number; total: number } } = {};
    
    attendance.forEach(record => {
      const date = new Date(record.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { present: 0, total: 0 };
      }
      
      monthlyData[monthKey].total++;
      if (record.status === 'present') {
        monthlyData[monthKey].present++;
      }
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long' }),
        rawMonth: month,
        present: data.present,
        total: data.total,
        percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
      }))
      .sort((a, b) => a.rawMonth.localeCompare(b.rawMonth))
      .slice(-6);
  };

  const calculateSummaryStats = async (students: any[], attendance: any[]) => {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);
    const presentToday = todayAttendance.filter(a => a.status === 'present').length;
    
    const totalRecords = attendance.length;
    const presentRecords = attendance.filter(a => a.status === 'present').length;
    const averageAttendance = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

    // Haftalik trend hisoblash
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const lastWeek = attendance.filter(a => 
      new Date(a.date) >= sevenDaysAgo && a.status === 'present'
    ).length;
    
    const previousWeek = attendance.filter(a => 
      new Date(a.date) >= fourteenDaysAgo && 
      new Date(a.date) < sevenDaysAgo && 
      a.status === 'present'
    ).length;

    const trend = previousWeek > 0 ? Math.round(((lastWeek - previousWeek) / previousWeek) * 100) : 0;

    // Guruhlar bo'yicha statistika
    let bestGroup = '';
    let worstGroup = '';
    
    if (selectedGroup === 'all' && groups.length > 1) {
      const groupStats = await Promise.all(
        groups.map(async (groupName) => {
          const groupStudents = students.filter(s => s.group_name === groupName);
          const groupAttendance = attendance.filter(a => 
            groupStudents.some(s => s.id === a.student_id)
          );
          const groupPresent = groupAttendance.filter(a => a.status === 'present').length;
          const groupTotal = groupAttendance.length;
          const groupPercentage = groupTotal > 0 ? (groupPresent / groupTotal) * 100 : 0;
          
          return { groupName, percentage: groupPercentage };
        })
      );
      
      if (groupStats.length > 0) {
        groupStats.sort((a, b) => b.percentage - a.percentage);
        bestGroup = groupStats[0].groupName;
        worstGroup = groupStats[groupStats.length - 1].groupName;
      }
    }

    // Umumiy darslar soni
    const uniqueDates = [...new Set(attendance.map(a => a.date))];
    const totalClasses = uniqueDates.length;

    setSummaryStats({
      totalStudents: students.length,
      averageAttendance,
      presentToday,
      totalClasses,
      trend,
      bestGroup,
      worstGroup
    });
  };

  const pieData = [
    { name: 'Kelgan', value: summaryStats.presentToday, color: '#10b981' },
    { name: 'Kelmagan', value: Math.max(0, summaryStats.totalStudents - summaryStats.presentToday), color: '#ef4444' }
  ];

  const timeRangeOptions = [
    { value: '7', label: '7 kun' },
    { value: '14', label: '2 hafta' },
    { value: '30', label: '1 oy' },
    { value: '60', label: '2 oy' },
    { value: '90', label: '3 oy' }
  ];

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
          <p className="text-muted-foreground">Davomat statistikasi va tahlil</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeRangeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Guruhni tanlang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha guruhlar</SelectItem>
              {groups.map(group => (
                <SelectItem key={group} value={group}>{group}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Umumiy ko'rsatkichlar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="apple-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Jami o'quvchilar</p>
              <p className="text-2xl font-bold">{summaryStats.totalStudents}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">O'rtacha davomat</p>
              <p className="text-2xl font-bold">{summaryStats.averageAttendance}%</p>
            </div>
            <Target className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Bugun kelgan</p>
              <p className="text-2xl font-bold">{summaryStats.presentToday}</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Jami darslar</p>
              <p className="text-2xl font-bold">{summaryStats.totalClasses}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Qo'shimcha ko'rsatkichlar */}
      {summaryStats.bestGroup && summaryStats.worstGroup && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="apple-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Eng yaxshi guruh</p>
                <p className="text-lg font-bold text-green-600">{summaryStats.bestGroup}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card className="apple-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Haftalik trend</p>
                <p className="text-lg font-bold flex items-center">
                  {summaryStats.trend >= 0 ? '+' : ''}{summaryStats.trend}%
                  {summaryStats.trend >= 0 ? 
                    <TrendingUp className="w-5 h-5 text-green-500 ml-2" /> : 
                    <TrendingDown className="w-5 h-5 text-red-500 ml-2" />
                  }
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Diagrammalar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="apple-card p-6">
          <h3 className="text-lg font-semibold mb-4">Kunlik davomat foizi</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => [`${value}%`, 'Davomat']} />
              <Line 
                type="monotone" 
                dataKey="percentage" 
                stroke="#0ea5e9" 
                strokeWidth={3}
                dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="apple-card p-6">
          <h3 className="text-lg font-semibold mb-4">Bugungi davomat</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center space-x-4 mt-4">
            {pieData.map((entry, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-sm">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Haftalik va oylik ma'lumotlar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="apple-card p-6">
          <h3 className="text-lg font-semibold mb-4">Haftalik davomat</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => [`${value}%`, 'Davomat']} />
              <Bar dataKey="percentage" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="apple-card p-6">
          <h3 className="text-lg font-semibold mb-4">Oylik davomat</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => [`${value}%`, 'Davomat']} />
              <Bar dataKey="percentage" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

export default Statistics;
