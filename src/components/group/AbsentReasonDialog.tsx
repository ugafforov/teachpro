
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Student {
  id: string;
  name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name: string;
  teacher_id: string;
  created_at: string;
  rewardPenaltyPoints?: number;
}

interface AbsentReasonDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  reasonText: string;
  onReasonTextChange: (text: string) => void;
  onSave: () => void;
}

const AbsentReasonDialog: React.FC<AbsentReasonDialogProps> = ({
  isOpen,
  onOpenChange,
  student,
  reasonText,
  onReasonTextChange,
  onSave
}) => {
  const commonReasons = ["Kasallik", "Oilaviy sharoit", "Test/Imtihon", "Boshqa"];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sababli kelmaganini belgilash</DialogTitle>
          <DialogDescription>
            {student?.name} uchun dars qoldirish sababini tanlang yoki kiriting. Izoh qoldirish ixtiyoriy.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            {commonReasons.map(reason => (
              <Button 
                key={reason} 
                variant={reasonText === reason ? "default" : "outline"} 
                onClick={() => onReasonTextChange(reason)}
              >
                {reason}
              </Button>
            ))}
          </div>
          <div>
            <Label htmlFor="reason-text" className="sr-only">Izoh</Label>
            <Textarea
              id="reason-text"
              value={reasonText}
              onChange={(e) => onReasonTextChange(e.target.value)}
              placeholder="Yoki o'zingiz sabab kiriting..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); onReasonTextChange(''); }}>
              Bekor qilish
            </Button>
            <Button onClick={onSave}>Saqlash</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AbsentReasonDialog;
