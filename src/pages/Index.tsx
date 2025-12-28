import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuthPage from '@/components/AuthPage';
import Dashboard from '@/components/Dashboard';
import PendingApproval from '@/components/PendingApproval';
import AdminPanel from '@/components/AdminPanel';
import { sanitizeError, logError } from '@/lib/errorUtils';

interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  school: string;
  created_at: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  institution_name?: string;
  institution_address?: string;
  requested_at: string;
  rejection_reason?: string;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch teacher profile and admin status
          setTimeout(async () => {
            try {
              // Fetch teacher data
              const { data: teacherData, error: teacherError } = await supabase
                .from('teachers')
                .select('*')
                .eq('user_id', session.user.id)
                .single();

              if (teacherError && teacherError.code !== 'PGRST116') {
                logError('Index.fetchTeacher', teacherError);
                const { message } = sanitizeError(teacherError, 'fetch');
                toast.error(message);
              } else if (teacherData) {
                setTeacher(teacherData);
              }

              // Check if user is admin
              const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .eq('role', 'admin')
                .single();

              setIsAdmin(!!roleData);
            } catch (error) {
              logError('Index.fetchProfile', error);
            }
            setLoading(false);
          }, 0);
        } else {
          setTeacher(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setTeacher(null);
      toast.success("You have been successfully logged out");
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

  if (!user || !session) {
    return <AuthPage />;
  }

  if (!teacher) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Setting up your profile...</h2>
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
