import React, { useState, useEffect } from 'react';
import { logError } from '@/lib/errorUtils';
import { Card } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, TrendingUp, Medal, Award, Target, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateGroupRankings, GroupRanking } from '@/lib/studentScoreCalculator';

interface GroupRankingsProps {
  teacherId: string;
  selectedPeriod: string;
}

const GroupRankings: React.FC<GroupRankingsProps> = ({ teacherId, selectedPeriod }) => {
  const [groupRankings, setGroupRankings] = useState<GroupRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchGroupRankings = async () => {
      try {
        setLoading(true);
        const rankings = await calculateGroupRankings(teacherId, selectedPeriod);
        setGroupRankings(rankings);
      } catch (error) {
        logError('GroupRankings:fetchGroupRankings', error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroupRankings();
  }, [teacherId, selectedPeriod]);

  const getAttendanceIcon = (rank: number) => {
    if (rank === 1) return '🏆';
    if (rank === 2) return '⭐';
    if (rank === 3) return '📈';
    return '📊';
  };

  const getGradientClass = (percentage: number) => {
    if (percentage >= 90) return 'bg-gradient-to-r from-emerald-50 via-emerald-50/50 to-white border-emerald-200 shadow-sm';
    if (percentage >= 75) return 'bg-gradient-to-r from-amber-50 via-amber-50/50 to-white border-amber-200 shadow-sm';
    if (percentage >= 60) return 'bg-gradient-to-r from-orange-50 via-orange-50/50 to-white border-orange-200 shadow-sm';
    return 'bg-gradient-to-r from-red-50 via-red-50/50 to-white border-red-200 shadow-sm';
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (percentage >= 75) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (percentage >= 60) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getPerformanceStatus = (percentage: number) => {
    if (percentage >= 90) return { label: "A'lo", icon: "🔥", color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-100" };
    if (percentage >= 75) return { label: "Yaxshi", icon: "⚡", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-100" };
    if (percentage >= 60) return { label: "O'rtacha", icon: "📊", color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-100" };
    return { label: "Past", icon: "⚠️", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-100" };
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Guruhlar reytingi</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Guruhlar reytingi</h3>
        </div>

        {groupRankings.length > 1 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
          >
            {showAll ? (
              <>
                Yopish <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                Barchasini ko'rish <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {groupRankings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>Ma'lumotlar topilmadi</p>
          </div>
        ) : (
          groupRankings.slice(0, showAll ? undefined : 1).map((group) => {
            const strictlyPresentPercentage = Math.max(0, group.attendancePercentage - (group.latePercentage || 0));
            const status = getPerformanceStatus(group.efficiency);

            return (
              <div
                key={group.groupName}
                className={`border rounded-2xl transition-all duration-300 hover:shadow-md ${getGradientClass(group.efficiency)} p-5`}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/70 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
                      <span className="text-2xl">{getAttendanceIcon(group.rank)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xl text-gray-800">{group.groupName}</h4>
                        <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 h-5 border-gray-300 text-gray-500">
                          #{group.rank}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {group.totalClasses} dars o'tildi
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="secondary"
                      className={`${getAttendanceColor(group.attendancePercentage)} border font-bold text-lg px-3 py-1`}
                    >
                      {group.attendancePercentage.toFixed(1)}%
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">Davomat ko'rsatkichi</p>
                  </div>
                </div>

                {/* Stats Section - Stacked Bar */}
                <div className="bg-white/50 rounded-xl p-4 border border-gray-100/50">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium text-gray-600">Umumiy ko'rsatkichlar</span>
                  </div>

                  {/* Stacked Progress Bar */}
                  <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex mb-4 shadow-inner">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500 hover:bg-emerald-400 relative group"
                      style={{ width: `${strictlyPresentPercentage}%` }}
                      title={`Davomat: ${strictlyPresentPercentage.toFixed(1)}%`}
                    ></div>
                    <div
                      className="h-full bg-amber-400 transition-all duration-500 hover:bg-amber-300 relative group"
                      style={{ width: `${group.latePercentage}%` }}
                      title={`Kech qolish: ${group.latePercentage.toFixed(1)}%`}
                    ></div>
                    <div
                      className="h-full bg-red-400 transition-all duration-500 hover:bg-red-300 relative group"
                      style={{ width: `${group.absentPercentage}%` }}
                      title={`Kelmagan: ${group.absentPercentage.toFixed(1)}%`}
                    ></div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-gray-500">O'quvchilar</span>
                      </div>
                      <p className="font-bold text-lg text-gray-800">{group.totalStudents}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <BookOpen className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-gray-500">Darslar</span>
                      </div>
                      <p className="font-bold text-lg text-gray-800">{group.totalClasses}</p>
                    </div>
                    <div className="text-center group cursor-default">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Target className="w-4 h-4 text-purple-500 group-hover:rotate-12 transition-transform" />
                        <span className="text-xs text-gray-500">Samaradorlik</span>
                      </div>
                      <div className={`inline-flex flex-col items-center px-3 py-1 rounded-xl ${status.bgColor} border ${status.borderColor} shadow-sm transition-all duration-300 group-hover:scale-105`}>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{status.icon}</span>
                          <span className={`font-bold text-sm ${status.color}`}>
                            {group.efficiency.toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tighter text-gray-500 leading-none">
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default GroupRankings;
