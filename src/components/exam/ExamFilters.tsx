import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Group } from "./types";

interface ExamFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterGroup: string;
  setFilterGroup: (val: string) => void;
  filterExamType: string;
  setFilterExamType: (val: string) => void;
  dateFilter: string;
  setDateFilter: (val: string) => void;
  groups: Group[];
  uniqueExamNames: string[];
}

export const ExamFilters: React.FC<ExamFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  filterGroup,
  setFilterGroup,
  filterExamType,
  setFilterExamType,
  dateFilter,
  setDateFilter,
  groups,
  uniqueExamNames,
}) => {
  return (
    <Card className="p-3 sm:p-4 shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="col-span-2 lg:col-span-2 relative group">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Imtihon nomi bo'yicha qidiruv..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary"
          />
        </div>
        <Select value={filterGroup} onValueChange={setFilterGroup}>
          <SelectTrigger className="h-10 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
            <SelectValue placeholder="Guruh" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha guruhlar</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterExamType} onValueChange={setFilterExamType}>
          <SelectTrigger className="h-10 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
            <SelectValue placeholder="Imtihon turi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha turlar</SelectItem>
            {uniqueExamNames.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="h-10 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
            <SelectValue placeholder="Sana" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha sanalar</SelectItem>
            <SelectItem value="today">Bugun</SelectItem>
            <SelectItem value="week">So'nggi hafta</SelectItem>
            <SelectItem value="month">So'nggi oy</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => {
            setSearchQuery("");
            setFilterGroup("all");
            setFilterExamType("all");
            setDateFilter("all");
          }}
          className="h-10 col-span-2 sm:col-span-1 lg:col-span-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800"
        >
          Tozalash
        </Button>
      </div>
    </Card>
  );
};
