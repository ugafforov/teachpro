import { supabase } from '@/integrations/supabase/client';
import { fetchAllRecords } from './supabaseHelpers';

export interface StudentScoreResult {
  totalScore: number;
  attendancePoints: number;
  mukofotPoints: number;
  jarimaPoints: number;
  bahoScore: number;
  bahoAverage: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  totalClasses: number;
  attendancePercentage: number;
  rewardPenaltyPoints: number; // mukofot - jarima
}

export interface StudentWithScore {
  id: string;
  name: string;
  group_name: string;
  created_at: string;
  score: StudentScoreResult;
}

/**
 * Markaziy ball hisoblash funksiyasi - GroupDetails bilan 100% bir xil mantiq
 * Formula: totalScore = (mukofot - jarima) + attendancePoints
 * Davomat: present = +1, late = +0.5, absent = 0
 */
export async function calculateStudentScore(
  studentId: string,
  teacherId: string,
  groupName: string,
  studentCreatedAt: string
): Promise<StudentScoreResult> {
  // Fetch all data using pagination helper (same as GroupDetails)
  const [attendanceData, rewardData, groupStudents, allGroupAttendance] = await Promise.all([
    fetchAllRecords<{student_id: string; status: string; date: string}>(
      'attendance_records',
      teacherId,
      undefined,
      [studentId]
    ),
    fetchAllRecords<{student_id: string; points: number; type: string}>(
      'reward_penalty_history',
      teacherId,
      undefined,
      [studentId]
    ),
    supabase
      .from('students')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('group_name', groupName)
      .eq('is_active', true),
    fetchAllRecords<{student_id: string; date: string}>(
      'attendance_records',
      teacherId
    )
  ]);

  const groupStudentIds = groupStudents.data?.map(s => s.id) || [];
  const groupStudentIdSet = new Set(groupStudentIds);
  
  // Filter group attendance and get unique dates
  const filteredGroupAttendance = allGroupAttendance.filter(a => groupStudentIdSet.has(a.student_id));
  const groupClassDates = [...new Set(filteredGroupAttendance.map(a => a.date))];
  
  // Only count classes after student joined
  const studentJoinDate = new Date(studentCreatedAt).toISOString().split('T')[0];
  const relevantClassDates = groupClassDates.filter(date => date >= studentJoinDate);
  const totalClasses = relevantClassDates.length;

  // Calculate attendance stats
  const relevantAttendance = attendanceData.filter(a => a.date >= studentJoinDate);
  const presentCount = relevantAttendance.filter(a => a.status === 'present').length;
  const lateCount = relevantAttendance.filter(a => a.status === 'late').length;
  const absentCount = Math.max(0, totalClasses - presentCount - lateCount);
  
  // Attendance percentage (both present and late count as attended)
  const attendancePercentage = totalClasses > 0 
    ? Math.round(((presentCount + lateCount) / totalClasses) * 100) 
    : 0;

  // Attendance points: present = +1, late = +0.5, absent = 0
  const attendancePoints = presentCount * 1 + lateCount * 0.5;

  // Calculate reward/penalty by type (same as GroupDetails)
  let bahoScore = 0;
  let mukofotPoints = 0;
  let jarimaPoints = 0;
  let bahoCount = 0;

  rewardData.forEach(record => {
    const points = Number(record.points || 0);
    if (record.type === 'Baho') {
      bahoScore += points;
      bahoCount++;
    } else if (record.type === 'Mukofot') {
      mukofotPoints += points;
    } else if (record.type === 'Jarima') {
      jarimaPoints += points;
    }
  });

  const bahoAverage = bahoCount > 0 ? bahoScore / bahoCount : 0;
  const rewardPenaltyPoints = mukofotPoints - jarimaPoints;
  
  // Total score = (mukofot - jarima) + attendancePoints (EXACTLY same as GroupDetails)
  const totalScore = rewardPenaltyPoints + attendancePoints;

  return {
    totalScore,
    attendancePoints,
    mukofotPoints,
    jarimaPoints,
    bahoScore,
    bahoAverage,
    presentCount,
    lateCount,
    absentCount,
    totalClasses,
    attendancePercentage,
    rewardPenaltyPoints
  };
}

/**
 * Batch calculate scores for multiple students - optimized for rankings
 */
export async function calculateAllStudentScores(
  teacherId: string,
  groupFilter?: string
): Promise<StudentWithScore[]> {
  // Fetch all students
  let studentsQuery = supabase
    .from('students')
    .select('id, name, group_name, created_at')
    .eq('teacher_id', teacherId)
    .eq('is_active', true);

  if (groupFilter && groupFilter !== 'all') {
    studentsQuery = studentsQuery.eq('group_name', groupFilter);
  }

  const { data: students, error: studentsError } = await studentsQuery;
  if (studentsError || !students || students.length === 0) {
    return [];
  }

  const studentIds = students.map(s => s.id);

  // Fetch ALL records using pagination helper
  const [allAttendance, allRewards] = await Promise.all([
    fetchAllRecords<{student_id: string; status: string; date: string}>(
      'attendance_records',
      teacherId,
      undefined,
      studentIds
    ),
    fetchAllRecords<{student_id: string; points: number; type: string}>(
      'reward_penalty_history',
      teacherId,
      undefined,
      studentIds
    )
  ]);

  // Build group class dates map
  const groupClassDates = new Map<string, Set<string>>();
  students.forEach(s => {
    if (s.group_name && !groupClassDates.has(s.group_name)) {
      groupClassDates.set(s.group_name, new Set());
    }
  });

  allAttendance.forEach(a => {
    const student = students.find(s => s.id === a.student_id);
    if (student && student.group_name) {
      groupClassDates.get(student.group_name)?.add(a.date);
    }
  });

  // Calculate scores for each student (EXACTLY same logic as GroupDetails)
  return students.map(student => {
    const studentJoinDate = new Date(student.created_at).toISOString().split('T')[0];
    const studentAttendance = allAttendance.filter(a => a.student_id === student.id);
    const studentRewards = allRewards.filter(r => r.student_id === student.id);

    // Get relevant class dates for this student
    const groupDates = student.group_name ? groupClassDates.get(student.group_name) : undefined;
    const relevantClassDates = groupDates 
      ? Array.from(groupDates).filter(date => date >= studentJoinDate)
      : [];
    const totalClasses = relevantClassDates.length;

    // Attendance stats
    const relevantAttendance = studentAttendance.filter(a => a.date >= studentJoinDate);
    const presentCount = relevantAttendance.filter(a => a.status === 'present').length;
    const lateCount = relevantAttendance.filter(a => a.status === 'late').length;
    const absentCount = Math.max(0, totalClasses - presentCount - lateCount);
    
    const attendancePercentage = totalClasses > 0 
      ? Math.round(((presentCount + lateCount) / totalClasses) * 100) 
      : 0;

    // Attendance points: present = +1, late = +0.5
    const attendancePoints = presentCount * 1 + lateCount * 0.5;

    // Reward/penalty by type
    let bahoScore = 0;
    let mukofotPoints = 0;
    let jarimaPoints = 0;
    let bahoCount = 0;

    studentRewards.forEach(record => {
      const points = Number(record.points || 0);
      if (record.type === 'Baho') {
        bahoScore += points;
        bahoCount++;
      } else if (record.type === 'Mukofot') {
        mukofotPoints += points;
      } else if (record.type === 'Jarima') {
        jarimaPoints += points;
      }
    });

    const bahoAverage = bahoCount > 0 ? bahoScore / bahoCount : 0;
    const rewardPenaltyPoints = mukofotPoints - jarimaPoints;
    const totalScore = rewardPenaltyPoints + attendancePoints;

    return {
      id: student.id,
      name: student.name,
      group_name: student.group_name || '',
      created_at: student.created_at,
      score: {
        totalScore,
        attendancePoints,
        mukofotPoints,
        jarimaPoints,
        bahoScore,
        bahoAverage,
        presentCount,
        lateCount,
        absentCount,
        totalClasses,
        attendancePercentage,
        rewardPenaltyPoints
      }
    };
  });
}

/**
 * Calculate student rank among all teacher's students
 */
export async function calculateStudentRank(
  studentId: string,
  teacherId: string
): Promise<number> {
  const allStudents = await calculateAllStudentScores(teacherId);
  const sortedStudents = allStudents.sort((a, b) => b.score.totalScore - a.score.totalScore);
  const rank = sortedStudents.findIndex(s => s.id === studentId) + 1;
  return rank > 0 ? rank : allStudents.length;
}
