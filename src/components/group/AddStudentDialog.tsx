
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Plus } from 'lucide-react';

interface AddStudentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newStudent: {
    name: string;
    student_id: string;
    email: string;
    phone: string;
  };
  onStudentChange: (student: { name: string; student_id: string; email: string; phone: string; }) => void;
  onAddStudent: () => void;
}

const AddStudentDialog: React.FC<AddStudentDialogProps> = ({
  isOpen,
  onOpenChange,
  newStudent,
  onStudentChange,
  onAddStudent
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button className="apple-button">
              <Plus className="w-4 h-4 mr-2" />
              O'quvchi qo'shish
            </Button>
          </TooltipTrigger>
          <TooltipContent>Guruhga yangi o'quvchi qo'shish</TooltipContent>
        </Tooltip>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yangi o'quvchi qo'shish</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="studentName">O'quvchi nomi *</Label>
            <Input
              id="studentName"
              value={newStudent.name}
              onChange={(e) => onStudentChange({ ...newStudent, name: e.target.value })}
              placeholder="To'liq ism sharif"
            />
          </div>
          <div>
            <Label htmlFor="studentId">O'quvchi ID</Label>
            <Input
              id="studentId"
              value={newStudent.student_id}
              onChange={(e) => onStudentChange({ ...newStudent, student_id: e.target.value })}
              placeholder="Masalan: 2024001"
            />
          </div>
          <div>
            <Label htmlFor="studentEmail">Email</Label>
            <Input
              id="studentEmail"
              type="email"
              value={newStudent.email}
              onChange={(e) => onStudentChange({ ...newStudent, email: e.target.value })}
              placeholder="student@example.com"
            />
          </div>
          <div>
            <Label htmlFor="studentPhone">Telefon</Label>
            <Input
              id="studentPhone"
              value={newStudent.phone}
              onChange={(e) => onStudentChange({ ...newStudent, phone: e.target.value })}
              placeholder="+998 90 123 45 67"
            />
          </div>
          <div className="flex space-x-2">
            <Button onClick={onAddStudent} className="apple-button flex-1">
              Qo'shish
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">
              Bekor qilish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddStudentDialog;
