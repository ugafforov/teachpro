import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Award, BarChart3, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logError } from '@/lib/errorUtils';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { calculateAllStudentScores } from '@/lib/studentScoreCalculator';

interface PublicStudentScore {
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

const PublicRankings: React.FC = () => {
  const navigate = useNavigate();
  const [scoreRankings, setScoreRankings] = useState<PublicStudentScore[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPublicRankings = React.useCallback(async () => {
    try {
      setLoading(true);

      console.log('Fetching public rankings...');
      
      // Fetch all active students to get teacher IDs
      const studentsQ = query(collection(db, 'students'), where('is_active', '==', true));
      const studentsSnap = await getDocs(studentsQ);
      
      console.log('Students snapshot size:', studentsSnap.size);
      
      if (studentsSnap.empty) {
        console.log('No students found');
        setScoreRankings([]);
        setLoading(false);
        return;
      }

      // Get all unique teacher IDs
      const teacherIds = [...new Set(studentsSnap.docs.map(doc => doc.data().teacher_id))];
      console.log('Teacher IDs:', teacherIds);
      
      // Fetch rankings from each teacher
      const allRankings: PublicStudentScore[] = [];
      
      for (const teacherId of teacherIds) {
        try {
          console.log('Fetching for teacher:', teacherId);
          const studentScores = await calculateAllStudentScores(
            teacherId,
            selectedGroup !== 'all' ? selectedGroup : undefined,
            'all'
          );
          
          console.log('Student scores for teacher:', studentScores.length);
          
          const rankings = studentScores.map(student => ({
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
          }));
          
          allRankings.push(...rankings);
        } catch (error) {
          console.error('Error fetching for teacher:', teacherId, error);
          logError('PublicRankings:fetchTeacherRankings', error);
          // Continue with next teacher if one fails
        }
      }

      console.log('Total rankings:', allRankings.length);

      // Extract unique groups
      const uniqueGroups = [...new Set(allRankings.map(s => s.group_name).filter(Boolean))];
      const sortedGroups = uniqueGroups.sort((a, b) => {
        const aNum = parseInt(a.match(/^\d+/)?.[0] || '0', 10);
        const bNum = parseInt(b.match(/^\d+/)?.[0] || '0', 10);
        
        if (aNum !== bNum) {
          return aNum - bNum;
        }
        
        return a.localeCompare(b);
      });
      setGroups(sortedGroups);

      // Filter by group if selected
      const filteredData = selectedGroup === 'all' 
        ? allRankings 
        : allRankings.filter(s => s.group_name === selectedGroup);

      // Sort by total score and assign ranks
      const rankedData = filteredData
        .sort((a, b) => b.total_score - a.total_score)
        .map((student, index) => ({
          ...student,
          class_rank: index + 1
        }));

      setScoreRankings(rankedData);
    } catch (error) {
      console.error('Error in fetchPublicRankings:', error);
      logError('PublicRankings:fetchPublicRankings', error);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  useEffect(() => {
    fetchPublicRankings();
  }, [fetchPublicRankings]);

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return <Trophy className="w-6 h-6 text-yellow-500 dark:text-amber-400" />;
      case 2: return <Medal className="w-6 h-6 text-gray-400 dark:text-muted-foreground" />;
      case 3: return <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Orqaga
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">O'quvchilar reytingi</h1>
              <p className="text-muted-foreground">Ball bo'yicha eng yaxshi o'quvchilar</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-40 md:w-48">
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger><SelectValue placeholder="Guruhni tanlang" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barcha guruhlar</SelectItem>
                  {groups.map(group => <SelectItem key={group} value={group}>{group}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {scoreRankings.length >= 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
              {scoreRankings.slice(0, 3).map((student, index) => (
                <Card key={student.id} className={`p-4 text-center ${index === 0 ? 'ring-2 ring-yellow-500 dark:ring-amber-400 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-amber-950/40 dark:to-amber-900/30' :
                  index === 1 ? 'ring-2 ring-gray-400 dark:ring-muted-foreground/50 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-muted/50 dark:to-muted/30' :
                    'ring-2 ring-amber-600 dark:ring-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-900/30'
                  }`}>
                  <div className="flex flex-col items-center">
                    {getRankIcon(student.class_rank)}
                    <h3 className="text-base sm:text-lg font-semibold text-foreground mt-2 mb-1 line-clamp-1">
                      {student.student_name}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">{student.group_name}</p>
                    <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl mb-3 sm:mb-4 ${getScoreColor(student.total_score)}`}>
                      {student.total_score.toFixed(1)}
                    </div>
                    <div className="flex gap-2 sm:gap-4 text-[10px] font-medium justify-center w-full">
                      <div className="flex flex-col items-center"><span className="text-blue-600 dark:text-blue-400">{student.attendance_points.toFixed(1)}</span><span className="text-muted-foreground hidden sm:inline">Davomat</span><span className="text-muted-foreground sm:hidden">D</span></div>
                      <div className="flex flex-col items-center"><span className="text-green-600 dark:text-emerald-400">+{student.mukofot_points.toFixed(1)}</span><span className="text-muted-foreground hidden sm:inline">Mukofot</span><span className="text-muted-foreground sm:hidden">M</span></div>
                      <div className="flex flex-col items-center"><span className="text-red-600 dark:text-red-400">-{student.jarima_points.toFixed(1)}</span><span className="text-muted-foreground hidden sm:inline">Jarima</span><span className="text-muted-foreground sm:hidden">J</span></div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <div className="p-4 border-b flex justify-between items-center bg-muted/20">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">{selectedGroup === 'all' ? 'Barcha o\'quvchilar' : `${selectedGroup} guruhi`} ball reytingi</h3>
              <span className="text-xs sm:text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">{scoreRankings.length} ta</span>
            </div>
            {scoreRankings.length === 0 ? (
              <div className="p-8 sm:p-12 text-center"><BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-3 sm:mb-4" /><p className="text-foreground">Ma'lumotlar topilmadi</p></div>
            ) : (
              <div className="divide-y">
                {scoreRankings.map((student) => (
                  <div key={student.id} className="p-3 sm:p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3 sm:space-x-4 overflow-hidden">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center font-bold text-muted-foreground text-sm sm:text-base">{student.class_rank}</div>
                      <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-xs font-bold text-primary">
                          {student.student_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm sm:text-base truncate">{student.student_name}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{student.group_name}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
                      <div className="hidden md:flex items-center gap-6 text-[11px] justify-center">
                        <div className="flex flex-col items-center">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">{student.attendance_points.toFixed(1)}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">Davomat</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-green-600 dark:text-emerald-400 font-bold">+{student.mukofot_points.toFixed(1)}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">Mukofot</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-red-600 dark:text-red-400 font-bold">-{student.jarima_points.toFixed(1)}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">Jarima</span>
                        </div>
                      </div>
                      <Badge className={`${getScoreColor(student.total_score)} text-white min-w-[50px] sm:min-w-[60px] justify-center text-xs sm:text-sm h-6 sm:h-7`}>{student.total_score.toFixed(1)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
};

export default PublicRankings;
