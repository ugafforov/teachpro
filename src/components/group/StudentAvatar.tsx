
import React from 'react';
import { Star, AlertTriangle } from 'lucide-react';

interface StudentAvatarProps {
  name: string;
  rewardPenaltyPoints?: number;
}

const StudentAvatar: React.FC<StudentAvatarProps> = ({ name, rewardPenaltyPoints }) => (
  <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center relative">
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
  </div>
);

export default StudentAvatar;
