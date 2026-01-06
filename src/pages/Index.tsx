import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { onAuthChange, firebaseSignOut, db, User } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuthPage from '@/components/AuthPage';
import Dashboard from '@/components/Dashboard';
import PendingApproval from '@/components/PendingApproval';
import AdminPanel from '@/components/AdminPanel';
import { logError } from '@/lib/errorUtils';

interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  school: string;
  created_at: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  is_approved?: boolean;
  institution_name?: string;
  institution_address?: string;
  requested_at: string;
  rejection_reason?: string;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          // Fetch teacher data from Firestore
          const teacherDoc = await getDoc(doc(db, 'teachers', firebaseUser.uid));

          if (teacherDoc.exists()) {
            const teacherData = teacherDoc.data() as Teacher;
            teacherData.id = teacherDoc.id;

            // Map is_approved to verification_status for compatibility
            if (teacherData.is_approved !== undefined) {
              teacherData.verification_status = teacherData.is_approved ? 'approved' : 'pending';
            }

            setTeacher(teacherData);
          }

          // Check if user is admin
          const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
          setIsAdmin(adminDoc.exists());
        } catch (error) {
          logError('Index.fetchProfile', error);
        }
        setLoading(false);
      } else {
        setTeacher(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await firebaseSignOut();
      setUser(null);
      setTeacher(null);
      toast.success("Tizimdan muvaffaqiyatli chiqdingiz");
    } catch (error) {
      logError('Index.handleLogout', error);
      toast.error("Chiqishda xatolik yuz berdi");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </main>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!teacher) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Profil sozlanmoqda...</h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </main>
    );
  }

  // Show admin panel if user is admin
  if (isAdmin) {
    return <AdminPanel />;
  }

  // Show pending approval page if teacher is not yet approved
  if (teacher.verification_status === 'pending') {
    return <PendingApproval teacher={teacher} onLogout={handleLogout} />;
  }

  // Show rejection message if teacher was rejected
  if (teacher.verification_status === 'rejected') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ariza rad etildi</h2>
          <p className="text-gray-600 mb-4">
            Afsusiki, sizning arizangiz qabul qilinmadi.
          </p>
          {teacher.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm font-semibold text-red-800 mb-1">Sabab:</p>
              <p className="text-sm text-red-700">{teacher.rejection_reason}</p>
            </div>
          )}
          <Button onClick={handleLogout} variant="outline">
            Chiqish
          </Button>
        </div>
      </main>
    );
  }

  // Show dashboard for approved teachers
  return <Dashboard teacherId={teacher.id} teacherName={teacher.name} onLogout={handleLogout} />;
};

export default Index;
