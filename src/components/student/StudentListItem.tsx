
import React from 'react';
import { Student } from '../StudentManager';
import StudentActions from './StudentActions';

interface StudentListItemProps {
  student: Student;
  onSelectStudent: (student: Student) => void;
  onEdit: (student: Student) => void;
  onArchive: (studentId: string, studentName: string) => void;
  onDelete: (studentId: string, studentName:string) => void;
  onReward: (student: Student) => void;
}

const StudentListItem: React.FC<StudentListItemProps> = ({ student, onSelectStudent, onEdit, onArchive, onDelete, onReward }) => {
  return (
    <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
          <span className="text-sm font-medium">
            {student.name.split(' ').map(n => n[0]).join('')}
          </span>
        </div>
        <div>
          <h3 className="font-semibold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => onSelectStudent(student)}>
            {student.name}
          </h3>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            {student.student_id && <span>ID: {student.student_id}</span>}
            <span className="text-blue-600">{student.group_name}</span>
          </div>
          {(student.email || student.phone) && (
            <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
              {student.email && <span>{student.email}</span>}
              {student.phone && <span>{student.phone}</span>}
            </div>
          )}
        </div>
      </div>
      <StudentActions 
        student={student} 
        onEdit={onEdit}
        onArchive={onArchive}
        onDelete={onDelete}
        onReward={onReward}
      />
    </div>
  );
};

export default StudentListItem;
