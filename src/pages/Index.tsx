
import React, { useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Dashboard from '@/components/Dashboard';

interface Teacher {
  name: string;
  email: string;
  phone: string;
  school: string;
  registeredAt: string;
}

const Index = () => {
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);

  const handleAuthenticated = (teacher: Teacher) => {
    setCurrentTeacher(teacher);
  };

  const handleLogout = () => {
    localStorage.removeItem('teacherProfile');
    setCurrentTeacher(null);
    window.location.reload();
  };

  return (
    <AuthGuard onAuthenticated={handleAuthenticated}>
      {currentTeacher && (
        <Dashboard teacher={currentTeacher} onLogout={handleLogout} />
      )}
    </AuthGuard>
  );
};

export default Index;
