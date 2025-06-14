
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Users, Calendar, Edit2, Archive, Trash2 } from 'lucide-react';
import { Group } from '../GroupManager';

interface GroupCardProps {
  group: Group;
  onGroupClick: (groupName: string) => void;
  onEdit: (e: React.MouseEvent, group: Group) => void;
  onArchive: (groupId: string, groupName: string) => void;
  onDelete: (groupId: string, groupName: string) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, onGroupClick, onEdit, onArchive, onDelete }) => {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const isAnyDialogOpen = isArchiveOpen || isDeleteOpen;

  return (
    <Card
      className="p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => !isAnyDialogOpen && onGroupClick(group.name)}
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{group.name}</h3>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <div>
              <span className="text-gray-600 text-sm">O'quvchilar</span>
              <div className="text-lg font-semibold">{group.student_count}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-500" />
            <div>
              <span className="text-gray-600 text-sm">Davomat</span>
              <div className="text-lg font-semibold text-green-600">{group.attendance_percentage}%</div>
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {new Date(group.created_at).toLocaleDateString('uz-UZ')}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={(e) => onEdit(e, group)} variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2">
                <Edit2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Guruhni tahrirlash</TooltipContent>
          </Tooltip>
          <AlertDialog open={isArchiveOpen} onOpenChange={setIsArchiveOpen}>
            <AlertDialogTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={(e) => { e.stopPropagation(); setIsArchiveOpen(true); }} variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 p-2">
                    <Archive className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Guruhni arxivlash</TooltipContent>
              </Tooltip>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Guruhni arxivlash</AlertDialogTitle>
                <AlertDialogDescription>"{group.name}" guruhini arxivlashga ishonchingiz komilmi? Arxivlangan guruhlarni keyinroq tiklash mumkin.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                <AlertDialogAction onClick={() => onArchive(group.id, group.name)} className="bg-orange-600 hover:bg-orange-700">Arxivlash</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={(e) => { e.stopPropagation(); setIsDeleteOpen(true); }} variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Guruhni o'chirish</TooltipContent>
              </Tooltip>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Guruhni o'chirish</AlertDialogTitle>
                <AlertDialogDescription>"{group.name}" guruhini o'chirishga ishonchingiz komilmi? O'chirilgan guruhlarni chiqindi qutisidan tiklash mumkin.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(group.id, group.name)} className="bg-red-600 hover:bg-red-700">O'chirish</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
};

export default GroupCard;
