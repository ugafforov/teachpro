import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Student {
  id: string;
  name: string;
  student_id?: string;
  group_name: string;
  teacher_id: string;
  created_at: any;
  join_date?: string;
  is_active?: boolean;
}

interface AttendanceRecord {
  student_id: string;
  status: 'present' | 'late' | 'absent_with_reason' | 'absent_without_reason';
  date: string;
  notes?: string;
}

interface AttendanceJournalProps {
  teacherId: string;
  groupName: string;
}

const AttendanceJournal: React.FC<AttendanceJournalProps> = ({ teacherId, groupName }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Oyning barcha kunlarini olish
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // O'quvchilarni olish
  const fetchStudents = async () => {
    try {
      const q = query(
        collection(db, 'students'),
        where('teacher_id', '==', teacherId),
        where('group_name', '==', groupName),
        where('is_active', '==', true)
      );
      const snapshot = await getDocs(q);
      const studentsData = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Student))
        .sort((a, b) => a.name.localeCompare(b.name));
      setStudents(studentsData);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({ title: 'Xatolik', description: 'O\'quvchilarni olishda xatolik', variant: 'destructive' });
    }
  };

  // Davomat ma'lumotlarini olish
  const fetchAttendance = async () => {
    try {
      const q = query(
        collection(db, 'attendance_records'),
        where('teacher_id', '==', teacherId)
      );
      const snapshot = await getDocs(q);
      const attendanceData: Record<string, AttendanceRecord> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const key = `${data.student_id}_${data.date}`;
        attendanceData[key] = data as AttendanceRecord;
      });
      setAttendance(attendanceData);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchAttendance();
  }, []);

  // Effective join date olish
  const getEffectiveJoinDate = (student: Student): string | null => {
    if (student.join_date) return student.join_date;
    if (student.created_at) {
      if (student.created_at instanceof Timestamp) {
        return student.created_at.toDate().toISOString().split('T')[0];
      } else if (typeof student.created_at === 'string') {
        return student.created_at.split('T')[0];
      }
    }
    return null;
  };

  // Davomat holatini o'zgartirishazuyi
  const toggleAttendance = async (studentId: string, date: string) => {
    const student = students.find(s => s.id === studentId);
    const effectiveJoinDate = student ? getEffectiveJoinDate(student) : null;

    if (effectiveJoinDate && date < effectiveJoinDate) {
      toast({
        title: 'Xatolik',
        description: `Bu sana o'quvchining kelgan sanasidan oldin`,
        variant: 'destructive'
      });
      return;
    }

    const key = `${studentId}_${date}`;
    const current = attendance[key];

    let nextStatus: 'present' | 'late' | 'absent_with_reason' | 'absent_without_reason' | null = null;

    if (!current) {
      nextStatus = 'present';
    } else if (current.status === 'present') {
      nextStatus = 'late';
    } else if (current.status === 'late') {
      nextStatus = 'absent_without_reason';
    } else {
      nextStatus = null;
    }

    try {
      const recordId = `${studentId}_${date}`;
      if (nextStatus) {
        await setDoc(doc(db, 'attendance_records', recordId), {
          student_id: studentId,
          teacher_id: teacherId,
          date: date,
          status: nextStatus
        });
        setAttendance(prev => ({
          ...prev,
          [key]: { student_id: studentId, status: nextStatus!, date }
        }));
      } else {
        await deleteDoc(doc(db, 'attendance_records', recordId));
        setAttendance(prev => {
          const newAttendance = { ...prev };
          delete newAttendance[key];
          return newAttendance;
        });
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast({ title: 'Xatolik', description: 'Davomatni o\'zgartirishda xatolik', variant: 'destructive' });
    }
  };

  // Davomat holati uchun rang
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'late':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'absent_with_reason':
      case 'absent_without_reason':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-300';
    }
  };

  // Davomat holati uchun qisqa belgi
  const getStatusSymbol = (status?: string) => {
    switch (status) {
      case 'present':
        return '✓';
      case 'late':
        return '○';
      case 'absent_with_reason':
      case 'absent_without_reason':
        return '−';
      default:
        return '';
    }
  };

  // Davomat foizini hisoblash
  const getAttendancePercentage = (studentId: string): number => {
    const studentDaysInMonth = daysInMonth.filter(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const student = students.find(s => s.id === studentId);
      const effectiveJoinDate = student ? getEffectiveJoinDate(student) : null;
      return !effectiveJoinDate || dateStr >= effectiveJoinDate;
    });

    const presentDays = studentDaysInMonth.filter(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const key = `${studentId}_${dateStr}`;
      const record = attendance[key];
      return record && (record.status === 'present' || record.status === 'late');
    }).length;

    if (studentDaysInMonth.length === 0) return 0;
    return Math.round((presentDays / studentDaysInMonth.length) * 100);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">Davomat ma'lumotlari yuklanmoqda...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        {/* Oyni o'zgartirishzuyi */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-48"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(currentMonth, 'MMMM yyyy', { locale: uz })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={currentMonth}
                  onSelect={(date) => date && setCurrentMonth(date)}
                  initialFocus
                  locale={uz}
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Excel chiqarish
          </Button>
        </div>

        {/* Davomat jadvali */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-gray-50 border border-gray-200 px-3 py-2 text-left text-sm font-semibold w-48 z-10">
                  O'quvchi (Foiz)
                </th>
                {daysInMonth.map((day, idx) => (
                  <th
                    key={idx}
                    className="border border-gray-200 px-2 py-2 text-center text-xs font-medium bg-gray-50 min-w-12"
                  >
                    <div className="text-gray-600">{format(day, 'd')}</div>
                    <div className="text-gray-400">{format(day, 'EEE', { locale: uz }).substring(0, 2)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth.length + 1} className="text-center py-8 text-gray-500">
                    O'quvchilar topilmadi
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="sticky left-0 bg-white border border-gray-200 px-3 py-2 font-medium text-sm z-10">
                      <div className="flex items-center justify-between">
                        <span className="truncate">{student.name}</span>
                        <span className={cn(
                          "ml-2 inline-block px-2 py-1 rounded text-xs font-semibold",
                          getAttendancePercentage(student.id) >= 75
                            ? 'bg-green-100 text-green-700'
                            : getAttendancePercentage(student.id) >= 50
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        )}>
                          {getAttendancePercentage(student.id)}%
                        </span>
                      </div>
                    </td>
                    {daysInMonth.map((day, idx) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const key = `${student.id}_${dateStr}`;
                      const record = attendance[key];
                      const effectiveJoinDate = getEffectiveJoinDate(student);
                      const isBeforeJoinDate = effectiveJoinDate && dateStr < effectiveJoinDate;

                      return (
                        <td
                          key={idx}
                          className="border border-gray-200 p-1 text-center min-w-12"
                        >
                          <button
                            onClick={() => !isBeforeJoinDate && toggleAttendance(student.id, dateStr)}
                            disabled={isBeforeJoinDate}
                            className={cn(
                              'w-full py-2 px-1 border-2 rounded font-semibold text-sm transition-colors',
                              isBeforeJoinDate
                                ? 'opacity-30 cursor-not-allowed'
                                : 'cursor-pointer hover:opacity-80',
                              getStatusColor(record?.status)
                            )}
                            title={isBeforeJoinDate ? 'O\'quvchi bu sanada qo\'shilmagan' : ''}
                          >
                            {getStatusSymbol(record?.status) || '−'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legendasi */}
        <div className="mt-4 flex gap-6 text-sm border-t pt-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-100 text-green-800 border border-green-300 rounded flex items-center justify-center text-xs font-bold">✓</div>
            <span>Kelgan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded flex items-center justify-center text-xs font-bold">○</div>
            <span>Kech kelgan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-100 text-red-800 border border-red-300 rounded flex items-center justify-center text-xs font-bold">−</div>
            <span>Kelmadi</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-50 text-gray-600 border border-gray-300 rounded flex items-center justify-center text-xs font-bold">−</div>
            <span>Ma'lumot yo'q</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AttendanceJournal;
