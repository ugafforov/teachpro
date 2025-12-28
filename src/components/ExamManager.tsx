import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, FileText, TrendingUp, Trash2, Archive, Edit2, Search, Calendar, Users, BookOpen, Filter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { examSchema, examResultSchema, formatValidationError } from '@/lib/validations';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { formatDateUz } from '@/lib/utils';

interface ExamManagerProps {
  teacherId: string;
}

interface Group {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
}

interface ExamType {
  id: string;
  name: string;
}

interface Exam {
  id: string;
  exam_name: string;
  exam_date: string;
  group_id: string;
}

interface ExamResult {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
  exam_date: string;
  exam_name: string;
}

interface ExamWithResults extends Exam {
  results?: ExamResult[];
  student_count?: number;
}

const ExamManager: React.FC<ExamManagerProps> = ({ teacherId }) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedExamType, setSelectedExamType] = useState<string>('');
  const [customExamName, setCustomExamName] = useState<string>('');
  const [examDate, setExamDate] = useState<string>('');
  const [currentExamId, setCurrentExamId] = useState<string>('');
  
  const [examResults, setExamResults] = useState<Record<string, string>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [showExamDetailsDialog, setShowExamDetailsDialog] = useState(false);
  const [selectedExamForDetails, setSelectedExamForDetails] = useState<string | null>(null);
  const [examDetailsData, setExamDetailsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteExamId, setDeleteExamId] = useState<string | null>(null);
  const [archiveExamId, setArchiveExamId] = useState<string | null>(null);
  const [editingResult, setEditingResult] = useState<{id: string, studentName: string, currentScore: number} | null>(null);
  const [editScore, setEditScore] = useState('');
  const [editReason, setEditReason] = useState('');
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterExamType, setFilterExamType] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all'); // all, today, week, month, custom

  useEffect(() => {
    fetchGroups();
    fetchExamTypes();
    fetchExams();
  }, [teacherId]);

  useEffect(() => {
    if (selectedGroup) {
      fetchStudents(selectedGroup);
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (showResultsDialog && selectedGroup) {
      fetchStudents(selectedGroup);
    }
  }, [showResultsDialog, selectedGroup]);

  // Filtered and grouped exams
  const filteredExams = useMemo(() => {
    return exams.filter(exam => {
      // Search filter
      if (searchQuery && !exam.exam_name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Group filter
      if (filterGroup !== 'all' && exam.group_id !== filterGroup) {
        return false;
      }
      
      // Exam type filter
      if (filterExamType !== 'all' && exam.exam_name !== filterExamType) {
        return false;
      }
      
      // Date filter
      const examDate = new Date(exam.exam_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dateFilter === 'today') {
        const examDateOnly = new Date(examDate);
        examDateOnly.setHours(0, 0, 0, 0);
        return examDateOnly.getTime() === today.getTime();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return examDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return examDate >= monthAgo;
      }
      
      return true;
    });
  }, [exams, searchQuery, filterGroup, filterExamType, dateFilter]);

  // Group exams by month
  const groupedExams = useMemo(() => {
    const groups: Record<string, Exam[]> = {};
    
    filteredExams.forEach(exam => {
      const date = new Date(exam.exam_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(exam);
    });
    
    // Sort by date descending
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime());
    });
    
    return groups;
  }, [filteredExams]);

  // Statistics
  const stats = useMemo(() => {
    const total = exams.length;
    const thisMonth = exams.filter(e => {
      const date = new Date(e.exam_date);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    
    const uniqueTypes = new Set(exams.map(e => e.exam_name)).size;
    const groupsWithExams = new Set(exams.map(e => e.group_id)).size;
    
    return { total, thisMonth, uniqueTypes, groupsWithExams };
  }, [exams]);

  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const uzbekMonths = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    return `${uzbekMonths[parseInt(month) - 1]}, ${year}`;
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast({
        title: 'Xato',
        description: 'Guruhlarni yuklashda xatolik',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (groupId: string) => {
    try {
      const groupName = groups.find(g => g.id === groupId)?.name;
      let query = supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (groupName) {
        // Fallback: match by group_id or group_name for legacy data
        query = query.or(`group_id.eq.${groupId},group_name.eq.${groupName}`);
      } else {
        query = query.eq('group_id', groupId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
    }
  };

  const fetchExamTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_types')
        .select('*')
        .eq('teacher_id', teacherId);

      if (error) throw error;
      setExamTypes(data || []);
    } catch (error) {
      console.error('Error fetching exam types:', error);
    }
  };

  const fetchExams = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('exam_date', { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

  const createExam = async () => {
    const examName = customExamName || examTypes.find(t => t.id === selectedExamType)?.name || '';
    
    // Validate with zod
    try {
      examSchema.parse({
        exam_name: examName,
        exam_date: examDate,
        group_id: selectedGroup
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validatsiya xatosi',
          description: formatValidationError(error),
          variant: 'destructive',
        });
      }
      return;
    }

    try {
      // Save custom exam type if entered
      let examTypeId = selectedExamType;
      if (customExamName) {
        const { data: newType, error: typeError } = await supabase
          .from('exam_types')
          .insert({
            teacher_id: teacherId,
            name: customExamName,
          })
          .select()
          .single();

        if (typeError) throw typeError;
        examTypeId = newType.id;
        await fetchExamTypes();
      }

      const { data, error } = await supabase
        .from('exams')
        .insert({
          teacher_id: teacherId,
          group_id: selectedGroup,
          exam_type_id: examTypeId,
          exam_name: examName,
          exam_date: examDate,
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentExamId(data.id);
      setShowCreateDialog(false);
      await fetchStudents(selectedGroup);
      setShowResultsDialog(true);
      await fetchExams();

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Imtihon yaratildi',
      });
    } catch (error) {
      console.error('Error creating exam:', error);
      toast({
        title: 'Xato',
        description: 'Imtihon yaratishda xatolik',
        variant: 'destructive',
      });
    }
  };

  const saveExamResults = async () => {
    if (!currentExamId) return;

    try {
      const resultsToInsert = Object.entries(examResults)
        .filter(([_, score]) => score && score.trim() !== '')
        .map(([studentId, score]) => ({
          teacher_id: teacherId,
          exam_id: currentExamId,
          student_id: studentId,
          score: parseFloat(score),
        }));

      if (resultsToInsert.length === 0) {
        toast({
          title: 'Xato',
          description: 'Hech bo\'lmaganda bitta natija kiriting',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('exam_results')
        .insert(resultsToInsert);

      if (error) throw error;

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Natijalar saqlandi',
      });

      setShowResultsDialog(false);
      setExamResults({});
      setCurrentExamId('');
      setSelectedGroup('');
      setSelectedExamType('');
      setCustomExamName('');
      setExamDate('');
    } catch (error) {
      console.error('Error saving results:', error);
      toast({
        title: 'Xato',
        description: 'Natijalarni saqlashda xatolik',
        variant: 'destructive',
      });
    }
  };

  const deleteExam = async (examId: string) => {
    try {
      // Get exam details with results before deleting
      const { data: examData } = await supabase
        .from('exams')
        .select('*, exam_results(*)')
        .eq('id', examId)
        .single();

      const groupName = groups.find(g => g.id === examData?.group_id)?.name;

      // Archive to deleted_exams
      const { error: archiveError } = await supabase
        .from('deleted_exams')
        .insert({
          teacher_id: teacherId,
          original_exam_id: examId,
          exam_name: examData?.exam_name,
          exam_date: examData?.exam_date,
          group_name: groupName,
          group_id: examData?.group_id,
          results_data: examData?.exam_results || []
        });

      if (archiveError) throw archiveError;

      // Delete exam results
      const { error: resultsError } = await supabase
        .from('exam_results')
        .delete()
        .eq('exam_id', examId);

      if (resultsError) throw resultsError;

      // Delete the exam
      const { error: examError } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId);

      if (examError) throw examError;

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Imtihon chiqindilar qutisiga yuborildi',
      });

      await fetchExams();
      setDeleteExamId(null);
    } catch (error) {
      console.error('Error deleting exam:', error);
      toast({
        title: 'Xato',
        description: 'Imtihonni o\'chirishda xatolik',
        variant: 'destructive',
      });
    }
  };

  const archiveExam = async (examId: string) => {
    try {
      // Get exam details with results before archiving
      const { data: examData } = await supabase
        .from('exams')
        .select('*, exam_results(*)')
        .eq('id', examId)
        .single();

      const groupName = groups.find(g => g.id === examData?.group_id)?.name;

      // Archive to archived_exams
      const { error: archiveError } = await supabase
        .from('archived_exams')
        .insert({
          teacher_id: teacherId,
          original_exam_id: examId,
          exam_name: examData?.exam_name,
          exam_date: examData?.exam_date,
          group_name: groupName,
          group_id: examData?.group_id,
          results_data: examData?.exam_results || []
        });

      if (archiveError) throw archiveError;

      // Delete exam results from active table
      const { error: resultsError } = await supabase
        .from('exam_results')
        .delete()
        .eq('exam_id', examId);

      if (resultsError) throw resultsError;

      // Delete the exam from active table
      const { error: examError } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId);

      if (examError) throw examError;

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Imtihon arxivlandi',
      });

      await fetchExams();
      setArchiveExamId(null);
    } catch (error) {
      console.error('Error archiving exam:', error);
      toast({
        title: 'Xato',
        description: 'Imtihonni arxivlashda xatolik',
        variant: 'destructive',
      });
    }
  };

  const fetchExamDetails = async (examId: string) => {
    try {
      console.log('Fetching exam details for examId:', examId);
      
      const { data: results, error } = await supabase
        .from('exam_results')
        .select(`
          *,
          students!inner(id, name, group_name)
        `)
        .eq('exam_id', examId)
        .order('score', { ascending: false });

      if (error) {
        console.error('Error fetching exam details:', error);
        throw error;
      }

      console.log('Exam details results:', results);
      setExamDetailsData(results || []);
      setShowExamDetailsDialog(true);
    } catch (error) {
      console.error('Error in fetchExamDetails:', error);
      toast({
        title: 'Xato',
        description: 'Imtihon natijalarini yuklashda xatolik',
        variant: 'destructive',
      });
    }
  };

  const updateExamResult = async () => {
    if (!editingResult || !editScore || !editReason.trim()) {
      toast({
        title: 'Xato',
        description: 'Ball va izohni kiriting',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('exam_results')
        .update({
          score: parseFloat(editScore),
          notes: editReason.trim()
        })
        .eq('id', editingResult.id);

      if (error) throw error;

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Natija yangilandi',
      });

      // Refresh exam details
      const currentExam = examDetailsData[0]?.exam_id;
      if (currentExam) {
        await fetchExamDetails(currentExam);
      }

      setEditingResult(null);
      setEditScore('');
      setEditReason('');
    } catch (error) {
      console.error('Error updating result:', error);
      toast({
        title: 'Xato',
        description: 'Natijani yangilashda xatolik',
        variant: 'destructive',
      });
    }
  };

  const getStudentExamHistory = async (studentId: string, examName: string) => {
    try {
      const { data, error } = await supabase
        .from('exam_results')
        .select(`
          *,
          exams!inner(exam_name, exam_date)
        `)
        .eq('teacher_id', teacherId)
        .eq('student_id', studentId)
        .eq('exams.exam_name', examName)
        .order('exam_date', { ascending: true, foreignTable: 'exams' });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching exam history:', error);
      return [];
    }
  };

  const ExamAnalysis = () => {
    const [selectedExamName, setSelectedExamName] = useState<string>('');
    const [selectedAnalysisGroup, setSelectedAnalysisGroup] = useState<string>('');
    const [analysisData, setAnalysisData] = useState<Record<string, any[]>>({});

    useEffect(() => {
      if (selectedExamName) {
        fetchAnalysisData();
      }
    }, [selectedExamName, selectedAnalysisGroup]);

    const fetchAnalysisData = async () => {
      try {
        console.log('Fetching analysis for exam:', selectedExamName, 'group:', selectedAnalysisGroup);

        // 1) Get matching exams to avoid fragile foreign table filters
        let examsQuery = supabase
          .from('exams')
          .select('id, exam_date, exam_name, group_id')
          .eq('teacher_id', teacherId)
          .eq('exam_name', selectedExamName);

        if (selectedAnalysisGroup && selectedAnalysisGroup !== 'all') {
          examsQuery = examsQuery.eq('group_id', selectedAnalysisGroup);
        }

        const { data: examRows, error: examsError } = await examsQuery;
        if (examsError) {
          console.error('Error fetching exams for analysis:', examsError);
          throw examsError;
        }

        if (!examRows || examRows.length === 0) {
          console.log('No exams found matching filters');
          setAnalysisData({});
          return;
        }

        const examIdToDate = new Map(examRows.map((e) => [e.id, e.exam_date]));
        const examIds = examRows.map((e) => e.id);

        // 2) Get results for those exams and join students
        const { data: results, error } = await supabase
          .from('exam_results')
          .select(`
            id, score, exam_id,
            students!inner(id, name, group_id, group_name)
          `)
          .eq('teacher_id', teacherId)
          .in('exam_id', examIds)
          .order('name', { ascending: true, foreignTable: 'students' });

        if (error) {
          console.error('Error fetching analysis data:', error);
          throw error;
        }

        console.log('Analysis results:', results);

        // Group by student
        const grouped: Record<string, any[]> = {};
        results?.forEach((result: any) => {
          const studentId = result.students.id;
          if (!grouped[studentId]) grouped[studentId] = [];
          grouped[studentId].push({
            studentName: result.students.name,
            groupName: result.students.group_name || groups.find(g => g.id === result.students.group_id)?.name,
            examDate: examIdToDate.get(result.exam_id),
            score: result.score,
          });
        });

        // Sort each student's results by date
        Object.keys(grouped).forEach((studentId) => {
          grouped[studentId].sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
        });

        console.log('Grouped analysis data:', grouped);
        setAnalysisData(grouped);
      } catch (error) {
        console.error('Error fetching analysis:', error);
      }
    };

    const getScoreColor = (score: number) => {
      if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
      if (score >= 70) return 'text-blue-600 bg-blue-50 border-blue-200';
      if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      return 'text-red-600 bg-red-50 border-red-200';
    };

    const getTrend = (results: any[]) => {
      if (results.length < 2) return null;
      const lastScore = results[results.length - 1].score;
      const prevScore = results[results.length - 2].score;
      const diff = lastScore - prevScore;
      if (diff > 0) return { icon: '📈', text: `+${diff.toFixed(1)}`, color: 'text-green-600' };
      if (diff < 0) return { icon: '📉', text: `${diff.toFixed(1)}`, color: 'text-red-600' };
      return { icon: '➡️', text: '0', color: 'text-gray-600' };
    };

    const uniqueExamNames = [...new Set(exams.map(e => e.exam_name))];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label>Imtihon turi</Label>
            <Select value={selectedExamName} onValueChange={setSelectedExamName}>
              <SelectTrigger>
                <SelectValue placeholder="Imtihon turini tanlang" />
              </SelectTrigger>
              <SelectContent>
                {uniqueExamNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <Label>Guruh (ixtiyoriy)</Label>
            <Select value={selectedAnalysisGroup} onValueChange={setSelectedAnalysisGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Barcha guruhlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha guruhlar</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedExamName && Object.keys(analysisData).length > 0 && (
          <Card className="p-6 overflow-x-auto">
            <h3 className="text-lg font-semibold mb-4">
              {selectedExamName} - Natijalar tahlili
              {selectedAnalysisGroup && ` (${groups.find(g => g.id === selectedAnalysisGroup)?.name})`}
            </h3>
            
            {(() => {
              const allDates = Array.from(
                new Set(
                  Object.values(analysisData)
                    .flat()
                    .map(r => r.examDate)
                )
              ).sort();
              
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">O'quvchi</TableHead>
                      <TableHead className="min-w-[120px]">Guruh</TableHead>
                      {allDates.map((date, idx) => (
                        <TableHead key={idx} className="text-center min-w-[100px]">
                          {formatDateUz(date, 'short')}
                        </TableHead>
                      ))}
                      <TableHead className="text-center min-w-[80px]">O'rtacha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(analysisData)
                      .sort(([, aResults], [, bResults]) => {
                        const aAvg = aResults.reduce((sum, r) => sum + r.score, 0) / aResults.length;
                        const bAvg = bResults.reduce((sum, r) => sum + r.score, 0) / bResults.length;
                        return bAvg - aAvg;
                      })
                      .map(([studentId, results]) => {
                        const avgScore = (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1);
                        const scoresByDate = new Map(results.map(r => [r.examDate, r.score]));
                        
                        return (
                          <TableRow key={studentId}>
                            <TableCell className="font-medium">{results[0]?.studentName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{results[0]?.groupName}</TableCell>
                            {allDates.map((date, idx) => {
                              const score = scoresByDate.get(date);
                              return (
                                <TableCell key={idx} className="text-center">
                                  {score !== undefined ? (
                                    <span className={`inline-block px-3 py-1 rounded-md font-semibold ${
                                      score >= 90 ? 'bg-green-100 text-green-700' :
                                      score >= 70 ? 'bg-blue-100 text-blue-700' :
                                      score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {score}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold text-primary">{avgScore}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              );
            })()}
          </Card>
        )}

        {selectedExamName && Object.keys(analysisData).length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Bu imtihon turi uchun natijalar topilmadi</p>
          </Card>
        )}
      </div>
    );
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Imtihonlar</h2>
          <p className="text-muted-foreground">O'quvchilar imtihon natijalarini boshqaring va tahlil qiling</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Yangi imtihon
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yangi imtihon yaratish</DialogTitle>
              <DialogDescription>
                Guruh, imtihon nomi va sanani tanlang, so'ng davom eting.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Guruh</Label>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Imtihon turi</Label>
                <Select 
                  value={selectedExamType} 
                  onValueChange={(value) => {
                    setSelectedExamType(value);
                    setCustomExamName('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Imtihon turini tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {examTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Yoki yangi imtihon nomini kiriting</Label>
                <Input
                  value={customExamName}
                  onChange={(e) => {
                    setCustomExamName(e.target.value);
                    setSelectedExamType('');
                  }}
                  placeholder="Masalan: Oraliq nazorat"
                />
              </div>

              <div>
                <Label>Imtihon sanasi</Label>
                <Input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>

              <Button onClick={createExam} className="w-full">
                Davom etish
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jami imtihonlar</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Barcha imtihonlar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bu oy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground">Joriy oyda o'tkazilgan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Imtihon turlari</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueTypes}</div>
            <p className="text-xs text-muted-foreground">Turli imtihon turlari</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Guruhlar</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.groupsWithExams}</div>
            <p className="text-xs text-muted-foreground">Imtihonlar o'tkazilgan</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Imtihon nomini qidiring..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger>
              <SelectValue placeholder="Guruh" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha guruhlar</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterExamType} onValueChange={setFilterExamType}>
            <SelectTrigger>
              <SelectValue placeholder="Imtihon turi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha turlar</SelectItem>
              {Array.from(new Set(exams.map(e => e.exam_name))).map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Sana" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha sanalar</SelectItem>
              <SelectItem value="today">Bugun</SelectItem>
              <SelectItem value="week">So'nggi hafta</SelectItem>
              <SelectItem value="month">So'nggi oy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {(searchQuery || filterGroup !== 'all' || filterExamType !== 'all' || dateFilter !== 'all') && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="secondary">{filteredExams.length} ta natija topildi</Badge>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setFilterGroup('all');
                setFilterExamType('all');
                setDateFilter('all');
              }}
            >
              Filterni tozalash
            </Button>
          </div>
        )}
      </Card>

      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Imtihon natijalarini kiriting</DialogTitle>
            <DialogDescription>
              Natijani yozing va Enter bosing — kursor keyingi o'quvchiga o'tadi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>O'quvchi</TableHead>
                  <TableHead>Natija</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student, index) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>
                      <Input
                        id={`result-${student.id}`}
                        type="number"
                        step="0.1"
                        placeholder="Ball kiriting"
                        value={examResults[student.id] || ''}
                        onChange={(e) =>
                          setExamResults({
                            ...examResults,
                            [student.id]: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const nextIndex = index + 1;
                            if (nextIndex < students.length) {
                              const nextInput = document.getElementById(`result-${students[nextIndex].id}`);
                              nextInput?.focus();
                            } else {
                              // Last input, save results
                              saveExamResults();
                            }
                          }
                        }}
                        autoFocus={index === 0}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {students.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                Bu guruhda faol o'quvchilar topilmadi. Avval guruhga o'quvchi qo'shing.
              </p>
            )}

            <Button onClick={saveExamResults} className="w-full">
              Natijalarni saqlash
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">
            <FileText className="w-4 h-4 mr-2" />
            Imtihonlar ro'yxati
          </TabsTrigger>
          <TabsTrigger value="analysis">
            <TrendingUp className="w-4 h-4 mr-2" />
            Tahlil
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          {filteredExams.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                {exams.length === 0 
                  ? "Hozircha imtihonlar yo'q" 
                  : "Hech qanday natija topilmadi. Filterni o'zgartiring."}
              </p>
            </Card>
          ) : (
            Object.keys(groupedExams)
              .sort((a, b) => b.localeCompare(a))
              .map((monthKey) => (
                <div key={monthKey} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{getMonthName(monthKey)}</h3>
                    <Badge variant="secondary">{groupedExams[monthKey].length} ta</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedExams[monthKey].map((exam) => (
                      <Card 
                        key={exam.id} 
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => fetchExamDetails(exam.id)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base line-clamp-2">{exam.exam_name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDateUz(exam.exam_date, 'short')}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 mb-3">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {groups.find(g => g.id === exam.group_id)?.name || 'Noma\'lum'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setArchiveExamId(exam.id);
                              }}
                            >
                              <Archive className="w-3 h-3 mr-1" />
                              Arxiv
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteExamId(exam.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              O'chirish
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))
          )}
        </TabsContent>

        <AlertDialog open={!!deleteExamId} onOpenChange={() => setDeleteExamId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Imtihonni o'chirish</AlertDialogTitle>
              <AlertDialogDescription>
                Bu imtihonni va unga tegishli barcha natijalarni o'chirishga aminmisiz? Bu amalni qaytarib bo'lmaydi.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteExamId && deleteExam(deleteExamId)}>
                O'chirish
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!archiveExamId} onOpenChange={() => setArchiveExamId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Imtihonni arxivlash</AlertDialogTitle>
              <AlertDialogDescription>
                Bu imtihonni arxivlashga aminmisiz?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
              <AlertDialogAction onClick={() => archiveExamId && archiveExam(archiveExamId)}>
                Arxivlash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={showExamDetailsDialog} onOpenChange={setShowExamDetailsDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Imtihon natijalari</DialogTitle>
              <DialogDescription>
                Barcha o'quvchilar natijalari
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {examDetailsData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Bu imtihon uchun natijalar topilmadi
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>O'quvchi</TableHead>
                      <TableHead>Guruh</TableHead>
                      <TableHead className="text-right">Natija</TableHead>
                      <TableHead className="text-right">Amallar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {examDetailsData.map((result: any) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">{result.students.name}</TableCell>
                        <TableCell>{result.students.group_name}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-lg font-bold text-primary">{result.score}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingResult({
                                id: result.id,
                                studentName: result.students.name,
                                currentScore: result.score
                              });
                              setEditScore(result.score.toString());
                              setEditReason('');
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <TabsContent value="analysis">
          <ExamAnalysis />
        </TabsContent>
      </Tabs>

      {/* Edit Result Dialog */}
      <Dialog open={!!editingResult} onOpenChange={(open) => !open && setEditingResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Natijani tahrirlash</DialogTitle>
            <DialogDescription>
              {editingResult?.studentName} - Joriy ball: {editingResult?.currentScore}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editScore">Yangi ball</Label>
              <Input
                id="editScore"
                type="number"
                step="0.1"
                value={editScore}
                onChange={(e) => setEditScore(e.target.value)}
                placeholder="Ball kiriting"
              />
            </div>
            <div>
              <Label htmlFor="editReason">Izoh (majburiy)</Label>
              <Input
                id="editReason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="O'zgartirish sababini kiriting"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={updateExamResult} className="flex-1">
                Saqlash
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setEditingResult(null);
                  setEditScore('');
                  setEditReason('');
                }} 
                className="flex-1"
              >
                Bekor qilish
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExamManager;
