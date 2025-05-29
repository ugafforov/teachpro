
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, Users, Award, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StatisticsProps {
  teacherId: string;
}

const Statistics: React.FC<StatisticsProps> = ({ teacherId }) => {
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [groupStats, setGroupStats] = useState<any[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1month');
  const [groups, setGroups] = useState<string[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    averageAttendance: 0,
    topPerformer: ''
  });
  const [loading, setLoading] = useState(true);

  const periodOptions = [
    { value: '1day', label: '1 kun', days: 1 },
    { value: '1week', label: '1 hafta', days: 7 },
    { value: '2weeks', label: '2 hafta', days: 14 },
    { value: '1month', label: '1 oy', days: 30 },
    { value: '2months', label: '2 oy', days: 60 },
    { value: '3months', label: '3 oy', days: 90 },
    { value: '6months', label: '6 oy', days: 180 },
    { value: '10months', label: '10 oy', days: 300 },
  ];

  useEffect(() => {
    fetchGroups();
    fetchStatistics();
  }, [teacherId]);

  useEffect(() => {
    fetchStatistics();
  }, [selectedGroup, selectedPeriod]);

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
    try {
      const selectedPeriodDays = periodOptions.find(p => p.value === selectedPeriod)?.days || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - selectedPeriodDays);

      // Fetch attendance statistics
      let attendanceQuery = supabase
        .from('attendance_records')
        .select(`
          status,
          date,
          students!inner(name, group_name, is_active)
        `)
        .eq('teacher_id', teacherId)
        .eq('students.is_active', true)
        .gte('date', startDate.toISOString().split('T')[0]);

      if (selectedGroup !== 'all') {
        attendanceQuery = attendanceQuery.eq('students.group_name', selectedGroup);
      }

      const { data: attendanceRecords, error: attendanceError } = await attendanceQuery;
      if (attendanceError) throw attendanceError;

      // Calculate attendance distribution
      const statusCounts = attendanceRecords?.reduce((acc, record) => {
        acc[record.status] = (acc[record.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const attendanceChartData = [
        { name: 'Kelgan', value: statusCounts.present || 0, color: '#22c55e' },
        { name: 'Kechikkan', value: statusCounts.late || 0, color: '#f59e0b' },
        { name: 'Kelmagan', value: statusCounts.absent || 0, color: '#ef4444' }
      ];

      setAttendanceData(attendanceChartData);

      // Calculate group statistics
      if (selectedGroup === 'all') {
        const groupData = groups.map(groupName => {
          const groupRecords = attendanceRecords?.filter(r => r.students.group_name === groupName) || [];
          const present = groupRecords.filter(r => r.status === 'present').length;
          const total = groupRecords.length;
          const percentage = total > 0 ? (present / total) * 100 : 0;

          return {
            name: groupName,
            attendance: Math.round(percentage * 100) / 100,
            total: total,
            present: present
          };
        });

        setGroupStats(groupData);
      } else {
        setGroupStats([]);
      }

      // Calculate time series data based on selected period
      const timeSeriesData = [];
      const periodDays = periodOptions.find(p => p.value === selectedPeriod)?.days || 30;
      
      if (selectedPeriod === '1day') {
        // Hourly data for 1 day
        for (let hour = 0; hour < 24; hour++) {
          const hourRecords = attendanceRecords?.filter(record => {
            const recordDate = new Date(record.date);
            return recordDate.getHours() === hour;
          }) || [];

          const present = hourRecords.filter(r => r.status === 'present').length;
          const total = hourRecords.length;
          const percentage = total > 0 ? (present / total) * 100 : 0;

          timeSeriesData.push({
            period: `${hour}:00`,
            attendance: Math.round(percentage * 100) / 100,
            total: total,
            present: present
          });
        }
      } else if (selectedPeriod === '1week' || selectedPeriod === '2weeks') {
        // Daily data for weeks
        const days = selectedPeriod === '1week' ? 7 : 14;
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          
          const dayRecords = attendanceRecords?.filter(record => record.date === dateStr) || [];
          const present = dayRecords.filter(r => r.status === 'present').length;
          const total = dayRecords.length;
          const percentage = total > 0 ? (present / total) * 100 : 0;

          timeSeriesData.push({
            period: date.toLocaleDateString('uz-UZ', { weekday: 'short', day: 'numeric' }),
            attendance: Math.round(percentage * 100) / 100,
            total: total,
            present: present
          });
        }
      } else {
        // Monthly data for longer periods
        const months = Math.ceil(periodDays / 30);
        for (let i = months - 1; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
          const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          
          const monthRecords = attendanceRecords?.filter(record => {
            const recordDate = new Date(record.date);
            return recordDate >= monthStart && recordDate <= monthEnd;
          }) || [];

          const present = monthRecords.filter(r => r.status === 'present').length;
          const total = monthRecords.length;
          const percentage = total > 0 ? (present / total) * 100 : 0;

          timeSeriesData.push({
            period: date.toLocaleDateString('uz-UZ', { month: 'short', year: 'numeric' }),
            attendance: Math.round(percentage * 100) / 100,
            total: total,
            present: present
          });
        }
      }

      setTimeSeriesData(timeSeriesData);

      // Calculate summary statistics
      const totalRecords = attendanceRecords?.length || 0;
      const presentCount = attendanceRecords?.filter(r => r.status === 'present').length || 0;
      const avgAttendance = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;

      // Get unique students count
      const uniqueStudents = new Set(attendanceRecords?.map(r => r.students.name) || []).size;

      // Find top performer
      const studentStats = attendanceRecords?.reduce((acc, record) => {
        const studentName = record.students.name;
        if (!acc[studentName]) {
          acc[studentName] = { present: 0, total: 0 };
        }
        acc[studentName].total += 1;
        if (record.status === 'present') {
          acc[studentName].present += 1;
        }
        return acc;
      }, {} as Record<string, { present: number; total: number }>) || {};

      let topPerformer = '';
      let bestAttendance = 0;
      Object.entries(studentStats).forEach(([name, stats]) => {
        const percentage = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
        if (percentage > bestAttendance && stats.total >= 3) {
          bestAttendance = percentage;
          topPerformer = name;
        }
      });

      setSummaryStats({
        totalStudents: uniqueStudents,
        totalClasses: totalRecords,
        averageAttendance: Math.round(avgAttendance * 100) / 100,
        topPerformer: topPerformer || 'Ma\'lumot yo\'q'
      });

    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
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
          <div className="w-full sm:w-48">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Davr tanlang" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="apple-card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Jami o'quvchilar</p>
              <p className="text-2xl font-bold">{summaryStats.totalStudents}</p>
            </div>
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Jami darslar</p>
              <p className="text-2xl font-bold">{summaryStats.totalClasses}</p>
            </div>
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">O'rtacha davomat</p>
              <p className="text-2xl font-bold">{summaryStats.averageAttendance}%</p>
            </div>
          </div>
        </Card>

        <Card className="apple-card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Eng yaxshi o'quvchi</p>
              <p className="text-lg font-bold truncate">{summaryStats.topPerformer}</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Umumiy ko'rinish</TabsTrigger>
          <TabsTrigger value="trends">Tendensiyalar</TabsTrigger>
          <TabsTrigger value="details">Batafsil</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance Distribution */}
            <Card className="apple-card p-6">
              <h3 className="text-lg font-semibold mb-4">Davomat taqsimoti</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {attendanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Group Comparison */}
            {selectedGroup === 'all' && groupStats.length > 0 && (
              <Card className="apple-card p-6">
                <h3 className="text-lg font-semibold mb-4">Guruhlar bo'yicha taqqoslash</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => [`${value}%`, 'Davomat foizi']} />
                      <Legend />
                      <Bar dataKey="attendance" fill="#22c55e" name="Davomat foizi" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {/* Time Series Trend */}
          <Card className="apple-card p-6">
            <h3 className="text-lg font-semibold mb-4">
              Davomat tendensiyasi ({periodOptions.find(p => p.value === selectedPeriod)?.label})
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => [`${value}%`, 'Davomat foizi']} />
                  <Line 
                    type="monotone" 
                    dataKey="attendance" 
                    stroke="#22c55e" 
                    strokeWidth={3}
                    dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          {/* Detailed Stats Table */}
          <Card className="apple-card p-6">
            <h3 className="text-lg font-semibold mb-4">
              Batafsil statistika ({periodOptions.find(p => p.value === selectedPeriod)?.label})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Davr</th>
                    <th className="text-right p-2">Jami darslar</th>
                    <th className="text-right p-2">Kelgan</th>
                    <th className="text-right p-2">Davomat %</th>
                  </tr>
                </thead>
                <tbody>
                  {timeSeriesData.map((period, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{period.period}</td>
                      <td className="p-2 text-right">{period.total}</td>
                      <td className="p-2 text-right">{period.present}</td>
                      <td className="p-2 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          period.attendance >= 90 ? 'bg-green-100 text-green-800' :
                          period.attendance >= 80 ? 'bg-blue-100 text-blue-800' :
                          period.attendance >= 70 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {period.attendance}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Statistics;
