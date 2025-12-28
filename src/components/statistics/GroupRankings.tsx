
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Clock, TrendingUp, Medal, Award, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface GroupRanking {
  groupName: string;
  totalStudents: number;
  attendancePercentage: number;
  latePercentage: number;
  absentPercentage: number;
  totalClasses: number;
  efficiency: number;
  rank: number;
}

interface GroupRankingsProps {
  teacherId: string;
  selectedPeriod: string;
}

const GroupRankings: React.FC<GroupRankingsProps> = ({ teacherId, selectedPeriod }) => {
  const [groupRankings, setGroupRankings] = useState<GroupRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroupRankings();
  }, [teacherId, selectedPeriod]);

  const getPeriodStartDate = (period: string) => {
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1kun':
        startDate.setDate(now.getDate() - 1);
        break;
      case '1hafta':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1oy':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '2oy':
        startDate.setMonth(now.getMonth() - 2);
        break;
      case '3oy':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '4oy':
        startDate.setMonth(now.getMonth() - 4);
        break;
      case '5oy':
        startDate.setMonth(now.getMonth() - 5);
        break;
      case '6oy':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '7oy':
        startDate.setMonth(now.getMonth() - 7);
        break;
      case '8oy':
        startDate.setMonth(now.getMonth() - 8);
        break;
      case '9oy':
        startDate.setMonth(now.getMonth() - 9);
        break;
      case '10oy':
        startDate.setMonth(now.getMonth() - 10);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }
    
    return startDate.toISOString().split('T')[0];
  };

  const fetchGroupRankings = async () => {
    try {
      setLoading(true);
      const startDate = getPeriodStartDate(selectedPeriod);

      // Get all active groups for this teacher
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('name')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (groupsError) throw groupsError;

      if (!groups || groups.length === 0) {
        setGroupRankings([]);
        return;
      }

      const rankings: GroupRanking[] = [];

      for (const group of groups) {
        // Get students count for this group
        const { count: studentCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', teacherId)
          .eq('group_name', group.name)
          .eq('is_active', true);

        // Get attendance data for this group within the selected period
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance_records')
          .select(`
            date,
            status,
            students!inner(group_name, is_active)
          `)
          .eq('teacher_id', teacherId)
          .eq('students.group_name', group.name)
          .eq('students.is_active', true)
          .gte('date', startDate)
          .range(0, 10000);

        if (attendanceError) throw attendanceError;

        if (attendanceData && studentCount) {
          // Calculate unique classes
          const uniqueDates = [...new Set(attendanceData.map(record => record.date))];
          const totalClasses = uniqueDates.length;

          // Calculate attendance statistics
          const totalRecords = attendanceData.length;
          const presentRecords = attendanceData.filter(record => 
            record.status === 'present' || record.status === 'late'
          ).length;
          const lateRecords = attendanceData.filter(record => 
            record.status === 'late'
          ).length;
          const absentRecords = attendanceData.filter(record => 
            record.status === 'absent_with_reason' || 
            record.status === 'absent_without_reason'
          ).length;

          const attendancePercentage = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0;
          const latePercentage = totalRecords > 0 ? (lateRecords / totalRecords) * 100 : 0;
          const absentPercentage = totalRecords > 0 ? (absentRecords / totalRecords) * 100 : 0;

          // New efficiency formula: (Attendance% + (100% - Late%) + (100% - Absent%)) / 3
          const efficiency = (attendancePercentage + (100 - latePercentage) + (100 - absentPercentage)) / 3;

          rankings.push({
            groupName: group.name,
            totalStudents: studentCount,
            attendancePercentage: Math.round(attendancePercentage * 100) / 100,
            latePercentage: Math.round(latePercentage * 100) / 100,
            absentPercentage: Math.round(absentPercentage * 100) / 100,
            totalClasses,
            efficiency: Math.round(efficiency * 100) / 100,
            rank: 0 // Will be set after sorting
          });
        }
      }

      // Sort by efficiency (highest first) and assign ranks
      rankings.sort((a, b) => b.efficiency - a.efficiency);
      rankings.forEach((ranking, index) => {
        ranking.rank = index + 1;
      });

      setGroupRankings(rankings);
    } catch (error) {
      console.error('Error fetching group rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <Target className="w-6 h-6 text-gray-500" />;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300';
      case 2:
        return 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300';
      case 3:
        return 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300';
      default:
        return 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200';
    }
  };

  const getEfficiencyBadgeColor = (efficiency: number) => {
    if (efficiency >= 90) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (efficiency >= 80) return 'bg-green-100 text-green-800 border-green-300';
    if (efficiency >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (efficiency >= 60) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getEfficiencyLevel = (efficiency: number) => {
    if (efficiency >= 95) return 'Ajoyib';
    if (efficiency >= 90) return 'Yaxshi';
    if (efficiency >= 80) return 'O\'rtacha';
    if (efficiency >= 70) return 'Qoniqarli';
    if (efficiency >= 60) return 'Zaif';
    return 'Juda zaif';
  };

  if (loading) {
    return (
      <Card className="apple-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Guruhlar reytingi</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  if (groupRankings.length === 0) {
    return (
      <Card className="apple-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Guruhlar reytingi</h3>
        </div>
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Guruhlar ma'lumotlari topilmadi</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="apple-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Guruhlar reytingi</h3>
        </div>
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          {groupRankings.length} guruh
        </Badge>
      </div>

      <div className="space-y-4">
        {groupRankings.map((group, index) => (
          <div
            key={group.groupName}
            className={`border rounded-xl p-5 hover:shadow-lg transition-all duration-300 ${getRankColor(group.rank)}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/70 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm">
                  {getRankIcon(group.rank)}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-lg text-gray-800">{group.groupName}</h4>
                    <Badge variant="secondary" className="bg-white/50 text-gray-700 border-gray-300">
                      #{group.rank}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {group.totalStudents} o'quvchi • {group.totalClasses} dars
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge 
                  variant="secondary" 
                  className={`${getEfficiencyBadgeColor(group.efficiency)} border font-bold text-lg px-3 py-1`}
                >
                  {getEfficiencyLevel(group.efficiency)}
                </Badge>
                <p className="text-xs text-gray-500 mt-1">{group.efficiency}% Samaradorlik</p>
              </div>
            </div>

            {/* Progress bars */}
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Davomat</span>
                  <span>{group.attendancePercentage}%</span>
                </div>
                <div className="w-full bg-white/50 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${group.attendancePercentage}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Kech qolish</span>
                  <span>{group.latePercentage}%</span>
                </div>
                <div className="w-full bg-white/50 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-orange-500 transition-all duration-500"
                    style={{ width: `${group.latePercentage}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Kelmagan</span>
                  <span>{group.absentPercentage}%</span>
                </div>
                <div className="w-full bg-white/50 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-red-500 transition-all duration-500"
                    style={{ width: `${group.absentPercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="text-center bg-white/50 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-xs text-gray-600 font-medium">O'quvchilar</p>
                <p className="font-bold text-lg text-gray-800">{group.totalStudents}</p>
              </div>
              <div className="text-center bg-white/50 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-xs text-gray-600 font-medium">Davomat</p>
                <p className="font-bold text-lg text-gray-800">{group.attendancePercentage}%</p>
              </div>
              <div className="text-center bg-white/50 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                </div>
                <p className="text-xs text-gray-600 font-medium">Kech qolish</p>
                <p className="font-bold text-lg text-gray-800">{group.latePercentage}%</p>
              </div>
              <div className="text-center bg-white/50 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <Target className="w-4 h-4 text-purple-500" />
                </div>
                <p className="text-xs text-gray-600 font-medium">Samaradorlik</p>
                <p className="font-bold text-lg text-gray-800">{group.efficiency}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-sm text-gray-700 mb-3">Samaradorlik hisoblash formulasi:</h4>
        <p className="text-xs text-gray-600 leading-relaxed">
          <strong>Samaradorlik = (Davomat% + (100% - Kech qolish%) + (100% - Kelmagan%)) / 3</strong>
          <br />
          Bu formula davomat, kech qolmaslik va kelmay qolmaslik ko'rsatkichlarini teng darajada hisobga olib,
          guruh samaradorligini aniqlaydi. Yuqori davomat, kam kech qolish va kam kelmay qolish = yuqori samaradorlik
        </p>
      </div>
    </Card>
  );
};

export default GroupRankings;
