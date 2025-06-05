
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
      // Only fetch active groups (not deleted or archived)
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

  const periodOptions = [
    { value: '1kun', label: '1 kun' },
    { value: '1hafta', label: '1 hafta' },
    { value: '1oy', label: '1 oy' },
    { value: '2oy', label: '2 oy' },
    { value: '3oy', label: '3 oy' },
    { value: '4oy', label: '4 oy' },
    { value: '5oy', label: '5 oy' },
    { value: '6oy', label: '6 oy' },
    { value: '7oy', label: '7 oy' },
    { value: '8oy', label: '8 oy' },
    { value: '9oy', label: '9 oy' },
    { value: '10oy', label: '10 oy' }
  ];

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
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
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
