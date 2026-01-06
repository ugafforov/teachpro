
export interface StatsData {
  totalStudents: number;
  totalClasses: number;
  averageAttendance: number;
  topStudent: string;
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
