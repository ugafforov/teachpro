
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Gift, AlertTriangle } from 'lucide-react';
import { Student } from '../StudentManager';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RewardDialogProps {
  student: Student | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddReward: (studentId: string, points: number, type: 'reward' | 'penalty') => Promise<void>;
}

const RewardDialog: React.FC<RewardDialogProps> = ({ student, isOpen, onOpenChange, onAddReward }) => {
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardType, setRewardType] = useState<'reward' | 'penalty'>('reward');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!student) return;

    if (!rewardPoints || !rewardPoints.trim()) {
      toast({ 
        title: "Ma'lumot yetishmayapti", 
        description: "Ball miqdorini kiriting", 
        variant: "destructive" 
      });
      return;
    }

    const points = parseFloat(rewardPoints);
    if (isNaN(points) || points <= 0 || points > 5) {
      toast({ 
        title: "Noto'g'ri format", 
        description: "Ball 0.1 dan 5 gacha bo'lishi kerak", 
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);
    try {
      // Check if student already has reward/penalty today
      const today = new Date().toISOString().split('T')[0];
      const { data: existingReward, error: checkError } = await supabase
        .from('daily_reward_penalty_summary')
        .select('id')
        .eq('student_id', student.id)
        .eq('date_given', today)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing reward:', checkError);
        throw checkError;
      }

      if (existingReward) {
        toast({
          title: "Cheklov",
          description: "Bu o'quvchiga bugun allaqachon mukofot/jarima berilgan.",
          variant: "destructive",
        });
        return;
      }

      // Add reward/penalty to history
      const finalPoints = rewardType === 'penalty' ? -Math.abs(points) : Math.abs(points);
      const { error: historyError } = await supabase
        .from('reward_penalty_history')
        .insert({
          student_id: student.id,
          teacher_id: student.teacher_id,
          points: finalPoints,
          reason: reason || (rewardType === 'reward' ? 'Mukofot' : 'Jarima'),
          type: rewardType,
          date_given: today
        });

      if (historyError) {
        console.error('Error saving reward history:', historyError);
        throw historyError;
      }

      // Update student scores
      await updateStudentScores(student.id, student.teacher_id);

      toast({
        title: "Muvaffaqiyat",
        description: `${rewardType === 'reward' ? 'Mukofot' : 'Jarima'} muvaffaqiyatli berildi.`,
      });

      // Call the parent callback
      await onAddReward(student.id, points, rewardType);
      
      // Reset form and close dialog
      setRewardPoints('');
      setReason('');
      onOpenChange(false);
      
    } catch (error) {
      console.error('Error adding reward/penalty:', error);
      toast({
        title: "Xatolik",
        description: "Mukofot/jarima berishda xatolik yuz berdi.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateStudentScores = async (studentId: string, teacherId: string) => {
    try {
      // Calculate total reward/penalty points
      const { data: rewardData, error: rewardError } = await supabase
        .from('reward_penalty_history')
        .select('points')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId);

      if (rewardError) {
        console.error('Error fetching reward points:', rewardError);
        return;
      }

      const totalRewardPoints = rewardData?.reduce((sum, r) => sum + r.points, 0) || 0;

      // Get total grade points
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('grade')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId);

      if (gradesError) {
        console.error('Error fetching grades:', gradesError);
        return;
      }

      const totalGradePoints = gradesData?.reduce((sum, g) => sum + g.grade, 0) || 0;
      const newTotalScore = totalRewardPoints + totalGradePoints;

      // Update student scores
      const { error: updateError } = await supabase
        .from('student_scores')
        .upsert({
          student_id: studentId,
          teacher_id: teacherId,
          reward_penalty_points: totalRewardPoints,
          total_score: newTotalScore
        }, {
          onConflict: 'student_id,teacher_id'
        });

      if (updateError) {
        console.error('Error updating student scores:', updateError);
      }

    } catch (error) {
      console.error('Error updating student scores:', error);
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
