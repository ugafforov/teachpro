import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Calendar, AlertTriangle, Archive, Edit2, Grid3x3, List } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import GroupDetails from './GroupDetails';
import { groupSchema, formatValidationError } from '@/lib/validations';
import { z } from 'zod';
import { formatDateUz } from '@/lib/utils';
import ConfirmDialog from './ConfirmDialog';

interface Group {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  student_count?: number;
  attendance_percentage?: number;
  is_active?: boolean;
}

interface GroupManagerProps {
  teacherId: string;
  onGroupSelect: (groupName: string) => void;
  onStatsUpdate: () => Promise<void>;
}

const GroupManager: React.FC<GroupManagerProps> = ({
  teacherId,
  onGroupSelect,
  onStatsUpdate
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const selectedGroupStorageKey = `tp:groups:selectedGroup:${teacherId}`;
  const groupViewModeStorageKey = `tp:groups:viewMode:${teacherId}`;
  const [selectedGroup, setSelectedGroup] = useState<string | null>(() => {
    try {
      return localStorage.getItem(selectedGroupStorageKey);
    } catch {
      return null;
    }
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem(groupViewModeStorageKey);
      return saved === 'list' || saved === 'grid' ? saved : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [nameError, setNameError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    groupId: string;
    groupName: string;
  }>({
    isOpen: false,
    groupId: '',
    groupName: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchGroups();
  }, [teacherId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(groupViewModeStorageKey);
      if (saved === 'list' || saved === 'grid') {
        setViewMode(saved);
      } else {
        setViewMode('grid');
      }
    } catch {
      setViewMode('grid');
    }
  }, [groupViewModeStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(groupViewModeStorageKey, viewMode);
    } catch {
      // ignore
    }
  }, [groupViewModeStorageKey, viewMode]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      // 1. Fetch all active groups
      const groupsQuery = query(
        collection(db, 'groups'),
        where('teacher_id', '==', teacherId),
        where('is_active', '==', true)
      );
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsData = groupsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Group))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      if (groupsData.length === 0) {
        setGroups([]);
        return;
      }

      // 2. Fetch all active students for this teacher to count per group
      const studentsQuery = query(
        collection(db, 'students'),
        where('teacher_id', '==', teacherId),
        where('is_active', '==', true)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const allStudents = studentsSnapshot.docs.map(d => d.data());

      // 3. Fetch all attendance records for this teacher to calculate percentage
      const attendanceQuery = query(
        collection(db, 'attendance_records'),
        where('teacher_id', '==', teacherId)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);

      // Pre-group attendance by student_id for O(1) lookup
      const attendanceByStudent: Record<string, any[]> = {};
      attendanceSnapshot.docs.forEach(d => {
        const data = d.data();
        if (data.student_id) {
          if (!attendanceByStudent[data.student_id]) {
            attendanceByStudent[data.student_id] = [];
          }
          attendanceByStudent[data.student_id].push(data);
        }
      });

      // 4. Combine data in memory
      // Pre-group students by group name for efficient lookup
      const studentsByGroup: Record<string, string[]> = {};
      studentsSnapshot.docs.forEach(d => {
        const data = d.data();
        if (data.group_name) {
          if (!studentsByGroup[data.group_name]) {
            studentsByGroup[data.group_name] = [];
          }
          studentsByGroup[data.group_name].push(d.id);
        }
      });

      const groupsWithStats = groupsData.map(group => {
        const groupStudentIds = studentsByGroup[group.name] || [];

        // Get all attendance for all students in this group
        const groupAttendance = groupStudentIds.flatMap(id => attendanceByStudent[id] || []);

        let attendancePercentage = 0;
        if (groupAttendance.length > 0) {
          const presentCount = groupAttendance.filter(a =>
            a.status === 'present' || a.status === 'late'
          ).length;
          attendancePercentage = Math.round((presentCount / groupAttendance.length) * 100);
        }

        return {
          ...group,
          student_count: groupStudentIds.length,
          attendance_percentage: attendancePercentage
        };
      });

      setGroups(groupsWithStats);

      if (selectedGroup && !groupsWithStats.some(g => g.name === selectedGroup)) {
        setSelectedGroup(null);
        try {
          localStorage.removeItem(selectedGroupStorageKey);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast({
        title: "Xatolik",
        description: "Guruhlarni yuklashda xatolik yuz berdi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkGroupNameExists = async (name: string): Promise<boolean> => {
    try {
      const activeQuery = query(
        collection(db, 'groups'),
        where('teacher_id', '==', teacherId),
        where('is_active', '==', true)
      );
      const activeSnapshot = await getDocs(activeQuery);
      const activeExists = activeSnapshot.docs.some(d =>
        d.data().name.toLowerCase() === name.toLowerCase()
      );

      const archivedQuery = query(
        collection(db, 'archived_groups'),
        where('teacher_id', '==', teacherId)
      );
      const archivedSnapshot = await getDocs(archivedQuery);
      const archivedExists = archivedSnapshot.docs.some(d =>
        d.data().name.toLowerCase() === name.toLowerCase()
      );

      return activeExists || archivedExists;
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
    try {
      groupSchema.parse({
        name: newGroup.name,
        description: newGroup.description || ''
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        setNameError(formatValidationError(error));
        toast({
          title: "Validatsiya xatosi",
          description: formatValidationError(error),
          variant: "destructive"
        });
      }
      return;
    }

    if (nameError) return;

    try {
      const exists = await checkGroupNameExists(newGroup.name.trim());
      if (exists) {
        setNameError('Ushbu nomda guruh mavjud');
        return;
      }

      await addDoc(collection(db, 'groups'), {
        teacher_id: teacherId,
        name: newGroup.name.trim(),
        description: newGroup.description.trim() || null,
        is_active: true,
        created_at: new Date().toISOString()
      });

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
    setSelectedGroup(groupName);
    try {
      localStorage.setItem(selectedGroupStorageKey, groupName);
    } catch {
      // ignore
    }
    onGroupSelect(groupName);
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
    try {
      localStorage.removeItem(selectedGroupStorageKey);
    } catch {
      // ignore
    }
  };

  const handleEditGroup = async (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
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
      const originalGroup = groups.find(g => g.id === editingGroup.id);

      await updateDoc(doc(db, 'groups', editingGroup.id), {
        name: editingGroup.name.trim(),
        description: editingGroup.description?.trim() || null
      });

      // Update students with new group name if changed
      if (originalGroup && originalGroup.name !== editingGroup.name.trim()) {
        const studentsQuery = query(
          collection(db, 'students'),
          where('group_name', '==', originalGroup.name),
          where('teacher_id', '==', teacherId)
        );
        const studentsSnapshot = await getDocs(studentsQuery);

        for (const studentDoc of studentsSnapshot.docs) {
          await updateDoc(doc(db, 'students', studentDoc.id), {
            group_name: editingGroup.name.trim()
          });
        }
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

  const handleArchiveGroup = (e: React.MouseEvent, groupId: string, groupName: string) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      groupId,
      groupName
    });
  };

  const executeArchiveGroup = async () => {
    const { groupId, groupName } = confirmDialog;
    try {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        // Add to archived_groups
        await addDoc(collection(db, 'archived_groups'), {
          original_group_id: group.id,
          teacher_id: teacherId,
          name: group.name,
          description: group.description,
          archived_at: serverTimestamp()
        });
      }

      // Get and archive students
      const studentsQuery = query(
        collection(db, 'students'),
        where('group_name', '==', groupName),
        where('teacher_id', '==', teacherId),
        where('is_active', '==', true)
      );
      const studentsSnapshot = await getDocs(studentsQuery);

      for (const studentDoc of studentsSnapshot.docs) {
        const student = studentDoc.data();
        await addDoc(collection(db, 'archived_students'), {
          original_student_id: studentDoc.id,
          teacher_id: teacherId,
          name: student.name,
          student_id: student.student_id,
          email: student.email,
          phone: student.phone,
          group_name: student.group_name,
          join_date: student.join_date || null,
          created_at: student.created_at || null,
          left_date: new Date().toISOString().split('T')[0],
          archived_at: serverTimestamp()
        });
        await updateDoc(doc(db, 'students', studentDoc.id), {
          is_active: false,
          left_date: new Date().toISOString().split('T')[0],
          archived_at: serverTimestamp()
        });
      }

      // Mark group as inactive
      await updateDoc(doc(db, 'groups', groupId), { is_active: false });

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
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (selectedGroup) {
    return (
      <GroupDetails
        groupName={selectedGroup}
        teacherId={teacherId}
        onBack={handleBackToGroups}
        onStatsUpdate={onStatsUpdate}
        availableGroups={groups.map(g => ({ id: g.id, name: g.name }))}
        onGroupChange={(newGroupName) => setSelectedGroup(newGroupName)}
      />
    );
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Guruhlar boshqaruvi</h2>
          <p className="text-gray-600">Sinflaringizni yarating va boshqaring</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
              className={`rounded-none px-3 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('grid')}
              className={`rounded-none px-3 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
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
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {groups.map(group => (
            <Card
              key={group.id}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleGroupClick(group.name)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{group.name}</h3>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <div>
                        <span className="text-gray-600 text-xs">O'quvchilar</span>
                        <div className="text-sm font-semibold">{group.student_count}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-green-500" />
                      <div>
                        <span className="text-gray-600 text-xs">Davomat</span>
                        <div className="text-sm font-semibold text-green-600">{group.attendance_percentage}%</div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500">
                      {formatDateUz(group.created_at)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1 ml-4">
                  <Button
                    onClick={(e) => handleEditGroup(e, group)}
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2"
                    title="Tahrirlash"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={(e) => handleArchiveGroup(e, group.id, group.name)}
                    variant="ghost"
                    size="sm"
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 p-2"
                    title="Arxivlash"
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => (
            <Card
              key={group.id}
              className="p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleGroupClick(group.name)}
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
                  {formatDateUz(group.created_at)}
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
                  <Button
                    onClick={(e) => handleArchiveGroup(e, group.id, group.name)}
                    variant="ghost"
                    size="sm"
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 p-2"
                    title="Arxivlash"
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
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

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeArchiveGroup}
        title="Guruhni arxivlash"
        description={`"${confirmDialog.groupName}" guruhini arxivlashga ishonchingiz komilmi?`}
        confirmText="Arxivlash"
        variant="warning"
      />
    </div>
  );
};

export default GroupManager;
