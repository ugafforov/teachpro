
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ScheduleManagerProps {
  groupName: string;
  teacherId: string;
}

const daysOfWeek = [
  { id: 1, name: 'Dushanba' },
  { id: 2, name: 'Seshanba' },
  { id: 3, name: 'Chorshanba' },
  { id: 4, name: 'Payshanba' },
  { id: 5, name: 'Juma' },
  { id: 6, name: 'Shanba' },
  { id: 7, name: 'Yakshanba' },
];

const ScheduleManager: React.FC<ScheduleManagerProps> = ({ groupName, teacherId }) => {
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSchedule();
  }, [groupName, teacherId]);

  const fetchSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('group_schedule')
        .select('day_of_week')
        .eq('teacher_id', teacherId)
        .eq('group_name', groupName);

      if (error) throw error;

      const days = data?.map(item => item.day_of_week) || [];
      setSelectedDays(days);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast({
        title: "Xatolik",
        description: "Dars jadvalini yuklashda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (dayId: number) => {
    setSelectedDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(id => id !== dayId)
        : [...prev, dayId]
    );
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      // Delete existing schedule
      const { error: deleteError } = await supabase
        .from('group_schedule')
        .delete()
        .eq('teacher_id', teacherId)
        .eq('group_name', groupName);

      if (deleteError) throw deleteError;

      // Insert new schedule
      if (selectedDays.length > 0) {
        const scheduleData = selectedDays.map(dayId => ({
          teacher_id: teacherId,
          group_name: groupName,
          day_of_week: dayId
        }));

        const { error: insertError } = await supabase
          .from('group_schedule')
          .insert(scheduleData);

        if (insertError) throw insertError;
      }

      toast({
        title: "Muvaffaqiyat",
        description: "Dars jadvali saqlandi",
      });

    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: "Xatolik",
        description: "Dars jadvalini saqlashda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Dars kunlari</h3>
        <p className="text-sm text-gray-600 mb-4">
          Guruh uchun dars bo'ladigan kunlarni tanlang
        </p>
      </div>

      <Card className="p-4">
        <div className="space-y-3">
          {daysOfWeek.map((day) => (
            <div key={day.id} className="flex items-center space-x-2">
              <Checkbox
                id={`day-${day.id}`}
                checked={selectedDays.includes(day.id)}
                onCheckedChange={() => handleDayToggle(day.id)}
                disabled={saving}
              />
              <label htmlFor={`day-${day.id}`} className="text-sm font-medium">
                {day.name}
              </label>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveSchedule} disabled={saving}>
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </Button>
      </div>
    </div>
  );
};

export default ScheduleManager;
