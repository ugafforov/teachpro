import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Building2, Mail, Phone, School } from 'lucide-react';
import { firebaseSignOut } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { formatDateUz } from '@/lib/utils';

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
    await firebaseSignOut();
    onLogout();
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-card border border-border shadow-lg rounded-2xl p-8 animate-fade-in">
        <div className="text-center mb-6">
          <div className="mx-auto w-20 h-20 bg-amber-500/20 dark:bg-amber-400/20 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Tasdiqlanishni kutmoqda
          </h1>
          <p className="text-muted-foreground">
            Hisobingiz administrator tomonidan ko'rib chiqilmoqda
          </p>
        </div>

        <div className="bg-amber-500/10 dark:bg-amber-400/10 border-l-4 border-amber-500 dark:border-amber-400 p-4 mb-6 rounded">
          <p className="text-sm text-foreground">
            <strong>Eslatma:</strong> Administrator sizning hisob ma'lumotlaringizni tekshirib,
            tasdiqlashdan so'ng tizimga to'liq kirish huquqiga ega bo'lasiz.
            Bu jarayon odatda 24-48 soat ichida amalga oshiriladi.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Yuborilgan ma'lumotlar:
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
              <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase">Email</p>
                <p className="text-sm font-medium text-foreground">{teacher.email}</p>
              </div>
            </div>

            {teacher.phone && (
              <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Telefon</p>
                  <p className="text-sm font-medium text-foreground">{teacher.phone}</p>
                </div>
              </div>
            )}

            {teacher.school && (
              <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                <School className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Maktab</p>
                  <p className="text-sm font-medium text-foreground">{teacher.school}</p>
                </div>
              </div>
            )}

            {teacher.institution_name && (
              <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                <Building2 className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Muassasa</p>
                  <p className="text-sm font-medium text-foreground">{teacher.institution_name}</p>
                </div>
              </div>
            )}
          </div>

          {teacher.institution_address && (
            <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
              <Building2 className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase">Manzil</p>
                <p className="text-sm font-medium text-foreground">{teacher.institution_address}</p>
              </div>
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase mb-1">Yuborilgan vaqt</p>
            <p className="text-sm font-medium text-foreground">
              {formatDateUz(teacher.requested_at)}
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-border"
          >
            Chiqish
          </Button>
        </div>
      </Card>
    </main>
  );
};

export default PendingApproval;
