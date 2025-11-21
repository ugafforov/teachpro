import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Building2, Mail, Phone, School } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PendingApprovalProps {
  teacher: {
    name: string;
    email: string;
    phone?: string;
    school?: string;
    institution_name?: string;
    institution_address?: string;
    requested_at: string;
  };
  onLogout: () => void;
}

const PendingApproval: React.FC<PendingApprovalProps> = ({ teacher, onLogout }) => {
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-white border border-gray-300 shadow-lg rounded-2xl p-8 animate-fade-in">
        <div className="text-center mb-6">
          <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-10 h-10 text-amber-600 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Tasdiqlanishni kutmoqda
          </h1>
          <p className="text-gray-600">
            Hisobingiz administrator tomonidan ko'rib chiqilmoqda
          </p>
        </div>

        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded">
          <p className="text-sm text-amber-800">
            <strong>Eslatma:</strong> Administrator sizning hisob ma'lumotlaringizni tekshirib, 
            tasdiqlashdan so'ng tizimga to'liq kirish huquqiga ega bo'lasiz. 
            Bu jarayon odatda 24-48 soat ichida amalga oshiriladi.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Yuborilgan ma'lumotlar:
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="w-5 h-5 text-gray-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 uppercase">Email</p>
                <p className="text-sm font-medium text-gray-900">{teacher.email}</p>
              </div>
            </div>

            {teacher.phone && (
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 uppercase">Telefon</p>
                  <p className="text-sm font-medium text-gray-900">{teacher.phone}</p>
                </div>
              </div>
            )}

            {teacher.school && (
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <School className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 uppercase">Maktab</p>
                  <p className="text-sm font-medium text-gray-900">{teacher.school}</p>
                </div>
              </div>
            )}

            {teacher.institution_name && (
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <Building2 className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 uppercase">Muassasa</p>
                  <p className="text-sm font-medium text-gray-900">{teacher.institution_name}</p>
                </div>
              </div>
            )}
          </div>

          {teacher.institution_address && (
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <Building2 className="w-5 h-5 text-gray-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 uppercase">Manzil</p>
                <p className="text-sm font-medium text-gray-900">{teacher.institution_address}</p>
              </div>
            </div>
          )}

          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Yuborilgan vaqt</p>
            <p className="text-sm font-medium text-gray-900">
              {new Date(teacher.requested_at).toLocaleDateString('uz-UZ', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="border-gray-300 hover:bg-gray-100"
          >
            Chiqish
          </Button>
        </div>
      </Card>
    </main>
  );
};

export default PendingApproval;
