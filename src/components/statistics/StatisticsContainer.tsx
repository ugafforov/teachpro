
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatisticsCards from './StatisticsCards';
import MonthlyAnalysis from './MonthlyAnalysis';
import GroupRankings from './GroupRankings';
import { useStatistics } from './hooks/useStatistics';

interface StatisticsContainerProps {
  teacherId: string;
}

const StatisticsContainer: React.FC<StatisticsContainerProps> = ({ teacherId }) => {
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('1oy');
  
  const { stats, monthlyData, loading } = useStatistics(teacherId, selectedPeriod, selectedGroup);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Statistika</h2>
          <p className="text-muted-foreground">Davomat tahlili va statistikalar</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Guruh tanlang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha guruhlar</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1kun">1 kun</SelectItem>
              <SelectItem value="1hafta">1 hafta</SelectItem>
              <SelectItem value="1oy">1 oy</SelectItem>
              <SelectItem value="2oy">2 oy</SelectItem>
              <SelectItem value="3oy">3 oy</SelectItem>
              <SelectItem value="4oy">4 oy</SelectItem>
              <SelectItem value="5oy">5 oy</SelectItem>
              <SelectItem value="6oy">6 oy</SelectItem>
              <SelectItem value="7oy">7 oy</SelectItem>
              <SelectItem value="8oy">8 oy</SelectItem>
              <SelectItem value="9oy">9 oy</SelectItem>
              <SelectItem value="10oy">10 oy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics Cards */}
      <StatisticsCards stats={stats} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <MonthlyAnalysis data={monthlyData} />
        </Card>
        <Card className="p-6">
          <GroupRankings teacherId={teacherId} selectedGroup={selectedGroup} />
        </Card>
      </div>
    </div>
  );
};

export default StatisticsContainer;
