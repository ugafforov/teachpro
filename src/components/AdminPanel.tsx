import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, Building2, Mail, Phone, School, MapPin, Calendar } from 'lucide-react';

interface Teacher {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  school?: string;
  institution_name?: string;
  institution_address?: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  approved_at?: string;
  rejection_reason?: string;
}

const AdminPanel: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setTeachers(data || []);
    } catch (error: any) {
      toast({
        title: "Xatolik",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleApprove = async (teacherId: string) => {
    try {
      const { error } = await supabase
        .from('teachers')
        .update({
          verification_status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', teacherId);

      if (error) throw error;

      toast({
        title: "Tasdiqlandi",
        description: "O'qituvchi muvaffaqiyatli tasdiqlandi",
      });
      
      fetchTeachers();
    } catch (error: any) {
      toast({
        title: "Xatolik",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async (teacherId: string) => {
    const reason = rejectionReason[teacherId];
    if (!reason || reason.trim() === '') {
      toast({
        title: "Sabab talab qilinadi",
        description: "Rad etish sababini kiriting",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('teachers')
        .update({
          verification_status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', teacherId);

      if (error) throw error;

      toast({
        title: "Rad etildi",
        description: "O'qituvchi arizasi rad etildi",
      });
      
      setRejectionReason({ ...rejectionReason, [teacherId]: '' });
      fetchTeachers();
    } catch (error: any) {
      toast({
        title: "Xatolik",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500"><Clock className="w-3 h-3 mr-1" />Kutilmoqda</Badge>;
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Tasdiqlangan</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Rad etilgan</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingTeachers = teachers.filter(t => t.verification_status === 'pending');
  const approvedTeachers = teachers.filter(t => t.verification_status === 'approved');
  const rejectedTeachers = teachers.filter(t => t.verification_status === 'rejected');

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
        <p className="text-gray-600">O'qituvchilarni tasdiqlash va boshqarish</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-600 font-medium">Kutilmoqda</p>
              <p className="text-3xl font-bold text-amber-700">{pendingTeachers.length}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
        </Card>
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Tasdiqlangan</p>
              <p className="text-3xl font-bold text-green-700">{approvedTeachers.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Rad etilgan</p>
              <p className="text-3xl font-bold text-red-700">{rejectedTeachers.length}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </Card>
      </div>

      {pendingTeachers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Kutilayotgan arizalar</h2>
          <div className="space-y-4">
            {pendingTeachers.map((teacher) => (
              <Card key={teacher.id} className="p-6 border-amber-200 bg-amber-50/30">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{teacher.name}</h3>
                    {getStatusBadge(teacher.verification_status)}
                  </div>
                  <div className="text-sm text-gray-500">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {new Date(teacher.requested_at).toLocaleDateString('uz-UZ')}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700">{teacher.email}</span>
                  </div>
                  {teacher.phone && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">{teacher.phone}</span>
                    </div>
                  )}
                  {teacher.school && (
                    <div className="flex items-center space-x-2 text-sm">
                      <School className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">{teacher.school}</span>
                    </div>
                  )}
                  {teacher.institution_name && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Building2 className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">{teacher.institution_name}</span>
                    </div>
                  )}
                  {teacher.institution_address && (
                    <div className="flex items-center space-x-2 text-sm col-span-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">{teacher.institution_address}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col space-y-3">
                  <Textarea
                    placeholder="Rad etish sababi (majburiy)"
                    value={rejectionReason[teacher.id] || ''}
                    onChange={(e) => setRejectionReason({
                      ...rejectionReason,
                      [teacher.id]: e.target.value
                    })}
                    className="min-h-[80px]"
                  />
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => handleApprove(teacher.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Tasdiqlash
                    </Button>
                    <Button
                      onClick={() => handleReject(teacher.id)}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Rad etish
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {approvedTeachers.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Tasdiqlangan o'qituvchilar</h2>
            <div className="space-y-3">
              {approvedTeachers.map((teacher) => (
                <Card key={teacher.id} className="p-4 border-green-200 bg-green-50/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{teacher.name}</h3>
                      <p className="text-sm text-gray-600">{teacher.email}</p>
                      {teacher.school && <p className="text-xs text-gray-500">{teacher.school}</p>}
                    </div>
                    {getStatusBadge(teacher.verification_status)}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {rejectedTeachers.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Rad etilgan arizalar</h2>
            <div className="space-y-3">
              {rejectedTeachers.map((teacher) => (
                <Card key={teacher.id} className="p-4 border-red-200 bg-red-50/30">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{teacher.name}</h3>
                      <p className="text-sm text-gray-600">{teacher.email}</p>
                    </div>
                    {getStatusBadge(teacher.verification_status)}
                  </div>
                  {teacher.rejection_reason && (
                    <p className="text-xs text-red-600 mt-2">
                      <strong>Sabab:</strong> {teacher.rejection_reason}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
