import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Upload, FileJson, CheckCircle, AlertCircle, Loader2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
import { fetchAllRecordsForExport, calculateChecksum } from '@/lib/supabaseHelpers';

interface DataManagerProps {
  teacherId: string;
}

interface ExportData {
  exportDate: string;
  version: string;
  teacherId: string;
  checksum: string;
  recordCounts: Record<string, number>;
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

// Import tartibini aniqlash - foreign key bog'lanishlarini hisobga olgan holda
const IMPORT_ORDER = [
  'groups',           // Guruhlar birinchi - students va exams bunga bog'liq
  'exam_types',       // Imtihon turlari - exams bunga bog'liq
  'students',         // O'quvchilar - attendance, scores, results bunga bog'liq
  'exams',            // Imtihonlar - exam_results bunga bog'liq
  'attendance_records',
  'reward_penalty_history',
  'student_scores',
  'exam_results',
  // Arxivlangan va o'chirilgan ma'lumotlar
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

// O'chirish tartibi - teskari tartibda (bog'liq jadvallar avval o'chiriladi)
const DELETE_ORDER = [
  'exam_results',
  'student_scores',
  'reward_penalty_history',
  'attendance_records',
  'exams',
  'students',
  'exam_types',
  'groups',
  'deleted_exam_results',
  'deleted_student_scores',
  'deleted_reward_penalty_history',
  'deleted_attendance_records',
  'deleted_exams',
  'deleted_students',
  'deleted_groups',
  'archived_exams',
  'archived_students',
  'archived_groups',
];

const DataManager: React.FC<DataManagerProps> = ({ teacherId }) => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState<ExportData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    try {
      setExporting(true);
      setProgress(0);

      const tables = [
        'teachers',
        'groups',
        'exam_types',
        'students', 
        'exams',
        'attendance_records',
        'reward_penalty_history',
        'exam_results',
        'student_scores',
        'archived_students',
        'archived_groups',
        'archived_exams',
        'deleted_students',
        'deleted_groups',
        'deleted_exams',
        'deleted_attendance_records',
        'deleted_reward_penalty_history',
        'deleted_student_scores',
        'deleted_exam_results',
      ];

      const data: any = {};
      const recordCounts: Record<string, number> = {};
      
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        setProgress(Math.round((i / tables.length) * 100));
        
        // Use pagination to fetch ALL records without limits
        const tableData = await fetchAllRecordsForExport<any>(table, teacherId);
        data[table] = tableData;
        recordCounts[table] = tableData.length;
      }

      setProgress(100);

      // Calculate checksum for verification
      const checksum = calculateChecksum(data);

      const exportObject: ExportData = {
        exportDate: new Date().toISOString(),
        version: '2.1',
        teacherId: teacherId,
        checksum,
        recordCounts,
        data
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `teachpro_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Calculate totals for toast message
      const totalRecords = Object.values(data).reduce((sum: number, arr: any) => sum + (arr?.length || 0), 0);
      
      toast.success(`Ma'lumotlar muvaffaqiyatli eksport qilindi!`, {
        description: `Jami ${totalRecords} ta yozuv yuklab olindi. Tekshirish kodi: ${checksum}`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Eksport qilishda xatolik yuz berdi');
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        // Validate JSON structure
        if (!json.version || !json.data) {
          toast.error('Noto\'g\'ri fayl formati', {
            description: 'Iltimos, TeachPro eksport faylini tanlang'
          });
          return;
        }

        setImportData(json);
        setShowImportDialog(true);
      } catch (error) {
        toast.error('Faylni o\'qishda xatolik', {
          description: 'JSON formati noto\'g\'ri'
        });
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const performImport = async () => {
    if (!importData) return;

    try {
      setImporting(true);
      setShowImportDialog(false);
      setProgress(0);

      const { data: importDataContent } = importData;
      
      // ID xaritalari - eski ID -> yangi ID
      const idMaps: Record<string, Record<string, string>> = {
        groups: {},
        exam_types: {},
        students: {},
        exams: {},
      };

      // 1-BOSQICH: Mavjud ma'lumotlarni o'chirish (to'g'ri tartibda)
      setProgressMessage("Mavjud ma'lumotlar o'chirilmoqda...");
      for (let i = 0; i < DELETE_ORDER.length; i++) {
        const table = DELETE_ORDER[i];
        setProgress(Math.round((i / DELETE_ORDER.length) * 25)); // 0-25%
        
        try {
          await supabase
            .from(table as any)
            .delete()
            .eq('teacher_id', teacherId);
        } catch (err) {
          console.log(`Table ${table} delete skipped:`, err);
        }
      }

      // 2-BOSQICH: Ma'lumotlarni to'g'ri tartibda import qilish
      let importStep = 0;
      const totalSteps = IMPORT_ORDER.length;

      for (const table of IMPORT_ORDER) {
        importStep++;
        setProgress(25 + Math.round((importStep / totalSteps) * 75)); // 25-100%
        setProgressMessage(`${table} import qilinmoqda...`);
        
        const records = importDataContent[table as keyof typeof importDataContent];
        
        if (!records || records.length === 0) {
          continue;
        }

        // Har bir yozuvni individual ravishda qo'shish (ID larni to'g'ri saqlash uchun)
        for (const record of records) {
          try {
            let newRecord = { ...record };
            
            // teacher_id ni yangilash
            if ('teacher_id' in newRecord) {
              newRecord.teacher_id = teacherId;
            }

            // Foreign key ID larini yangilash
            if (table === 'students' && newRecord.group_id && idMaps.groups[newRecord.group_id]) {
              newRecord.group_id = idMaps.groups[newRecord.group_id];
            }
            
            if (table === 'exams') {
              if (newRecord.group_id && idMaps.groups[newRecord.group_id]) {
                newRecord.group_id = idMaps.groups[newRecord.group_id];
              }
              if (newRecord.exam_type_id && idMaps.exam_types[newRecord.exam_type_id]) {
                newRecord.exam_type_id = idMaps.exam_types[newRecord.exam_type_id];
              }
            }
            
            if (table === 'attendance_records' || 
                table === 'reward_penalty_history' || 
                table === 'student_scores') {
              if (newRecord.student_id && idMaps.students[newRecord.student_id]) {
                newRecord.student_id = idMaps.students[newRecord.student_id];
              }
            }
            
            if (table === 'exam_results') {
              if (newRecord.student_id && idMaps.students[newRecord.student_id]) {
                newRecord.student_id = idMaps.students[newRecord.student_id];
              }
              if (newRecord.exam_id && idMaps.exams[newRecord.exam_id]) {
                newRecord.exam_id = idMaps.exams[newRecord.exam_id];
              }
            }

            // Original ID ni saqlash yoki yangi ID olish
            const originalId = newRecord.id;
            delete newRecord.id; // Supabase yangi ID yaratsin
            delete newRecord.created_at; // Yangi timestamp

            const { data: insertedData, error } = await supabase
              .from(table as any)
              .insert(newRecord)
              .select('id')
              .single();

            if (error) {
              console.error(`Error importing ${table}:`, error, newRecord);
              continue;
            }

            // Yangi ID ni xaritaga qo'shish
            const newId = (insertedData as any)?.id;
            if (newId && originalId) {
              if (table === 'groups') {
                idMaps.groups[originalId] = newId;
              } else if (table === 'exam_types') {
                idMaps.exam_types[originalId] = newId;
              } else if (table === 'students') {
                idMaps.students[originalId] = newId;
              } else if (table === 'exams') {
                idMaps.exams[originalId] = newId;
              }
            }
          } catch (recordError) {
            console.error(`Error processing record in ${table}:`, recordError);
          }
        }
      }

      const totalRecords = Object.values(importDataContent).reduce((sum: number, arr: any) => sum + (arr?.length || 0), 0);
      
      toast.success("Ma'lumotlar muvaffaqiyatli import qilindi!", {
        description: `Jami ${totalRecords} ta yozuv yuklandi`
      });

      // Refresh the page to show new data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
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
    
    const { data, checksum, recordCounts, version } = importData;
    return {
      students: data.students?.length || 0,
      groups: data.groups?.length || 0,
      attendance: data.attendance_records?.length || 0,
      rewards: data.reward_penalty_history?.length || 0,
      exams: data.exams?.length || 0,
      examResults: data.exam_results?.length || 0,
      examTypes: data.exam_types?.length || 0,
      studentScores: data.student_scores?.length || 0,
      checksum: checksum || 'N/A',
      version: version || '1.0',
      recordCounts: recordCounts || {}
    };
  };

  const summary = getImportSummary();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Ma'lumotlarni boshqarish</h2>
        <p className="text-muted-foreground">
          Barcha ma'lumotlaringizni eksport yoki import qiling
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <Card className="p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Ma'lumotlarni eksport qilish</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Barcha o'quvchilar, guruhlar, davomat va boshqa ma'lumotlarni bitta JSON faylga yuklab oling
              </p>
              
              {exporting && (
                <div className="mb-4">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{progress}% bajarildi</p>
                </div>
              )}

              <Button 
                onClick={exportData} 
                disabled={exporting}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Eksport qilinmoqda...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Eksport qilish
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Import Card */}
        <Card className="p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Ma'lumotlarni import qilish</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Oldin eksport qilingan JSON fayldan ma'lumotlarni tiklang
              </p>
              
              {importing && (
                <div className="mb-4">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {progress}% - {progressMessage}
                  </p>
                </div>
              )}

              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="hidden"
              />

              <Button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={importing}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Import qilinmoqda...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Faylni tanlash
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="p-6 bg-amber-50 border-amber-200">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">Muhim ma'lumot</h4>
            <ul className="text-sm text-amber-700 mt-2 space-y-1">
              <li>• Eksport qilish faqat sizning ma'lumotlaringizni yuklab oladi</li>
              <li>• Import qilishda mavjud ma'lumotlar o'chiriladi va yangilari bilan almashtiriladi</li>
              <li>• Guruhlar, o'quvchilar, imtihonlar va ularning bog'lanishlari to'liq tiklanadi</li>
              <li>• Faylni xavfsiz joyda saqlang</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Import Confirmation Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              Ma'lumotlarni import qilish
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Quyidagi ma'lumotlar import qilinadi:</p>
                
                {summary && (
                  <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between border-b pb-2 mb-2">
                      <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Versiya:</span>
                      <span className="font-medium">{summary.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Guruhlar:</span>
                      <span className="font-medium">{summary.groups} ta</span>
                    </div>
                    <div className="flex justify-between">
                      <span>O'quvchilar:</span>
                      <span className="font-medium">{summary.students} ta</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Imtihon turlari:</span>
                      <span className="font-medium">{summary.examTypes} ta</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Imtihonlar:</span>
                      <span className="font-medium">{summary.exams} ta</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Imtihon natijalari:</span>
                      <span className="font-medium">{summary.examResults} ta</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Davomat yozuvlari:</span>
                      <span className="font-medium">{summary.attendance} ta</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mukofot/Jarimalar:</span>
                      <span className="font-medium">{summary.rewards} ta</span>
                    </div>
                    <div className="flex justify-between">
                      <span>O'quvchi baholari:</span>
                      <span className="font-medium">{summary.studentScores} ta</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span>Tekshirish kodi:</span>
                      <span className="font-mono text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{summary.checksum}</span>
                    </div>
                  </div>
                )}

                <p className="text-amber-600 font-medium">
                  ⚠️ Diqqat: Mavjud ma'lumotlar o'chiriladi va yangilari bilan almashtiriladi!
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={performImport} className="bg-blue-600 hover:bg-blue-700">
              <CheckCircle className="w-4 h-4 mr-2" />
              Import qilish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DataManager;
