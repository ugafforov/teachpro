import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn, getTashkentDate, getTashkentToday } from '@/lib/utils';
import { db } from '@/lib/firebase';
import {
  collection,
  writeBatch,
  doc,
  serverTimestamp
} from 'firebase/firestore';

// Kept for type reference, though the prop will be passed in
interface Group {
  id: string;
  name: string;
}

interface StudentImportProps {
  teacherId: string;
  groupName?: string;
  onImportComplete: () => void;
  availableGroups: Group[]; // Use the passed-in groups
}

const StudentImport: React.FC<StudentImportProps> = ({ teacherId, groupName, onImportComplete, availableGroups = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(groupName || '');
  const [joinDate, setJoinDate] = useState(getTashkentToday());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // When the component receives a new groupName prop, update the selected group
  useEffect(() => {
    if (groupName) {
      setSelectedGroup(groupName);
    }
  }, [groupName]);

  const handleImport = async () => {
    if (!importText.trim()) {
      toast({ title: "Ma'lumot yetishmayapti", description: "O'quvchilar nomlarini kiriting", variant: "destructive" });
      return;
    }

    if (!selectedGroup) {
      toast({ title: "Guruh tanlanmagan", description: "Guruhni tanlang", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const lines = importText.split('\n').filter(line => line.trim());
      const batch = writeBatch(db);
      let count = 0;

      for (const line of lines) {
        const name = line.trim();
        if (name) {
          const studentRef = doc(collection(db, 'students'));
          batch.set(studentRef, {
            teacher_id: teacherId,
            name: name,
            join_date: joinDate,
            group_name: selectedGroup,
            is_active: true,
            created_at: serverTimestamp()
          });
          count++;
        }
      }

      if (count === 0) {
        toast({ title: "Ma'lumot topilmadi", description: "Hech bo'lmaganda bitta o'quvchi nomini kiriting", variant: "destructive" });
        setLoading(false);
        return;
      }

      await batch.commit();

      toast({ title: "Import muvaffaqiyatli", description: `${count} ta o'quvchi qo'shildi` });
      setImportText('');
      setIsOpen(false);
      onImportComplete();
    } catch (error) {
      console.error('Error importing students:', error);
      toast({ title: "Import xatoligi", description: "O'quvchilarni import qilishda xatolik yuz berdi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          O'quvchi qo'shish
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>O'quvchi qo'shish</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-2">Format:</p>
                <code className="block bg-white p-2 rounded text-xs border">Ali Valiyev<br />Olima Karimova<br />Sardor Usmonov</code>
                <p className="text-blue-700 mt-2">Har bir qatorda bitta o'quvchi nomi</p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Guruh tanlang *</Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger><SelectValue placeholder="Guruhni tanlang" /></SelectTrigger>
                <SelectContent>
                  {availableGroups.map(group => <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Qo'shilgan sana *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !joinDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {joinDate ? format(parseISO(joinDate), "d-MMM, yy", { locale: uz }) : <span>Sana tanlang</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(joinDate)}
                    onSelect={(date) => date && setJoinDate(format(date, 'yyyy-MM-dd'))}
                    initialFocus
                    locale={uz}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label>O'quvchilar nomi</Label>
            <Textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Ali Valiyev&#10;Olima Karimova&#10;Sardor Usmonov" rows={10} className="font-mono text-sm" />
          </div>

          <div className="flex space-x-2">
            <Button onClick={handleImport} disabled={loading || !selectedGroup} className="flex-1">{loading ? "Import qilinmoqda..." : "Import qilish"}</Button>
            <Button onClick={() => setIsOpen(false)} variant="outline" className="flex-1">Bekor qilish</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentImport;