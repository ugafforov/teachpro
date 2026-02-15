import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getTashkentDate } from '@/lib/utils';
import { Eye, EyeOff, User, School, Mail, Phone, Building2, MapPin } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { firebaseSignIn, firebaseSignUp, db, addDocument } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { sanitizeError, logError } from '@/lib/errorUtils';

const AuthPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    school: '',
    phone: '',
    institution_name: '',
    institution_address: ''
  });
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null); // Xatolikni tozalash

    try {
      const result = await firebaseSignIn(formData.email, formData.password);

      if (result.user) {
        toast({
          title: "Xush kelibsiz!",
          description: "Tizimga muvaffaqiyatli kirdingiz.",
        });
      }
    } catch (error: unknown) {
      logError('AuthPage.handleSignIn', error);
      const { message } = sanitizeError(error, 'auth');
      setLoginError(message); // Xatolikni saqlash
      toast({
        title: "Kirish muvaffaqiyatsiz",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null); // Xatolikni tozalash

    if (!formData.name || !formData.school || !formData.institution_name) {
      const errorMsg = "Iltimos, barcha majburiy maydonlarni to'ldiring.";
      setLoginError(errorMsg);
      toast({
        title: "Ma'lumot yetishmayapti",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const result = await firebaseSignUp(formData.email, formData.password);

      if (result.user) {
        // Create teacher document in Firestore
        await setDoc(doc(db, 'teachers', result.user.uid), {
          id: result.user.uid,
          email: formData.email,
          name: formData.name,
          school: formData.school,
          phone: formData.phone,
          institution_name: formData.institution_name,
          institution_address: formData.institution_address,
          is_approved: false,
          created_at: getTashkentDate().toISOString()
        });

        toast({
          title: "Ariza yuborildi",
          description: "Hisobingiz administratorlar tomonidan ko'rib chiqiladi. Bu 24-48 soat ichida amalga oshiriladi.",
        });
      }
    } catch (error: unknown) {
      logError('AuthPage.handleSignUp', error);
      const { message } = sanitizeError(error, 'auth');
      setLoginError(message);
      toast({
        title: "Ro'yxatdan o'tish muvaffaqiyatsiz",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-lg bg-card border border-border shadow-lg rounded-2xl p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            {authMode === 'signin' ? 'Xush kelibsiz' : 'TeachPro ga qo\'shiling'}
          </h1>
          <p className="text-muted-foreground">
            {authMode === 'signin'
              ? 'O\'qituvchi hisobingizga kiring'
              : 'O\'qituvchi hisobingizni yarating'
            }
          </p>
        </div>

        <div className="flex mb-6 bg-muted rounded-xl p-1">
          <button
            onClick={() => setAuthMode('signin')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${authMode === 'signin'
                ? 'bg-background text-foreground shadow-sm dark:bg-card'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Kirish
          </button>
          <button
            onClick={() => setAuthMode('signup')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${authMode === 'signup'
                ? 'bg-background text-foreground shadow-sm dark:bg-card'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Ro'yxatdan o'tish
          </button>
        </div>

        <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
          {/* Xatolik xabarini ko'rsatish */}
          {loginError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {loginError}
              </div>
            </div>
          )}
          {authMode === 'signup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">To'liq ism *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="To'liq ismingizni kiriting"
                  className="border-border"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school" className="text-foreground">Maktab/Muassasa *</Label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="school"
                    type="text"
                    value={formData.school}
                    onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                    placeholder="Maktab yoki muassasa nomi"
                    className="pl-10 border-border"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground">Telefon raqam</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998 (90) 123-45-67"
                    className="pl-10 border-border"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="institution_name" className="text-foreground">Muassasa nomi *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="institution_name"
                    type="text"
                    value={formData.institution_name}
                    onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
                    placeholder="Ta'lim muassasasi nomi"
                    className="pl-10 border-border"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="institution_address" className="text-foreground">Muassasa manzili</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="institution_address"
                    type="text"
                    value={formData.institution_address}
                    onChange={(e) => setFormData({ ...formData, institution_address: e.target.value })}
                    placeholder="Shahar, ko'cha, bino"
                    className="pl-10 border-border"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email manzil</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setLoginError(null);
                }}
                placeholder="sizning.email@maktab.uz"
                className={`pl-10 border-border ${loginError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">Parol</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  setLoginError(null);
                }}
                placeholder="Parolingizni kiriting"
                className={`pr-10 border-border ${loginError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground min-w-[24px] min-h-[24px] flex items-center justify-center"
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {authMode === 'signin' && (
              <p className="text-xs text-muted-foreground mt-1">
                Kamida 6 ta belgidan iborat parol kiriting
              </p>
            )}
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:opacity-90 rounded-xl py-2.5">
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                <span>{authMode === 'signin' ? 'Kirilmoqda...' : 'Hisob yaratilmoqda...'}</span>
              </div>
            ) : (
              authMode === 'signin' ? 'Kirish' : 'Hisob yaratish'
            )}
          </Button>
        </form>
      </Card>
    </main>
  );
};

export default AuthPage;
