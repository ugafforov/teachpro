import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logError } from '@/lib/errorUtils';
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Award, Users, Calendar, BarChart3 } from 'lucide-react';
import StudentProfileLink from './StudentProfileLink';
import { calculateAllStudentScores, StudentWithScore } from '@/lib/studentScoreCalculator';

interface StudentRanking {
  id: string;
  student_id: string;
  total_classes: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  attendance_percentage: number;
  rank_position: number;
  student_name: string;
  group_name: string;
}

interface StudentScore {
  id: string;
  student_id: string;
  student_name: string;
  group_name: string;
  total_score: number;
  attendance_points: number;
  mukofot_points: number;
  jarima_points: number;
  baho_average: number;
  class_rank: number;
}

interface StudentRankingsProps {
  teacherId: string;
}

const StudentRankings: React.FC<StudentRankingsProps> = ({ teacherId }) => {
  const [scoreRankings, setScoreRankings] = useState<StudentScore[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchAllRankings();
  }, [teacherId, selectedGroup, selectedPeriod]);

  const fetchAllRankings = async () => {
    try {
      setLoading(true);

      const allStudents = await calculateAllStudentScores(
        teacherId,
        selectedGroup !== 'all' ? selectedGroup : undefined,
        selectedPeriod
      );

      // Extract unique groups for the filter
      if (selectedGroup === 'all') {
        const uniqueGroups = [...new Set(allStudents.map(s => s.group_name).filter(Boolean))];
        const sortedGroups = uniqueGroups.sort((a, b) => {
          const aNum = parseInt(a.match(/^\d+/)?.[0] || '0', 10);
          const bNum = parseInt(b.match(/^\d+/)?.[0] || '0', 10);
          
          if (aNum !== bNum) {
            return aNum - bNum;
          }
          
          return a.localeCompare(b);
        });
        setGroups(sortedGroups);
      }

      if (allStudents.length === 0) {
        setScoreRankings([]);
        setLoading(false);
        return;
      }

      // Build score rankings
      const scoreStats = allStudents
        .map(student => ({
          id: student.id,
          student_id: student.id,
          student_name: student.name,
          group_name: student.group_name,
          total_score: student.score.totalScore,
          attendance_points: student.score.attendancePoints,
          mukofot_points: student.score.mukofotPoints,
          jarima_points: student.score.jarimaPoints,
          baho_average: Math.round(student.score.bahoAverage * 100) / 100,
          class_rank: 0
        }))
        .sort((a, b) => b.total_score - a.total_score)
        .map((score, index) => ({
          ...score,
          class_rank: index + 1
        }));

      setScoreRankings(scoreStats);
    } catch (error) {
      logError('StudentRankings:fetchRankings', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentClick = (studentId: string) => {
    navigate(`/students/${studentId}`, { state: { from: `${location.pathname}${location.search}` } });
  };

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2: return <Medal className="w-6 h-6 text-gray-400" />;
      case 3: return <Award className="w-6 h-6 text-amber-600" />;
      default: return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">#{position}</span>;
    }
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 80) return 'bg-blue-500';
    if (percentage >= 70) return 'bg-yellow-500';
    if (percentage >= 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreColor = (score: number) => {
    if (score >= 20) return 'bg-green-500';
    if (score >= 10) return 'bg-blue-500';
    if (score >= 0) return 'bg-yellow-500';
    if (score >= -10) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">O'quvchilar reytingi</h2>
          <p className="text-muted-foreground">Ball bo'yicha eng yaxshi o'quvchilar</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-48">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger><SelectValue placeholder="Guruhni tanlang" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha guruhlar</SelectItem>
                {groups.map(group => <SelectItem key={group} value={group}>{group}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-32">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger><SelectValue placeholder="Davr" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1_day">1 kun</SelectItem>
                <SelectItem value="1_week">1 hafta</SelectItem>
                <SelectItem value="1_month">1 oy</SelectItem>
                <SelectItem value="2_months">2 oy</SelectItem>
                <SelectItem value="3_months">3 oy</SelectItem>
                <SelectItem value="6_months">6 oy</SelectItem>
                <SelectItem value="10_months">10 oy</SelectItem>
                <SelectItem value="all">Barchasi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {scoreRankings.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {scoreRankings.slice(0, 3).map((student, index) => (
              <Card key={student.id} className={`p-6 text-center cursor-pointer hover:shadow-lg transition-shadow ${index === 0 ? 'ring-2 ring-yellow-500 bg-gradient-to-br from-yellow-50 to-amber-50' :
                index === 1 ? 'ring-2 ring-gray-400 bg-gradient-to-br from-gray-50 to-slate-50' :
                  'ring-2 ring-amber-600 bg-gradient-to-br from-amber-50 to-orange-50'
                }`} onClick={() => handleStudentClick(student.student_id)}>
                <div className="flex flex-col items-center">
                  {getRankIcon(student.class_rank)}
                  <h3 className="text-lg font-semibold mt-2 mb-1">
                    <StudentProfileLink studentId={student.student_id} className="text-inherit hover:text-inherit">
                      {student.student_name}
                    </StudentProfileLink>
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">{student.group_name}</p>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4 ${getScoreColor(student.total_score)}`}>
                    {student.total_score.toFixed(1)}
                  </div>
                  <div className="flex gap-4 text-[10px] font-medium">
                    <div className="flex flex-col"><span className="text-blue-600">{student.attendance_points.toFixed(1)}</span><span className="text-gray-400">Davomat</span></div>
                    <div className="flex flex-col"><span className="text-green-600">+{student.mukofot_points.toFixed(1)}</span><span className="text-gray-400">Mukofot</span></div>
                    <div className="flex flex-col"><span className="text-red-600">-{student.jarima_points.toFixed(1)}</span><span className="text-gray-400">Jarima</span></div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <div className="p-6 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold">{selectedGroup === 'all' ? 'Barcha o\'quvchilar' : `${selectedGroup} guruhi`} ball reytingi</h3>
            <span className="text-sm text-muted-foreground">{scoreRankings.length} o'quvchi topildi</span>
          </div>
          {scoreRankings.length === 0 ? (
            <div className="p-12 text-center"><BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" /><p>Ma'lumotlar topilmadi</p></div>
          ) : (
            <div className="divide-y">
              {scoreRankings.map((student) => (
                <div key={student.id} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer" onClick={() => handleStudentClick(student.student_id)}>
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 flex items-center justify-center">{getRankIcon(student.class_rank)}</div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                        {student.student_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">
                          <StudentProfileLink studentId={student.student_id} className="text-inherit hover:text-inherit">
                            {student.student_name}
                          </StudentProfileLink>
                        </p>
                        <p className="text-xs text-muted-foreground">{student.group_name}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden sm:flex items-center gap-4 text-[11px]">
                      <div className="text-blue-600 font-medium">{student.attendance_points.toFixed(1)} davomat</div>
                      <div className="text-green-600 font-medium">+{student.mukofot_points.toFixed(1)} mukofot</div>
                      <div className="text-red-600 font-medium">-{student.jarima_points.toFixed(1)} jarima</div>
                    </div>
                    <Badge className={`${getScoreColor(student.total_score)} text-white min-w-[60px] justify-center`}>{student.total_score.toFixed(1)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
};

export default StudentRankings;
