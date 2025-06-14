
import React from "react";
import { Card } from "@/components/ui/card";
import StudentList from "./StudentList";

interface Student {
  id: string;
  name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name: string;
  teacher_id: string;
  created_at: string;
  rewardPenaltyPoints?: number;
}

type AttendanceStatus = "present" | "absent" | "late" | "absent_with_reason";

interface StudentTableProps {
  students: Student[];
  attendance: Record<string, { status: AttendanceStatus; reason?: string | null }>;
  onStudentClick: (studentId: string) => void;
  onMarkAttendance: (studentId: string, status: AttendanceStatus, reason?: string | null) => void;
  onShowReward: (studentId: string) => void;
  onShowReason: (student: Student) => void;
  onAddStudentClick: () => void;
}

const StudentTable: React.FC<StudentTableProps> = ({
  students, attendance, onStudentClick, onMarkAttendance, onShowReward, onShowReason, onAddStudentClick
}) => (
  <Card className="apple-card">
    <StudentList
      students={students}
      attendance={attendance}
      onStudentClick={onStudentClick}
      onMarkAttendance={onMarkAttendance}
      onShowReward={onShowReward}
      onShowReason={onShowReason}
      onAddStudentClick={onAddStudentClick}
    />
  </Card>
);

export default StudentTable;
