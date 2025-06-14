import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, Users, BarChart3, Award, Target, BookOpen } from 'lucide-react';
import { MonthlyData } from './types';
interface MonthlyAnalysisProps {
  monthlyData: MonthlyData[];
}
const MonthlyAnalysis: React.FC<MonthlyAnalysisProps> = ({
  monthlyData
}) => {
  if (monthlyData.length === 0) {
    return <Card className="apple-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Oylik tahlil</h3>
        </div>
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Oylik ma'lumotlar topilmadi</p>
        </div>
      </Card>;
  }
  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (percentage >= 75) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (percentage >= 60) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };
  const getAttendanceIcon = (percentage: number) => {
    if (percentage >= 90) return '🏆';
    if (percentage >= 75) return '⭐';
    if (percentage >= 60) return '📈';
    return '📊';
  };
  const getGradientClass = (percentage: number) => {
    if (percentage >= 90) return 'bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200';
    if (percentage >= 75) return 'bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200';
    if (percentage >= 60) return 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200';
    return 'bg-gradient-to-br from-red-50 to-red-100 border-red-200';
  };
  const bestMonth = monthlyData.reduce((prev, current) => prev.averageAttendance > current.averageAttendance ? prev : current);
  return <div className="space-y-6">
      {/* Umumiy ko'rsatkichlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        

        

        
      </div>

      {/* Oylik ma'lumotlar */}
      <Card className="apple-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold">Oylik tahlil</h3>
          </div>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {monthlyData.length} oy
          </Badge>
        </div>
        
        <div className="grid gap-4">
          {monthlyData.map((month, index) => <div key={index} className={`border rounded-xl p-5 hover:shadow-lg transition-all duration-300 ${getGradientClass(month.averageAttendance)}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/70 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-2xl">{getAttendanceIcon(month.averageAttendance)}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-800">{month.month}</h4>
                    <p className="text-sm text-gray-600">
                      {month.totalClasses} dars o'tildi
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className={`${getAttendanceColor(month.averageAttendance)} border font-bold text-lg px-3 py-1`}>
                    {month.averageAttendance.toFixed(1)}%
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">Davomat ko'rsatkichi</p>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-white/50 rounded-full h-2 mb-4">
                <div className={`h-2 rounded-full transition-all duration-500 ${month.averageAttendance >= 90 ? 'bg-emerald-500' : month.averageAttendance >= 75 ? 'bg-amber-500' : month.averageAttendance >= 60 ? 'bg-orange-500' : 'bg-red-500'}`} style={{
              width: `${month.averageAttendance}%`
            }}></div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="text-center bg-white/50 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-xs text-gray-600 font-medium">O'quvchilar</p>
                  <p className="font-bold text-lg text-gray-800">{month.totalStudents}</p>
                </div>
                <div className="text-center bg-white/50 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <BookOpen className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-xs text-gray-600 font-medium">Darslar</p>
                  <p className="font-bold text-lg text-gray-800">{month.totalClasses}</p>
                </div>
                <div className="text-center bg-white/50 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Target className="w-4 h-4 text-purple-500" />
                  </div>
                  <p className="text-xs text-gray-600 font-medium">Samaradorlik</p>
                  <p className="font-bold text-lg text-gray-800">
                    {month.averageAttendance >= 90 ? 'A+' : month.averageAttendance >= 75 ? 'A' : month.averageAttendance >= 60 ? 'B' : 'C'}
                  </p>
                </div>
              </div>
            </div>)}
        </div>
      </Card>
    </div>;
};
export default MonthlyAnalysis;