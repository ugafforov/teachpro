import React from 'react';
import { Card } from '@/components/ui/card';
import { Calendar, Users, TrendingUp, Award } from 'lucide-react';

interface GroupStatisticsCardProps {
  totalStudents: number;
  attendancePercentage: number;
  totalLessons: number;
  topStudent: { name: string; score: number } | null;
  loading?: boolean;
}

const GroupStatisticsCard: React.FC<GroupStatisticsCardProps> = ({
  totalStudents,
  attendancePercentage,
  totalLessons,
  topStudent,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="h-20 animate-pulse bg-gray-100/50 border-border/50" />
        ))}
      </div>
    );
  }

  const StatCard = ({
    icon: Icon,
    label,
    value,
    subValue
  }: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    subValue?: React.ReactNode;
  }) => (
    <Card className="apple-card p-4 border-border/50">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-500">{label}</div>
          <div className="text-xl font-bold text-gray-900 truncate">{value}</div>
          {subValue ? <div className="text-xs text-gray-500 truncate">{subValue}</div> : null}
        </div>
        <div className="h-10 w-10 rounded-full bg-gray-50 border border-border/50 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-gray-700" />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard icon={Users} label="O'quvchilar" value={totalStudents} subValue="Faol talabalar" />
      <StatCard
        icon={Award}
        label="Top o'quvchi"
        value={topStudent ? topStudent.name : '---'}
        subValue={topStudent ? `${topStudent.score} ball` : undefined}
      />
      <StatCard icon={Calendar} label="Darslar" value={totalLessons} subValue="Jami o'tilgan" />
      <StatCard icon={TrendingUp} label="Davomat" value={`${attendancePercentage}%`} subValue="O'rtacha foiz" />
    </div>
  );
};

export default GroupStatisticsCard;
