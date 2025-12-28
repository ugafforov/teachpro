import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches ALL records from a table without any limits
 * Uses pagination to get around Supabase's default 1000 row limit
 */
export async function fetchAllRecords<T>(
  tableName: string,
  teacherId: string,
  additionalFilters?: Record<string, any>,
  studentIds?: string[]
): Promise<T[]> {
  const allRecords: T[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(tableName as any)
      .select('*')
      .eq('teacher_id', teacherId)
      .range(offset, offset + pageSize - 1);

    // Add student_id filter if provided
    if (studentIds && studentIds.length > 0) {
      query = query.in('student_id', studentIds);
    }

    // Add any additional filters
    if (additionalFilters) {
      Object.entries(additionalFilters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allRecords.push(...(data as T[]));
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRecords;
}

/**
 * Fetches all records for export without any teacher_id filter
 * Used specifically for export functionality
 */
export async function fetchAllRecordsForExport<T>(
  tableName: string,
  teacherId: string
): Promise<T[]> {
  const allRecords: T[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName as any)
      .select('*')
      .eq('teacher_id', teacherId)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allRecords.push(...(data as T[]));
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRecords;
}

/**
 * Calculate data checksum for verification
 */
export function calculateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Calculate group statistics
 */
export interface GroupStatistics {
  totalLessons: number;
  totalRewards: number;
  totalPenalties: number;
  lastActivityDate: string | null;
  totalStudents: number;
  totalAttendanceRecords: number;
}

export async function calculateGroupStatistics(
  teacherId: string,
  groupName: string,
  studentIds: string[]
): Promise<GroupStatistics> {
  if (studentIds.length === 0) {
    return {
      totalLessons: 0,
      totalRewards: 0,
      totalPenalties: 0,
      lastActivityDate: null,
      totalStudents: 0,
      totalAttendanceRecords: 0
    };
  }

  // Fetch all attendance records
  const attendanceRecords = await fetchAllRecords<{
    id: string;
    date: string;
    status: string;
  }>('attendance_records', teacherId, undefined, studentIds);

  // Fetch all reward/penalty history
  const rewardHistory = await fetchAllRecords<{
    id: string;
    date: string;
    points: number;
    type: string;
  }>('reward_penalty_history', teacherId, undefined, studentIds);

  // Calculate unique lesson dates
  const uniqueDates = [...new Set(attendanceRecords.map(r => r.date))];
  
  // Calculate totals
  let totalRewards = 0;
  let totalPenalties = 0;
  
  rewardHistory.forEach(record => {
    if (record.type === 'Mukofot') {
      totalRewards += record.points;
    } else if (record.type === 'Jarima') {
      totalPenalties += record.points;
    }
  });

  // Find last activity date
  const allDates = [
    ...attendanceRecords.map(r => r.date),
    ...rewardHistory.map(r => r.date)
  ].filter(Boolean).sort().reverse();

  return {
    totalLessons: uniqueDates.length,
    totalRewards,
    totalPenalties,
    lastActivityDate: allDates[0] || null,
    totalStudents: studentIds.length,
    totalAttendanceRecords: attendanceRecords.length
  };
}
