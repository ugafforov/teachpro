
import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStatistics } from './hooks/useStatistics';
import StatisticsCards from './StatisticsCards';
import MonthlyAnalysis from './MonthlyAnalysis';
import { StatisticsProps } from './types';

const StatisticsContainer: React.FC<StatisticsProps> = ({ teacherId }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('1oy');
  const { stats, monthlyData, loading } = useStatistics(teacherId, selectedPeriod);

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
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1oy">1 oy</SelectItem>
              <SelectItem value="12oy">Barcha guruhlar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <StatisticsCards stats={stats} />
      <MonthlyAnalysis monthlyData={monthlyData} />
    </div>
  );
};

export default StatisticsContainer;
