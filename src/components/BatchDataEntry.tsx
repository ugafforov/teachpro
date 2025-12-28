import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Users, Calendar, Save, Check, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateUz } from '@/lib/utils';

interface BatchDataEntryProps {
  teacherId: string;
  onComplete?: () => void;
}

interface Student {
  id: string;
  name: string;
  group_name: string | null;
  group_id: string | null;
}

interface StudentEntry {
  studentId: string;
  studentName: string;
  attendance: 'present' | 'absent_with_reason' | 'absent_without_reason' | 'late' | null;
  rewardPoints: number;
  penaltyPoints: number;
}

const BatchDataEntry: React.FC<BatchDataEntryProps> = ({ teacherId, onComplete }) => {
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<StudentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchGroups();
  }, [teacherId]);

  useEffect(() => {
    if (selectedGroup) {
      fetchStudents();
    }
  }, [selectedGroup, selectedDate]);

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

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, group_name, group_id')
        .eq('teacher_id', teacherId)
        .eq('group_id', selectedGroup)
        .eq('is_active', true)
        .order('name');

      if (studentsError) throw studentsError;

      setStudents(studentsData || []);

      // Check existing attendance records for this date
      const studentIds = studentsData?.map(s => s.id) || [];
      
      const { data: existingAttendance } = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('teacher_id', teacherId)
        .eq('date', selectedDate)
        .in('student_id', studentIds);

      const { data: existingRewards } = await supabase
        .from('reward_penalty_history')
        .select('student_id, points, type')
        .eq('teacher_id', teacherId)
        .eq('date', selectedDate)
        .in('student_id', studentIds);

      // Initialize entries with existing data
      const initialEntries: StudentEntry[] = (studentsData || []).map(student => {
        const attendance = existingAttendance?.find(a => a.student_id === student.id);
        const rewards = existingRewards?.filter(r => r.student_id === student.id) || [];
        
        const rewardPoints = rewards
          .filter(r => r.type === 'Mukofot')
          .reduce((sum, r) => sum + Number(r.points), 0);
        const penaltyPoints = rewards
          .filter(r => r.type === 'Jarima')
          .reduce((sum, r) => sum + Number(r.points), 0);

        return {
          studentId: student.id,
          studentName: student.name,
          attendance: attendance?.status as StudentEntry['attendance'] || null,
          rewardPoints,
          penaltyPoints
        };
      });

      setEntries(initialEntries);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchilarni yuklashda xatolik",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (studentId: string, field: keyof StudentEntry, value: any) => {
    setEntries(prev => prev.map(entry => 
      entry.studentId === studentId ? { ...entry, [field]: value } : entry
    ));
    setSaveSuccess(false);
  };

  const markAllPresent = () => {
    setEntries(prev => prev.map(entry => ({ ...entry, attendance: 'present' })));
    setSaveSuccess(false);
  };

  const saveAllData = async () => {
    setSaving(true);
    setSaveSuccess(false);
    
    try {
      // Save attendance records
      const attendanceToSave = entries.filter(e => e.attendance);
      
      for (const entry of attendanceToSave) {
        await supabase
          .from('attendance_records')
          .upsert({
            student_id: entry.studentId,
            teacher_id: teacherId,
            date: selectedDate,
            status: entry.attendance!
          }, {
            onConflict: 'student_id,date'
          });
      }

      // Save rewards and penalties
      for (const entry of entries) {
        // Delete existing reward/penalty for this date first
        await supabase
          .from('reward_penalty_history')
          .delete()
          .eq('student_id', entry.studentId)
          .eq('teacher_id', teacherId)
          .eq('date', selectedDate);

        // Add new reward if any
        if (entry.rewardPoints > 0) {
          await supabase
            .from('reward_penalty_history')
            .insert({
              student_id: entry.studentId,
              teacher_id: teacherId,
              points: entry.rewardPoints,
              type: 'Mukofot',
              reason: 'Mukofot',
              date: selectedDate
            });
        }

        // Add new penalty if any
        if (entry.penaltyPoints > 0) {
          await supabase
            .from('reward_penalty_history')
            .insert({
              student_id: entry.studentId,
              teacher_id: teacherId,
              points: entry.penaltyPoints,
              type: 'Jarima',
              reason: 'Jarima',
              date: selectedDate
            });
        }
      }

      // Backup to localStorage
      const backupKey = `batch_entry_backup_${selectedGroup}_${selectedDate}`;
      localStorage.setItem(backupKey, JSON.stringify({
        entries,
        savedAt: new Date().toISOString()
      }));

      setSaveSuccess(true);
      toast({
        title: "✓ Muvaffaqiyatli saqlandi",
        description: `${attendanceToSave.length} ta davomat va ball ma'lumotlari saqlandi`,
      });

      onComplete?.();
    } catch (error) {
      console.error('Error saving batch data:', error);
      toast({
        title: "Xatolik",
        description: "Ma'lumotlarni saqlashda xatolik yuz berdi. Qayta urinib ko'ring.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Batch ma'lumot kiritish
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Bir sanada ko'p o'quvchiga davomat va ball kiritish
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Guruh</label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Guruhni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Sana</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {selectedGroup && selectedDate && (
          <p className="text-sm text-muted-foreground mb-4">
            {formatDateUz(selectedDate)} sanasi uchun ma'lumotlar
          </p>
        )}
      </Card>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={markAllPresent}>
              <Check className="w-4 h-4 mr-2" />
              Barchasini kelgan deb belgilash
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">O'quvchi</th>
                    <th className="text-center p-4 font-medium">Davomat</th>
                    <th className="text-center p-4 font-medium">Mukofot</th>
                    <th className="text-center p-4 font-medium">Jarima</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr key={entry.studentId} className="hover:bg-muted/30">
                      <td className="p-4 font-medium">{entry.studentName}</td>
                      <td className="p-4">
                        <Select 
                          value={entry.attendance || ''} 
                          onValueChange={(v) => updateEntry(entry.studentId, 'attendance', v || null)}
                        >
                          <SelectTrigger className="w-40 mx-auto">
                            <SelectValue placeholder="Tanlang" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Kelgan</SelectItem>
                            <SelectItem value="late">Kechikkan</SelectItem>
                            <SelectItem value="absent_with_reason">Sababli</SelectItem>
                            <SelectItem value="absent_without_reason">Sababsiz</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4">
                        <Input
                          type="number"
                          min="0"
                          value={entry.rewardPoints || ''}
                          onChange={(e) => updateEntry(entry.studentId, 'rewardPoints', Number(e.target.value) || 0)}
                          className="w-20 mx-auto text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="p-4">
                        <Input
                          type="number"
                          min="0"
                          value={entry.penaltyPoints || ''}
                          onChange={(e) => updateEntry(entry.studentId, 'penaltyPoints', Number(e.target.value) || 0)}
                          className="w-20 mx-auto text-center"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={saveAllData} 
              disabled={saving} 
              className={`flex items-center gap-2 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saqlanmoqda...' : saveSuccess ? 'Saqlandi!' : 'Barchasini saqlash'}
            </Button>
          </div>
        </>
      ) : selectedGroup ? (
        <Card className="p-8 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Bu guruhda o'quvchilar topilmadi</p>
        </Card>
      ) : null}
    </div>
  );
};

export default BatchDataEntry;
