import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Upload, FileJson, CheckCircle, AlertCircle, Loader2, Shield, Database } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fetchAllRecordsForExport, calculateChecksum, validateImportData, logAuditEntry, ValidationResult } from '@/lib/firebaseHelpers';

interface DataManagerProps {
  teacherId: string;
}

interface UniversalExportData {
  exportDate: string;
  version: string;
  format: 'universal';
  sourceDatabase: string;
  checksum: string;
  metadata: {
    originalTeacherId: string;
    exportedBy: string;
    recordCounts: Record<string, number>;
  };
  data: {
    teachers: any[];
    students: any[];
    groups: any[];
    attendance_records: any[];
    reward_penalty_history: any[];
    exams: any[];
    exam_results: any[];
    exam_types: any[];
    student_scores: any[];
    archived_students: any[];
    archived_groups: any[];
    archived_exams: any[];
    deleted_students: any[];
    deleted_groups: any[];
    deleted_exams: any[];
    deleted_attendance_records: any[];
    deleted_reward_penalty_history: any[];
    deleted_student_scores: any[];
    deleted_exam_results: any[];
  };
}

interface LegacyExportData {
  exportDate: string;
  version: string;
  teacherId: string;
  checksum: string;
  recordCounts?: Record<string, number>;
  data: UniversalExportData['data'];
}

type ImportData = UniversalExportData | LegacyExportData;

const IMPORT_ORDER = [
  'groups',
  'exam_types',
  'students',
  'exams',
  'attendance_records',
  'reward_penalty_history',
  'student_scores',
  'exam_results',
  'archived_groups',
  'archived_students',
  'archived_exams',
  'deleted_groups',
  'deleted_students',
  'deleted_exams',
  'deleted_attendance_records',
  'deleted_reward_penalty_history',
  'deleted_student_scores',
  'deleted_exam_results',
];

const DELETE_ORDER = [...IMPORT_ORDER].reverse();

const DataManager: React.FC<DataManagerProps> = ({ teacherId }) => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [backupKey, setBackupKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    try {
      setExporting(true);
      setProgress(0);

      const tables = [
        'teachers', 'groups', 'exam_types', 'students', 'exams',
        'attendance_records', 'reward_penalty_history', 'exam_results',
        'student_scores', 'archived_students', 'archived_groups', 'archived_exams',
        'deleted_students', 'deleted_groups', 'deleted_exams',
        'deleted_attendance_records', 'deleted_reward_penalty_history',
        'deleted_student_scores', 'deleted_exam_results',
      ];

      const data: any = {};
      const recordCounts: Record<string, number> = {};

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        setProgress(Math.round((i / tables.length) * 100));
        setProgressMessage(`${table} yuklanmoqda...`);

        const tableData = await fetchAllRecordsForExport<any>(table, teacherId);
        data[table] = tableData;
        recordCounts[table] = tableData.length;
      }

      setProgress(100);
      const checksum = calculateChecksum(data);

      const exportObject: UniversalExportData = {
        exportDate: new Date().toISOString(),
        version: '3.0',
        format: 'universal',
        sourceDatabase: 'firebase-firestore',
        checksum,
        metadata: {
          originalTeacherId: teacherId,
          exportedBy: 'TeachPro v3.0',
          recordCounts
        },
        data
      };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Format: teachpro_backup_2024-01-07T14-30-45_1234-records.json
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const totalRecords = Object.values(data).reduce((sum: number, arr: any) => sum + (arr?.length || 0), 0);
      a.download = `teachpro_backup_${timestamp}_${totalRecords}-records.json`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Ma'lumotlar muvaffaqiyatli eksport qilindi!`, {
        description: `Jami ${totalRecords} ta yozuv yuklab olindi. Tekshirish kodi: ${checksum}`
      });

      // Log export operation
      await logAuditEntry({
        teacher_id: teacherId,
        action: 'export',
        details: {
          recordCounts,
          checksum,
          version: '3.0'
        },
        metadata: {
          userAgent: navigator.userAgent,
          fileSize: blob.size
        }
      });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Eksport qilishda xatolik yuz berdi');
    } finally {
      setExporting(false);
      setProgress(0);
      setProgressMessage('');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.version || !json.data) {
          toast.error('Noto\'g\'ri fayl formati', { description: 'Iltimos, TeachPro eksport faylini tanlang' });
          return;
        }
        setImportData(json);
        setShowImportDialog(true);
      } catch (error) {
        toast.error('Faylni o\'qishda xatolik', { description: 'JSON formati noto\'g\'ri' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const convertToTimestamp = (value: any) => {
    if (!value) return serverTimestamp();
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? serverTimestamp() : Timestamp.fromDate(date);
    }
    if (value && typeof value === 'object') {
      if (value.seconds !== undefined) return new Timestamp(value.seconds, value.nanoseconds || 0);
      if (value instanceof Date) return Timestamp.fromDate(value);
    }
    return serverTimestamp();
  };

  const performImport = async () => {
    if (!importData || !teacherId) return;

    try {
      setImporting(true);
      setShowImportDialog(false);
      setProgress(0);

      const { data: importDataContent } = importData;
      const idMaps: Record<string, Record<string, string>> = {
        groups: {}, exam_types: {}, students: {}, exams: {},
      };

      // 1-BOSQICH: O'chirish
      setProgressMessage("Mavjud ma'lumotlar o'chirilmoqda...");
      for (let i = 0; i < DELETE_ORDER.length; i++) {
        const table = DELETE_ORDER[i];
        setProgress(Math.round((i / DELETE_ORDER.length) * 20));
        const q = query(collection(db, table), where('teacher_id', '==', teacherId));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // 2-BOSQICH: Import
      let importStep = 0;
      const totalSteps = IMPORT_ORDER.length;

      for (const table of IMPORT_ORDER) {
        importStep++;
        setProgress(20 + Math.round((importStep / totalSteps) * 70));
        setProgressMessage(`${table} import qilinmoqda...`);

        const records = importDataContent[table as keyof typeof importDataContent];
        if (!records || records.length === 0) continue;

        // Batch processing for Firestore (max 500 per batch)
        for (let i = 0; i < records.length; i += 500) {
          const chunk = records.slice(i, i + 500);
          const batch = writeBatch(db);

          for (const record of chunk) {
            const newRecord = { ...record };
            const originalId = newRecord.id;
            delete newRecord.id;

            // FORCE current teacherId for EVERY record
            newRecord.teacher_id = teacherId;

            // Preserve timestamps
            newRecord.created_at = convertToTimestamp(record.created_at);
            if (record.updated_at) newRecord.updated_at = convertToTimestamp(record.updated_at);

            // ID Mapping logic for ALL tables
            if (newRecord.group_id && idMaps.groups[newRecord.group_id]) newRecord.group_id = idMaps.groups[newRecord.group_id];
            if (newRecord.exam_type_id && idMaps.exam_types[newRecord.exam_type_id]) newRecord.exam_type_id = idMaps.exam_types[newRecord.exam_type_id];
            if (newRecord.student_id && idMaps.students[newRecord.student_id]) newRecord.student_id = idMaps.students[newRecord.student_id];
            if (newRecord.exam_id && idMaps.exams[newRecord.exam_id]) newRecord.exam_id = idMaps.exams[newRecord.exam_id];

            let newDocRef;
            if (table === 'attendance_records') {
              const docId = `${newRecord.student_id}_${newRecord.date}`;
              newDocRef = doc(db, table, docId);
              batch.set(newDocRef, newRecord);
            } else {
              newDocRef = doc(collection(db, table));
              batch.set(newDocRef, newRecord);

              // Store new ID for mapping if this table can be a parent
              if (originalId) {
                if (table.includes('group')) idMaps.groups[originalId] = newDocRef.id;
                else if (table.includes('exam_type')) idMaps.exam_types[originalId] = newDocRef.id;
                else if (table.includes('student')) idMaps.students[originalId] = newDocRef.id;
                else if (table.includes('exam') && !table.includes('result')) idMaps.exams[originalId] = newDocRef.id;
              }
            }
          }
          await batch.commit();
        }
      }

      setProgress(100);
      toast.success("Ma'lumotlar muvaffaqiyatli import qilindi!");
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import qilishda xatolik yuz berdi');
    } finally {
      setImporting(false);
      setProgress(0);
      setProgressMessage('');
      setImportData(null);
    }
  };

  const getImportSummary = () => {
    if (!importData) return null;
    const { data, checksum } = importData;
    const version = importData.version || '1.0';
    const isUniversal = 'format' in importData && importData.format === 'universal';
    const sourceDb = isUniversal ? (importData as UniversalExportData).sourceDatabase : 'unknown';

    const archivedCount = (data.archived_students?.length || 0) + (data.archived_groups?.length || 0) + (data.archived_exams?.length || 0);
    const deletedCount = (data.deleted_students?.length || 0) + (data.deleted_groups?.length || 0) + (data.deleted_exams?.length || 0) + (data.deleted_attendance_records?.length || 0) + (data.deleted_reward_penalty_history?.length || 0) + (data.deleted_student_scores?.length || 0) + (data.deleted_exam_results?.length || 0);

    return {
      students: data.students?.length || 0,
      groups: data.groups?.length || 0,
      attendance: data.attendance_records?.length || 0,
      rewards: data.reward_penalty_history?.length || 0,
      exams: data.exams?.length || 0,
      examResults: data.exam_results?.length || 0,
      examTypes: data.exam_types?.length || 0,
      studentScores: data.student_scores?.length || 0,
      archivedCount,
      deletedCount,
      checksum: checksum || 'N/A',
      version,
      sourceDb,
      isUniversal
    };
  };

  const summary = getImportSummary();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Ma'lumotlarni boshqarish</h2>
        <p className="text-muted-foreground">Barcha ma'lumotlaringizni eksport yoki import qiling</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0"><Download className="w-6 h-6 text-green-600" /></div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Ma'lumotlarni eksport qilish</h3>
              <p className="text-sm text-muted-foreground mb-4">Barcha o'quvchilar, guruhlar, davomat va boshqa ma'lumotlarni bitta JSON faylga yuklab oling</p>
              {exporting && <div className="mb-4"><Progress value={progress} className="h-2" /><p className="text-xs text-muted-foreground mt-1">{progress}% - {progressMessage}</p></div>}
              <Button onClick={exportData} disabled={exporting} className="w-full bg-green-600 hover:bg-green-700">{exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Eksport qilinmoqda...</> : <><Download className="w-4 h-4 mr-2" />Eksport qilish</>}</Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0"><Upload className="w-6 h-6 text-blue-600" /></div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Ma'lumotlarni import qilish</h3>
              <p className="text-sm text-muted-foreground mb-4">Oldin eksport qilingan JSON fayldan ma'lumotlarni tiklang</p>
              {importing && <div className="mb-4"><Progress value={progress} className="h-2" /><p className="text-xs text-muted-foreground mt-1">{progress}% - {progressMessage}</p></div>}
              <input type="file" accept=".json" onChange={handleFileSelect} ref={fileInputRef} className="hidden" />
              <Button onClick={() => fileInputRef.current?.click()} disabled={importing} variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">{importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Import qilinmoqda...</> : <><Upload className="w-4 h-4 mr-2" />Faylni tanlash</>}</Button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-amber-50 border-amber-200">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">Muhim ma'lumot</h4>
            <ul className="text-sm text-amber-700 mt-2 space-y-1">
              <li>• Eksport qilish faqat sizning ma'lumotlaringizni yuklab oladi</li>
              <li>• Import qilishda mavjud ma'lumotlar o'chiriladi va yangilari bilan almashtiriladi</li>
              <li>• Guruhlar, o'quvchilar, imtihonlar va ularning bog'lanishlari to'liq tiklanadi</li>
              <li>• <strong>Universal format:</strong> Fayl Firebase Firestore-ga mos keladi</li>
            </ul>
          </div>
        </div>
      </Card>

      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><FileJson className="w-5 h-5" />Ma'lumotlarni import qilish</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Quyidagi ma'lumotlar import qilinadi:</p>
                {summary && (
                  <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between border-b pb-2 mb-2"><span>Versiya:</span><span className="font-medium">{summary.version}</span></div>
                    <div className="flex justify-between"><span>Guruhlar:</span><span className="font-medium">{summary.groups} ta</span></div>
                    <div className="flex justify-between"><span>O'quvchilar:</span><span className="font-medium">{summary.students} ta</span></div>
                    <div className="flex justify-between"><span>Imtihonlar:</span><span className="font-medium">{summary.exams} ta</span></div>
                    <div className="flex justify-between border-t pt-2 mt-2"><span>Tekshirish kodi:</span><span className="font-mono text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{summary.checksum}</span></div>
                  </div>
                )}
                <p className="text-amber-600 font-medium">⚠️ Diqqat: Mavjud ma'lumotlar o'chiriladi!</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={performImport} className="bg-blue-600 hover:bg-blue-700"><CheckCircle className="w-4 h-4 mr-2" />Import qilish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DataManager;
