import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Shield, User, School, Mail, Phone } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface Teacher {
  name: string;
  email: string;
  phone: string;
  school: string;
  registeredAt: string;
}

interface AuthGuardProps {
  children: React.ReactNode;
  onAuthenticated: (teacher: Teacher) => void;
}

const MASTER_PASSWORD = "TeachPro2024!";

const AuthGuard: React.FC<AuthGuardProps> = ({ children, onAuthenticated }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [teacher, setTeacher] = useState<Teacher>({
    name: '',
    email: '',
    phone: '',
    school: '',
    registeredAt: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    const savedTeacher = localStorage.getItem('teacherProfile');
    if (savedTeacher) {
      const teacherData = JSON.parse(savedTeacher);
      setTeacher(teacherData);
      setIsRegistered(true);
      setIsAuthenticated(true);
      onAuthenticated(teacherData);
    }
  }, [onAuthenticated]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === MASTER_PASSWORD) {
      if (isRegistered) {
        setIsAuthenticated(true);
        onAuthenticated(teacher);
      } else {
        setIsAuthenticated(true);
      }
      toast({
        title: "Access Granted",
        description: isRegistered ? "Welcome back!" : "Please complete your registration",
      });
    } else {
      toast({
        title: "Access Denied",
        description: "Invalid password. Please contact your administrator.",
        variant: "destructive",
      });
    }
  };

  const handleRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher.name || !teacher.email || !teacher.school) {
      toast({
        title: "Incomplete Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const teacherData = {
      ...teacher,
      registeredAt: new Date().toISOString()
    };

    localStorage.setItem('teacherProfile', JSON.stringify(teacherData));
    setIsRegistered(true);
    onAuthenticated(teacherData);
    toast({
      title: "Registration Complete",
      description: "Welcome to TeachPro! You can now access all features.",
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md apple-card p-8 animate-fade-in">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">TeachPro</h1>
            <p className="text-muted-foreground">Secure access for teachers only</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Access Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your access password"
                  className="pr-10"
                  required
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Parolni {showPassword ? "yashirish" : "ko'rsatish"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="submit" className="w-full apple-button">
                  Access Platform
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tizimga kirish</TooltipContent>
            </Tooltip>
          </form>
        </Card>
      </div>
    );
  }

  if (isAuthenticated && !isRegistered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg apple-card p-8 animate-slide-up">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">Complete Your Profile</h1>
            <p className="text-muted-foreground">Please provide your details to get started</p>
          </div>

          <form onSubmit={handleRegistration} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                value={teacher.name}
                onChange={(e) => setTeacher({ ...teacher, name: e.target.value })}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={teacher.email}
                  onChange={(e) => setTeacher({ ...teacher, email: e.target.value })}
                  placeholder="your.email@school.edu"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={teacher.phone}
                  onChange={(e) => setTeacher({ ...teacher, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school">School/Institution *</Label>
              <div className="relative">
                <School className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="school"
                  type="text"
                  value={teacher.school}
                  onChange={(e) => setTeacher({ ...teacher, school: e.target.value })}
                  placeholder="Your school or institution name"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="submit" className="w-full apple-button">
                  Complete Registration
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ro'yxatdan o'tishni yakunlash</TooltipContent>
            </Tooltip>
          </form>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;
