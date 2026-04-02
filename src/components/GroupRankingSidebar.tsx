import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import StudentProfileLink from "./StudentProfileLink";

interface Student {
  id: string;
  name: string;
  rewardPenaltyPoints?: number;
  attendancePoints?: number;
  mukofotScore?: number;
  jarimaScore?: number;
  is_active?: boolean;
}

interface GroupRankingSidebarProps {
  students: Student[];
  loading?: boolean;
}

const GroupRankingSidebar: React.FC<GroupRankingSidebarProps> = ({
  students,
  loading,
}) => {
  const rankedStudents = [...students]
    .filter((s) => s.is_active)
    .sort(
      (a, b) => (b.rewardPenaltyPoints || 0) - (a.rewardPenaltyPoints || 0),
    );

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return (
          <Trophy className="w-6 h-6 text-yellow-500 dark:text-amber-400" />
        );
      case 2:
        return (
          <Medal className="w-6 h-6 text-gray-400 dark:text-muted-foreground" />
        );
      case 3:
        return <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />;
      default:
        return (
          <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">
            #{position}
          </span>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 20) return "bg-green-500";
    if (score >= 10) return "bg-blue-500";
    if (score >= 0) return "bg-yellow-500";
    if (score >= -10) return "bg-orange-500";
    return "bg-red-500";
  };

  const getInitials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  if (loading) {
    return (
      <Card className="overflow-hidden bg-card border-border">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="h-5 w-36 bg-muted animate-pulse rounded" />
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
        </div>
        <div className="divide-y">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-6 w-6 bg-muted animate-pulse rounded" />
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                </div>
              </div>
              <div className="h-6 w-14 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden apple-card bg-card border-border">
      <div className="p-3 sm:p-4 border-b border-border flex justify-between items-center bg-muted/30 dark:bg-muted/50">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight">
          Sinf reytingi
        </h3>
        <span className="text-xs text-muted-foreground">
          {rankedStudents.length} o'quvchi
        </span>
      </div>

      {rankedStudents.length === 0 ? (
        <div className="p-8 sm:p-12 text-center text-muted-foreground text-sm">
          Ma'lumotlar topilmadi
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rankedStudents.map((student, index) => {
            const position = index + 1;
            const score = student.rewardPenaltyPoints || 0;
            return (
              <div
                key={student.id}
                className={cn(
                  "px-2 sm:px-3 py-2 sm:py-3 flex items-center justify-between hover:bg-muted/50 dark:hover:bg-accent/50 transition-colors",
                  position <= 3 &&
                    "bg-gradient-to-r from-muted/20 via-muted/10 to-muted/30 dark:from-muted/40 dark:via-muted/30 dark:to-muted/50",
                )}
              >
                <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
                    {getRankIcon(position)}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted items-center justify-center text-xs font-bold text-muted-foreground shrink-0 hidden xs:flex">
                      {getInitials(student.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium truncate leading-5 text-foreground">
                        <StudentProfileLink
                          studentId={student.id}
                          className="text-inherit hover:text-blue-700 dark:hover:text-blue-400"
                        >
                          {student.name}
                        </StudentProfileLink>
                      </p>
                      <div className="flex items-center gap-3 sm:gap-4 mt-1">
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-blue-600 dark:text-blue-400 text-[10px] font-bold">{(student.attendancePoints || 0).toFixed(1)}</span>
                          <span className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5">Davomat</span>
                        </div>
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-green-600 dark:text-emerald-400 text-[10px] font-bold">+{(student.mukofotScore || 0).toFixed(1)}</span>
                          <span className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5">Mukofot</span>
                        </div>
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-red-600 dark:text-red-400 text-[10px] font-bold">-{(student.jarimaScore || 0).toFixed(1)}</span>
                          <span className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5">Jarima</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <Badge
                  className={`${getScoreColor(score)} text-white min-w-[44px] sm:min-w-[56px] justify-center text-[10px] sm:text-xs font-bold px-1.5 sm:px-2`}
                >
                  {score.toFixed(1)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default GroupRankingSidebar;
