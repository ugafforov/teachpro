
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Gift, AlertTriangle } from 'lucide-react';
import { Student } from '../StudentManager';
import { useToast } from '@/hooks/use-toast';

interface RewardDialogProps {
  student: Student | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddReward: (studentId: string, points: number, type: 'reward' | 'penalty') => void;
}

const RewardDialog: React.FC<RewardDialogProps> = ({ student, isOpen, onOpenChange, onAddReward }) => {
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardType, setRewardType] = useState<'reward' | 'penalty'>('reward');
  const { toast } = useToast();

  const handleSave = () => {
    if (!student) return;

    if (!rewardPoints) {
      toast({ title: "Ma'lumot yetishmayapti", description: "Ball miqdorini kiriting", variant: "destructive" });
      return;
    }

    const points = parseFloat(rewardPoints);
    if (isNaN(points)) {
      toast({ title: "Noto'g'ri format", description: "Ball sonli qiymat bo'lishi kerak", variant: "destructive" });
      return;
    }
    
    onAddReward(student.id, points, rewardType);
    setRewardPoints('');
  };

  if (!student) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mukofot/Jarima berish ({student.name})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setRewardType('reward')} variant={rewardType === 'reward' ? 'default' : 'outline'} className="flex items-center justify-center gap-2">
              <Gift className="w-4 h-4" /> Mukofot
            </Button>
            <Button onClick={() => setRewardType('penalty')} variant={rewardType === 'penalty' ? 'default' : 'outline'} className="flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Jarima
            </Button>
          </div>
          <div>
            <label className="text-sm font-medium">Ball miqdori</label>
            <Input type="number" step="0.1" value={rewardPoints} onChange={(e) => setRewardPoints(e.target.value)} placeholder="Masalan: 5" />
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleSave} className="flex-1">Saqlash</Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">Bekor qilish</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RewardDialog;
