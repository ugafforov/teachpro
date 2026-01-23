import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface StudentProfileLinkProps {
  studentId: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  onClick?: () => void;
}

const StudentProfileLink: React.FC<StudentProfileLinkProps> = ({
  studentId,
  children,
  className,
  title,
  onClick
}) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Fast navigation without page refresh
    navigate(`/students/${studentId}`, {
      replace: false,
      state: { fastNavigate: true }
    });
    
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      className={cn(
        'font-medium text-blue-700 hover:text-blue-800 hover:underline underline-offset-2 transition-colors duration-150 cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded',
        className
      )}
    >
      {children}
    </button>
  );
};

export default StudentProfileLink;
