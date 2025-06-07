
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { MonthlyData } from './types';

interface MonthlyAnalysisProps {
  monthlyData: MonthlyData[];
}

const MonthlyAnalysis: React.FC<MonthlyAnalysisProps> = ({ monthlyData }) => {
  if (monthlyData.length === 0) {
    return (
      <Card className="apple-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Oylik tahlil</h3>
        </div>
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Oylik ma'lumotlar topilmadi</p>
        </div>
      </Card>
    );
  }

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-100 text-green-800 border-green-200';
    if (percentage >= 75) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (percentage >= 60) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getAttendanceIcon = (percentage: number) => {
    if (percentage >= 90) return '🟢';
    if (percentage >= 75) return '🟡';
    if (percentage >= 60) return '🟠';
    return '🔴';
  };

  return (
    <Card className="apple-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Oylik tahlil</h3>
        <Badge variant="secondary" className="ml-auto">
          {monthlyData.length} oy
        </Badge>
      </div>
      
      <div className="grid gap-4">
        {monthlyData.map((month, index) => (
          <div key={index} className="border border-border/50 rounded-xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-base">{month.month}</h4>
                  <p className="text-sm text-muted-foreground">
                    {month.totalClasses} dars
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{getAttendanceIcon(month.averageAttendance)}</span>
                <Badge 
                  variant="secondary" 
                  className={`${getAttendanceColor(month.averageAttendance)} border font-medium`}
                >
                  {month.averageAttendance.toFixed(1)}%
                </Badge>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border/30">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="w-3 h-3 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">O'quvchilar</p>
                <p className="font-semibold text-sm">{month.totalStudents}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">Darslar</p>
                <p className="font-semibold text-sm">{month.totalClasses}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">Davomat</p>
                <p className="font-semibold text-sm">{month.averageAttendance.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default MonthlyAnalysis;
