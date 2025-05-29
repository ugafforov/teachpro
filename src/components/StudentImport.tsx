
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StudentImportProps {
  teacherId: string;
  groupName?: string;
  onImportComplete: () => void;
}

const StudentImport: React.FC<StudentImportProps> = ({ teacherId, groupName, onImportComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!importText.trim()) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Import qilish uchun o'quvchilar ro'yxatini kiriting",
        variant: "destructive",
      });
      return;
    }

    if (!groupName) {
      toast({
        title: "Guruh tanlanmagan",
        description: "Avval guruhni tanlang",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const lines = importText.split('\n').filter(line => line.trim());
      const students = [];

      for (const line of lines) {
        const parts = line.split(',').map(part => part.trim());
        
        if (parts.length >= 1) {
          const student = {
            teacher_id: teacherId,
            name: parts[0],
            student_id: parts[1] || null,
            email: parts[2] || null,
            phone: parts[3] || null,
            group_name: groupName
          };
          students.push(student);
        }
      }

      if (students.length === 0) {
        toast({
          title: "Ma'lumot topilmadi",
          description: "Import qilish uchun to'g'ri formatda ma'lumot kiriting",
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
        description: `${students.length} ta o'quvchi import qilindi`,
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

  const downloadTemplate = () => {
    const template = `Ism Familiya,ID,Email,Telefon
Ali Valiyev,2024001,ali@example.com,+998901234567
Olima Karimova,2024002,olima@example.com,+998907654321
Sardor Usmonov,2024003,sardor@example.com,+998909876543`;

    const blob = new Blob([template], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="w-4 h-4" />
          O'quvchilarni import qilish
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>O'quvchilarni import qilish</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Har bir qatorda bitta o'quvchi ma'lumotini kiriting
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Namuna yuklash
            </Button>
          </div>

          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-2">Format:</p>
                <code className="block bg-white p-2 rounded text-xs border">
                  Ism Familiya,ID,Email,Telefon<br/>
                  Ali Valiyev,2024001,ali@example.com,+998901234567
                </code>
                <p className="text-blue-700 mt-2">
                  Faqat ism majburiy, qolgan maydonlar ixtiyoriy
                </p>
              </div>
            </div>
          </Card>

          <div>
            <Label htmlFor="importText">O'quvchilar ro'yxati</Label>
            <Textarea
              id="importText"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Ism Familiya,ID,Email,Telefon
Ali Valiyev,2024001,ali@example.com,+998901234567
Olima Karimova,2024002,olima@example.com,+998907654321"
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          {groupName && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                <strong>Tanlangan guruh:</strong> {groupName}
              </p>
            </div>
          )}

          <div className="flex space-x-2">
            <Button 
              onClick={handleImport} 
              disabled={loading || !groupName}
              className="flex-1"
            >
              {loading ? "Import qilinmoqda..." : "Import qilish"}
            </Button>
            <Button 
              onClick={() => setIsOpen(false)} 
              variant="outline" 
              className="flex-1"
            >
              Bekor qilish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentImport;
