
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowDown, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import StudentImportGroupSelect from './student-import/StudentImportGroupSelect';
import StudentImportTextarea from './student-import/StudentImportTextarea';
import StudentImportActions from './student-import/StudentImportActions';

interface StudentImportProps {
  teacherId: string;
  groupName?: string;
  onImportComplete: () => void;
}

interface Group {
  id: string;
  name: string;
  description?: string;
}

const StudentImport: React.FC<StudentImportProps> = ({ teacherId, groupName, onImportComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(groupName || '');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchGroups();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && groupName) {
      setSelectedGroup(groupName);
    }
  }, [isOpen, groupName]);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setGroups(data || []);
      if (groupName && data?.find((g) => g.name === groupName)) {
        setSelectedGroup(groupName);
      } else if (data && data.length > 0 && !selectedGroup) {
        setSelectedGroup(data[0].name);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "O'quvchilar nomlarini kiriting",
        variant: "destructive",
      });
      return;
    }

    if (!selectedGroup) {
      toast({
        title: "Guruh tanlanmagan",
        description: "Guruhni tanlang",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const lines = importText.split('\n').filter(line => line.trim());
      const students = [];

      for (const line of lines) {
        const name = line.trim();

        if (name) {
          const student = {
            teacher_id: teacherId,
            name: name,
            group_name: selectedGroup
          };
          students.push(student);
        }
      }

      if (students.length === 0) {
        toast({
          title: "Ma'lumot topilmadi",
          description: "Hech bo'lmaganda bitta o'quvchi nomini kiriting",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('students')
        .insert(students);

      if (error) throw error;

      toast({
        title: "Import muvaffaqiyatli",
        description: `${students.length} ta o'quvchi qo'shildi`,
      });

      setImportText('');
      setIsOpen(false);
      onImportComplete();
    } catch (error) {
      console.error('Error importing students:', error);
      toast({
        title: "Import xatoligi",
        description: "O'quvchilarni import qilishda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isSelectDisabled = !!groupName && groups.some((g) => g.name === groupName) && groups.length === 1;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <ArrowDown className="w-4 h-4" />
          O'quvchilarni import qilish
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>O'quvchilarni import qilish</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-2">Format:</p>
                <code className="block bg-white p-2 rounded text-xs border">
                  Ali Valiyev<br />
                  Olima Karimova<br />
                  Sardor Usmonov
                </code>
                <p className="text-blue-700 mt-2">
                  Har bir qatorda bitta o'quvchi nomi
                </p>
              </div>
            </div>
          </Card>

          <StudentImportGroupSelect
            groups={groups}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
            disabled={isSelectDisabled}
          />
          <StudentImportTextarea
            importText={importText}
            setImportText={setImportText}
          />
          <StudentImportActions
            onImport={handleImport}
            onCancel={() => setIsOpen(false)}
            loading={loading}
            disabled={!selectedGroup}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentImport;
