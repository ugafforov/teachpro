import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  Target,
  BookOpen,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { MonthlyData } from "./types";

interface MonthlyAnalysisProps {
  monthlyData: MonthlyData[];
}

const MonthlyAnalysis: React.FC<MonthlyAnalysisProps> = ({ monthlyData }) => {
  const [showAll, setShowAll] = useState(false);

  if (monthlyData.length === 0) {
    return (
      <Card className="p-4 sm:p-6 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            Oylik tahlil
          </h3>
        </div>
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Oylik ma'lumotlar topilmadi</p>
        </div>
      </Card>
    );
  }

  const sortedData = [...monthlyData].reverse();

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 90)
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500/40";
    if (percentage >= 75)
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/25 dark:text-amber-300 dark:border-amber-500/40";
    if (percentage >= 60)
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/25 dark:text-orange-300 dark:border-orange-500/40";
    return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/25 dark:text-red-300 dark:border-red-500/40";
  };

  const getAttendanceIcon = (percentage: number) => {
    if (percentage >= 90) return "🏆";
    if (percentage >= 75) return "⭐";
    if (percentage >= 60) return "📈";
    return "📊";
  };

  const getGradientClass = (percentage: number) => {
    if (percentage >= 90)
      return "bg-gradient-to-r from-emerald-50 via-emerald-50/50 to-white dark:from-emerald-950/50 dark:via-card dark:to-card border-emerald-200 dark:border-emerald-500/30 shadow-sm";
    if (percentage >= 75)
      return "bg-gradient-to-r from-amber-50 via-amber-50/50 to-white dark:from-amber-950/50 dark:via-card dark:to-card border-amber-200 dark:border-amber-500/30 shadow-sm";
    if (percentage >= 60)
      return "bg-gradient-to-r from-orange-50 via-orange-50/50 to-white dark:from-orange-950/50 dark:via-card dark:to-card border-orange-200 dark:border-orange-500/30 shadow-sm";
    return "bg-gradient-to-r from-red-50 via-red-50/50 to-white dark:from-red-950/50 dark:via-card dark:to-card border-red-200 dark:border-red-500/30 shadow-sm";
  };

  const getPerformanceStatus = (percentage: number) => {
    if (percentage >= 90)
      return {
        label: "A'lo",
        icon: "🔥",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-500/20",
        borderColor: "border-emerald-100 dark:border-emerald-500/40",
      };
    if (percentage >= 75)
      return {
        label: "Yaxshi",
        icon: "⚡",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-500/20",
        borderColor: "border-blue-100 dark:border-blue-500/40",
      };
    if (percentage >= 60)
      return {
        label: "O'rtacha",
        icon: "📊",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-500/20",
        borderColor: "border-amber-100 dark:border-amber-500/40",
      };
    return {
      label: "Past",
      icon: "⚠️",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-500/20",
      borderColor: "border-red-100 dark:border-red-500/40",
    };
  };

  return (
    <Card className="p-4 sm:p-6 bg-card border-border">
      {/* Card header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            Oylik tahlil
          </h3>
        </div>

        {monthlyData.length > 1 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-500/20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 flex-shrink-0"
          >
            {showAll ? (
              <>
                Yopish <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Ko'rish <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {sortedData.slice(0, showAll ? undefined : 1).map((month, index) => {
          const strictlyPresentPercentage = Math.max(
            0,
            month.averageAttendance - (month.latePercentage || 0),
          );
          const efficiency = month.efficiency || month.averageAttendance;
          const status = getPerformanceStatus(efficiency);

          return (
            <div
              key={`${month.month}-${index}`}
              className={`border rounded-2xl transition-all duration-300 hover:shadow-md ${getGradientClass(month.averageAttendance)} p-3 sm:p-5`}
            >
              {/* Month header row */}
              <div className="flex items-center justify-between gap-2 mb-3 sm:mb-5">
                {/* Left: icon + month name */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 flex-shrink-0 bg-white/70 dark:bg-card backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm border border-border">
                    <span className="text-lg sm:text-2xl">
                      {getAttendanceIcon(month.averageAttendance)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm sm:text-xl text-foreground capitalize truncate">
                      {month.month}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {month.totalClasses} dars o'tildi
                    </p>
                  </div>
                </div>

                {/* Right: attendance badge */}
                <div className="text-right flex-shrink-0">
                  <Badge
                    variant="secondary"
                    className={`${getAttendanceColor(month.averageAttendance)} border font-bold text-sm sm:text-lg px-2 sm:px-3 py-0.5 sm:py-1`}
                  >
                    {month.averageAttendance.toFixed(1)}%
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-0.5 hidden xs:block">
                    Davomat ko'rsatkichi
                  </p>
                </div>
              </div>

              {/* Stats panel */}
              <div className="bg-muted/30 dark:bg-muted/50 rounded-xl p-3 sm:p-4 border border-border">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-xs sm:text-sm text-muted-foreground">
                    Umumiy ko'rsatkichlar
                  </span>
                </div>

                {/* Stacked progress bar */}
                <div className="h-3 sm:h-4 w-full bg-muted rounded-full overflow-hidden flex mb-3 sm:mb-4 shadow-inner">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${strictlyPresentPercentage}%` }}
                    title={`Davomat: ${strictlyPresentPercentage.toFixed(1)}%`}
                  />
                  <div
                    className="h-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${month.latePercentage || 0}%` }}
                    title={`Kech qolish: ${(month.latePercentage || 0).toFixed(1)}%`}
                  />
                  <div
                    className="h-full bg-red-400 transition-all duration-500"
                    style={{ width: `${month.absentPercentage || 0}%` }}
                    title={`Kelmagan: ${(month.absentPercentage || 0).toFixed(1)}%`}
                  />
                </div>

                {/* 3-col stats */}
                <div className="grid grid-cols-3 gap-1 sm:gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-1">
                      <Users className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        O'quvchi
                      </span>
                    </div>
                    <p className="font-bold text-base sm:text-lg text-foreground">
                      {month.totalStudents}
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-1">
                      <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 dark:text-emerald-400 flex-shrink-0" />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        Darslar
                      </span>
                    </div>
                    <p className="font-bold text-base sm:text-lg text-foreground">
                      {month.totalClasses}
                    </p>
                  </div>

                  <div className="text-center group cursor-default">
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-1">
                      <Target className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500 dark:text-purple-400 flex-shrink-0 group-hover:rotate-12 transition-transform" />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        Samaradorlik
                      </span>
                    </div>
                    <div
                      className={`inline-flex flex-col items-center px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl ${status.bgColor} border ${status.borderColor} shadow-sm transition-all duration-300 group-hover:scale-105`}
                    >
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <span className="text-xs sm:text-sm">
                          {status.icon}
                        </span>
                        <span
                          className={`font-bold text-xs sm:text-sm ${status.color}`}
                        >
                          {efficiency.toFixed(1)}%
                        </span>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground leading-none hidden xs:block">
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default MonthlyAnalysis;
