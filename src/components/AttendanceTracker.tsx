
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Users, Check, X, Clock, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Student {
  id: string;
  name: string;
  group_name: string;
  student_id?: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  student?: Student;
}

interface AttendanceTrackerProps {
  teacherId: string;
  onStatsUpdate: () => Promise<void>;
}

const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({ teacherId, onStatsUpdate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
    fetchAttendanceRecords();
  }, [teacherId, selectedDate]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId);

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: "Error",
        description: "Failed to load students",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          students (
            id,
            name,
            group_name,
            student_id
          )
        `)
        .eq('teacher_id', teacherId)
        .eq('date', selectedDate);

      if (error) throw error;
      setAttendanceRecords(data || []);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    }
  };

  const groups = [...new Set(students.map(student => student.group_name))];
  
  const filteredStudents = selectedGroup === 'all' 
    ? students 
    : students.filter(student => student.group_name === selectedGroup);

  const getAttendanceStatus = (studentId: string) => {
    const record = attendanceRecords.find(record => record.student_id === studentId);
    return record?.status || null;
  };

  const markAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          student_id: studentId,
          teacher_id: teacherId,
          date: selectedDate,
          status: status
        }, {
          onConflict: 'student_id,date'
        });

      if (error) throw error;

      await fetchAttendanceRecords();
      await onStatsUpdate();
      
      toast({
        title: "Attendance Updated",
        description: `Student marked as ${status}`,
      });
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive",
      });
    }
  };

  const markAllPresent = async () => {
    try {
      const attendancePromises = filteredStudents.map(student =>
        supabase
          .from('attendance_records')
          .upsert({
            student_id: student.id,
            teacher_id: teacherId,
            date: selectedDate,
            status: 'present'
          }, {
            onConflict: 'student_id,date'
          })
      );

      await Promise.all(attendancePromises);
      await fetchAttendanceRecords();
      await onStatsUpdate();

      toast({
        title: "Attendance Updated",
        description: `Marked all ${filteredStudents.length} students as present`,
      });
    } catch (error) {
      console.error('Error marking all present:', error);
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          students (name, group_name, student_id)
        `)
        .eq('teacher_id', teacherId);

      if (error) throw error;

      const headers = ['Student Name', 'Group', 'Student ID', 'Date', 'Status'];
      const csvContent = [
        headers.join(','),
        ...(data || []).map(record => [
          record.students?.name || '',
          record.students?.group_name || '',
          record.students?.student_id || '',
          record.date,
          record.status
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${selectedGroup}-${selectedDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'present': return 'text-green-600 bg-green-50';
      case 'absent': return 'text-red-600 bg-red-50';
      case 'late': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'present': return <Check className="w-4 h-4" />;
      case 'absent': return <X className="w-4 h-4" />;
      case 'late': return <Clock className="w-4 h-4" />;
      default: return null;
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Attendance Tracker</h2>
          <p className="text-muted-foreground">Manage student attendance efficiently</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={exportToCSV} variant="outline" className="apple-button-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={markAllPresent} className="apple-button">
            <Users className="w-4 h-4 mr-2" />
            Mark All Present
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="apple-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Group</label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map(group => (
                  <SelectItem key={group} value={group}>{group}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Attendance List */}
      <Card className="apple-card">
        <div className="p-6 border-b border-border/50">
          <h3 className="text-lg font-semibold">
            {selectedGroup === 'all' ? 'All Students' : `Group: ${selectedGroup}`}
          </h3>
          <p className="text-sm text-muted-foreground">
            {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Students Found</h3>
            <p className="text-muted-foreground">
              {selectedGroup === 'all' 
                ? 'Add students to start taking attendance'
                : `No students found in ${selectedGroup} group`
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredStudents.map(student => {
              const status = getAttendanceStatus(student.id);
              return (
                <div key={student.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-sm text-muted-foreground">{student.group_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {status && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(status)}`}>
                        {getStatusIcon(status)}
                        <span className="capitalize">{status}</span>
                      </span>
                    )}
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant={status === 'present' ? 'default' : 'outline'}
                        onClick={() => markAttendance(student.id, 'present')}
                        className="w-8 h-8 p-0"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={status === 'late' ? 'default' : 'outline'}
                        onClick={() => markAttendance(student.id, 'late')}
                        className="w-8 h-8 p-0"
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={status === 'absent' ? 'default' : 'outline'}
                        onClick={() => markAttendance(student.id, 'absent')}
                        className="w-8 h-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AttendanceTracker;
