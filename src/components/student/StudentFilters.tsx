
import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, List, LayoutGrid } from 'lucide-react';
import { Group } from '../StudentManager';

interface StudentFiltersProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  selectedGroup: string;
  onSelectedGroupChange: (value: string) => void;
  groups: Group[];
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

const StudentFilters: React.FC<StudentFiltersProps> = ({
  searchTerm,
  onSearchTermChange,
  selectedGroup,
  onSelectedGroupChange,
  groups,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <Card className="apple-card p-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="O'quvchi nomi yoki ID bo'yicha qidiring..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedGroup} onValueChange={onSelectedGroupChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha guruhlar</SelectItem>
            {groups.map(group => (
              <SelectItem key={group.id} value={group.name}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant={viewMode === 'grid' ? 'default' : 'outline'} onClick={() => onViewModeChange('grid')} size="sm">
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === 'list' ? 'default' : 'outline'} onClick={() => onViewModeChange('list')} size="sm">
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default StudentFilters;
