
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ScheduleManager from './ScheduleManager';

interface ScheduleManagerButtonProps {
  groupName: string;
  teacherId: string;
}

const ScheduleManagerButton: React.FC<ScheduleManagerButtonProps> = ({ groupName, teacherId }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="flex justify-start">
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          Dars jadvali
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dars jadvali - {groupName}</DialogTitle>
          </DialogHeader>
          <ScheduleManager groupName={groupName} teacherId={teacherId} />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScheduleManagerButton;
