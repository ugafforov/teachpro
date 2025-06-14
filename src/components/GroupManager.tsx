import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Calendar, Settings, Trash2, AlertTriangle, Archive, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogOverlay } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import GroupDetails from './GroupDetails';

interface Group {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  student_count?: number;
  attendance_percentage?: number;
}

interface GroupManagerProps {
  teacherId: string;
  onGroupSelect: (groupName: string) => void;
  onStatsUpdate: () => Promise<void>;
}

const GroupManager: React.FC<GroupManagerProps> = ({
  teacherId,
  onGroupSelect,
  onStatsUpdate,
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [nameError, setNameError] = useState('');
  const { toast } = useToast();

  // Har bir guruh uchun arxiv va o‘chirish dialoglari ochiqmi yo‘qmi — shularni kuzatamiz
  const [openArchiveDialogIds, setOpenArchiveDialogIds] = useState<string[]>([]);
  const [openDeleteDialogIds, setOpenDeleteDialogIds] = useState<string[]>([]);

  // Yordamchi: Dialog ochish
  const handleArchiveDialogOpen = (groupId: string, open: boolean) => {
    setOpenArchiveDialogIds((prev) =>
      open ? [...prev, groupId] : prev.filter((id) => id !== groupId)
    );
  };
  const handleDeleteDialogOpen = (groupId: string, open: boolean) => {
    setOpenDeleteDialogIds((prev) =>
      open ? [...prev, groupId] : prev.filter((id) => id !== groupId)
    );
  };

  useEffect(() => {
    fetchGroups();
  }, [teacherId]);

  const fetchGroups = async () => {
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      // Get student counts and attendance for each group
      const groupsWithStats = await Promise.all(
        (groupsData || []).map(async (group) => {
          // Get student count
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('group_name', group.name)
            .eq('teacher_id', teacherId)
            .eq('is_active', true);

          // Get attendance percentage for this group
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendance_records')
            .select(`
              status,
              students!inner(group_name, is_active)
            `)
            .eq('teacher_id', teacherId)
            .eq('students.group_name', group.name)
            .eq('students.is_active', true);

          let attendancePercentage = 0;
          if (!attendanceError && attendanceData && attendanceData.length > 0) {
            const totalRecords = attendanceData.length;
            const presentRecords = attendanceData.filter(a => a.status === 'present' || a.status === 'late').length;
            attendancePercentage = Math.round((presentRecords / totalRecords) * 100);
          }

          return {
            ...group,
            student_count: count || 0,
            attendance_percentage: attendancePercentage
          };
        })
      );

      setGroups(groupsWithStats);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkGroupNameExists = async (name: string): Promise<boolean> => {
    try {
      // Check in active groups
      const { data: activeGroups, error: activeError } = await supabase
        .from('groups')
        .select('name')
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .ilike('name', name);

      if (activeError) throw activeError;

      // Check in archived groups
      const { data: archivedGroups, error: archivedError } = await supabase
        .from('archived_groups')
        .select('name')
        .eq('teacher_id', teacherId)
        .ilike('name', name);

      if (archivedError) throw archivedError;

      // Check in deleted groups
      const { data: deletedGroups, error: deletedError } = await supabase
        .from('deleted_groups')
        .select('name')
        .eq('teacher_id', teacherId)
        .ilike('name', name);

      if (deletedError) throw deletedError;

      return (activeGroups?.length || 0) > 0 ||
             (archivedGroups?.length || 0) > 0 ||
             (deletedGroups?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking group name:', error);
      return false;
    }
  };

  const handleNameChange = async (name: string) => {
    setNewGroup({ ...newGroup, name });
    setNameError('');

    if (name.trim()) {
      const exists = await checkGroupNameExists(name.trim());
      if (exists) {
        setNameError('Ushbu nomda guruh mavjud');
      }
    }
  };

  const addGroup = async () => {
    if (!newGroup.name.trim()) {
      setNameError('Guruh nomi kiritilishi shart');
      return;
    }

    if (nameError) {
      return;
    }

    try {
      // Double check before adding
      const exists = await checkGroupNameExists(newGroup.name.trim());
      if (exists) {
        setNameError('Ushbu nomda guruh mavjud');
        return;
      }

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
      setNameError('');
      setIsAddDialogOpen(false);

      toast({
        title: "Muvaffaqiyat",
        description: "Guruh muvaffaqiyatli qo'shildi",
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

  const handleGroupClick = (groupName: string) => {
    console.log('Group clicked:', groupName);
    setSelectedGroup(groupName);
    onGroupSelect(groupName);
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
  };

  const handleEditGroup = async (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    console.log('Edit group:', group.name);
    setEditingGroup(group);
    setIsEditDialogOpen(true);
  };

  const updateGroup = async () => {
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

      // Update students table with new group name if needed
      const originalGroup = groups.find(g => g.id === editingGroup.id);
      if (originalGroup && originalGroup.name !== editingGroup.name.trim()) {
        await supabase
          .from('students')
          .update({ group_name: editingGroup.name.trim() })
          .eq('group_name', originalGroup.name)
          .eq('teacher_id', teacherId);
      }

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

  const handleArchiveGroup = async (groupId: string, groupName: string) => {
    try {
      // Move group to archived_groups table
      const group = groups.find(g => g.id === groupId);
      if (group) {
        const { error: archiveError } = await supabase
          .from('archived_groups')
          .insert({
            original_group_id: group.id,
            teacher_id: teacherId,
            name: group.name,
            description: group.description
          });

        if (archiveError) throw archiveError;
      }

      // Move students to archived_students table
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('group_name', groupName)
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (studentsError) throw studentsError;

      if (students && students.length > 0) {
        const studentsToArchive = students.map(student => ({
          original_student_id: student.id,
          teacher_id: teacherId,
          name: student.name,
          student_id: student.student_id,
          email: student.email,
          phone: student.phone,
          group_name: student.group_name
        }));

        const { error: archiveStudentsError } = await supabase
          .from('archived_students')
          .insert(studentsToArchive);

        if (archiveStudentsError) throw archiveStudentsError;

        // Mark students as inactive
        const { error: updateStudentsError } = await supabase
          .from('students')
          .update({ is_active: false })
          .eq('group_name', groupName)
          .eq('teacher_id', teacherId);

        if (updateStudentsError) throw updateStudentsError;
      }

      // Mark group as inactive
      const { error: updateError } = await supabase
        .from('groups')
        .update({ is_active: false })
        .eq('id', groupId);

      if (updateError) throw updateError;

      await fetchGroups();
      await onStatsUpdate();

      toast({
        title: "Muvaffaqiyat",
        description: "Guruh muvaffaqiyatli arxivlandi",
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

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    try {
      // Move group to deleted_groups table
      const group = groups.find(g => g.id === groupId);
      if (group) {
        const { error: deleteError } = await supabase
          .from('deleted_groups')
          .insert({
            original_group_id: group.id,
            teacher_id: teacherId,
            name: group.name,
            description: group.description
          });

        if (deleteError) throw deleteError;
      }

      // Move students to deleted_students table
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('group_name', groupName)
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (studentsError) throw studentsError;

      if (students && students.length > 0) {
        const studentsToDelete = students.map(student => ({
          original_student_id: student.id,
          teacher_id: teacherId,
          name: student.name,
          student_id: student.student_id,
          email: student.email,
          phone: student.phone,
          group_name: student.group_name
        }));

        const { error: deleteStudentsError } = await supabase
          .from('deleted_students')
          .insert(studentsToDelete);

        if (deleteStudentsError) throw deleteStudentsError;

        // Mark students as inactive
        const { error: updateStudentsError } = await supabase
          .from('students')
          .update({ is_active: false })
          .eq('group_name', groupName)
          .eq('teacher_id', teacherId);

        if (updateStudentsError) throw updateStudentsError;
      }

      // Mark group as inactive
      const { error: updateError } = await supabase
        .from('groups')
        .update({ is_active: false })
        .eq('id', groupId);

      if (updateError) throw updateError;

      await fetchGroups();
      await onStatsUpdate();

      toast({
        title: "Muvaffaqiyat",
        description: "Guruh muvaffaqiyatli o'chirildi",
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show GroupDetails component if a group is selected
  if (selectedGroup) {
    return (
      <GroupDetails
        groupName={selectedGroup}
        teacherId={teacherId}
        onBack={handleBackToGroups}
        onStatsUpdate={onStatsUpdate}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Guruhlar boshqaruvi</h2>
          <p className="text-gray-600">Sinflaringizni yarating va boshqaring</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black text-white hover:bg-gray-800 rounded-lg px-4 py-2">
              <Plus className="w-4 h-4 mr-2" />
              Yangi guruh
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Yangi guruh yaratish</DialogTitle>
              <DialogDescription>
                Yangi guruh yarating va o'quvchilar qo'shing
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="groupName">Guruh nomi *</Label>
                <Input
                  id="groupName"
                  value={newGroup.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Masalan: 10-A sinf"
                  className={nameError ? 'border-red-500' : ''}
                />
                {nameError && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                    <AlertTriangle className="w-4 h-4" />
                    {nameError}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="groupDescription">Izoh</Label>
                <Textarea
                  id="groupDescription"
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  placeholder="Guruh haqida qo'shimcha ma'lumot"
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={addGroup}
                  className="bg-black text-white hover:bg-gray-800 flex-1"
                  disabled={!newGroup.name.trim() || !!nameError}
                >
                  Yaratish
                </Button>
                <Button
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setNewGroup({ name: '', description: '' });
                    setNameError('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Bekor qilish
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card className="p-12 text-center bg-white border border-gray-200 rounded-lg">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Guruhlar topilmadi</h3>
          <p className="text-gray-600 mb-4">
            Birinchi guruhingizni yarating va o'quvchilar qo'shishni boshlang
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-black text-white hover:bg-gray-800">
            <Plus className="w-4 h-4 mr-2" />
            Birinchi guruhni yaratish
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => {
            // Guruh uchun hozir arxiv yoki delete dialog ochiqmi — uni aniqlab olamiz
            const isAnyDialogOpen =
              openArchiveDialogIds.includes(group.id) ||
              openDeleteDialogIds.includes(group.id);

            return (
              <Card
                key={group.id}
                className="p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                // faqat dialoglar yopiq bo'lsa onClick ishlaydi
                onClick={() => {
                  if (!isAnyDialogOpen) {
                    handleGroupClick(group.name);
                  }
                }}
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{group.name}</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" />
                      <div>
                        <span className="text-gray-600 text-sm">O'quvchilar</span>
                        <div className="text-lg font-semibold">{group.student_count}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-green-500" />
                      <div>
                        <span className="text-gray-600 text-sm">Davomat</span>
                        <div className="text-lg font-semibold text-green-600">{group.attendance_percentage}%</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(group.created_at).toLocaleDateString('uz-UZ')}
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <Button
                      onClick={(e) => handleEditGroup(e, group)}
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2"
                      title="Tahrirlash"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {/* Arxiv dialog */}
                    <AlertDialog
                      open={openArchiveDialogIds.includes(group.id)}
                      onOpenChange={(open) => handleArchiveDialogOpen(group.id, open)}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveDialogOpen(group.id, true);
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 p-2"
                          title="Arxivlash"
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogOverlay
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveDialogOpen(group.id, false);
                        }}
                      />
                      <AlertDialogContent
                        onClick={(e) => e.stopPropagation()}
                      >
                        <AlertDialogHeader>
                          <AlertDialogTitle>Guruhni arxivlash</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{group.name}" guruhini arxivlashga ishonchingiz komilmi? Arxivlangan guruhlarni keyinroq tiklash mumkin.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveDialogOpen(group.id, false);
                            }}
                          >
                            Bekor qilish
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveDialogOpen(group.id, false);
                              handleArchiveGroup(group.id, group.name);
                            }}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            Arxivlash
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {/* O‘chirish dialog */}
                    <AlertDialog
                      open={openDeleteDialogIds.includes(group.id)}
                      onOpenChange={(open) => handleDeleteDialogOpen(group.id, open)}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDialogOpen(group.id, true);
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogOverlay
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDialogOpen(group.id, false);
                        }}
                      />
                      <AlertDialogContent
                        onClick={(e) => e.stopPropagation()}
                      >
                        <AlertDialogHeader>
                          <AlertDialogTitle>Guruhni o'chirish</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{group.name}" guruhini o'chirishga ishonchingiz komilmi? O'chirilgan guruhlarni chiqindi qutisidan tiklash mumkin.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDialogOpen(group.id, false);
                            }}
                          >
                            Bekor qilish
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDialogOpen(group.id, false);
                              handleDeleteGroup(group.id, group.name);
                            }}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            O'chirish
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tahrirlash dialogi */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Guruhni tahrirlash</DialogTitle>
            <DialogDescription>
              Guruh ma'lumotlarini yangilang
            </DialogDescription>
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
                <Label htmlFor="edit-groupDescription">Izoh</Label>
                <Textarea
                  id="edit-groupDescription"
                  value={editingGroup.description || ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={updateGroup} className="bg-black text-white hover:bg-gray-800 flex-1">
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
