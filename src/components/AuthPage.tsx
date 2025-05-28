
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Shield, User, School, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Developer access password (faqat developer uchun ko'rinadi)
const MASTER_PASSWORD = "TeachPro2024!";

const AuthPage: React.FC = () => {
  const [step, setStep] = useState<'password' | 'auth'>('password');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    school: '',
    phone: ''
  });
  const { toast } = useToast();

  const handleMasterPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword === MASTER_PASSWORD) {
      setStep('auth');
      toast({
        title: "Kirish ruxsat berildi",
        description: "TeachPro ga xush kelibsiz! Iltimos, tizimga kiring yoki hisob yarating.",
      });
    } else {
      toast({
        title: "Kirish rad etildi",
        description: "Noto'g'ri parol. Administrator bilan bog'laning.",
        variant: "destructive",
      });
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      if (data.user) {
        toast({
          title: "Xush kelibsiz!",
          description: "Tizimga muvaffaqiyatli kirdingiz.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Kirish muvaffaqiyatsiz",
        description: error.message || "Noto'g'ri email yoki parol",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.school) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Iltimos, barcha majburiy maydonlarni to'ldiring.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            school: formData.school,
            phone: formData.phone
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        toast({
          title: "Hisob yaratildi",
          description: "TeachPro ga xush kelibsiz! Hisobingiz muvaffaqiyatli yaratildi.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Ro'yxatdan o'tish muvaffaqiyatsiz",
        description: error.message || "Hisob yaratishda xatolik",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === 'password') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg rounded-2xl p-8 animate-fade-in">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">TeachPro</h1>
            <p className="text-gray-600">Faqat o'qituvchilar uchun xavfsiz kirish</p>
          </div>

          <form onSubmit={handleMasterPasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="masterPassword" className="text-gray-700">Kirish paroli</Label>
              <div className="relative">
                <Input
                  id="masterPassword"
                  type={showPassword ? "text" : "password"}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Kirish parolini kiriting"
                  className="pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5">
              Platformaga kirish
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg rounded-2xl p-8 animate-slide-up">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            {authMode === 'signin' ? 'Xush kelibsiz' : 'TeachPro ga qo\'shiling'}
          </h1>
          <p className="text-gray-600">
            {authMode === 'signin' 
              ? 'O\'qituvchi hisobingizga kiring' 
              : 'O\'qituvchi hisobingizni yarating'
            }
          </p>
        </div>

        <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setAuthMode('signin')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              authMode === 'signin'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Kirish
          </button>
          <button
            onClick={() => setAuthMode('signup')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              authMode === 'signup'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Ro'yxatdan o'tish
          </button>
        </div>

        <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
          {authMode === 'signup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700">To'liq ism *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="To'liq ismingizni kiriting"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school" className="text-gray-700">Maktab/Muassasa *</Label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="school"
                    type="text"
                    value={formData.school}
                    onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                    placeholder="Maktab yoki muassasa nomi"
                    className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-gray-700">Telefon raqam</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998 (90) 123-45-67"
                    className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700">Email manzil</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="sizning.email@maktab.uz"
                className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-700">Parol</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Parolingizni kiriting"
                className="pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5">
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>{authMode === 'signin' ? 'Kirilmoqda...' : 'Hisob yaratilmoqda...'}</span>
              </div>
            ) : (
              authMode === 'signin' ? 'Kirish' : 'Hisob yaratish'
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default AuthPage;
