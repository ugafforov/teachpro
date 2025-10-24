
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import AuthPage from '@/components/AuthPage';
import Dashboard from '@/components/Dashboard';

interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  school: string;
  created_at: string;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch teacher profile
          setTimeout(async () => {
            try {
              const { data: teacherData, error } = await supabase
                .from('teachers')
                .select('*')
                .eq('user_id', session.user.id)
                .single();

              if (error && error.code !== 'PGRST116') {
                console.error('Error fetching teacher:', error);
                toast({
                  title: "Error",
                  description: "Failed to load teacher profile",
                  variant: "destructive",
                });
              } else if (teacherData) {
                setTeacher(teacherData);
              }
            } catch (error) {
              console.error('Error fetching teacher profile:', error);
            }
            setLoading(false);
          }, 0);
        } else {
          setTeacher(null);
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
  }, [toast]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setTeacher(null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !session) {
    return <AuthPage />;
  }

  if (!teacher) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Setting up your profile...</h2>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return <Dashboard teacherId={teacher.id} teacherName={teacher.name} onLogout={handleLogout} />;
};

export default Index;
