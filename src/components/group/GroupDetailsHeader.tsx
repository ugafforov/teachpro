
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ArrowLeft } from 'lucide-react';
import AddStudentDialog from './AddStudentDialog';
import StudentImport from '../StudentImport';

interface GroupDetailsHeaderProps {
  groupName: string;
  studentCount: number;
  onBack: () => void;
  onStudentImport: () => void;
  isAddDialogOpen: boolean;
  onAddDialogOpenChange: (v: boolean) => void;
  newStudent: {
    name: string; student_id: string; email: string; phone: string
  };
  onStudentChange: (v: { name: string; student_id: string; email: string; phone: string }) => void;
  onAddStudent: () => void;
  teacherId: string;
}

const GroupDetailsHeader: React.FC<GroupDetailsHeaderProps> = ({
  groupName, studentCount, onBack,
  onStudentImport,
  isAddDialogOpen, onAddDialogOpenChange,
  newStudent, onStudentChange, onAddStudent,
  teacherId
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button onClick={onBack} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ortga qaytish</TooltipContent>
      </Tooltip>
      <div>
        <h2 className="text-2xl font-bold">{groupName}</h2>
        <p className="text-muted-foreground">{studentCount} o'quvchi</p>
      </div>
    </div>
    <div className="flex gap-2">
      <StudentImport 
        teacherId={teacherId} 
        groupName={groupName}
        onImportComplete={onStudentImport}
      />
      <AddStudentDialog
        isOpen={isAddDialogOpen}
        onOpenChange={onAddDialogOpenChange}
        newStudent={newStudent}
        onStudentChange={onStudentChange}
        onAddStudent={onAddStudent}
      />
    </div>
  </div>
);

export default GroupDetailsHeader;
