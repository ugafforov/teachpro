import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, Award, Users, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import StudentDetailsPopup from './StudentDetailsPopup';
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
  const [attendanceRankings, setAttendanceRankings] = useState<StudentRanking[]>([]);
  const [scoreRankings, setScoreRankings] = useState<StudentScore[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  useEffect(() => {
    fetchGroups();
  }, [teacherId]);

  useEffect(() => {
    fetchAllRankings();
  }, [teacherId, selectedGroup]);

  const fetchGroups = async () => {
    try {
      const { data: students, error } = await supabase
        .from('students')
        .select('group_name')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (error) throw error;

      const uniqueGroups = [...new Set(students?.map(s => s.group_name).filter(Boolean) || [])];
      setGroups(uniqueGroups as string[]);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchAllRankings = async () => {
    try {
      setLoading(true);
      
      // Use centralized score calculator (same as GroupDetails)
      const allStudents = await calculateAllStudentScores(
        teacherId,
        selectedGroup !== 'all' ? selectedGroup : undefined
      );

      if (allStudents.length === 0) {
        setAttendanceRankings([]);
        setScoreRankings([]);
        setLoading(false);
        return;
      }

      // Build attendance rankings from calculated scores
      const attendanceStats = allStudents
        .map((student, index) => ({
          id: `${student.id}-ranking`,
          student_id: student.id,
          student_name: student.name,
          group_name: student.group_name,
          total_classes: student.score.totalClasses,
          present_count: student.score.presentCount,
          late_count: student.score.lateCount,
          absent_count: student.score.absentCount,
          attendance_percentage: student.score.attendancePercentage,
          rank_position: 0
        }))
        .sort((a, b) => {
          if (b.attendance_percentage !== a.attendance_percentage) {
            return b.attendance_percentage - a.attendance_percentage;
          }
          return b.present_count - a.present_count;
        })
        .map((stat, index) => ({
          ...stat,
          rank_position: index + 1
        }));

      setAttendanceRankings(attendanceStats);

      // Build score rankings from calculated scores
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
      console.error('Error fetching rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentClick = async (studentId: string) => {
    try {
      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

      if (error) throw error;
      setSelectedStudent(student);
    } catch (error) {
      console.error('Error fetching student details:', error);
    }
  };

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">#{position}</span>;
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
          <p className="text-muted-foreground">Davomat va ball bo'yicha eng yaxshi o'quvchilar</p>
        </div>
        <div className="w-full sm:w-64">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger>
              <SelectValue placeholder="Guruhni tanlang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha guruhlar</SelectItem>
              {groups.map(group => (
                <SelectItem key={group} value={group}>{group}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Davomat reytingi
          </TabsTrigger>
          <TabsTrigger value="scores" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Ball reytingi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-6">
          {/* Top 3 Attendance */}
          {attendanceRankings.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {attendanceRankings.slice(0, 3).map((student, index) => (
                <Card key={student.id} className={`apple-card p-6 text-center cursor-pointer hover:shadow-lg transition-shadow ${
                  index === 0 ? 'ring-2 ring-yellow-500 bg-gradient-to-br from-yellow-50 to-amber-50' :
                  index === 1 ? 'ring-2 ring-gray-400 bg-gradient-to-br from-gray-50 to-slate-50' :
                  'ring-2 ring-amber-600 bg-gradient-to-br from-amber-50 to-orange-50'
                }`} onClick={() => handleStudentClick(student.student_id)}>
                  <div className="flex flex-col items-center">
                    {getRankIcon(student.rank_position)}
                    <h3 className="text-lg font-semibold mt-2 mb-1">{student.student_name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{student.group_name}</p>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${getAttendanceColor(student.attendance_percentage)}`}>
                      {student.attendance_percentage.toFixed(0)}%
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="font-semibold text-green-600">{student.present_count}</div>
                        <div className="text-muted-foreground">Keldi</div>
                      </div>
                      <div>
                        <div className="font-semibold text-orange-600">{student.late_count}</div>
                        <div className="text-muted-foreground">Kech</div>
                      </div>
                      <div>
                        <div className="font-semibold text-red-600">{student.absent_count}</div>
                        <div className="text-muted-foreground">Kelmadi</div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* All Attendance Rankings */}
          <Card className="apple-card">
            <div className="p-6 border-b border-border/50">
              <h3 className="text-lg font-semibold">
                {selectedGroup === 'all' ? 'Barcha o\'quvchilar' : `${selectedGroup} guruhi`} davomat reytingi
              </h3>
              <p className="text-sm text-muted-foreground">
                {attendanceRankings.length} o'quvchi topildi
              </p>
            </div>
            
            {attendanceRankings.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Ma'lumotlar topilmadi</h3>
                <p className="text-muted-foreground">
                  {selectedGroup === 'all' 
                    ? 'Hali davomat ma\'lumotlari mavjud emas'
                    : `${selectedGroup} guruhida davomat ma'lumotlari topilmadi`
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {attendanceRankings.map((student) => (
                  <div key={student.id} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => handleStudentClick(student.student_id)}>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-10 h-10">
                        {getRankIcon(student.rank_position)}
                      </div>
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {student.student_name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium hover:text-blue-600">{student.student_name}</p>
                        <p className="text-sm text-muted-foreground">{student.group_name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>{student.total_classes} dars</span>
                        </div>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-xs text-green-600">{student.present_count} keldi</span>
                          <span className="text-xs text-orange-600">{student.late_count} kech</span>
                          <span className="text-xs text-red-600">{student.absent_count} yo'q</span>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`${getAttendanceColor(student.attendance_percentage)} text-white px-3 py-1`}
                      >
                        {student.attendance_percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="scores" className="space-y-6">
          {/* Top 3 Scores */}
          {scoreRankings.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {scoreRankings.slice(0, 3).map((student, index) => (
                <Card key={student.id} className={`apple-card p-6 text-center cursor-pointer hover:shadow-lg transition-shadow ${
                  index === 0 ? 'ring-2 ring-yellow-500 bg-gradient-to-br from-yellow-50 to-amber-50' :
                  index === 1 ? 'ring-2 ring-gray-400 bg-gradient-to-br from-gray-50 to-slate-50' :
                  'ring-2 ring-amber-600 bg-gradient-to-br from-amber-50 to-orange-50'
                }`} onClick={() => handleStudentClick(student.student_id)}>
                  <div className="flex flex-col items-center">
                    {getRankIcon(student.class_rank)}
                    <h3 className="text-lg font-semibold mt-2 mb-1">{student.student_name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{student.group_name}</p>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${getScoreColor(student.total_score)}`}>
                      {student.total_score.toFixed(1)}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="font-semibold text-blue-600">{student.attendance_points.toFixed(1)}</div>
                        <div className="text-muted-foreground">Davomat</div>
                      </div>
                      <div>
                        <div className="font-semibold text-green-600">+{student.mukofot_points.toFixed(1)}</div>
                        <div className="text-muted-foreground">Mukofot</div>
                      </div>
                      <div>
                        <div className="font-semibold text-red-600">-{student.jarima_points.toFixed(1)}</div>
                        <div className="text-muted-foreground">Jarima</div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* All Score Rankings */}
          <Card className="apple-card">
            <div className="p-6 border-b border-border/50">
              <h3 className="text-lg font-semibold">
                {selectedGroup === 'all' ? 'Barcha o\'quvchilar' : `${selectedGroup} guruhi`} ball reytingi
              </h3>
              <p className="text-sm text-muted-foreground">
                {scoreRankings.length} o'quvchi topildi
              </p>
            </div>
            
            {scoreRankings.length === 0 ? (
              <div className="p-12 text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Ma'lumotlar topilmadi</h3>
                <p className="text-muted-foreground">
                  {selectedGroup === 'all' 
                    ? 'Hali ball ma\'lumotlari mavjud emas'
                    : `${selectedGroup} guruhida ball ma'lumotlari topilmadi`
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {scoreRankings.map((student) => (
                  <div key={student.id} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => handleStudentClick(student.student_id)}>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-10 h-10">
                        {getRankIcon(student.class_rank)}
                      </div>
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {student.student_name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium hover:text-blue-600">{student.student_name}</p>
                        <p className="text-sm text-muted-foreground">{student.group_name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center space-x-3 text-sm">
                          <span className="text-blue-600">{student.attendance_points.toFixed(1)} davomat</span>
                          <span className="text-green-600">+{student.mukofot_points.toFixed(1)} mukofot</span>
                          <span className="text-red-600">-{student.jarima_points.toFixed(1)} jarima</span>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`${getScoreColor(student.total_score)} text-white px-3 py-1`}
                      >
                        {student.total_score.toFixed(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {selectedStudent && (
        <StudentDetailsPopup
          studentId={selectedStudent.id}
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          teacherId={teacherId}
        />
      )}
    </div>
  );
};

export default StudentRankings;
