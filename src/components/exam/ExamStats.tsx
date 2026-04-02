import React from "react";
import { Card } from "@/components/ui/card";
import { FileText, Calendar, BookOpen, Users } from "lucide-react";

interface ExamStatsProps {
  stats: {
    total: number;
    thisMonth: number;
    uniqueTypes: number;
    groupsWithExams: number;
  };
}

export const ExamStats: React.FC<ExamStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
      <Card className="p-4 shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-all hover:shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Jami imtihonlar</p>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground leading-none">{stats.total}</h3>
          </div>
        </div>
      </Card>
      
      <Card className="p-4 shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-all hover:shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Bu oyda</p>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground leading-none">{stats.thisMonth}</h3>
          </div>
        </div>
      </Card>
      
      <Card className="p-4 shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-all hover:shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Imtihon turlari</p>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground leading-none">{stats.uniqueTypes}</h3>
          </div>
        </div>
      </Card>
      
      <Card className="p-4 shadow-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-all hover:shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Guruhlar</p>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground leading-none">{stats.groupsWithExams}</h3>
          </div>
        </div>
      </Card>
    </div>
  );
};
