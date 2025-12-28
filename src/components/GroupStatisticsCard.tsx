import React from 'react';
import { Card } from '@/components/ui/card';
import { Calendar, Gift, AlertTriangle, Clock, Users, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';

interface GroupStatisticsCardProps {
  totalLessons: number;
  totalRewards: number;
  totalPenalties: number;
  lastActivityDate: string | null;
  totalStudents: number;
  totalAttendanceRecords: number;
  loading?: boolean;
}

const GroupStatisticsCard: React.FC<GroupStatisticsCardProps> = ({
  totalLessons,
  totalRewards,
  totalPenalties,
  lastActivityDate,
  totalStudents,
  totalAttendanceRecords,
  loading = false
}) => {
  if (loading) {
    return (
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-center h-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Ma\'lumot yo\'q';
    try {
      return format(parseISO(dateStr), 'd-MMMM, yyyy', { locale: uz });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="p-4 mb-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">O'quvchilar</p>
            <p className="text-lg font-bold">{totalStudents}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Jami darslar</p>
            <p className="text-lg font-bold">{totalLessons}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Davomat yozuvlari</p>
            <p className="text-lg font-bold">{totalAttendanceRecords}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Gift className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Jami mukofot</p>
            <p className="text-lg font-bold text-emerald-600">+{totalRewards}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Jami jarima</p>
            <p className="text-lg font-bold text-red-600">-{totalPenalties}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Oxirgi faoliyat</p>
            <p className="text-sm font-medium">{formatDate(lastActivityDate)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default GroupStatisticsCard;
