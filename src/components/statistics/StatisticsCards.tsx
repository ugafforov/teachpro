
import React from 'react';
import { Card } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Trophy } from 'lucide-react';
import { StatsData } from './types';

interface StatisticsCardsProps {
  stats: StatsData;
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="apple-card p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.totalStudents}</p>
            <p className="text-sm text-muted-foreground">Jami o'quvchilar</p>
          </div>
        </div>
      </Card>

      <Card className="apple-card p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <Calendar className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.totalClasses}</p>
            <p className="text-sm text-muted-foreground">Jami darslar</p>
          </div>
        </div>
      </Card>

      <Card className="apple-card p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.averageAttendance.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">O'rtacha davomat</p>
          </div>
        </div>
      </Card>

      <Card className="apple-card p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <Trophy className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-lg font-bold truncate">{stats.topStudent}</p>
            <p className="text-sm text-muted-foreground">Eng yaxshi o'quvchi</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StatisticsCards;
