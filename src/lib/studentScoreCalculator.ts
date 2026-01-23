import { db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { getTashkentDate } from './utils';
import { format } from 'date-fns';

/**
 * =============================================================================
 * BALL TIZIMI KONSTANTALARI
 * =============================================================================
 *
 * O'quvchi ballini hisoblash formulasi:
 * totalScore = rewardPenaltyPoints + attendancePoints
 *
 * Qayerda:
 * - rewardPenaltyPoints = mukofotPoints - jarimaPoints
 * - attendancePoints = (presentCount * PRESENT_POINTS) + (lateCount * LATE_POINTS)
 *
 * Davomat foizi formulasi:
 * attendancePercentage = (presentCount + lateCount) / totalClasses * 100
 *
 * Efficiency (Samaradorlik):
 * efficiency = attendancePercentage (soddalashtirilgan)
 * =============================================================================
 */

// Davomat ballari
export const PRESENT_POINTS = 1;      // Kelgan o'quvchi uchun ball
export const LATE_POINTS = 0.5;       // Kech kelgan o'quvchi uchun ball
export const ABSENT_POINTS = 0;       // Kelmagan o'quvchi uchun ball

export interface TopStudentSummary {
  id: string;
  name: string;
  score: number;
}

export interface StatsData {
  totalStudents: number;
  totalClasses: number;
  averageAttendance: number;
  topStudent: TopStudentSummary | null;
}

export interface MonthlyData {
  month: string;
  totalClasses: number;
  averageAttendance: number;
  totalStudents: number;
  latePercentage?: number;
  absentPercentage?: number;
  efficiency?: number;
}

export interface GroupRanking {
  groupName: string;
  totalStudents: number;
  attendancePercentage: number;
  latePercentage: number;
  absentPercentage: number;
  totalClasses: number;
  efficiency: number;
  rank: number;
}

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
  unexcusedAbsentCount: number;
  totalClasses: number;
  attendancePercentage: number;
  rewardPenaltyPoints: number; // mukofot - jarima
  efficiency: number; // Samaradorlik = attendancePercentage (soddalashtirilgan)
}

export interface StudentWithScore {
  id: string;
  name: string;
  group_name: string;
  created_at: any;
  join_date?: string; // O'quvchi qo'shilgan sana (YYYY-MM-DD format)
  score: StudentScoreResult;
}

/**
 * Centralized score calculation function for a single student
 */
export async function calculateStudentScore(
  studentId: string,
  teacherId: string,
  groupName: string,
  studentCreatedAt: any,
  studentJoinDateStr?: string,
  studentLeaveDateStr?: string | null
): Promise<StudentScoreResult> {
  // Fetch attendance and rewards
  const attendanceQ = query(
    collection(db, 'attendance_records'),
    where('teacher_id', '==', teacherId),
    where('student_id', '==', studentId)
  );

  const rewardsQ = query(
    collection(db, 'reward_penalty_history'),
    where('teacher_id', '==', teacherId),
    where('student_id', '==', studentId)
  );

  const studentsQ = query(
    collection(db, 'students'),
    where('teacher_id', '==', teacherId),
    where('group_name', '==', groupName),
    where('is_active', '==', true)
  );

  const allGroupAttendanceQ = query(
    collection(db, 'attendance_records'),
    where('teacher_id', '==', teacherId)
  );

  const [attendanceSnap, rewardsSnap, groupStudentsSnap, allGroupAttendanceSnap] = await Promise.all([
    getDocs(attendanceQ),
    getDocs(rewardsQ),
    getDocs(studentsQ),
    getDocs(allGroupAttendanceQ)
  ]);

  const attendanceData = attendanceSnap.docs.map(d => d.data());
  const rewardData = rewardsSnap.docs.map(d => d.data());
  const groupStudentIds = groupStudentsSnap.docs.map(d => d.id);
  const groupStudentIdSet = new Set(groupStudentIds);

  const filteredGroupAttendance = allGroupAttendanceSnap.docs
    .map(d => d.data())
    .filter(a => groupStudentIdSet.has(a.student_id));
  const groupClassDates = [...new Set(filteredGroupAttendance.map(a => a.date))];

  // Prioritize explicit join_date, fallback to created_at
  let studentJoinDate = studentJoinDateStr || '';
  if (!studentJoinDate) {
    if (studentCreatedAt instanceof Timestamp) {
      studentJoinDate = getTashkentDate(studentCreatedAt.toDate()).toISOString().split('T')[0];
    } else if (typeof studentCreatedAt === 'string') {
      studentJoinDate = getTashkentDate(new Date(studentCreatedAt)).toISOString().split('T')[0];
    }
  }

  const studentLeaveDate = studentLeaveDateStr || '';

  const relevantClassDates = groupClassDates.filter(date =>
    date >= studentJoinDate && (!studentLeaveDate || date <= studentLeaveDate)
  );
  const totalClasses = relevantClassDates.length;

  const relevantAttendance = attendanceData.filter(a =>
    a.date >= studentJoinDate && (!studentLeaveDate || a.date <= studentLeaveDate)
  );
  const presentCount = relevantAttendance.filter(a => a.status === 'present').length;
  const lateCount = relevantAttendance.filter(a => a.status === 'late').length;
  const excusedAbsentCount = relevantAttendance.filter(a => a.status === 'absent_with_reason').length;
  const unexcusedAbsentCount = relevantAttendance.filter(a => a.status === 'absent_without_reason').length;
  // absentCount = jami kelmaganlar (sababli + sababsiz + yozilmagan darslar)
  const absentCount = Math.max(0, totalClasses - presentCount - lateCount);

  const attendancePercentage = totalClasses > 0
    ? Math.round(((presentCount + lateCount) / totalClasses) * 100)
    : 0;

  const attendancePoints = presentCount * PRESENT_POINTS + lateCount * LATE_POINTS;

  let bahoScore = 0;
  let mukofotPoints = 0;
  let jarimaPoints = 0;
  let bahoCount = 0;

  const relevantRewards = rewardData.filter((record: any) =>
    record?.date &&
    record.date >= studentJoinDate &&
    (!studentLeaveDate || record.date <= studentLeaveDate)
  );

  relevantRewards.forEach(record => {
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

  // Efficiency = davomat foizi (soddalashtirilgan formula)
  // Eski murakkab formula: (attendancePercentage + (100 - latePercentage) + (100 - unexcusedPercentage)) / 3
  // Yangi sodda formula: attendancePercentage = (present + late) / totalClasses * 100
  const efficiency = attendancePercentage;

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
    unexcusedAbsentCount,
    totalClasses,
    attendancePercentage,
    rewardPenaltyPoints,
    efficiency: Math.round(efficiency * 100) / 100
  };
}

/**
 * Batch calculate scores for multiple students with period filtering
 */
export async function calculateAllStudentScores(
  teacherId: string,
  groupFilter?: string,
  period: string = 'all'
): Promise<StudentWithScore[]> {
  let studentsQ = query(
    collection(db, 'students'),
    where('teacher_id', '==', teacherId),
    where('is_active', '==', true)
  );

  if (groupFilter && groupFilter !== 'all') {
    studentsQ = query(studentsQ, where('group_name', '==', groupFilter));
  }

  const studentsSnap = await getDocs(studentsQ);
  if (studentsSnap.empty) return [];

  const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  const attendanceQ = query(
    collection(db, 'attendance_records'),
    where('teacher_id', '==', teacherId)
  );

  const rewardsQ = query(
    collection(db, 'reward_penalty_history'),
    where('teacher_id', '==', teacherId)
  );

  const [attendanceSnap, rewardsSnap] = await Promise.all([
    getDocs(attendanceQ),
    getDocs(rewardsQ)
  ]);

  const allAttendance = attendanceSnap.docs.map(d => d.data());
  const allRewards = rewardsSnap.docs.map(d => d.data());

  let startDate: string | null = null;
  if (period !== 'all') {
    const now = getTashkentDate();
    switch (period) {
      case '1_day': now.setDate(now.getDate() - 1); break;
      case '1_week': now.setDate(now.getDate() - 7); break;
      case '1_month': now.setMonth(now.getMonth() - 1); break;
      case '2_months': now.setMonth(now.getMonth() - 2); break;
      case '3_months': now.setMonth(now.getMonth() - 3); break;
      case '6_months': now.setMonth(now.getMonth() - 6); break;
      case '10_months': now.setMonth(now.getMonth() - 10); break;
    }
    startDate = format(now, 'yyyy-MM-dd');
  }

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

  return students.map(student => {
    // Prioritize explicit join_date, fallback to created_at
    let studentJoinDate = student.join_date || '';
    if (!studentJoinDate) {
      if (student.created_at instanceof Timestamp) {
        studentJoinDate = student.created_at.toDate().toISOString().split('T')[0];
      } else if (typeof student.created_at === 'string') {
        studentJoinDate = student.created_at.split('T')[0];
      }
    }

    const effectiveStartDate = startDate && startDate > studentJoinDate ? startDate : studentJoinDate;

    const studentAttendance = allAttendance.filter(a => a.student_id === student.id && a.date >= effectiveStartDate);
    const studentRewards = allRewards.filter(r => r.student_id === student.id && r.date >= effectiveStartDate);

    const groupDates = student.group_name ? groupClassDates.get(student.group_name) : undefined;
    const relevantClassDates = groupDates
      ? Array.from(groupDates).filter(date => date >= effectiveStartDate)
      : [];
    const totalClasses = relevantClassDates.length;

    const presentCount = studentAttendance.filter(a => a.status === 'present').length;
    const lateCount = studentAttendance.filter(a => a.status === 'late').length;
    const excusedAbsentCount = studentAttendance.filter(a => a.status === 'absent_with_reason').length;
    const unexcusedAbsentCount = studentAttendance.filter(a => a.status === 'absent_without_reason').length;
    // absentCount = jami kelmaganlar (sababli + sababsiz + yozilmagan darslar)
    const absentCount = Math.max(0, totalClasses - presentCount - lateCount);

    const attendancePercentage = totalClasses > 0
      ? Math.round(((presentCount + lateCount) / totalClasses) * 100)
      : 0;

    const attendancePoints = presentCount * PRESENT_POINTS + lateCount * LATE_POINTS;

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

    // Efficiency = davomat foizi (soddalashtirilgan formula)
    const efficiency = attendancePercentage;

    return {
      id: student.id,
      name: student.name,
      group_name: student.group_name || '',
      created_at: student.created_at,
      join_date: student.join_date,
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
        unexcusedAbsentCount,
        totalClasses,
        attendancePercentage,
        rewardPenaltyPoints,
        efficiency: Math.round(efficiency * 100) / 100
      }
    };
  });
}

/**
 * Calculate Dashboard statistics and Monthly Analysis
 */
export async function calculateDashboardStats(
  teacherId: string,
  period: string = 'all',
  groupFilter: string = 'all'
): Promise<{ stats: StatsData, monthlyData: MonthlyData[] }> {
  const allStudents = await calculateAllStudentScores(teacherId, groupFilter, period);

  if (allStudents.length === 0) {
    return {
      stats: { totalStudents: 0, totalClasses: 0, averageAttendance: 0, topStudent: null },
      monthlyData: []
    };
  }

  const totalStudents = allStudents.length;
  let totalPresent = 0;
  let totalLate = 0;
  let totalPossible = 0;
  let maxScore = -Infinity;
  let topStudent: TopStudentSummary | null = null;

  allStudents.forEach(s => {
    totalPresent += s.score.presentCount;
    totalLate += s.score.lateCount;
    totalPossible += s.score.totalClasses;

    if (s.score.totalScore > maxScore) {
      maxScore = s.score.totalScore;
      topStudent = {
        id: s.id,
        name: s.name,
        score: Math.round(s.score.totalScore * 10) / 10,
      };
    }
  });

  const averageAttendance = totalPossible > 0 ? ((totalPresent + totalLate) / totalPossible) * 100 : 0;

  // Fetch unique dates for total classes
  const attendanceQ = query(
    collection(db, 'attendance_records'),
    where('teacher_id', '==', teacherId)
  );
  const attendanceSnap = await getDocs(attendanceQ);
  const studentIdSet = new Set(allStudents.map(s => s.id));

  let startDateStr = '2000-01-01';
  if (period !== 'all') {
    const now = getTashkentDate();
    switch (period) {
      case '1_day': now.setDate(now.getDate() - 1); break;
      case '1_week': now.setDate(now.getDate() - 7); break;
      case '1_month': now.setMonth(now.getMonth() - 1); break;
      case '2_months': now.setMonth(now.getMonth() - 2); break;
      case '3_months': now.setMonth(now.getMonth() - 3); break;
      case '6_months': now.setMonth(now.getMonth() - 6); break;
      case '10_months': now.setMonth(now.getMonth() - 10); break;
    }
    startDateStr = now.toISOString().split('T')[0];
  }

  const filteredAttendance = attendanceSnap.docs
    .map(d => d.data())
    .filter(a => studentIdSet.has(a.student_id) && a.date >= startDateStr);

  const uniqueDates = [...new Set(filteredAttendance.map(a => a.date))];
  const totalClasses = uniqueDates.length;

  // Monthly Analysis
  const monthlyStats: { [key: string]: { classes: Set<string>, students: Set<string>, totalRecords: number, strictlyPresent: number, late: number, unexcusedAbsent: number } } = {};
  const uzbekMonths = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

  filteredAttendance.forEach(record => {
    const date = getTashkentDate(new Date(record.date));
    const month = `${uzbekMonths[date.getMonth()]}, ${date.getFullYear()}`;

    if (!monthlyStats[month]) {
      monthlyStats[month] = { classes: new Set(), students: new Set(), totalRecords: 0, strictlyPresent: 0, late: 0, unexcusedAbsent: 0 };
    }

    monthlyStats[month].classes.add(record.date);
    monthlyStats[month].students.add(record.student_id);
    monthlyStats[month].totalRecords++;

    if (record.status === 'present') {
      monthlyStats[month].strictlyPresent++;
    } else if (record.status === 'late') {
      monthlyStats[month].late++;
    } else if (record.status === 'absent_without_reason') {
      monthlyStats[month].unexcusedAbsent++;
    }
  });

  const monthlyData: MonthlyData[] = Object.entries(monthlyStats).map(([month, data]) => {
    const totalPossible = data.totalRecords;
    const attendancePercentage = totalPossible > 0 ? ((data.strictlyPresent + data.late) / totalPossible) * 100 : 0;
    const latePercentage = totalPossible > 0 ? (data.late / totalPossible) * 100 : 0;
    const unexcusedPercentage = totalPossible > 0 ? (data.unexcusedAbsent / totalPossible) * 100 : 0;
    // Efficiency = davomat foizi (soddalashtirilgan formula)
    const efficiency = attendancePercentage;

    return {
      month,
      totalClasses: data.classes.size,
      averageAttendance: Math.round(attendancePercentage * 100) / 100,
      totalStudents: data.students.size,
      latePercentage: Math.round(latePercentage * 100) / 100,
      absentPercentage: Math.round(unexcusedPercentage * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100
    };
  });

  return {
    stats: {
      totalStudents,
      totalClasses,
      averageAttendance: Math.round(averageAttendance * 100) / 100,
      topStudent
    },
    monthlyData
  };
}

/**
 * Calculate Group Rankings
 */
export async function calculateGroupRankings(
  teacherId: string,
  period: string = 'all'
): Promise<GroupRanking[]> {
  const allStudents = await calculateAllStudentScores(teacherId, 'all', period);
  const groupsMap = new Map<string, {
    totalStudents: number,
    presentCount: number,
    lateCount: number,
    unexcusedCount: number,
    totalPossible: number
  }>();

  allStudents.forEach(s => {
    if (!s.group_name) return;
    if (!groupsMap.has(s.group_name)) {
      groupsMap.set(s.group_name, {
        totalStudents: 0,
        presentCount: 0,
        lateCount: 0,
        unexcusedCount: 0,
        totalPossible: 0
      });
    }
    const g = groupsMap.get(s.group_name)!;
    g.totalStudents++;
    g.presentCount += s.score.presentCount;
    g.lateCount += s.score.lateCount;
    g.unexcusedCount += s.score.unexcusedAbsentCount;
    g.totalPossible += s.score.totalClasses;
  });

  const rankings: GroupRanking[] = Array.from(groupsMap.entries()).map(([name, data]) => {
    const attendancePercentage = data.totalPossible > 0 ? ((data.presentCount + data.lateCount) / data.totalPossible) * 100 : 0;
    const latePercentage = data.totalPossible > 0 ? (data.lateCount / data.totalPossible) * 100 : 0;
    const unexcusedPercentage = data.totalPossible > 0 ? (data.unexcusedCount / data.totalPossible) * 100 : 0;

    // Efficiency = davomat foizi (soddalashtirilgan formula)
    const efficiency = attendancePercentage;

    return {
      groupName: name,
      totalStudents: data.totalStudents,
      attendancePercentage: Math.round(attendancePercentage * 100) / 100,
      latePercentage: Math.round(latePercentage * 100) / 100,
      absentPercentage: Math.round(unexcusedPercentage * 100) / 100,
      totalClasses: data.totalStudents > 0 ? Math.round(data.totalPossible / data.totalStudents) : 0,
      efficiency: Math.round(efficiency * 100) / 100,
      rank: 0
    };
  });

  return rankings.sort((a, b) => b.efficiency - a.efficiency).map((r, i) => ({ ...r, rank: i + 1 }));
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
