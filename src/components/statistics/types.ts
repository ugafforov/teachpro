
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

export interface StatisticsProps {
  teacherId: string;
}
