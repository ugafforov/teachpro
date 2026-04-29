import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthChange, db, User, firebaseSignOut } from '@/lib/firebase';
import AuthPage from '@/components/AuthPage';
import PendingApproval from '@/components/PendingApproval';
import AdminPanel from '@/components/AdminPanel';
import StudentDetailView from '@/components/StudentDetailView';
import { logError } from '@/lib/errorUtils';
import { fetchTeacherProfile, TeacherProfile } from '@/lib/teacherProfile';

const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          setTeacher(await fetchTeacherProfile(firebaseUser.uid));

          const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
          setIsAdmin(adminDoc.exists());
        } catch (error) {
          logError('StudentProfile.fetchProfile', error);
          setTeacher(null);
          setIsAdmin(false);
        } finally {
          setLoading(false);
        }
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
    } catch (error) {
      logError('StudentProfile.handleLogout', error);
    } finally {
      navigate('/');
    }
  };

  if (!studentId) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">O'quvchi topilmadi</div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </main>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (isAdmin) {
    return <AdminPanel adminId={user.uid} onLogout={handleLogout} />;
  }

  if (!teacher) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">Profil topilmadi</div>
      </main>
    );
  }

  if (teacher.verification_status === 'pending') {
    return <PendingApproval teacher={teacher} onLogout={handleLogout} />;
  }

  if (teacher.verification_status === 'rejected') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Ariza rad etilgan</div>
          <div className="text-muted-foreground">Profilga kirish mumkin emas</div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        <StudentDetailView
          studentId={studentId}
          teacherId={teacher.id}
          onBack={() => navigate(-1)}
        />
      </div>
    </div>
  );
};

export default StudentProfile;
