
import React from 'react';
import { Star, AlertTriangle, Clock } from 'lucide-react';

interface StudentAvatarProps {
  name: string;
  rewardPenaltyPoints?: number;
  hasRewardToday?: boolean;
}

const StudentAvatar: React.FC<StudentAvatarProps> = ({ name, rewardPenaltyPoints, hasRewardToday }) => (
  <div className={`w-10 h-10 bg-secondary rounded-full flex items-center justify-center relative ${
    hasRewardToday ? 'ring-2 ring-blue-400 ring-offset-2' : ''
  }`}>
    <span className="text-sm font-medium">
      {name.split(' ').map(n => n[0]).join('')}
    </span>
    {rewardPenaltyPoints !== undefined && rewardPenaltyPoints !== 0 && (
      <div className="absolute -top-1 -right-1">
        {
          rewardPenaltyPoints > 0
            ? <Star className="w-4 h-4 text-yellow-500" />
            : <AlertTriangle className="w-4 h-4 text-red-500" />
        }
      </div>
    )}
    {hasRewardToday && (
      <div className="absolute -bottom-1 -right-1">
        <Clock className="w-3 h-3 text-blue-500 bg-white rounded-full p-0.5" />
      </div>
    )}
  </div>
);

export default StudentAvatar;
