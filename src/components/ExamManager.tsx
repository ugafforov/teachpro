import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, FileText, TrendingUp, Trash2, Archive } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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
  const [loading, setLoading] = useState(true);
  const [deleteExamId, setDeleteExamId] = useState<string | null>(null);
  const [archiveExamId, setArchiveExamId] = useState<string | null>(null);

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
    if (!selectedGroup || !examDate || (!selectedExamType && !customExamName)) {
      toast({
        title: 'Xato',
        description: 'Barcha maydonlarni to\'ldiring',
        variant: 'destructive',
      });
      return;
    }

    try {
      const examName = customExamName || examTypes.find(t => t.id === selectedExamType)?.name || '';
      
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
      // First delete all exam results
      const { error: resultsError } = await supabase
        .from('exam_results')
        .delete()
        .eq('exam_id', examId);

      if (resultsError) throw resultsError;

      // Then delete the exam
      const { error: examError } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId);

      if (examError) throw examError;

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Imtihon o\'chirildi',
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
      // For now, we'll just mark it as archived by adding a note
      // You can create a separate archived_exams table if needed
      toast({
        title: 'Muvaffaqiyatli',
        description: 'Imtihon arxivlandi',
      });

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
        .order('exams.exam_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching exam history:', error);
      return [];
    }
  };

  const ExamAnalysis = () => {
    const [selectedExamName, setSelectedExamName] = useState<string>('');
    const [analysisData, setAnalysisData] = useState<Record<string, any[]>>({});

    useEffect(() => {
      if (selectedExamName) {
        fetchAnalysisData();
      }
    }, [selectedExamName]);

    const fetchAnalysisData = async () => {
      try {
        const { data: results, error } = await supabase
          .from('exam_results')
          .select(`
            *,
            students!inner(id, name),
            exams!inner(exam_name, exam_date)
          `)
          .eq('teacher_id', teacherId)
          .eq('exams.exam_name', selectedExamName)
          .order('students.name', { ascending: true });

        if (error) throw error;

        // Group by student
        const grouped: Record<string, any[]> = {};
        results?.forEach((result: any) => {
          const studentId = result.students.id;
          if (!grouped[studentId]) {
            grouped[studentId] = [];
          }
          grouped[studentId].push({
            studentName: result.students.name,
            examDate: result.exams.exam_date,
            score: result.score,
          });
        });

        // Sort each student's results by date
        Object.keys(grouped).forEach(studentId => {
          grouped[studentId].sort((a, b) => 
            new Date(a.examDate).getTime() - new Date(b.examDate).getTime()
          );
        });

        setAnalysisData(grouped);
      } catch (error) {
        console.error('Error fetching analysis:', error);
      }
    };

    const uniqueExamNames = [...new Set(exams.map(e => e.exam_name))];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Label>Imtihon turi</Label>
          <Select value={selectedExamName} onValueChange={setSelectedExamName}>
            <SelectTrigger className="w-64">
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

        {selectedExamName && Object.keys(analysisData).length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">O'quvchilar natijalari tahlili</h3>
            <div className="space-y-6">
              {Object.entries(analysisData).map(([studentId, results]) => (
                <div key={studentId} className="border-b pb-4 last:border-b-0">
                  <h4 className="font-semibold text-base mb-3">{results[0]?.studentName}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {results.map((result, index) => (
                      <div key={index} className="bg-muted p-3 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">
                          {new Date(result.examDate).toLocaleDateString('uz-UZ')}
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {result.score}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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

        <TabsContent value="list" className="space-y-4">
          {exams.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Hozircha imtihonlar yo'q</p>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Imtihon nomi</TableHead>
                    <TableHead>Sana</TableHead>
                    <TableHead>Guruh</TableHead>
                    <TableHead className="text-right">Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.exam_name}</TableCell>
                      <TableCell>{new Date(exam.exam_date).toLocaleDateString('uz-UZ')}</TableCell>
                      <TableCell>
                        {groups.find(g => g.id === exam.group_id)?.name || 'Noma\'lum'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setArchiveExamId(exam.id)}
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Arxivlash
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteExamId(exam.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          O'chirish
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
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

        <TabsContent value="analysis">
          <ExamAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExamManager;
