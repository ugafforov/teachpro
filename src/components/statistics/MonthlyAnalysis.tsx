
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MonthlyData } from './types';

interface MonthlyAnalysisProps {
  monthlyData: MonthlyData[];
}

const MonthlyAnalysis: React.FC<MonthlyAnalysisProps> = ({ monthlyData }) => {
  if (monthlyData.length === 0) {
    return null;
  }

  return (
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
  );
};

export default MonthlyAnalysis;
