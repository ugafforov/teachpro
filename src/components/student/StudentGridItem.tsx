
import React from 'react';
import { Card } from '@/components/ui/card';
import { Student } from '../StudentManager';
import StudentActions from './StudentActions';

interface StudentGridItemProps {
  student: Student;
  onSelectStudent: (student: Student) => void;
  onEdit: (student: Student) => void;
  onArchive: (studentId: string, studentName: string) => void;
  onDelete: (studentId: string, studentName:string) => void;
  onReward: (student: Student) => void;
}

const StudentGridItem: React.FC<StudentGridItemProps> = ({ student, onSelectStudent, onEdit, onArchive, onDelete, onReward }) => {
  return (
    <Card className="apple-card p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
              <span className="text-lg font-medium">
                {student.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <h3 className="font-semibold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => onSelectStudent(student)}>
                {student.name}
              </h3>
              {student.student_id && (
                <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
              )}
              <p className="text-sm text-blue-600">{student.group_name}</p>
            </div>
          </div>
        </div>

        {(student.email || student.phone) && (
          <div className="space-y-1">
            {student.email && (
              <p className="text-sm text-muted-foreground">{student.email}</p>
            )}
            {student.phone && (
              <p className="text-sm text-muted-foreground">{student.phone}</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {new Date(student.created_at).toLocaleDateString('uz-UZ')}
          </span>
          <StudentActions 
            student={student} 
            onEdit={onEdit}
            onArchive={onArchive}
            onDelete={onDelete}
            onReward={onReward}
          />
        </div>
      </div>
    </Card>
  );
};

export default StudentGridItem;
