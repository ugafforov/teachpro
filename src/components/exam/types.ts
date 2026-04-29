import { serverTimestamp } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";

export interface Group {
  id: string;
  name: string;
}

export interface Student {
  id: string;
  name: string;
  group_name?: string;
  group_id?: string;
  join_date?: string;
  left_date?: string;
}

export interface ExamType {
  id: string;
  name: string;
}

export interface Exam {
  id: string;
  exam_name: string;
  exam_date: string;
  group_id: string;
  exam_type_id?: string;
  created_at?: Timestamp | string;
}

export interface ExamResult {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
  notes?: string;
  student_name: string;
  group_name: string;
  submitted_at?: Timestamp | string;
  teacher_id?: string;
}

export type AnalysisRow = {
  studentName: string;
  groupName: string;
  examDate: string;
  score: number;
};
