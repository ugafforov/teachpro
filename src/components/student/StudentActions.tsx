
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Edit2, Archive, Trash2, Gift } from 'lucide-react';
import { Student } from '../StudentManager';

interface StudentActionsProps {
  student: Student;
  onEdit: (student: Student) => void;
  onArchive: (studentId: string, studentName: string) => void;
  onDelete: (studentId: string, studentName:string) => void;
  onReward: (student: Student) => void;
}

const StudentActions: React.FC<StudentActionsProps> = ({ student, onEdit, onArchive, onDelete, onReward }) => {
  return (
    <div className="flex items-center space-x-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" onClick={() => onReward(student)}>
            <Gift className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Mukofot/Jarima berish</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" onClick={() => onEdit(student)}>
            <Edit2 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Tahrirlash</TooltipContent>
      </Tooltip>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                <Archive className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Arxivlash</TooltipContent>
          </Tooltip>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'quvchini arxivlash</AlertDialogTitle>
            <AlertDialogDescription>
              "{student.name}" ni arxivlashga ishonchingiz komilmi? Arxivlangan o'quvchilarni keyinroq tiklash mumkin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={() => onArchive(student.id, student.name)} className="bg-orange-600 hover:bg-orange-700">
              Arxivlash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">O'chirish</TooltipContent>
          </Tooltip>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'quvchini o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              "{student.name}" ni o'chirishga ishonchingiz komilmi? O'chirilgan o'quvchilarni chiqindi qutisidan tiklash mumkin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(student.id, student.name)} className="bg-red-600 hover:bg-red-700">
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentActions;
