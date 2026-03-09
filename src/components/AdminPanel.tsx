import React, { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Mail,
  Phone,
  School,
  Calendar,
  LogOut,
} from "lucide-react";
import { formatDateUz } from "@/lib/utils";
import { sanitizeError, logError } from "@/lib/errorUtils";
import AIAnalysisPage from "./AIAnalysisPage";
import {
  normalizeTeacherProfile,
  TeacherProfile,
  TeacherVerificationStatus,
} from "@/lib/teacherProfile";

interface AdminPanelProps {
  adminId: string;
  onLogout?: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ adminId, onLogout }) => {
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<{
    [key: string]: string;
  }>({});
  const { toast } = useToast();

  const fetchTeachers = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "teachers"));
      setTeachers(
        snapshot.docs
          .map((d) =>
            normalizeTeacherProfile(
              d.id,
              d.data() as Record<string, unknown>,
            ),
          )
          .sort(
            (a, b) =>
              new Date(b.requested_at || b.created_at).getTime() -
              new Date(a.requested_at || a.created_at).getTime(),
          ),
      );
    } catch (error: unknown) {
      logError("AdminPanel.fetchTeachers", error);
      const { message } = sanitizeError(error, "fetch");
      toast({ title: "Xatolik", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchTeachers();
  }, [fetchTeachers]);

  const handleApprove = async (teacherId: string) => {
    try {
      await updateDoc(doc(db, "teachers", teacherId), {
        verification_status: "approved",
        is_approved: true,
        approved_at: serverTimestamp(),
        rejection_reason: null,
      });
      toast({
        title: "Tasdiqlandi",
        description: "O'qituvchi muvaffaqiyatli tasdiqlandi",
      });
      await fetchTeachers();
    } catch (error: unknown) {
      logError("AdminPanel.handleApprove", error);
      const { message } = sanitizeError(error, "update");
      toast({ title: "Xatolik", description: message, variant: "destructive" });
    }
  };

  const handleReject = async (teacherId: string) => {
    const reason = rejectionReason[teacherId];
    if (!reason || reason.trim() === "") {
      toast({
        title: "Sabab talab qilinadi",
        description: "Rad etish sababini kiriting",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateDoc(doc(db, "teachers", teacherId), {
        verification_status: "rejected",
        is_approved: false,
        rejection_reason: reason,
        approved_at: null,
      });
      toast({
        title: "Rad etildi",
        description: "O'qituvchi arizasi rad etildi",
      });
      setRejectionReason({ ...rejectionReason, [teacherId]: "" });
      await fetchTeachers();
    } catch (error: unknown) {
      logError("AdminPanel.handleReject", error);
      const { message } = sanitizeError(error, "update");
      toast({ title: "Xatolik", description: message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: TeacherVerificationStatus) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-amber-500">
            <Clock className="w-3 h-3 mr-1" />
            Kutilmoqda
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Tasdiqlangan
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500">
            <XCircle className="w-3 h-3 mr-1" />
            Rad etilgan
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingTeachers = teachers.filter(
    (t) => t.verification_status === "pending",
  );
  const approvedTeachers = teachers.filter(
    (t) => t.verification_status === "approved",
  );
  const rejectedTeachers = teachers.filter(
    (t) => t.verification_status === "rejected",
  );

  return (
    <main className="container mx-auto p-4 sm:p-6 max-w-7xl">
      <div className="mb-6 sm:mb-8 flex items-start justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">
          Admin Panel
        </h1>
        {onLogout && (
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Chiqish
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6 sm:mb-8">
        O'qituvchilarni tasdiqlash va boshqarish
      </p>

      <div className="mb-10">
        <AIAnalysisPage role="admin" currentUserId={adminId} />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card className="p-3 sm:p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between gap-1">
            <div>
              <p className="text-xs sm:text-sm text-amber-600 font-medium">
                Kutilmoqda
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-amber-700">
                {pendingTeachers.length}
              </p>
            </div>
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500 flex-shrink-0" />
          </div>
        </Card>
        <Card className="p-3 sm:p-4 bg-green-50 border-green-200">
          <div className="flex items-center justify-between gap-1">
            <div>
              <p className="text-xs sm:text-sm text-green-600 font-medium">
                Tasdiqlangan
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-green-700">
                {approvedTeachers.length}
              </p>
            </div>
            <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
          </div>
        </Card>
        <Card className="p-3 sm:p-4 bg-red-50 border-red-200">
          <div className="flex items-center justify-between gap-1">
            <div>
              <p className="text-xs sm:text-sm text-red-600 font-medium">
                Rad etilgan
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-red-700">
                {rejectedTeachers.length}
              </p>
            </div>
            <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 flex-shrink-0" />
          </div>
        </Card>
      </div>

      {pendingTeachers.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">
            Kutilayotgan arizalar
          </h2>
          <div className="space-y-4">
            {pendingTeachers.map((teacher) => (
              <Card
                key={teacher.id}
                className="p-4 sm:p-6 border-amber-200 bg-amber-50/30"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-foreground">
                      {teacher.name}
                    </h3>
                    {getStatusBadge(teacher.verification_status)}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-4 h-4 inline flex-shrink-0" />
                    <span>{formatDateUz(teacher.requested_at)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4">
                  <div className="flex items-center space-x-2 text-sm min-w-0">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-foreground truncate">
                      {teacher.email}
                    </span>
                  </div>
                  {teacher.phone && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground">{teacher.phone}</span>
                    </div>
                  )}
                  {teacher.school && (
                    <div className="flex items-center space-x-2 text-sm min-w-0">
                      <School className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground truncate">
                        {teacher.school}
                      </span>
                    </div>
                  )}
                  {teacher.institution_name && (
                    <div className="flex items-center space-x-2 text-sm min-w-0">
                      <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground truncate">
                        {teacher.institution_name}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col space-y-3">
                  <Textarea
                    placeholder="Rad etish sababi (majburiy)"
                    value={rejectionReason[teacher.id] || ""}
                    onChange={(e) =>
                      setRejectionReason({
                        ...rejectionReason,
                        [teacher.id]: e.target.value,
                      })
                    }
                    className="min-h-[80px]"
                  />
                  <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
                    <Button
                      onClick={() => handleApprove(teacher.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Tasdiqlash
                    </Button>
                    <Button
                      onClick={() => handleReject(teacher.id)}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Rad etish
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {approvedTeachers.length > 0 && (
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">
              Tasdiqlangan o'qituvchilar
            </h2>
            <div className="space-y-3">
              {approvedTeachers.map((teacher) => (
                <Card
                  key={teacher.id}
                  className="p-4 border-green-200 bg-green-50/30"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {teacher.name}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {teacher.email}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(teacher.verification_status)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
        {rejectedTeachers.length > 0 && (
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">
              Rad etilgan arizalar
            </h2>
            <div className="space-y-3">
              {rejectedTeachers.map((teacher) => (
                <Card
                  key={teacher.id}
                  className="p-4 border-red-200 bg-red-50/30"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {teacher.name}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {teacher.email}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(teacher.verification_status)}
                    </div>
                  </div>
                  {teacher.rejection_reason && (
                    <p className="text-xs text-red-600 mt-2">
                      <strong>Sabab:</strong> {teacher.rejection_reason}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default AdminPanel;
