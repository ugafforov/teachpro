
import { supabase } from '@/integrations/supabase/client';
import { formatMonthUz, getPeriodStartDate } from './statisticsDates';
import { StatsData, MonthlyData } from '../types';

// Fetch active students
export async function fetchActiveStudents(teacherId: string, group: string) {
  let query = supabase
    .from('students')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('is_active', true);

  if (group !== 'all') query = query.eq('group_name', group);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Fetch first lesson/class date
export async function fetchFirstClassDate(teacherId: string) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('date')
    .eq('teacher_id', teacherId)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.date || null;
}

// Fetch attendance/class records for the period
export async function fetchAttendanceRecords(teacherId: string, period: string, group: string) {
  let query = supabase
    .from('attendance_records')
    .select(`
      date,
      students!inner(is_active, group_name)
    `)
    .eq('teacher_id', teacherId)
    .eq('students.is_active', true)
    .gte('date', getPeriodStartDate(period));
  if (group !== 'all') query = query.eq('students.group_name', group);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Fetch present or late attendance count
export async function fetchPresentAttendance(teacherId: string, period: string, group: string) {
  let query = supabase
    .from('attendance_records')
    .select(`
      status,
      students!inner(is_active, group_name)
    `)
    .eq('teacher_id', teacherId)
    .eq('students.is_active', true)
    .in('status', ['present', 'late'])
    .gte('date', getPeriodStartDate(period));
  if (group !== 'all') query = query.eq('students.group_name', group);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Fetch top student
export async function fetchTopStudent(teacherId: string, group: string) {
  let query = supabase
    .from('student_scores')
    .select(`
      student_id,
      total_score,
      students!inner(name, is_active, group_name)
    `)
    .eq('teacher_id', teacherId)
    .eq('students.is_active', true)
    .order('total_score', { ascending: false })
    .limit(1);
  if (group !== 'all') query = query.eq('students.group_name', group);
  const { data, error } = await query;
  if (error) throw error;
  return data?.[0]?.students?.name || "Ma'lumot yo'q";
}

// Fetch and format monthly data for stats
export async function fetchMonthlyData(teacherId: string, period: string, group: string, totalStudents: number) {
  let monthlyQuery = supabase
    .from('attendance_records')
    .select(`
      date, 
      status,
      students!inner(is_active, group_name)
    `)
    .eq('teacher_id', teacherId)
    .eq('students.is_active', true)
    .gte('date', getPeriodStartDate(period));
  if (group !== 'all') monthlyQuery = monthlyQuery.eq('students.group_name', group);
  const { data: monthlyAttendance, error } = await monthlyQuery;
  if (error) throw error;
  const monthlyStats: { [key: string]: { classes: Set<string>, present: number } } = {};
  monthlyAttendance?.forEach(record => {
    const date = new Date(record.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = { classes: new Set(), present: 0 };
    }
    monthlyStats[monthKey].classes.add(record.date);
    if (record.status === 'present' || record.status === 'late') {
      monthlyStats[monthKey].present++;
    }
  });
  const result: MonthlyData[] = Object.entries(monthlyStats).map(([monthKey, data]) => {
    const [year, monthNum] = monthKey.split("-");
    const jsDate = new Date(Number(year), Number(monthNum) - 1, 1);
    return {
      month: formatMonthUz(jsDate),
      totalClasses: data.classes.size,
      averageAttendance:
        data.classes.size > 0 && totalStudents > 0
          ? (data.present / (data.classes.size * totalStudents)) * 100
          : totalStudents === 0
            ? 0
            : 100,
      totalStudents: totalStudents,
    };
  });
  return result;
}
