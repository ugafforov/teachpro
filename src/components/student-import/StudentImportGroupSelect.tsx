
import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface Props {
  groups: Group[];
  selectedGroup: string;
  onSelectGroup: (groupName: string) => void;
  disabled?: boolean;
}

const StudentImportGroupSelect: React.FC<Props> = ({
  groups, selectedGroup, onSelectGroup, disabled
}) => (
  <div>
    <Label htmlFor="groupSelect">Guruh tanlang *</Label>
    <Select value={selectedGroup} onValueChange={onSelectGroup} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Guruhni tanlang" />
      </SelectTrigger>
      <SelectContent>
        {groups.map(group => (
          <SelectItem key={group.id} value={group.name}>
            {group.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default StudentImportGroupSelect;
