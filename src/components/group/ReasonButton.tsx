
import React from 'react';
import { Button } from '@/components/ui/button';
import { ShieldQuestion } from 'lucide-react';

interface ReasonButtonProps {
  active: boolean;
  onClick: () => void;
}

const ReasonButton: React.FC<ReasonButtonProps> = ({ active, onClick }) => {
  const base = 'w-10 h-10 p-0 border border-gray-300';
  return (
    <Button
      size="sm"
      onClick={onClick}
      className={
        active
          ? `${base} bg-blue-500 hover:bg-blue-600 text-white border-blue-500`
          : `${base} bg-white hover:bg-gray-50 text-gray-600`
      }
    >
      <ShieldQuestion className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-600'}`} />
    </Button>
  );
};

export default ReasonButton;
