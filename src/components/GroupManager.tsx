import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Edit2, Trash2, Archive, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import GroupDetails from './GroupDetails';

interface Group {
  id: string;
  name: string;
  description?: string;
  teacher_id: string;
  is_active: boolean;
  created_at: string;
  student_count?: number;
  average_attendance?: number;
}

interface GroupManagerProps {
  teacherId: string;
  onStatsUpdate: () => Promise<void>;
}

const GroupManager: React.FC<GroupManagerProps> = ({ teacherId, onStatsUpdate }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: ''
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'archive' | 'delete',
    group: Group | null
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchGroups();
  }, [teacherId]);

  const fetchGroups = async () => {
    try {
      const { data: groupsData, error } = await supabase
        .from('groups')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Har bir guruh uchun o'quvchilar sonini va o'rtacha davomatni hisoblash
      const groupsWithStats = await Promise.all(
        (groupsData || []).map(async (group) => {
          // O'quvchilar soni
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('teacher_id', teacherId)
            .eq('group_name', group.name)
            .eq('is_active', true);

          // O'rtacha davomat
          const { data: attendanceData } = await supabase
            .from('attendance_records')
            .select('status, students!inner(group_name)')
            .eq('teacher_id', teacherId)
            .eq('students.group_name', group.name);

          const totalRecords = attendanceData?.length || 0;
          const presentRecords = attendanceData?.filter(a => a.status === 'present').length || 0;
          const averageAttendance = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

          return {
            ...group,
            student_count: count || 0,
            average_attendance: averageAttendance
          };
        })
      );

      setGroups(groupsWithStats);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast({
        title: "Xatolik",
        description: "Guruhlarni yuklashda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addGroup = async () => {
    if (!newGroup.name.trim()) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Guruh nomini kiriting",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('groups')
        .insert({
          teacher_id: teacherId,
          name: newGroup.name.trim(),
          description: newGroup.description.trim() || null
        });

      if (error) throw error;

      await fetchGroups();
      await onStatsUpdate();
      
      setNewGroup({ name: '', description: '' });
      setIsAddDialogOpen(false);
      
      toast({
        title: "Guruh qo'shildi",
        description: `"${newGroup.name}" guruhi muvaffaqiyatli yaratildi`,
      });
    } catch (error) {
      console.error('Error adding group:', error);
      toast({
        title: "Xatolik",
        description: "Guruh qo'shishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const editGroup = async () => {
    if (!editingGroup || !editingGroup.name.trim()) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Guruh nomini kiriting",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('groups')
        .update({
          name: editingGroup.name.trim(),
          description: editingGroup.description?.trim() || null
        })
        .eq('id', editingGroup.id);

      if (error) throw error;

      // O'quvchilar jadvalida ham guruh nomini yangilash
      await supabase
        .from('students')
        .update({ group_name: editingGroup.name.trim() })
        .eq('teacher_id', teacherId)
        .eq('group_name', groups.find(g => g.id === editingGroup.id)?.name);

      await fetchGroups();
      await onStatsUpdate();
      
      setEditingGroup(null);
      setIsEditDialogOpen(false);
      
      toast({
        title: "Guruh yangilandi",
        description: "Guruh ma'lumotlari muvaffaqiyatli yangilandi",
      });
    } catch (error) {
      console.error('Error updating group:', error);
      toast({
        title: "Xatolik",
        description: "Guruhni yangilashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const archiveGroup = async (groupId: string, groupName: string) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      await supabase
        .from('archived_groups')
        .insert({
          original_group_id: groupId,
          teacher_id: teacherId,
          name: group.name,
          description: group.description,
          archived_by: teacherId
        });

      await supabase
        .from('groups')
        .update({ is_active: false })
        .eq('id', groupId);

      const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('group_name', groupName)
        .eq('is_active', true);

      if (students && students.length > 0) {
        const archivedStudents = students.map(student => ({
          original_student_id: student.id,
          teacher_id: teacherId,
          name: student.name,
          student_id: student.student_id,
          group_name: student.group_name,
          email: student.email,
          phone: student.phone,
          archived_by: teacherId
        }));

        await supabase
          .from('archived_students')
          .insert(archivedStudents);

        await supabase
          .from('students')
          .update({ is_active: false })
          .eq('teacher_id', teacherId)
          .eq('group_name', groupName);
      }

      await fetchGroups();
      await onStatsUpdate();
      
      toast({
        title: "Guruh arxivlandi",
        description: `"${groupName}" guruhi va barcha o'quvchilari arxivga ko'chirildi`,
      });
    } catch (error) {
      console.error('Error archiving group:', error);
      toast({
        title: "Xatolik",
        description: "Guruhni arxivlashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const deleteGroup = async (groupId: string, groupName: string) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      // Move group to deleted_groups
      await supabase
        .from('deleted_groups')
        .insert({
          original_group_id: groupId,
          teacher_id: teacherId,
          name: group.name,
          description: group.description
        });

      // Deactivate group
      await supabase
        .from('groups')
        .update({ is_active: false })
        .eq('id', groupId);

      // Move students to deleted_students
      const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('group_name', groupName)
        .eq('is_active', true);

      if (students && students.length > 0) {
        const deletedStudents = students.map(student => ({
          original_student_id: student.id,
          teacher_id: teacherId,
          name: student.name,
          student_id: student.student_id,
          group_name: student.group_name,
          email: student.email,
          phone: student.phone
        }));

        await supabase
          .from('deleted_students')
          .insert(deletedStudents);

        await supabase
          .from('students')
          .update({ is_active: false })
          .eq('teacher_id', teacherId)
          .eq('group_name', groupName);
      }

      await fetchGroups();
      await onStatsUpdate();
      
      toast({
        title: "Guruh o'chirildi",
        description: `"${groupName}" guruhi va barcha o'quvchilari chiqindilar qutisiga ko'chirildi`,
      });
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        title: "Xatolik",
        description: "Guruhni o'chirishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const confirmAction = async () => {
    if (!confirmDialog?.group) return;

    if (confirmDialog.type === 'archive') {
      await archiveGroup(confirmDialog.group.id, confirmDialog.group.name);
    } else {
      await deleteGroup(confirmDialog.group.id, confirmDialog.group.name);
    }
    
    setConfirmDialog(null);
  };

  if (selectedGroup) {
    return (
      <GroupDetails
        groupName={selectedGroup}
        teacherId={teacherId}
        onBack={() => setSelectedGroup(null)}
        onStatsUpdate={onStatsUpdate}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Guruhlar boshqaruvi</h2>
          <p className="text-muted-foreground">Sinflaringizni yarating va boshqaring</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-gray-800 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Yangi guruh
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Yangi guruh yaratish</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="groupName">Guruh nomi *</Label>
                <Input
                  id="groupName"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  placeholder="Masalan: 10-A sinf"
                />
              </div>
              <div>
                <Label htmlFor="groupDescription">Tavsif</Label>
                <Textarea
                  id="groupDescription"
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  placeholder="Guruh haqida qo'shimcha ma'lumot"
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={addGroup} className="apple-button flex-1">
                  Yaratish
                </Button>
                <Button onClick={() => setIsAddDialogOpen(false)} variant="outline" className="flex-1">
                  Bekor qilish
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card className="p-12 text-center bg-white shadow-sm border border-gray-200">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Guruhlar topilmadi</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Birinchi guruhingizni yarating va o'quvchilarni qo'shishni boshlang
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-black hover:bg-gray-800 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Birinchi guruhni yaratish
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => (
            <Card 
              key={group.id} 
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow bg-white shadow-sm border border-gray-200"
              onClick={() => setSelectedGroup(group.name)}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">{group.name}</h3>
                  {group.description && (
                    <p className="text-sm text-muted-foreground mb-2">{group.description}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">O'quvchilar</p>
                      <p className="font-semibold">{group.student_count || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Davomat</p>
                      <p className="font-semibold">{group.average_attendance || 0}%</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    {new Date(group.created_at).toLocaleDateString('uz-UZ')}
                  </span>
                  <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingGroup(group);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDialog({ type: 'archive', group })}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    >
                      <Archive className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDialog({ type: 'delete', group })}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <Dialog open={true} onOpenChange={() => setConfirmDialog(null)}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>
                {confirmDialog.type === 'archive' ? 'Guruhni arxivlash' : 'Guruhni o\'chirish'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                {confirmDialog.type === 'archive' 
                  ? `"${confirmDialog.group?.name}" guruhini arxivlashni xohlaysizmi? Bu guruh va uning barcha o'quvchilari arxivga ko'chiriladi.`
                  : `"${confirmDialog.group?.name}" guruhini o'chirishni xohlaysizmi? Bu guruh va uning barcha o'quvchilari chiqindilar qutisiga ko'chiriladi.`
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
                variant={confirmDialog.type === 'delete' ? 'destructive' : 'default'}
                className={confirmDialog.type === 'archive' ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''}
              >
                {confirmDialog.type === 'archive' ? 'Arxivlash' : 'O\'chirish'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Tahrirlash dialogi */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Guruhni tahrirlash</DialogTitle>
          </DialogHeader>
          {editingGroup && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-groupName">Guruh nomi *</Label>
                <Input
                  id="edit-groupName"
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-groupDescription">Tavsif</Label>
                <Textarea
                  id="edit-groupDescription"
                  value={editingGroup.description || ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={editGroup} className="apple-button flex-1">
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
    </div>
  );
};

export default GroupManager;
