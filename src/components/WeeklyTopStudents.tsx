
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Trophy, TrendingUp, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WeeklyTopStudent {
  id: string;
  student_name: string;
  group_name: string;
  weekly_score: number;
  attendance_rate: number;
  reward_points: number;
  rank_position: number;
}

interface WeeklyTopStudentsProps {
  teacherId: string;
}

const WeeklyTopStudents: React.FC<WeeklyTopStudentsProps> = ({ teacherId }) => {
  const [topStudents, setTopStudents] = useState<WeeklyTopStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeeklyTopStudents();
  }, [teacherId]);

  const fetchWeeklyTopStudents = async () => {
    try {
      setLoading(true);
      
      // Joriy haftaning eng yaxshi o'quvchilarni olish
      const { data, error } = await supabase
        .from('weekly_top_students')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('rank_position');

      if (error) throw error;

      setTopStudents(data || []);
    } catch (error) {
      console.error('Error fetching weekly top students:', error);
      // Agar haftalik ma'lumotlar yo'q bo'lsa, funksiyani chaqirib yangi ma'lumotlar yaratamiz
      await calculateWeeklyStats();
    } finally {
      setLoading(false);
    }
  };

  const calculateWeeklyStats = async () => {
    try {
      const { error } = await supabase.rpc('calculate_weekly_statistics');
      if (error) throw error;
      
      // Qayta yuklash
      setTimeout(() => {
        fetchWeeklyTopStudents();
      }, 1000);
    } catch (error) {
      console.error('Error calculating weekly statistics:', error);
    }
  };

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '🏆';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Trophy className="w-5 h-5 text-yellow-600" />
        <h3 className="text-lg font-semibold">Haftaning eng yaxshi o'quvchilari</h3>
      </div>
      
      {topStudents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Haftalik statistika mavjud emas</p>
          <button 
            onClick={calculateWeeklyStats}
            className="mt-2 text-blue-600 hover:underline"
          >
            Statistikani hisoblash
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {topStudents.map((student) => (
            <div 
              key={student.id} 
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getRankIcon(student.rank_position)}</span>
                <div>
                  <p className="font-medium">{student.student_name}</p>
                  <p className="text-sm text-muted-foreground">{student.group_name}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">{student.attendance_rate.toFixed(1)}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Davomat</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center space-x-1">
                      <Gift className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">{student.reward_points}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Ball</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-yellow-600">{student.weekly_score.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Umumiy</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default WeeklyTopStudents;
