
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Group, NewStudent } from '../StudentManager';

interface AddStudentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddStudent: (student: NewStudent) => void;
  groups: Group[];
}

const AddStudentDialog: React.FC<AddStudentDialogProps> = ({ isOpen, onOpenChange, onAddStudent, groups }) => {
  const [newStudent, setNewStudent] = useState<NewStudent>({
    name: '',
    student_id: '',
    email: '',
    phone: '',
    group_name: ''
  });

  const handleAdd = () => {
    onAddStudent(newStudent);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yangi o'quvchi qo'shish</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="studentName">O'quvchi nomi *</Label>
            <Input id="studentName" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} placeholder="To'liq ism sharif" />
          </div>
          <div>
            <Label htmlFor="studentId">O'quvchi ID</Label>
            <Input id="studentId" value={newStudent.student_id} onChange={(e) => setNewStudent({ ...newStudent, student_id: e.target.value })} placeholder="Masalan: 2024001" />
          </div>
          <div>
            <Label htmlFor="studentGroup">Guruh *</Label>
            <Select value={newStudent.group_name} onValueChange={(value) => setNewStudent({ ...newStudent, group_name: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Guruhni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="studentEmail">Email</Label>
            <Input id="studentEmail" type="email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} placeholder="student@example.com" />
          </div>
          <div>
            <Label htmlFor="studentPhone">Telefon</Label>
            <Input id="studentPhone" value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} placeholder="+998 90 123 45 67" />
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleAdd} className="apple-button flex-1">Qo'shish</Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">Bekor qilish</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddStudentDialog;
