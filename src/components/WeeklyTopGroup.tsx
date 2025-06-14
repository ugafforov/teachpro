
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Users, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WeeklyTopGroup {
  id: string;
  group_name: string;
  average_attendance: number;
  total_students: number;
  active_students: number;
}

interface WeeklyTopGroupProps {
  teacherId: string;
}

const WeeklyTopGroup: React.FC<WeeklyTopGroupProps> = ({ teacherId }) => {
  const [topGroup, setTopGroup] = useState<WeeklyTopGroup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeeklyTopGroup();
  }, [teacherId]);

  const fetchWeeklyTopGroup = async () => {
    try {
      setLoading(true);
      
      // Raw SQL query to get weekly top group
      const { data, error } = await supabase.rpc('sql', {
        query: `
          SELECT id, group_name, average_attendance, total_students, active_students
          FROM weekly_top_groups 
          WHERE teacher_id = $1 
          ORDER BY created_at DESC 
          LIMIT 1
        `,
        params: [teacherId]
      });

      if (error) {
        console.error('Error fetching weekly top group:', error);
        return;
      }

      if (data && data.length > 0) {
        setTopGroup(data[0] as WeeklyTopGroup);
      }
    } catch (error) {
      console.error('Error fetching weekly top group:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!topGroup) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Ma'lumot yo'q</p>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
        <Users className="w-4 h-4 text-yellow-600" />
      </div>
      <div>
        <p className="text-sm font-medium">{topGroup.group_name}</p>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <span>{topGroup.active_students} o'quvchi</span>
          <span>•</span>
          <div className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>{topGroup.average_attendance.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyTopGroup;
