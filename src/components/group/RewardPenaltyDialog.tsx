
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Gift, XCircle, Loader2 } from 'lucide-react';

interface RewardPenaltyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rewardPoints: string;
  onRewardPointsChange: (points: string) => void;
  rewardType: 'reward' | 'penalty';
  onRewardTypeChange: (type: 'reward' | 'penalty') => void;
  onSave: () => void;
  isSaving: boolean;
}

const RewardPenaltyDialog: React.FC<RewardPenaltyDialogProps> = ({
  isOpen,
  onClose,
  rewardPoints,
  onRewardPointsChange,
  rewardType,
  onRewardTypeChange,
  onSave,
  isSaving
}) => {
  if (!isOpen) return null;

  const isValidPoints = rewardPoints && parseFloat(rewardPoints) > 0 && parseFloat(rewardPoints) <= 5;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Mukofot/Jarima berish</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onRewardTypeChange('reward')}
              variant={rewardType === 'reward' ? 'default' : 'outline'}
              className="flex items-center justify-center gap-2"
              disabled={isSaving}
            >
              <Gift className="w-4 h-4" />
              Mukofot
            </Button>
            <Button
              onClick={() => onRewardTypeChange('penalty')}
              variant={rewardType === 'penalty' ? 'default' : 'outline'}
              className="flex items-center justify-center gap-2"
              disabled={isSaving}
            >
              <XCircle className="w-4 h-4" />
              Jarima
            </Button>
          </div>
          <div>
            <label className="text-sm font-medium">
              Ball miqdori (maksimum {rewardType === 'reward' ? '+5' : '-5'})
            </label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="5"
              value={rewardPoints}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (isNaN(value) || value <= 5) {
                  onRewardPointsChange(e.target.value);
                }
              }}
              placeholder="Masalan: 3"
              disabled={isSaving}
            />
            <p className="text-xs text-gray-500 mt-1">
              * Har kuni bitta o'quvchiga faqat bir marta mukofot/jarima berish mumkin
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={onSave}
              className="flex-1"
              disabled={!isValidPoints || isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isSaving}
            >
              Bekor qilish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RewardPenaltyDialog;
