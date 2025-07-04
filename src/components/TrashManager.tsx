import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Trash2, RotateCcw, Users, Layers, AlertTriangle, BookOpen, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface DeletedStudent {
  id: string;
  original_student_id: string;
  name: string;
  student_id?: string;
  group_name: string;
  email?: string;
  phone?: string;
  deleted_at: string;
  teacher_id: string;
}

interface DeletedGroup {
  id: string;
  original_group_id: string;
  name: string;
  description?: string;
  deleted_at: string;
  teacher_id: string;
}

interface TrashManagerProps {
  teacherId: string;
  onStatsUpdate: () => Promise<void>;
}

const TrashManager: React.FC<TrashManagerProps> = ({ teacherId, onStatsUpdate }) => {
  const [deletedStudents, setDeletedStudents] = useState<DeletedStudent[]>([]);
  const [deletedGroups, setDeletedGroups] = useState<DeletedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'restore' | 'permanent',
    item: any,
    itemType: 'student' | 'group'
  } | null>(null);
  const [clearAllDialog, setClearAllDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchTrashData();
  }, [teacherId]);

  const fetchTrashData = async () => {
    try {
      // O'chirilgan o'quvchilarni olish
      const { data: students, error: studentsError } = await supabase
        .from('deleted_students')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('deleted_at', { ascending: false });

      if (studentsError) {
        console.error('Error fetching deleted students:', studentsError);
        setDeletedStudents([]);
      } else {
        setDeletedStudents(students || []);
      }

      // O'chirilgan guruhlarni olish
      const { data: groups, error: groupsError } = await supabase
        .from('deleted_groups')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('deleted_at', { ascending: false });

      if (groupsError) {
        console.error('Error fetching deleted groups:', groupsError);
        setDeletedGroups([]);
      } else {
        setDeletedGroups(groups || []);
      }
    } catch (error) {
      console.error('Error fetching deleted data:', error);
      toast({
        title: "Xatolik",
        description: "O'chirilgan ma'lumotlarni yuklashda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmClearAllTrash = async () => {
    try {
      const { error: studentsError } = await supabase
        .from('deleted_students')
        .delete()
        .eq('teacher_id', teacherId);

      if (studentsError) throw studentsError;

      const { error: groupsError } = await supabase
        .from('deleted_groups')
        .delete()
        .eq('teacher_id', teacherId);

      if (groupsError) throw groupsError;

      await fetchTrashData();
      if (onStatsUpdate) await onStatsUpdate();
      
      toast({
        title: "Muvaffaqiyat",
        description: "Chiqindilar qutisi tozalandi",
      });
    } catch (error) {
      console.error('Error clearing all trash:', error);
      toast({
        title: "Xatolik",
        description: "Chiqindilarni tozalashda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setClearAllDialog(false);
    }
  };

  const handleAction = (type: 'restore' | 'permanent', item: any, itemType: 'student' | 'group') => {
    setConfirmDialog({ type, item, itemType });
  };

  const confirmAction = async () => {
    if (!confirmDialog) return;

    const { type, item, itemType } = confirmDialog;

    try {
      if (itemType === 'student') {
        if (type === 'restore') {
          await restoreStudent(item);
        } else {
          await permanentDeleteStudent(item);
        }
      } else {
        if (type === 'restore') {
          await restoreGroup(item);
        } else {
          await permanentDeleteGroup(item);
        }
      }
    } catch (error) {
      console.error('Error performing action:', error);
    } finally {
      setConfirmDialog(null);
    }
  };

  const restoreStudent = async (deletedStudent: DeletedStudent) => {
    try {
      const { error: restoreError } = await supabase
        .from('students')
        .update({ is_active: true })
        .eq('id', deletedStudent.original_student_id);

      if (restoreError) throw restoreError;

      const { error: deleteError } = await supabase
        .from('deleted_students')
        .delete()
        .eq('id', deletedStudent.id);

      if (deleteError) throw deleteError;

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "O'quvchi tiklandi",
        description: `${deletedStudent.name} muvaffaqiyatli tiklandi`,
      });
    } catch (error) {
      console.error('Error restoring student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini tiklashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const restoreGroup = async (deletedGroup: DeletedGroup) => {
    try {
      const { error: restoreError } = await supabase
        .from('groups')
        .update({ is_active: true })
        .eq('id', deletedGroup.original_group_id);

      if (restoreError) throw restoreError;

      const { error: deleteError } = await supabase
        .from('deleted_groups')
        .delete()
        .eq('id', deletedGroup.id);

      if (deleteError) throw deleteError;

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "Guruh tiklandi",
        description: `${deletedGroup.name} guruhi muvaffaqiyatli tiklandi`,
      });
    } catch (error) {
      console.error('Error restoring group:', error);
      toast({
        title: "Xatolik",
        description: "Guruhni tiklashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const permanentDeleteStudent = async (deletedStudent: DeletedStudent) => {
    try {
      const { error: deleteError } = await supabase
        .from('deleted_students')
        .delete()
        .eq('id', deletedStudent.id);

      if (deleteError) throw deleteError;

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "O'quvchi o'chirildi",
        description: `${deletedStudent.name} butunlay o'chirildi`,
      });
    } catch (error) {
      console.error('Error permanently deleting student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini o'chirishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const permanentDeleteGroup = async (deletedGroup: DeletedGroup) => {
    try {
      const { error: deleteError } = await supabase
        .from('deleted_groups')
        .delete()
        .eq('id', deletedGroup.id);

      if (deleteError) throw deleteError;

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "Guruh o'chirildi",
        description: `${deletedGroup.name} guruhi butunlay o'chirildi`,
      });
    } catch (error) {
      console.error('Error permanently deleting group:', error);
      toast({
        title: "Xatolik",
        description: "Guruhni o'chirishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Chiqindilar qutisi</h2>
          <p className="text-muted-foreground">O'chirilgan ma'lumotlarni boshqaring</p>
        </div>
        <Button
          onClick={() => setClearAllDialog(true)}
          variant="destructive"
          className="flex items-center space-x-2"
          disabled={deletedStudents.length === 0 && deletedGroups.length === 0}
        >
          <Trash2 className="w-4 h-4" />
          <span>Chiqindini tozalash</span>
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <Tabs defaultValue="students" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="students" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            O'quvchilar ({deletedStudents.length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Guruhlar ({deletedGroups.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-6">
          {deletedStudents.length === 0 ? (
            <Card className="apple-card p-12 text-center">
              <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">O'chirilgan o'quvchilar yo'q</h3>
              <p className="text-muted-foreground">
                Hali hech qanday o'quvchi o'chirilmagan
              </p>
            </Card>
          ) : (
            <Card className="apple-card">
              <div className="p-6 border-b border-border/50">
                <h3 className="text-lg font-semibold">O'chirilgan o'quvchilar</h3>
                <p className="text-sm text-muted-foreground">
                  {deletedStudents.length} o'chirilgan o'quvchi
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {deletedStudents.map((student) => (
                  <div key={student.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {student.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>{student.group_name}</span>
                          {student.student_id && <span>ID: {student.student_id}</span>}
                          <span>O'chirilgan: {new Date(student.deleted_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('restore', student, 'student')}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Tiklash
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('permanent', student, 'student')}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Butunlay o'chirish
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="groups" className="mt-6">
          {deletedGroups.length === 0 ? (
            <Card className="apple-card p-12 text-center">
              <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">O'chirilgan guruhlar yo'q</h3>
              <p className="text-muted-foreground">
                Hali hech qanday guruh o'chirilmagan
              </p>
            </Card>
          ) : (
            <Card className="apple-card">
              <div className="p-6 border-b border-border/50">
                <h3 className="text-lg font-semibold">O'chirilgan guruhlar</h3>
                <p className="text-sm text-muted-foreground">
                  {deletedGroups.length} o'chirilgan guruh
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {deletedGroups.map((group) => (
                  <div key={group.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{group.name}</p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          {group.description && <span>{group.description}</span>}
                          <span>O'chirilgan: {new Date(group.deleted_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('restore', group, 'group')}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Tiklash
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('permanent', group, 'group')}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Butunlay o'chirish
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Clear All Confirmation Dialog */}
      {clearAllDialog && (
        <Dialog open={true} onOpenChange={() => setClearAllDialog(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Chiqindilarni tozalash
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Rostdan ham chiqindi qutisidagi barcha ma'lumotlarni butunlay o'chirmoqchimisiz? 
                Bu amalni bekor qilib bo'lmaydi!
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setClearAllDialog(false)}
              >
                Bekor qilish
              </Button>
              <Button
                onClick={confirmClearAllTrash}
                variant="destructive"
              >
                Ha, barchasini o'chirish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <Dialog open={true} onOpenChange={() => setConfirmDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Tasdiqlash
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                {confirmDialog.type === 'restore' 
                  ? `${confirmDialog.item.name}ni tiklashni xohlaysizmi?`
                  : `${confirmDialog.item.name}ni butunlay o'chirishni xohlaysizmi? Bu amalni bekor qilib bo'lmaydi.`
                }
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDialog(null)}
              >
                Bekor qilish
              </Button>
              <Button
                onClick={confirmAction}
                variant={confirmDialog.type === 'permanent' ? 'destructive' : 'default'}
              >
                {confirmDialog.type === 'restore' ? 'Tiklash' : 'Butunlay o\'chirish'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TrashManager;
