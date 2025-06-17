
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ScheduleManagerProps {
  groupName: string;
  teacherId: string;
}

const weekDays = [
  { id: 1, name: 'Dushanba' },
  { id: 2, name: 'Seshanba' },
  { id: 3, name: 'Chorshanba' },
  { id: 4, name: 'Payshanba' },
  { id: 5, name: 'Juma' },
  { id: 6, name: 'Shanba' },
  { id: 0, name: 'Yakshanba' },
];

const exceptionTypes = [
  { value: 'holiday', label: 'Bayram' },
  { value: 'break', label: 'Dam olish' },
  { value: 'no_class', label: 'Dars yo\'q' },
];

const ScheduleManager: React.FC<ScheduleManagerProps> = ({ groupName, teacherId }) => {
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [isExceptionDialogOpen, setIsExceptionDialogOpen] = useState(false);
  const [newException, setNewException] = useState({
    date: '',
    type: '',
    description: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSchedule();
    fetchExceptions();
  }, [groupName, teacherId]);

  const fetchSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('group_schedule')
        .select('day_of_week')
        .eq('group_name', groupName)
        .eq('teacher_id', teacherId);

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching schedule:', error);
        return;
      }
      
      if (data) {
        setSelectedDays(data.map(item => item.day_of_week));
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    }
  };

  const fetchExceptions = async () => {
    try {
      const { data, error } = await supabase
        .from('schedule_exceptions')
        .select('*')
        .eq('group_name', groupName)
        .eq('teacher_id', teacherId)
        .order('exception_date', { ascending: false });

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching exceptions:', error);
        return;
      }
      
      setExceptions(data || []);
    } catch (error) {
      console.error('Error fetching exceptions:', error);
    }
  };

  const handleDayToggle = async (dayId: number) => {
    const newSelectedDays = selectedDays.includes(dayId)
      ? selectedDays.filter(id => id !== dayId)
      : [...selectedDays, dayId];

    setSelectedDays(newSelectedDays);

    try {
      if (selectedDays.includes(dayId)) {
        const { error } = await supabase
          .from('group_schedule')
          .delete()
          .eq('group_name', groupName)
          .eq('teacher_id', teacherId)
          .eq('day_of_week', dayId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('group_schedule')
          .insert({
            group_name: groupName,
            teacher_id: teacherId,
            day_of_week: dayId
          });

        if (error) throw error;
      }

      toast({
        title: "Muvaffaqiyat",
        description: "Dars jadvali yangilandi.",
      });
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        title: "Xatolik",
        description: "Dars jadvalini yangilashda xatolik yuz berdi.",
        variant: "destructive",
      });
      setSelectedDays(selectedDays);
    }
  };

  const addException = async () => {
    if (!newException.date || !newException.type) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Sana va turni tanlang.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('schedule_exceptions')
        .insert({
          group_name: groupName,
          teacher_id: teacherId,
          exception_date: newException.date,
          exception_type: newException.type,
          description: newException.description || null
        });

      if (error) throw error;

      await fetchExceptions();
      setNewException({ date: '', type: '', description: '' });
      setIsExceptionDialogOpen(false);

      toast({
        title: "Muvaffaqiyat",
        description: "Istisno qo'shildi.",
      });
    } catch (error) {
      console.error('Error adding exception:', error);
      toast({
        title: "Xatolik",
        description: "Istisno qo'shishda xatolik yuz berdi.",
        variant: "destructive",
      });
    }
  };

  const removeException = async (exceptionId: string) => {
    try {
      const { error } = await supabase
        .from('schedule_exceptions')
        .delete()
        .eq('id', exceptionId);

      if (error) throw error;

      await fetchExceptions();
      
      toast({
        title: "Muvaffaqiyat",
        description: "Istisno o'chirildi.",
      });
    } catch (error) {
      console.error('Error removing exception:', error);
      toast({
        title: "Xatolik",
        description: "Istisno o'chirishda xatolik yuz berdi.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium mb-3 block">Dars kunlari:</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {weekDays.map((day) => (
            <div key={day.id} className="flex items-center space-x-2">
              <Checkbox
                id={`day-${day.id}`}
                checked={selectedDays.includes(day.id)}
                onCheckedChange={() => handleDayToggle(day.id)}
              />
              <Label htmlFor={`day-${day.id}`} className="text-sm">
                {day.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">Istisno kunlar:</Label>
          <Dialog open={isExceptionDialogOpen} onOpenChange={setIsExceptionDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Istisno qo'shish
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yangi istisno qo'shish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="exception-date">Sana</Label>
                  <Input
                    id="exception-date"
                    type="date"
                    value={newException.date}
                    onChange={(e) => setNewException({ ...newException, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="exception-type">Turi</Label>
                  <Select value={newException.type} onValueChange={(value) => setNewException({ ...newException, type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Istisno turini tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {exceptionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="exception-description">Izoh (ixtiyoriy)</Label>
                  <Input
                    id="exception-description"
                    value={newException.description}
                    onChange={(e) => setNewException({ ...newException, description: e.target.value })}
                    placeholder="Izoh kiriting"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={addException} className="flex-1">
                    Qo'shish
                  </Button>
                  <Button onClick={() => setIsExceptionDialogOpen(false)} variant="outline" className="flex-1">
                    Bekor qilish
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {exceptions.length > 0 ? (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {exceptions.map((exception) => (
              <div key={exception.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex-1">
                  <span className="text-sm font-medium">
                    {new Date(exception.exception_date).toLocaleDateString('uz-UZ')}
                  </span>
                  <span className="text-sm text-gray-600 ml-2">
                    ({exceptionTypes.find(t => t.value === exception.exception_type)?.label})
                  </span>
                  {exception.description && (
                    <span className="text-sm text-gray-500 block">{exception.description}</span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeException(exception.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Hozircha istisno kunlar yo'q</p>
        )}
      </div>
    </div>
  );
};

export default ScheduleManager;
