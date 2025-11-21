
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, User, School, Mail, Phone, Building2, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const AuthPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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
    
    if (!formData.name || !formData.school || !formData.institution_name) {
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
            phone: formData.phone,
            institution_name: formData.institution_name,
            institution_address: formData.institution_address
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        toast({
          title: "Ariza yuborildi",
          description: "Hisobingiz administratorlar tomonidan ko'rib chiqiladi. Bu 24-48 soat ichida amalga oshiriladi.",
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

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-white border border-gray-300 shadow-lg rounded-2xl p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-black mb-2">
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
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            Kirish
          </button>
          <button
            onClick={() => setAuthMode('signup')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              authMode === 'signup'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            Ro'yxatdan o'tish
          </button>
        </div>

        <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
          {authMode === 'signup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-black">To'liq ism *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="To'liq ismingizni kiriting"
                  className="border-gray-300 focus:border-black focus:ring-black"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school" className="text-black">Maktab/Muassasa *</Label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="school"
                    type="text"
                    value={formData.school}
                    onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                    placeholder="Maktab yoki muassasa nomi"
                    className="pl-10 border-gray-300 focus:border-black focus:ring-black"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-black">Telefon raqam</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998 (90) 123-45-67"
                    className="pl-10 border-gray-300 focus:border-black focus:ring-black"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="institution_name" className="text-black">Muassasa nomi *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="institution_name"
                    type="text"
                    value={formData.institution_name}
                    onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
                    placeholder="Ta'lim muassasasi nomi"
                    className="pl-10 border-gray-300 focus:border-black focus:ring-black"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="institution_address" className="text-black">Muassasa manzili</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="institution_address"
                    type="text"
                    value={formData.institution_address}
                    onChange={(e) => setFormData({ ...formData, institution_address: e.target.value })}
                    placeholder="Shahar, ko'cha, bino"
                    className="pl-10 border-gray-300 focus:border-black focus:ring-black"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-black">Email manzil</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="sizning.email@maktab.uz"
                className="pl-10 border-gray-300 focus:border-black focus:ring-black"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-black">Parol</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Parolingizni kiriting"
                className="pr-10 border-gray-300 focus:border-black focus:ring-black"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-black"
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-black hover:bg-gray-800 text-white rounded-xl py-2.5">
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
