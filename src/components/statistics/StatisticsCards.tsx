
import React from 'react';
import { Users, Calendar, Award, TrendingUp } from 'lucide-react';
import { StatsData } from './types';

interface StatisticsCardsProps {
  stats: StatsData & {
    totalMonths?: number;
    bestMonth?: { month: string; percent: number }; // optional: Eng yaxshi oy va % (masalan, 2025 M06, 40%)
  };
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ stats }) => {
  // Rang va ikonalar uchun statistikalar massivda
  const cardsList = [
    {
      label: "Jami o'quvchilar",
      value: stats.totalStudents,
      icon: <Users className="w-7 h-7 text-blue-600" />,
      container: 'bg-white border border-blue-100',
      labelClass: 'text-blue-600',
      valueClass: 'text-black',
    },
    {
      label: "Jami darslar",
      value: stats.totalClasses,
      icon: <Calendar className="w-7 h-7 text-green-600" />,
      container: 'bg-white border border-green-100',
      labelClass: 'text-green-600',
      valueClass: 'text-black',
    },
    {
      label: "Jami oylar",
      value: stats.totalMonths ?? 0,
      icon: <Calendar className="w-7 h-7 text-blue-600" />,
      container: 'bg-blue-50',
      labelClass: 'text-blue-700',
      valueClass: 'text-blue-900',
    },
    {
      label: "Eng yaxshi oy",
      value: stats.bestMonth?.month ?? "-",
      percent: stats.bestMonth?.percent ?? undefined,
      icon: <Award className="w-7 h-7 text-green-600" />,
      container: 'bg-green-50',
      labelClass: 'text-green-700',
      valueClass: 'text-green-900',
    },
    {
      label: "O'rtacha davomat",
      value: stats.averageAttendance ? stats.averageAttendance.toFixed(1) + "%" : "0.0%",
      icon: <TrendingUp className="w-7 h-7 text-purple-600" />,
      container: 'bg-purple-50',
      labelClass: 'text-purple-700',
      valueClass: 'text-purple-900',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
      {cardsList.map((card, idx) => (
        <div
          key={card.label}
          className={`rounded-2xl p-5 flex flex-col gap-2 min-w-[170px] ${card.container} shadow-sm`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-2 flex items-center justify-center shadow-none">
              {card.icon}
            </div>
            <div>
              <div className={`text-xs font-semibold ${card.labelClass}`}>{card.label}</div>
              <div className={`text-2xl font-bold ${card.valueClass}`}>
                {card.value}
                {/* best month card uchun % ham chiqaramiz */}
                {card.label === "Eng yaxshi oy" && card.percent !== undefined && (
                  <div className="text-sm font-semibold text-gray-700 mt-0.5">{card.percent.toFixed(1)}%</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatisticsCards;
