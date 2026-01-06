import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, RefreshCw, Shield, Database, Users, Search, FileSpreadsheet } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  writeBatch,
  doc,
  updateDoc
} from 'firebase/firestore';
import { toast } from 'sonner';
import DataAnomalyChecker from './DataAnomalyChecker';
import BatchDataEntry from './BatchDataEntry';

interface DataIntegrityManagerProps {
  teacherId: string;
}

interface AuditResult {
  totalStudents: number;
  studentsWithInvalidGroup: number;
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
      // Fetch all students and groups for the teacher
      const [studentsSnap, groupsSnap] = await Promise.all([
        getDocs(query(collection(db, 'students'), where('teacher_id', '==', teacherId), where('is_active', '==', true))),
        getDocs(query(collection(db, 'groups'), where('teacher_id', '==', teacherId), where('is_active', '==', true)))
      ]);

      const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const groupNames = new Set(groupsSnap.docs.map(d => d.data().name));

      let invalidCount = 0;
      const affectedGroups = new Set<string>();

      students.forEach(student => {
        if (!student.group_name || !groupNames.has(student.group_name)) {
          invalidCount++;
          if (student.group_name) affectedGroups.add(student.group_name);
        }
      });

      // Get counts for other collections
      const [attendanceCount, rewardCount, examCount] = await Promise.all([
        getCountFromServer(query(collection(db, 'attendance_records'), where('teacher_id', '==', teacherId))),
        getCountFromServer(query(collection(db, 'reward_penalty_history'), where('teacher_id', '==', teacherId))),
        getCountFromServer(query(collection(db, 'exam_results'), where('teacher_id', '==', teacherId)))
      ]);

      setAuditResult({
        totalStudents: students.length,
        studentsWithInvalidGroup: invalidCount,
        studentsFixed: 0,
        groupsAffected: Array.from(affectedGroups),
        attendanceRecords: attendanceCount.data().count,
        rewardPenaltyRecords: rewardCount.data().count,
        examResults: examCount.data().count
      });

      setLastAuditTime(new Date());
      toast.success(invalidCount > 0 ? `${invalidCount} ta o'quvchida guruh muammosi aniqlandi` : 'Barcha ma\'lumotlar to\'g\'ri!');
    } catch (error) {
      console.error('Audit error:', error);
      toast.error('Audit bajarilmadi');
    } finally {
      setLoading(false);
    }
  };

  const fixGroupLinks = async () => {
    toast.info('Firestore-da guruh bog\'lanishlari guruh nomi orqali amalga oshiriladi. Iltimos, o\'quvchi ma\'lumotlarini tahrirlang.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Ma'lumotlar Yaxlitligi
          </h2>
          <p className="text-muted-foreground">Ma'lumotlar bazasini tekshirish, anomaliyalarni aniqlash va tuzatish</p>
        </div>
      </div>

      <Tabs defaultValue="integrity" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="integrity" className="flex items-center gap-2"><Shield className="w-4 h-4" />Yaxlitlik</TabsTrigger>
          <TabsTrigger value="anomaly" className="flex items-center gap-2"><Search className="w-4 h-4" />Anomaliya</TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />Batch kiritish</TabsTrigger>
        </TabsList>

        <TabsContent value="integrity" className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={runAudit} disabled={loading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Audit bajarish
            </Button>
          </div>

          {lastAuditTime && <p className="text-sm text-muted-foreground">Oxirgi tekshiruv: {lastAuditTime.toLocaleString('uz-UZ')}</p>}

          {auditResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
                  <div><p className="text-2xl font-bold">{auditResult.totalStudents}</p><p className="text-sm text-muted-foreground">Jami o'quvchilar</p></div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${auditResult.studentsWithInvalidGroup > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                    {auditResult.studentsWithInvalidGroup > 0 ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <CheckCircle className="w-5 h-5 text-green-600" />}
                  </div>
                  <div><p className="text-2xl font-bold">{auditResult.studentsWithInvalidGroup}</p><p className="text-sm text-muted-foreground">Noto'g'ri guruhli</p></div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Database className="w-5 h-5 text-purple-600" /></div>
                  <div><p className="text-2xl font-bold">{auditResult.attendanceRecords}</p><p className="text-sm text-muted-foreground">Davomat yozuvlari</p></div>
                </div>
              </Card>
            </div>
          )}

          {auditResult && auditResult.groupsAffected.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Ta'sirlangan guruhlar:</h3>
              <div className="flex flex-wrap gap-2">{auditResult.groupsAffected.map((group, index) => <Badge key={index} variant="secondary">{group}</Badge>)}</div>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-600" />Avtomatik himoya</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Yangi o'quvchi qo'shilganda guruh nomi tekshiriladi</li>
                <li>✓ O'quvchi tahrirlanganda guruh nomi sinxronlanadi</li>
                <li>✓ Import qilinganda guruh nomi avtomatik bog'lanadi</li>
              </ul>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-yellow-600" />Ma'lumotlar statistikasi</h3>
              {auditResult ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>📊 Davomat yozuvlari: {auditResult.attendanceRecords}</li>
                  <li>🏆 Mukofot/Jarima yozuvlari: {auditResult.rewardPenaltyRecords}</li>
                  <li>📝 Imtihon natijalari: {auditResult.examResults}</li>
                </ul>
              ) : <p className="text-sm text-muted-foreground">Audit bajarib statistikani ko'ring</p>}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="anomaly"><DataAnomalyChecker teacherId={teacherId} /></TabsContent>
        <TabsContent value="batch"><BatchDataEntry teacherId={teacherId} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default DataIntegrityManager;
