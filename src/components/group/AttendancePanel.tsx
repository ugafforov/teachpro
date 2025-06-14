
import React from "react";
import AttendanceSection from "./AttendanceSection";

interface AttendancePanelProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onMarkAllPresent: () => void;
  onClearAll: () => void;
}

const AttendancePanel: React.FC<AttendancePanelProps> = ({
  selectedDate, onDateChange, onMarkAllPresent, onClearAll
}) => (
  <AttendanceSection
    selectedDate={selectedDate}
    onDateChange={onDateChange}
    onMarkAllPresent={onMarkAllPresent}
    onClearAll={onClearAll}
  />
);

export default AttendancePanel;
