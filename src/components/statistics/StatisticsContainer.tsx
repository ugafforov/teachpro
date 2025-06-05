
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useStatistics } from './hooks/useStatistics';
import StatisticsCards from './StatisticsCards';
import MonthlyAnalysis from './MonthlyAnalysis';
import { StatisticsProps } from './types';

interface Group {
  id: string;
  name: string;
}

const StatisticsContainer: React.FC<StatisticsProps> = ({ teacherId }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('1oy');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [groups, setGroups] = useState<Group[]>([]);
  const { stats, monthlyData, loading } = useStatistics(teacherId, selectedPeriod, selectedGroup);

  useEffect(() => {
    fetchGroups();
  }, [teacherId]);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
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
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha guruhlar</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.name}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1oy">1 oy</SelectItem>
              <SelectItem value="12oy">12 oy</SelectItem>
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
