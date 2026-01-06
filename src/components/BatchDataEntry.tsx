import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Users, Calendar as CalendarIcon, Save, Check, RefreshCw } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  writeBatch,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { formatDateUz } from '@/lib/utils';

interface BatchDataEntryProps {
  teacherId: string;
  onComplete?: () => void;
}

interface Student {
  id: string;
  name: string;
  group_name: string | null;
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
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<StudentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [attendanceDates, setAttendanceDates] = useState<Date[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchGroups();
    fetchAttendanceDates();
  }, [teacherId]);

  useEffect(() => {
    if (selectedGroup) {
      fetchStudents();
    }
  }, [selectedGroup, selectedDate]);

  const fetchGroups = async () => {
    try {
      const q = query(
        collection(db, 'groups'),
        where('teacher_id', '==', teacherId),
        where('is_active', '==', true),
        orderBy('name')
      );
      const snapshot = await getDocs(q);
      setGroups(snapshot.docs.map(d => ({ id: d.id, name: d.data().name })));
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchAttendanceDates = async () => {
    try {
      const q = query(
        collection(db, 'attendance_records'),
        where('teacher_id', '==', teacherId)
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(d => d.data());
      const uniqueDates = [...new Set(records.map(r => r.date))];
      setAttendanceDates(uniqueDates.map(date => parseISO(date)));
    } catch (error) {
      console.error('Error fetching attendance dates:', error);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // Find the group name from the selected ID
      const groupName = groups.find(g => g.id === selectedGroup)?.name;
      if (!groupName) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'students'),
        where('teacher_id', '==', teacherId),
        where('group_name', '==', groupName),
        where('is_active', '==', true),
        orderBy('name')
      );
      const snapshot = await getDocs(q);
      const studentsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(studentsData);

      const studentIds = studentsData.map(s => s.id);
      if (studentIds.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Fetch attendance and rewards for these students on this date
      const attendanceQ = query(
        collection(db, 'attendance_records'),
        where('teacher_id', '==', teacherId),
        where('date', '==', selectedDate)
      );
      const attendanceSnap = await getDocs(attendanceQ);
      const existingAttendance = attendanceSnap.docs
        .map(d => d.data())
        .filter(d => studentIds.includes(d.student_id));

      const rewardsQ = query(
        collection(db, 'reward_penalty_history'),
        where('teacher_id', '==', teacherId),
        where('date', '==', selectedDate)
      );
      const rewardsSnap = await getDocs(rewardsQ);
      const existingRewards = rewardsSnap.docs
        .map(d => d.data())
        .filter(d => studentIds.includes(d.student_id));

      const initialEntries: StudentEntry[] = studentsData.map(student => {
        const attendance = existingAttendance.find(a => a.student_id === student.id);
        const rewards = existingRewards.filter(r => r.student_id === student.id);

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
      toast({ title: "Xatolik", description: "O'quvchilarni yuklashda xatolik", variant: "destructive" });
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
      const batch = writeBatch(db);

      // We need to handle attendance and rewards separately
      // For attendance, we use the composite ID studentId_date
      for (const entry of entries) {
        if (entry.attendance) {
          const attRef = doc(db, 'attendance_records', `${entry.studentId}_${selectedDate}`);
          batch.set(attRef, {
            student_id: entry.studentId,
            teacher_id: teacherId,
            date: selectedDate,
            status: entry.attendance,
            updated_at: serverTimestamp()
          }, { merge: true });
        }

        // For rewards/penalties, it's more complex because there could be multiple.
        // But BatchDataEntry seems to simplify it to one reward and one penalty per day.
        // We'll first need to find and delete existing ones, but batch doesn't support queries.
        // So we'll fetch them first.
      }

      // Fetch existing rewards to delete them
      const rewardsQ = query(
        collection(db, 'reward_penalty_history'),
        where('teacher_id', '==', teacherId),
        where('date', '==', selectedDate)
      );
      const rewardsSnap = await getDocs(rewardsQ);
      const studentIds = entries.map(e => e.studentId);
      rewardsSnap.docs.forEach(d => {
        if (studentIds.includes(d.data().student_id)) {
          batch.delete(d.ref);
        }
      });

      // Add new rewards/penalties
      for (const entry of entries) {
        if (entry.rewardPoints > 0) {
          const rewardRef = doc(collection(db, 'reward_penalty_history'));
          batch.set(rewardRef, {
            student_id: entry.studentId,
            teacher_id: teacherId,
            points: entry.rewardPoints,
            type: 'Mukofot',
            reason: 'Mukofot',
            date: selectedDate,
            created_at: serverTimestamp()
          });
        }
        if (entry.penaltyPoints > 0) {
          const penaltyRef = doc(collection(db, 'reward_penalty_history'));
          batch.set(penaltyRef, {
            student_id: entry.studentId,
            teacher_id: teacherId,
            points: entry.penaltyPoints,
            type: 'Jarima',
            reason: 'Jarima',
            date: selectedDate,
            created_at: serverTimestamp()
          });
        }
      }

      await batch.commit();

      setSaveSuccess(true);
      toast({ title: "✓ Muvaffaqiyatli saqlandi", description: "Ma'lumotlar saqlandi" });
      onComplete?.();
    } catch (error) {
      console.error('Error saving batch data:', error);
      toast({ title: "Xatolik", description: "Ma'lumotlarni saqlashda xatolik yuz berdi", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2"><Users className="w-5 h-5" />Batch ma'lumot kiritish</h3>
          <p className="text-sm text-muted-foreground mt-1">Bir sanada ko'p o'quvchiga davomat va ball kiritish</p>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Guruh</label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger><SelectValue placeholder="Guruhni tanlang" /></SelectTrigger>
              <SelectContent>{groups.map(group => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Sana</label>
            <div className="relative">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(parseISO(selectedDate), "d-MMMM, yyyy", { locale: uz }) : <span>Sana tanlang</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(selectedDate)}
                    onSelect={(date) => date && setSelectedDate(format(date, 'yyyy-MM-dd'))}
                    initialFocus
                    locale={uz}
                    modifiers={{ hasAttendance: attendanceDates }}
                    modifiersStyles={{
                      hasAttendance: {
                        backgroundColor: '#22c55e',
                        color: 'white',
                        borderRadius: '50%'
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        {selectedGroup && selectedDate && <p className="text-sm text-muted-foreground mb-4">{formatDateUz(selectedDate)} sanasi uchun ma'lumotlar</p>}
      </Card>

      {loading ? (
        <div className="flex items-center justify-center p-12"><RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : entries.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2 mb-4"><Button variant="outline" size="sm" onClick={markAllPresent}><Check className="w-4 h-4 mr-2" />Barchasini kelgan deb belgilash</Button></div>
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
                        <Select value={entry.attendance || ''} onValueChange={(v) => updateEntry(entry.studentId, 'attendance', v || null)}>
                          <SelectTrigger className="w-40 mx-auto"><SelectValue placeholder="Tanlang" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Kelgan</SelectItem>
                            <SelectItem value="late">Kechikkan</SelectItem>
                            <SelectItem value="absent_with_reason">Sababli</SelectItem>
                            <SelectItem value="absent_without_reason">Sababsiz</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4"><Input type="number" min="0" value={entry.rewardPoints || ''} onChange={(e) => updateEntry(entry.studentId, 'rewardPoints', Number(e.target.value) || 0)} className="w-20 mx-auto text-center" placeholder="0" /></td>
                      <td className="p-4"><Input type="number" min="0" value={entry.penaltyPoints || ''} onChange={(e) => updateEntry(entry.studentId, 'penaltyPoints', Number(e.target.value) || 0)} className="w-20 mx-auto text-center" placeholder="0" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="flex justify-end">
            <Button onClick={saveAllData} disabled={saving} className={`flex items-center gap-2 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''}`}>
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saqlanmoqda...' : saveSuccess ? 'Saqlandi!' : 'Barchasini saqlash'}
            </Button>
          </div>
        </>
      ) : selectedGroup ? (
        <Card className="p-8 text-center"><Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Bu guruhda o'quvchilar topilmadi</p></Card>
      ) : null}
    </div>
  );
};

export default BatchDataEntry;
