
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Calendar, Settings, Trash2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface Group {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  student_count?: number;
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [nameError, setNameError] = useState('');
  const { toast } = useToast();

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

      // Get student counts for each group
      const groupsWithCounts = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('group_name', group.name)
            .eq('teacher_id', teacherId)
            .eq('is_active', true);

          return {
            ...group,
            student_count: count || 0
          };
        })
      );

      setGroups(groupsWithCounts);
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

  const deleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`"${groupName}" guruhini o'chirishga ishonchingiz komilmi?`)) {
      return;
    }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Guruhlar</h2>
          <p className="text-muted-foreground">{groups.length} ta guruh</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="apple-button">
              <Plus className="w-4 h-4 mr-2" />
              Guruh qo'shish
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Yangi guruh yaratish</DialogTitle>
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
                  className="apple-button flex-1"
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
        <Card className="apple-card p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Guruhlar topilmadi</h3>
          <p className="text-muted-foreground mb-4">
            Birinchi guruhingizni yarating va o'quvchilar qo'shishni boshlang
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)} className="apple-button">
            <Plus className="w-4 h-4 mr-2" />
            Birinchi guruhni yaratish
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => (
            <Card key={group.id} className="apple-card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{group.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {group.student_count} o'quvchi
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => deleteGroup(group.id, group.name)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              {group.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {group.description}
                </p>
              )}
              
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                <span className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {new Date(group.created_at).toLocaleDateString('uz-UZ')}
                </span>
              </div>
              
              <Button 
                onClick={() => onGroupSelect(group.name)}
                variant="outline" 
                className="w-full"
              >
                <Settings className="w-4 h-4 mr-2" />
                Boshqarish
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupManager;
