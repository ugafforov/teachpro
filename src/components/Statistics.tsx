
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Users, Calendar } from 'lucide-react';

interface StatisticsProps {
  teacherId: string;
}

const Statistics: React.FC<StatisticsProps> = ({ teacherId }) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [groups, setGroups] = useState<string[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalStudents: 0,
    averageAttendance: 0,
    presentToday: 0,
    trend: 0
  });

  useEffect(() => {
    fetchGroups();
    fetchStatistics();
  }, [teacherId]);

  useEffect(() => {
    fetchStatistics();
  }, [selectedGroup]);

  const fetchGroups = async () => {
    try {
      const { data: students, error } = await supabase
        .from('students')
        .select('group_name')
        .eq('teacher_id', teacherId);

      if (error) throw error;

      const uniqueGroups = [...new Set(students?.map(s => s.group_name) || [])];
      setGroups(uniqueGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchStatistics = async () => {
    try {
      // Get students for selected group
      let studentsQuery = supabase
        .from('students')
        .select('id, name, group_name')
        .eq('teacher_id', teacherId);

      if (selectedGroup !== 'all') {
        studentsQuery = studentsQuery.eq('group_name', selectedGroup);
      }

      const { data: students, error: studentsError } = await studentsQuery;
      if (studentsError) throw studentsError;

      const studentIds = students?.map(s => s.id) || [];

      // Get attendance records for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('date, status, student_id')
        .eq('teacher_id', teacherId)
        .in('student_id', studentIds)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

      if (attendanceError) throw attendanceError;

      // Process attendance data for charts
      const dailyAttendance = processDailyAttendance(attendance || []);
      const weeklyAttendance = processWeeklyAttendance(attendance || []);
      
      setAttendanceData(dailyAttendance);
      setWeeklyData(weeklyAttendance);

      // Calculate summary statistics
      const today = new Date().toISOString().split('T')[0];
      const todayAttendance = attendance?.filter(a => a.date === today) || [];
      const presentToday = todayAttendance.filter(a => a.status === 'present').length;
      
      const totalRecords = attendance?.length || 0;
      const presentRecords = attendance?.filter(a => a.status === 'present').length || 0;
      const averageAttendance = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0;

      // Calculate trend (compare last 7 days with previous 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const lastWeek = attendance?.filter(a => 
        new Date(a.date) >= sevenDaysAgo && a.status === 'present'
      ).length || 0;
      
      const previousWeek = attendance?.filter(a => 
        new Date(a.date) >= fourteenDaysAgo && 
        new Date(a.date) < sevenDaysAgo && 
        a.status === 'present'
      ).length || 0;

      const trend = previousWeek > 0 ? ((lastWeek - previousWeek) / previousWeek) * 100 : 0;

      setSummaryStats({
        totalStudents: students?.length || 0,
        averageAttendance: Math.round(averageAttendance),
        presentToday,
        trend: Math.round(trend)
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const processDailyAttendance = (attendance: any[]) => {
    const dailyData: { [key: string]: { present: number; absent: number; late: number } } = {};
    
    attendance.forEach(record => {
      const date = record.date;
      if (!dailyData[date]) {
        dailyData[date] = { present: 0, absent: 0, late: 0 };
      }
      dailyData[date][record.status]++;
    });

    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        present: data.present,
        absent: data.absent,
        late: data.late,
        total: data.present + data.absent + data.late,
        percentage: data.present + data.absent + data.late > 0 
          ? Math.round((data.present / (data.present + data.absent + data.late)) * 100)
          : 0
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14); // Last 14 days
  };

  const processWeeklyAttendance = (attendance: any[]) => {
    const weeklyData: { [key: string]: number } = {};
    
    attendance.forEach(record => {
      if (record.status === 'present') {
        const date = new Date(record.date);
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        const weekKey = weekStart.toISOString().split('T')[0];
        weeklyData[weekKey] = (weeklyData[weekKey] || 0) + 1;
      }
    });

    return Object.entries(weeklyData)
      .map(([week, count]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        attendance: count
      }))
      .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime())
      .slice(-4); // Last 4 weeks
  };

  const pieData = [
    { name: 'Present', value: summaryStats.presentToday, color: '#10b981' },
    { name: 'Absent', value: summaryStats.totalStudents - summaryStats.presentToday, color: '#ef4444' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Statistics</h2>
          <p className="text-muted-foreground">View attendance insights and trends</p>
        </div>
        <div className="w-full sm:w-64">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger>
              <SelectValue placeholder="Select a group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groups.map(group => (
                <SelectItem key={group} value={group}>{group}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="apple-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Students</p>
              <p className="text-2xl font-bold">{summaryStats.totalStudents}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Average Attendance</p>
              <p className="text-2xl font-bold">{summaryStats.averageAttendance}%</p>
            </div>
            <Calendar className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Present Today</p>
              <p className="text-2xl font-bold">{summaryStats.presentToday}</p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Weekly Trend</p>
              <p className="text-2xl font-bold flex items-center">
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="apple-card p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Attendance Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="percentage" 
                stroke="#0ea5e9" 
                strokeWidth={2}
                dot={{ fill: '#0ea5e9' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="apple-card p-6">
          <h3 className="text-lg font-semibold mb-4">Today's Attendance</h3>
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

      <Card className="apple-card p-6">
        <h3 className="text-lg font-semibold mb-4">Weekly Attendance Summary</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="attendance" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Statistics;
