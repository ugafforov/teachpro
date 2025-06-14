import React from "react";
import { Gift, Edit, Archive, Trash2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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

interface StudentCardProps {
  student: Student;
  onGift: (student: Student) => void;
  onEdit: (student: Student) => void;
  onArchive: (student: Student) => void;
  onDelete: (student: Student) => void;
}

const StudentCard: React.FC<StudentCardProps> = ({ student, onGift, onEdit, onArchive, onDelete }) => {
  return (
    <div className="student-card">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center relative">
          <span className="text-sm font-medium">
            {student.name.split(' ').map(n => n[0]).join('')}
          </span>
        </div>
        <div>
          <h3 className="font-semibold">{student.name}</h3>
          {student.student_id && (
            <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => onGift(student)} className="p-2">
              <Gift />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Mukofot/Jarima berish</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => onEdit(student)} className="p-2">
              <Edit />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Tahrirlash</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => onArchive(student)} className="p-2">
              <Archive />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Arxivlash</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => onDelete(student)} className="p-2 text-red-600">
              <Trash2 />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">O'chirish</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
};

export default StudentCard;
