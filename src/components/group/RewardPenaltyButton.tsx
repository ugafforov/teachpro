
import React from 'react';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';

interface RewardPenaltyButtonProps {
  points?: number;
  onClick: () => void;
}

const RewardPenaltyButton: React.FC<RewardPenaltyButtonProps> = ({ points, onClick }) => {
  const base = 'w-10 h-10 p-0 border border-gray-300';
  let className = `${base} bg-white hover:bg-gray-50 text-gray-600`;
  let iconColor = 'text-gray-600';

  if (typeof points === 'number' && points !== 0) {
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
    >
      <Gift className={`w-4 h-4 ${iconColor}`} />
    </Button>
  );
};

export default RewardPenaltyButton;
