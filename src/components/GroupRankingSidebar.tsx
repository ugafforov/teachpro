import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const GroupRankingSidebar: React.FC<GroupRankingSidebarProps> = ({ students, loading }) => {
    const rankedStudents = [...students]
        .filter(s => s.is_active)
        .sort((a, b) => (b.rewardPenaltyPoints || 0) - (a.rewardPenaltyPoints || 0));

    const getRankIcon = (position: number) => {
        switch (position) {
            case 1: return <Trophy className="w-6 h-6 text-yellow-500" />;
            case 2: return <Medal className="w-6 h-6 text-gray-400" />;
            case 3: return <Award className="w-6 h-6 text-amber-600" />;
            default: return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">#{position}</span>;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 20) return 'bg-green-500';
        if (score >= 10) return 'bg-blue-500';
        if (score >= 0) return 'bg-yellow-500';
        if (score >= -10) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getInitials = (name: string) => (
        name
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0])
            .join('')
            .toUpperCase()
    );

    if (loading) {
        return (
            <Card className="overflow-hidden">
                <div className="p-6 border-b flex items-center justify-between">
                    <div className="h-5 w-36 bg-gray-100 animate-pulse rounded" />
                    <div className="h-4 w-20 bg-gray-100 animate-pulse rounded" />
                </div>
                <div className="divide-y">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-6 w-6 bg-gray-100 animate-pulse rounded" />
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 bg-gray-100 animate-pulse rounded-full" />
                                    <div className="h-4 w-32 bg-gray-100 animate-pulse rounded" />
                                </div>
                            </div>
                            <div className="h-6 w-14 bg-gray-100 animate-pulse rounded" />
                        </div>
                    ))}
                </div>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden apple-card">
            <div className="p-6 border-b border-border/50 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Sinf reytingi</h3>
                <span className="text-xs text-gray-500">{rankedStudents.length} o'quvchi</span>
            </div>

            {rankedStudents.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                    Ma'lumotlar topilmadi
                </div>
            ) : (
                <div className="divide-y">
                    {rankedStudents.map((student, index) => {
                        const position = index + 1;
                        const score = student.rewardPenaltyPoints || 0;
                        return (
                            <div
                                key={student.id}
                                className={cn(
                                    "p-3 flex items-center justify-between hover:bg-gray-50 transition-colors",
                                    position <= 3 && "bg-gradient-to-r from-white via-white to-gray-50/30"
                                )}
                            >
                                <div className="flex items-center space-x-4 min-w-0">
                                    <div className="w-9 h-9 flex items-center justify-center shrink-0">
                                        {getRankIcon(position)}
                                    </div>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                                            {getInitials(student.name)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate leading-5">{student.name}</p>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] leading-4">
                                                <span className="text-blue-600 font-medium">
                                                    {((student.attendancePoints || 0)).toFixed(1)} davomat
                                                </span>
                                                <span className="text-green-600 font-medium">
                                                    +{((student.mukofotScore || 0)).toFixed(1)} mukofot
                                                </span>
                                                <span className="text-red-600 font-medium">
                                                    -{((student.jarimaScore || 0)).toFixed(1)} jarima
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <Badge className={`${getScoreColor(score)} text-white min-w-[56px] justify-center text-xs font-bold`}>
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
