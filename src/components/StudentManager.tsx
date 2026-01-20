import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Edit2, Archive, Gift, AlertTriangle, Search, List, LayoutGrid, Calendar as CalendarIcon, CheckSquare, Square, Trash2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn, formatDateUz, getTashkentToday, getTashkentDate } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { db, addDocument, updateDocument, getCollection } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, setDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import StudentDetailsPopup from './StudentDetailsPopup';
import StudentImport from './StudentImport';
import { studentSchema, formatValidationError } from '@/lib/validations';
import { z } from 'zod';
import ConfirmDialog from './ConfirmDialog';

interface Student {
  id: string;
  name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name: string;
  teacher_id: string;
  created_at: string;
  join_date?: string;
  is_active?: boolean;
}

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface StudentManagerProps {
  teacherId: string;
  onStatsUpdate?: () => Promise<void>;
}

const StudentManager: React.FC<StudentManagerProps> = ({
  teacherId,
  onStatsUpdate
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showRewardDialog, setShowRewardDialog] = useState<string | null>(null);
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardType, setRewardType] = useState<'reward' | 'penalty'>('reward');
  const [loading, setLoading] = useState(true);
  const [displayedCount, setDisplayedCount] = useState(20);
  const PAGE_SIZE = 20;
  const [newStudent, setNewStudent] = useState({
    name: '',
    join_date: getTashkentToday(),
    student_id: '',
    email: '',
    phone: '',
    group_name: ''
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
  }>({
    isOpen: false,
    studentId: '',
    studentName: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
    fetchGroups();
  }, [teacherId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setDisplayedCount(PAGE_SIZE);
  }, [debouncedSearchTerm, selectedGroup]);

  const filteredStudents = useMemo(() => {
    let filtered = students;
    if (selectedGroup !== 'all') {
      filtered = filtered.filter(student => student.group_name === selectedGroup);
    }
    if (debouncedSearchTerm) {
      const lowerSearch = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(lowerSearch) ||
        (student.student_id && student.student_id.toLowerCase().includes(lowerSearch))
      );
    }
    return filtered;
  }, [students, selectedGroup, debouncedSearchTerm]);

  const pagedStudents = useMemo(() => {
    return filteredStudents.slice(0, displayedCount);
  }, [filteredStudents, displayedCount]);

  const fetchStudents = async () => {
    try {
      const q = query(
        collection(db, 'students'),
        where('teacher_id', '==', teacherId),
        where('is_active', '==', true)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Student))
        .sort((a, b) => a.name.localeCompare(b.name));
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchilarni yuklashda xatolik yuz berdi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const q = query(
        collection(db, 'groups'),
        where('teacher_id', '==', teacherId),
        where('is_active', '==', true)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Group))
        .sort((a, b) => a.name.localeCompare(b.name));
      setGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const toggleAllSelection = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const handleBatchArchive = async () => {
    if (selectedStudentIds.size === 0) return;
    
    if (!window.confirm(`${selectedStudentIds.size} ta o'quvchini arxivlashni tasdiqlaysizmi?`)) {
      return;
    }

    setLoading(true);
    try {
      const promises = Array.from(selectedStudentIds).map(async (studentId) => {
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        // Add to archived_students
        await addDoc(collection(db, 'archived_students'), {
          original_student_id: studentId,
          teacher_id: teacherId,
          name: student.name,
          student_id: student.student_id,
          group_name: student.group_name,
          email: student.email,
          phone: student.phone,
          join_date: student.join_date || null,
          created_at: student.created_at || null,
          left_date: getTashkentToday(),
          archived_at: serverTimestamp()
        });

        // Mark as inactive
        await updateDoc(doc(db, 'students', studentId), {
          is_active: false,
          left_date: getTashkentToday(),
          archived_at: serverTimestamp()
        });
      });

      await Promise.all(promises);
      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      setSelectedStudentIds(new Set());
      toast({
        title: "Muvaffaqiyat",
        description: `${selectedStudentIds.size} ta o'quvchi arxivlandi`
      });
    } catch (error) {
      console.error('Error batch archiving:', error);
      toast({
        title: "Xatolik",
        description: "Ommaviy arxivlashda xatolik yuz berdi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addStudent = async () => {
    if (!newStudent.group_name) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Guruhni tanlashingiz shart",
        variant: "destructive"
      });
      return;
    }

    try {
      studentSchema.parse({
        name: newStudent.name,
        join_date: newStudent.join_date,
        student_id: newStudent.student_id || '',
        email: newStudent.email || '',
        phone: newStudent.phone || ''
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validatsiya xatosi",
          description: formatValidationError(error),
          variant: "destructive"
        });
      }
      return;
    }

    try {
      await addDoc(collection(db, 'students'), {
        teacher_id: teacherId,
        name: newStudent.name.trim(),
        join_date: newStudent.join_date,
        student_id: newStudent.student_id.trim() || null,
        email: newStudent.email.trim() || null,
        phone: newStudent.phone.trim() || null,
        group_name: newStudent.group_name,
        is_active: true,
        created_at: getTashkentDate().toISOString()
      });

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      setNewStudent({
        name: '',
        join_date: getTashkentToday(),
        student_id: '',
        email: '',
        phone: '',
        group_name: ''
      });
      setIsAddDialogOpen(false);
      toast({
        title: "O'quvchi qo'shildi",
        description: `"${newStudent.name}" muvaffaqiyatli qo'shildi`
      });
    } catch (error) {
      console.error('Error adding student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchi qo'shishda xatolik yuz berdi",
        variant: "destructive"
      });
    }
  };

  const editStudent = async () => {
    if (!editingStudent || !editingStudent.name.trim()) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "O'quvchi nomini kiriting",
        variant: "destructive"
      });
      return;
    }
    try {
      await updateDoc(doc(db, 'students', editingStudent.id), {
        name: editingStudent.name.trim(),
        student_id: editingStudent.student_id?.trim() || null,
        email: editingStudent.email?.trim() || null,
        phone: editingStudent.phone?.trim() || null,
        group_name: editingStudent.group_name
      });

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      setEditingStudent(null);
      setIsEditDialogOpen(false);
      toast({
        title: "O'quvchi yangilandi",
        description: "O'quvchi ma'lumotlari muvaffaqiyatli yangilandi"
      });
    } catch (error) {
      console.error('Error updating student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini yangilashda xatolik yuz berdi",
        variant: "destructive"
      });
    }
  };

  const archiveStudent = (studentId: string, studentName: string) => {
    setConfirmDialog({
      isOpen: true,
      studentId,
      studentName
    });
  };

  const executeArchiveStudent = async () => {
    const { studentId, studentName } = confirmDialog;
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      // Add to archived_students
      await addDoc(collection(db, 'archived_students'), {
        original_student_id: studentId,
        teacher_id: teacherId,
        name: student.name,
        student_id: student.student_id,
        group_name: student.group_name,
        email: student.email,
        phone: student.phone,
        join_date: student.join_date || null,
        created_at: student.created_at || null,
        left_date: getTashkentToday(),
        archived_at: serverTimestamp()
      });

      // Mark as inactive
      await updateDoc(doc(db, 'students', studentId), {
        is_active: false,
        left_date: getTashkentToday(),
        archived_at: serverTimestamp()
      });

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      toast({
        title: "Arxivlandi",
        description: `"${studentName}" arxivga o'tkazildi`
      });
    } catch (error) {
      console.error('Error archiving student:', error);
      toast({
        title: "Xatolik",
        description: "Arxivlashda xatolik yuz berdi",
        variant: "destructive"
      });
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  };

  const addReward = async (studentId: string) => {
    if (!rewardPoints) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Ball miqdorini kiriting",
        variant: "destructive"
      });
      return;
    }
    const points = parseFloat(rewardPoints);
    if (isNaN(points)) {
      toast({
        title: "Noto'g'ri format",
        description: "Ball sonli qiymat bo'lishi kerak",
        variant: "destructive"
      });
      return;
    }
    try {
      const type = rewardType === 'reward' ? 'Mukofot' : 'Jarima';
      await addDoc(collection(db, 'reward_penalty_history'), {
        student_id: studentId,
        teacher_id: teacherId,
        points: Math.abs(points),
        type,
        reason: type,
        date: getTashkentToday(),
        created_at: getTashkentDate().toISOString()
      });

      setShowRewardDialog(null);
      setRewardPoints('');
      if (onStatsUpdate) await onStatsUpdate();
      const studentName = students.find(s => s.id === studentId)?.name || '';
      toast({
        title: rewardType === 'reward' ? "Mukofot berildi" : "Jarima berildi",
        description: `${studentName}ga ${Math.abs(points)} ball ${rewardType === 'reward' ? 'qo\'shildi' : 'ayrildi'}`
      });
    } catch (error) {
      console.error('Error adding reward/penalty:', error);
      toast({
        title: "Xatolik",
        description: "Ball qo'shishda xatolik yuz berdi",
        variant: "destructive"
      });
    }
  };

  const renderStudentsList = () => (
    <Card className="apple-card">
      <div className="p-6 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">O'quvchilar ro'yxati</h3>
          <p className="text-sm text-muted-foreground">
            {filteredStudents.length} o'quvchi topildi
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {selectedStudentIds.size > 0 && (
            <Button variant="outline" size="sm" className="text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100" onClick={handleBatchArchive}>
              <Archive className="w-4 h-4 mr-2" />
              Arxivlash ({selectedStudentIds.size})
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={toggleAllSelection}>
            {selectedStudentIds.size === filteredStudents.length ? (
              <CheckSquare className="w-4 h-4 mr-2" />
            ) : (
              <Square className="w-4 h-4 mr-2" />
            )}
            Barchasini tanlash
          </Button>
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {filteredStudents.map(student => (
          <div key={student.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-4">
              <div 
                className="cursor-pointer text-muted-foreground hover:text-primary transition-colors"
                onClick={() => toggleStudentSelection(student.id)}
              >
                {selectedStudentIds.has(student.id) ? (
                  <CheckSquare className="w-5 h-5 text-primary" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </div>
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">
                  {student.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div>
                <h3 className="font-semibold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => setSelectedStudent(student)}>
                  {student.name}
                </h3>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  {student.student_id && <span>ID: {student.student_id}</span>}
                  <span className="text-blue-600">{student.group_name}</span>
                </div>
                {(student.email || student.phone) && (
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                    {student.email && <span>{student.email}</span>}
                    {student.phone && <span>{student.phone}</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button size="sm" variant="ghost" onClick={() => setShowRewardDialog(student.id)} title="Mukofot/Jarima berish">
                <Gift className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setEditingStudent(student);
                setIsEditDialogOpen(true);
              }}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => archiveStudent(student.id, student.name)} className="text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                <Archive className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderStudentsGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredStudents.map(student => (
        <Card key={student.id} className="apple-card p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                  <span className="text-lg font-medium">
                    {student.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => setSelectedStudent(student)}>
                    {student.name}
                  </h3>
                  {student.student_id && <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>}
                  <p className="text-sm text-blue-600">{student.group_name}</p>
                </div>
              </div>
            </div>

            {(student.email || student.phone) && (
              <div className="space-y-1">
                {student.email && <p className="text-sm text-muted-foreground">{student.email}</p>}
                {student.phone && <p className="text-sm text-muted-foreground">{student.phone}</p>}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                {formatDateUz(student.created_at)}
              </span>
              <div className="flex items-center space-x-1">
                <Button size="sm" variant="ghost" onClick={() => setShowRewardDialog(student.id)} title="Mukofot/Jarima berish">
                  <Gift className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  setEditingStudent(student);
                  setIsEditDialogOpen(true);
                }}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => archiveStudent(student.id, student.name)} className="text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                  <Archive className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

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
          <h2 className="text-2xl font-bold">O'quvchilar boshqaruvi</h2>
          <p className="text-muted-foreground">O'quvchilarni qo'shing va boshqaring</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StudentImport 
            teacherId={teacherId} 
            groupName={selectedGroup !== 'all' ? selectedGroup : undefined} 
            onImportComplete={async () => {
              await fetchStudents();
              if (onStatsUpdate) await onStatsUpdate();
            }} 
            availableGroups={groups} 
          />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="apple-button">
                <Plus className="w-4 h-4 mr-2" />
                Yangi o'quvchi
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Yangi o'quvchi qo'shish</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">F.I.SH</Label>
                  <Input
                    id="name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="Masalan: Ali Valiyev"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="student_id">O'quvchi ID (ixtiyoriy)</Label>
                  <Input
                    id="student_id"
                    value={newStudent.student_id}
                    onChange={(e) => setNewStudent({ ...newStudent, student_id: e.target.value })}
                    placeholder="Masalan: S12345"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Guruh</Label>
                  <Select
                    value={newStudent.group_name}
                    onValueChange={(value) => setNewStudent({ ...newStudent, group_name: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Guruhni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.name}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefon raqam (ixtiyoriy)</Label>
                  <Input
                    id="phone"
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                    placeholder="Masalan: +998901234567"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email (ixtiyoriy)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    placeholder="Masalan: ali@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>A'zo bo'lgan sana</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newStudent.join_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newStudent.join_date ? (
                          format(parseISO(newStudent.join_date), 'PPP', { locale: uz })
                        ) : (
                          <span>Sana tanlang</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newStudent.join_date ? parseISO(newStudent.join_date) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setNewStudent({
                              ...newStudent,
                              join_date: format(date, 'yyyy-MM-dd')
                            });
                          }
                        }}
                        initialFocus
                        locale={uz}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Bekor qilish
                </Button>
                <Button onClick={addStudent}>Qo'shish</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Ism yoki ID bo'yicha qidirish..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Barcha guruhlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha guruhlar</SelectItem>
              {groups.map(group => (
                <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-none"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {filteredStudents.length === 0 ? (
        <Card className="apple-card p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || selectedGroup !== 'all' ? "Qidiruv yoki filtr bo'yicha o'quvchilar topilmadi" : "Birinchi o'quvchingizni qo'shing"}
          </p>
          {!searchTerm && selectedGroup === 'all' && (
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setIsAddDialogOpen(true)} className="apple-button">
                <Plus className="w-4 h-4 mr-2" />
                Birinchi o'quvchini qo'shish
              </Button>
              <StudentImport teacherId={teacherId} onImportComplete={() => {
                fetchStudents();
                if (onStatsUpdate) onStatsUpdate();
              }} availableGroups={groups} />
            </div>
          )}
        </Card>
      ) : viewMode === 'grid' ? renderStudentsGrid() : renderStudentsList()}

      {showRewardDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Mukofot/Jarima berish</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setRewardType('reward')} variant={rewardType === 'reward' ? 'default' : 'outline'} className="flex items-center justify-center gap-2">
                  <Gift className="w-4 h-4" />
                  Mukofot
                </Button>
                <Button onClick={() => setRewardType('penalty')} variant={rewardType === 'penalty' ? 'default' : 'outline'} className="flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Jarima
                </Button>
              </div>
              <div>
                <label className="text-sm font-medium">Ball miqdori</label>
                <Input type="number" step="0.1" value={rewardPoints} onChange={e => setRewardPoints(e.target.value)} placeholder="Masalan: 5" />
              </div>
              <div className="flex space-x-2">
                <Button onClick={() => addReward(showRewardDialog)} className="flex-1">
                  Saqlash
                </Button>
                <Button onClick={() => {
                  setShowRewardDialog(null);
                  setRewardPoints('');
                }} variant="outline" className="flex-1">
                  Bekor qilish
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>O'quvchini tahrirlash</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-studentName">O'quvchi nomi *</Label>
                <Input id="edit-studentName" value={editingStudent.name} onChange={e => setEditingStudent({
                  ...editingStudent,
                  name: e.target.value
                })} />
              </div>
              <div>
                <Label htmlFor="edit-studentGroup">Guruh</Label>
                <Select value={editingStudent.group_name} onValueChange={value => setEditingStudent({
                  ...editingStudent,
                  group_name: value
                })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.name}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-2">
                <Button onClick={editStudent} className="apple-button flex-1">
                  Saqlash
                </Button>
                <Button onClick={() => setIsEditDialogOpen(false)} variant="outline" className="flex-1">
                  Bekor qilish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedStudent && (
        <StudentDetailsPopup
          studentId={selectedStudent.id}
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          teacherId={teacherId}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeArchiveStudent}
        title="O'quvchini arxivlash"
        description={`"${confirmDialog.studentName}" ni arxivlashga ishonchingiz komilmi?`}
        confirmText="Arxivlash"
        variant="warning"
      />
    </div>
  );
};

export default StudentManager;
