
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Group, Student } from '../StudentManager';

interface EditStudentDialogProps {
  student: Student | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onEditStudent: (student: Student) => void;
  groups: Group[];
}

const EditStudentDialog: React.FC<EditStudentDialogProps> = ({ student, isOpen, onOpenChange, onEditStudent, groups }) => {
  const [editingData, setEditingData] = useState<Student | null>(student);

  useEffect(() => {
    setEditingData(student);
  }, [student]);

  const handleSave = () => {
    if (editingData) {
      onEditStudent(editingData);
    }
  };

  if (!editingData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>O'quvchini tahrirlash</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-studentName">O'quvchi nomi *</Label>
            <Input id="edit-studentName" value={editingData.name} onChange={(e) => setEditingData({ ...editingData, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="edit-studentId">O'quvchi ID</Label>
            <Input id="edit-studentId" value={editingData.student_id || ''} onChange={(e) => setEditingData({ ...editingData, student_id: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="edit-studentGroup">Guruh</Label>
            <Select value={editingData.group_name} onValueChange={(value) => setEditingData({ ...editingData, group_name: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="edit-studentEmail">Email</Label>
            <Input id="edit-studentEmail" type="email" value={editingData.email || ''} onChange={(e) => setEditingData({ ...editingData, email: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="edit-studentPhone">Telefon</Label>
            <Input id="edit-studentPhone" value={editingData.phone || ''} onChange={(e) => setEditingData({ ...editingData, phone: e.target.value })} />
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleSave} className="apple-button flex-1">Saqlash</Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">Bekor qilish</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditStudentDialog;
