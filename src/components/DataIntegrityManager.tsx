import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, RefreshCw, Shield, Database, Users, Search, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DataAnomalyChecker from './DataAnomalyChecker';
import BatchDataEntry from './BatchDataEntry';

interface DataIntegrityManagerProps {
  teacherId: string;
}

interface AuditResult {
  totalStudents: number;
  studentsWithNullGroupId: number;
  studentsFixed: number;
  groupsAffected: string[];
  attendanceRecords: number;
  rewardPenaltyRecords: number;
  examResults: number;
}

const DataIntegrityManager: React.FC<DataIntegrityManagerProps> = ({ teacherId }) => {
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [lastAuditTime, setLastAuditTime] = useState<Date | null>(null);

  const runAudit = async () => {
    setLoading(true);
    try {
      // Run the audit function
      const { data: auditData, error: auditError } = await supabase
        .rpc('audit_student_group_links', { p_teacher_id: teacherId });

      if (auditError) throw auditError;

      // Get additional stats
      const [attendanceRes, rewardRes, examRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', teacherId),
        supabase
          .from('reward_penalty_history')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', teacherId),
        supabase
          .from('exam_results')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', teacherId)
      ]);

      // Handle array response from RPC
      const resultArray = Array.isArray(auditData) ? auditData : [auditData];
      const result = resultArray[0];
      
      setAuditResult({
        totalStudents: Number(result?.total_students || 0),
        studentsWithNullGroupId: Number(result?.students_with_null_group_id || 0),
        studentsFixed: Number(result?.students_fixed || 0),
        groupsAffected: result?.groups_affected || [],
        attendanceRecords: attendanceRes.count || 0,
        rewardPenaltyRecords: rewardRes.count || 0,
        examResults: examRes.count || 0
      });
      
      setLastAuditTime(new Date());

      if (Number(result?.students_fixed || 0) > 0) {
        toast.success(`${result.students_fixed} ta o'quvchi guruh bog'lanishi tuzatildi!`);
      } else {
        toast.success('Barcha ma\'lumotlar to\'g\'ri!');
      }
    } catch (error) {
      console.error('Audit error:', error);
      toast.error('Audit bajarilmadi');
    } finally {
      setLoading(false);
    }
  };

  const fixGroupLinks = async () => {
    setLoading(true);
    try {
      // Update students with NULL group_id but valid group_name
      const { data, error } = await supabase
        .from('students')
        .select('id, group_name, teacher_id')
        .eq('teacher_id', teacherId)
        .is('group_id', null)
        .not('group_name', 'is', null);

      if (error) throw error;

      let fixedCount = 0;
      
      for (const student of data || []) {
        // Find the matching group
        const { data: group } = await supabase
          .from('groups')
          .select('id')
          .eq('name', student.group_name)
          .eq('teacher_id', teacherId)
          .eq('is_active', true)
          .maybeSingle();

        if (group) {
          await supabase
            .from('students')
            .update({ group_id: group.id })
            .eq('id', student.id);
          fixedCount++;
        }
      }

      if (fixedCount > 0) {
        toast.success(`${fixedCount} ta o'quvchi guruh bog'lanishi tuzatildi!`);
      } else {
        toast.info('Tuzatish kerak bo\'lgan o\'quvchi topilmadi');
      }

      // Re-run audit to update stats
      await runAudit();
    } catch (error) {
      console.error('Fix error:', error);
      toast.error('Tuzatish bajarilmadi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Ma'lumotlar Yaxlitligi
          </h2>
          <p className="text-muted-foreground">
            Ma'lumotlar bazasini tekshirish, anomaliyalarni aniqlash va tuzatish
          </p>
        </div>
      </div>

      <Tabs defaultValue="integrity" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="integrity" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Yaxlitlik
          </TabsTrigger>
          <TabsTrigger value="anomaly" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Anomaliya
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Batch kiritish
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrity" className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={runAudit}
              disabled={loading}
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Audit bajarish
            </Button>
            <Button
              onClick={fixGroupLinks}
              disabled={loading}
            >
              <Database className="w-4 h-4 mr-2" />
              Guruh bog'lanishlarini tuzatish
            </Button>
          </div>

          {lastAuditTime && (
            <p className="text-sm text-muted-foreground">
              Oxirgi tekshiruv: {lastAuditTime.toLocaleString('uz-UZ')}
            </p>
          )}

          {auditResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{auditResult.totalStudents}</p>
                    <p className="text-sm text-muted-foreground">Jami o'quvchilar</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    auditResult.studentsWithNullGroupId > 0 ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                    {auditResult.studentsWithNullGroupId > 0 ? (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{auditResult.studentsWithNullGroupId}</p>
                    <p className="text-sm text-muted-foreground">Guruhsiz o'quvchilar</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{auditResult.studentsFixed}</p>
                    <p className="text-sm text-muted-foreground">Tuzatilgan</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Database className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{auditResult.attendanceRecords}</p>
                    <p className="text-sm text-muted-foreground">Davomat yozuvlari</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {auditResult && auditResult.groupsAffected.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Ta'sirlangan guruhlar:</h3>
              <div className="flex flex-wrap gap-2">
                {auditResult.groupsAffected.map((group, index) => (
                  <Badge key={index} variant="secondary">
                    {group}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Avtomatik himoya
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Yangi o'quvchi qo'shilganda group_id avtomatik to'ldiriladi</li>
                <li>✓ O'quvchi tahrirlanganda group_id sinxronlanadi</li>
                <li>✓ Import qilinganda group_id avtomatik bog'lanadi</li>
                <li>✓ Batch kiritish orqali tez ma'lumot tiklash</li>
              </ul>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Ma'lumotlar statistikasi
              </h3>
              {auditResult ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>📊 Davomat yozuvlari: {auditResult.attendanceRecords}</li>
                  <li>🏆 Mukofot/Jarima yozuvlari: {auditResult.rewardPenaltyRecords}</li>
                  <li>📝 Imtihon natijalari: {auditResult.examResults}</li>
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Audit bajarib statistikani ko'ring
                </p>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="anomaly">
          <DataAnomalyChecker teacherId={teacherId} />
        </TabsContent>

        <TabsContent value="batch">
          <BatchDataEntry teacherId={teacherId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataIntegrityManager;
