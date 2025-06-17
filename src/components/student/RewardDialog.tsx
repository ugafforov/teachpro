
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!student) return;

    if (!rewardPoints) {
      toast({ title: "Ma'lumot yetishmayapti", description: "Ball miqdorini kiriting", variant: "destructive" });
      return;
    }

    const points = parseFloat(rewardPoints);
    if (isNaN(points) || points <= 0 || points > 5) {
      toast({ title: "Noto'g'ri format", description: "Ball 0.1 dan 5 gacha bo'lishi kerak", variant: "destructive" });
      return;
    }

    try {
      setIsLoading(true);
      await onAddReward(student.id, points, rewardType);
      setRewardPoints('');
      setReason('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error in reward dialog:', error);
    } finally {
      setIsLoading(false);
    }
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
            <Button 
              onClick={() => setRewardType('reward')} 
              variant={rewardType === 'reward' ? 'default' : 'outline'} 
              className="flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <Gift className="w-4 h-4" /> Mukofot
            </Button>
            <Button 
              onClick={() => setRewardType('penalty')} 
              variant={rewardType === 'penalty' ? 'default' : 'outline'} 
              className="flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <AlertTriangle className="w-4 h-4" /> Jarima
            </Button>
          </div>
          <div>
            <label className="text-sm font-medium">Ball miqdori (0.1 - 5)</label>
            <Input 
              type="number" 
              step="0.1" 
              min="0.1"
              max="5"
              value={rewardPoints} 
              onChange={(e) => setRewardPoints(e.target.value)} 
              placeholder="Masalan: 5" 
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Sabab</label>
            <Textarea 
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              placeholder="Mukofot/jarima sababi..." 
              rows={3}
              disabled={isLoading}
            />
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleSave} className="flex-1" disabled={isLoading}>
              {isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1" disabled={isLoading}>
              Bekor qilish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RewardDialog;
