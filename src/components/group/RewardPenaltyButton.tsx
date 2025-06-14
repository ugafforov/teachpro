
import React from 'react';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';

interface RewardPenaltyButtonProps {
  points?: number;
  onClick: () => void;
  hasRewardToday?: boolean;
}

const RewardPenaltyButton: React.FC<RewardPenaltyButtonProps> = ({ points, onClick, hasRewardToday }) => {
  const base = 'w-10 h-10 p-0 border border-gray-300';
  let className = `${base} bg-white hover:bg-gray-50 text-gray-600`;
  let iconColor = 'text-gray-600';

  if (hasRewardToday) {
    // Bugungi mukofot/jarima olgan o'quvchilar uchun boshqa rang
    className = `${base} bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-300 cursor-not-allowed opacity-70`;
    iconColor = 'text-blue-700';
  } else if (typeof points === 'number' && points !== 0) {
    if (points > 0) {
      className = `${base} bg-green-100 hover:bg-green-200 text-green-700 border-green-300`;
      iconColor = 'text-green-700';
    } else {
      className = `${base} bg-red-100 hover:bg-red-200 text-red-700 border-red-300`;
      iconColor = 'text-red-700';
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      className={className}
      disabled={hasRewardToday}
    >
      <Gift className={`w-4 h-4 ${iconColor}`} />
    </Button>
  );
};

export default RewardPenaltyButton;
