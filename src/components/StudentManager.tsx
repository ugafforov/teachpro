
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Upload, Edit2, Trash2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Student {
  id: string;
  name: string;
  studentId?: string;
  group: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

const StudentManager: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [bulkImportText, setBulkImportText] = useState('');
  const [newStudent, setNewStudent] = useState<Partial<Student>>({
    name: '',
    studentId: '',
    group: '',
    email: '',
    phone: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    const savedStudents = localStorage.getItem('students');
    if (savedStudents) {
      setStudents(JSON.parse(savedStudents));
    }
  }, []);

  const saveStudents = (updatedStudents: Student[]) => {
    setStudents(updatedStudents);
    localStorage.setItem('students', JSON.stringify(updatedStudents));
  };

  const groups = [...new Set(students.map(student => student.group))];
  
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.studentId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = selectedGroup === 'all' || student.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const addStudent = () => {
    if (!newStudent.name || !newStudent.group) {
      toast({
        title: "Missing Information",
        description: "Please provide at least name and group.",
        variant: "destructive",
      });
      return;
    }

    const student: Student = {
      id: Date.now().toString(),
      name: newStudent.name,
      studentId: newStudent.studentId || '',
      group: newStudent.group,
      email: newStudent.email || '',
      phone: newStudent.phone || '',
      createdAt: new Date().toISOString()
    };

    const updatedStudents = [...students, student];
    saveStudents(updatedStudents);
    
    setNewStudent({ name: '', studentId: '', group: '', email: '', phone: '' });
    setIsAddDialogOpen(false);
    
    toast({
      title: "Student Added",
      description: `${student.name} has been added to ${student.group}.`,
    });
  };

  const editStudent = () => {
    if (!editingStudent || !editingStudent.name || !editingStudent.group) {
      toast({
        title: "Missing Information",
        description: "Please provide at least name and group.",
        variant: "destructive",
      });
      return;
    }

    const updatedStudents = students.map(student => 
      student.id === editingStudent.id ? editingStudent : student
    );
    saveStudents(updatedStudents);
    
    setEditingStudent(null);
    setIsEditDialogOpen(false);
    
    toast({
      title: "Student Updated",
      description: "Student information has been updated successfully.",
    });
  };

  const deleteStudent = (studentId: string) => {
    const updatedStudents = students.filter(student => student.id !== studentId);
    saveStudents(updatedStudents);
    
    toast({
      title: "Student Removed",
      description: "Student has been removed from the system.",
    });
  };

  const processBulkImport = () => {
    if (!bulkImportText.trim()) {
      toast({
        title: "No Data",
        description: "Please paste student data to import.",
        variant: "destructive",
      });
      return;
    }

    const lines = bulkImportText.trim().split('\n');
    const newStudents: Student[] = [];
    let errors = 0;

    lines.forEach((line, index) => {
      const parts = line.split(/[,\t]/).map(part => part.trim());
      if (parts.length >= 2) {
        const student: Student = {
          id: Date.now().toString() + index,
          name: parts[0],
          group: parts[1],
          studentId: parts[2] || '',
          email: parts[3] || '',
          phone: parts[4] || '',
          createdAt: new Date().toISOString()
        };
        newStudents.push(student);
      } else {
        errors++;
      }
    });

    if (newStudents.length > 0) {
      const updatedStudents = [...students, ...newStudents];
      saveStudents(updatedStudents);
      
      setBulkImportText('');
      setIsBulkImportOpen(false);
      
      toast({
        title: "Import Complete",
        description: `${newStudents.length} students imported successfully. ${errors > 0 ? `${errors} lines skipped due to errors.` : ''}`,
      });
    } else {
      toast({
        title: "Import Failed",
        description: "No valid student data found. Please check the format.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Student Management</h2>
          <p className="text-muted-foreground">Manage your student lists and groups</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="apple-button-secondary">
                <Upload className="w-4 h-4 mr-2" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Bulk Import Students</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Paste student data (one per line)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Format: Name, Group, Student ID, Email, Phone
                  </p>
                  <Textarea
                    value={bulkImportText}
                    onChange={(e) => setBulkImportText(e.target.value)}
                    placeholder="John Doe, Group A, ST001, john@email.com, 123-456-7890"
                    rows={8}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={processBulkImport} className="apple-button flex-1">
                    Import Students
                  </Button>
                  <Button onClick={() => setIsBulkImportOpen(false)} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="apple-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={newStudent.name || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="Student full name"
                  />
                </div>
                <div>
                  <Label htmlFor="group">Group *</Label>
                  <Input
                    id="group"
                    value={newStudent.group || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, group: e.target.value })}
                    placeholder="Class or group name"
                  />
                </div>
                <div>
                  <Label htmlFor="studentId">Student ID</Label>
                  <Input
                    id="studentId"
                    value={newStudent.studentId || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                    placeholder="Optional student ID"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newStudent.email || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    placeholder="student@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newStudent.phone || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={addStudent} className="apple-button flex-1">
                    Add Student
                  </Button>
                  <Button onClick={() => setIsAddDialogOpen(false)} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filter */}
      <Card className="apple-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Search Students</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or ID..."
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Filter by Group</Label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            >
              <option value="all">All Groups</option>
              {groups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Students List */}
      <Card className="apple-card">
        <div className="p-6 border-b border-border/50">
          <h3 className="text-lg font-semibold">
            {selectedGroup === 'all' ? 'All Students' : `Group: ${selectedGroup}`}
          </h3>
          <p className="text-sm text-muted-foreground">
            {filteredStudents.length} students found
          </p>
        </div>
        
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Students Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || selectedGroup !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first student'
              }
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="apple-button">
              <Plus className="w-4 h-4 mr-2" />
              Add First Student
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredStudents.map(student => (
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
                      <span>{student.group}</span>
                      {student.studentId && <span>ID: {student.studentId}</span>}
                      {student.email && <span>{student.email}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingStudent(student);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteStudent(student.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-group">Group *</Label>
                <Input
                  id="edit-group"
                  value={editingStudent.group}
                  onChange={(e) => setEditingStudent({ ...editingStudent, group: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-studentId">Student ID</Label>
                <Input
                  id="edit-studentId"
                  value={editingStudent.studentId || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, studentId: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  value={editingStudent.email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editingStudent.phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={editStudent} className="apple-button flex-1">
                  Save Changes
                </Button>
                <Button onClick={() => setIsEditDialogOpen(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentManager;
