
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Calendar, CheckCircle, RotateCcw } from 'lucide-react';

interface AttendanceSectionProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onMarkAllPresent: () => void;
  onClearAll: () => void;
}

const AttendanceSection: React.FC<AttendanceSectionProps> = ({
  selectedDate,
  onDateChange,
  onMarkAllPresent,
  onClearAll
}) => {
  return (
    <Card className="apple-card">
      <div className="p-6 border-b border-border/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold">Davomat</h3>
            <p className="text-sm text-muted-foreground">
              O'quvchilar davomatini boshqaring
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-40"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onMarkAllPresent}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Barchani kelgan deb belgilash
                </Button>
              </TooltipTrigger>
              <TooltipContent>Barcha o'quvchilarni "kelgan" sifatida belgilash</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onClearAll}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Belgilarni tozalash
                </Button>
              </TooltipTrigger>
              <TooltipContent>Barcha davomat statuslarini tozalash</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default AttendanceSection;
