import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { onAuthChange, firebaseSignOut, db, User } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { XCircle, RefreshCw } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AuthPage from '@/components/AuthPage';
import Dashboard from '@/components/Dashboard';
import PendingApproval from '@/components/PendingApproval';
import AdminPanel from '@/components/AdminPanel';
import { logError, sanitizeError } from '@/lib/errorUtils';

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
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isStudentProfileRoute = /^\/students\/[^/]+$/.test(location.pathname);

  const fetchProfile = async (firebaseUser: User) => {
    setLoading(true);
    setError(null);
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
      } else {
        setTeacher(null);
      }

      // Check if user is admin
      const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
      setIsAdmin(adminDoc.exists());
    } catch (error) {
      logError('Index.fetchProfile', error);
      const { message, code } = sanitizeError(error, 'fetch');

      if (code === 'permission-denied') {
        setError(
          "Ma'lumotlar bazasiga kirish uchun ruxsat yo'q (permission-denied). " +
          "Bu ma'lumotlar o'chib ketganini anglatmaydi, faqat Firebase qoidalari bo'yicha sizga o'qish ruxsati berilmagan. " +
          "Iltimos, Firebase Firestore rules bo'limida ushbu akkaunt uchun o'qish huquqi borligini tekshiring."
        );
      } else if (code === 'unavailable') {
        setError(
          "Firebase serveriga ulana olmadik (service unavailable). " +
          "Internet aloqasini va Firebase xizmatlarining ishlayotganini tekshiring."
        );
      } else {
        setError(message || "Ma'lumotlarni yuklashda xatolik yuz berdi. Internet aloqasini tekshiring.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await fetchProfile(firebaseUser);
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
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </main>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8 bg-card border border-border rounded-2xl shadow-lg max-w-md w-full">
          <div className="mx-auto w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Xatolik yuz berdi</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="flex gap-3">
            <Button onClick={() => fetchProfile(user)} variant="outline" className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Qayta urinish
            </Button>
            <Button onClick={handleLogout} variant="destructive" className="flex-1">
              Chiqish
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Show admin panel if user is admin
  if (isAdmin) {
    return <AdminPanel />;
  }

  if (!teacher) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8 bg-card border border-border rounded-2xl shadow-lg max-w-md w-full">
          <div className="mx-auto w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Profil topilmadi</h2>
          <p className="text-muted-foreground mb-6">
            Sizning hisobingiz bilan bog'liq o'qituvchi profili topilmadi yoki unga kirish huquqi yo'q.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => fetchProfile(user)} variant="outline" className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Qayta urinish
            </Button>
            <Button onClick={handleLogout} variant="default" className="flex-1">
              Chiqish
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Show pending approval page if teacher is not yet approved
  if (teacher.verification_status === 'pending') {
    return <PendingApproval teacher={teacher} onLogout={handleLogout} />;
  }

  // Show rejection message if teacher was rejected
  if (teacher.verification_status === 'rejected') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Ariza rad etildi</h2>
          <p className="text-muted-foreground mb-4">
            Afsusiki, sizning arizangiz qabul qilinmadi.
          </p>
          {teacher.rejection_reason && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm font-semibold text-destructive mb-1">Sabab:</p>
              <p className="text-sm text-foreground">{teacher.rejection_reason}</p>
            </div>
          )}
          <Button onClick={handleLogout} variant="outline">
            Chiqish
          </Button>
        </div>
      </main>
    );
  }

  // Show dashboard for approved teachers.
  // When URL is /students/:id, Dashboard shows StudentDetailView in its main area — do not render Outlet to avoid duplicate content.
  return (
    <>
      <Dashboard teacherId={teacher.id} teacherName={teacher.name} onLogout={handleLogout} />
      {!isStudentProfileRoute && <Outlet />}
    </>
  );
};

export default Index;
