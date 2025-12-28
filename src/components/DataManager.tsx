import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Upload, FileJson, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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
import { logError } from '@/lib/errorUtils';

interface DataManagerProps {
  teacherId: string;
}

interface ExportData {
  exportDate: string;
  version: string;
  teacherId: string;
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

const DataManager: React.FC<DataManagerProps> = ({ teacherId }) => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState<ExportData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    try {
      setExporting(true);
      setProgress(0);

      const tables = [
        'teachers',
        'students', 
        'groups',
        'attendance_records',
        'reward_penalty_history',
        'exams',
        'exam_results',
        'exam_types',
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
      
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        setProgress(Math.round((i / tables.length) * 100));
        
        const { data: tableData, error } = await supabase
          .from(table as any)
          .select('*')
          .eq('teacher_id', teacherId);
        
        if (error) {
          logError(`DataManager.exportData.${table}`, error);
          data[table] = [];
        } else {
          data[table] = tableData || [];
        }
      }

      setProgress(100);

      const exportObject: ExportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        teacherId: teacherId,
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
        description: `Jami ${totalRecords} ta yozuv yuklab olindi`
      });
    } catch (error) {
      logError('DataManager.exportData', error);
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
      const tables = Object.keys(importDataContent);
      let processedTables = 0;

      for (const table of tables) {
        const records = importDataContent[table as keyof typeof importDataContent];
        
        if (records && records.length > 0) {
          // Update teacher_id for all records to current user
          const updatedRecords = records.map((record: any) => ({
            ...record,
            teacher_id: teacherId
          }));

          // Delete existing data first
          await supabase
            .from(table as any)
            .delete()
            .eq('teacher_id', teacherId);

          // Insert new data in batches
          const batchSize = 100;
          for (let i = 0; i < updatedRecords.length; i += batchSize) {
            const batch = updatedRecords.slice(i, i + batchSize);
            const { error } = await supabase
              .from(table as any)
              .insert(batch);
            
            if (error) {
              logError(`DataManager.performImport.${table}`, error);
            }
          }
        }

        processedTables++;
        setProgress(Math.round((processedTables / tables.length) * 100));
      }

      const totalRecords = Object.values(importDataContent).reduce((sum: number, arr: any) => sum + (arr?.length || 0), 0);
      
      toast.success('Ma\'lumotlar muvaffaqiyatli import qilindi!', {
        description: `Jami ${totalRecords} ta yozuv yuklandi`
      });

      // Refresh the page to show new data
      window.location.reload();
    } catch (error) {
      logError('DataManager.performImport', error);
      toast.error('Import qilishda xatolik yuz berdi');
    } finally {
      setImporting(false);
      setProgress(0);
      setImportData(null);
    }
  };

  const getImportSummary = () => {
    if (!importData) return null;
    
    const { data } = importData;
    return {
      students: data.students?.length || 0,
      groups: data.groups?.length || 0,
      attendance: data.attendance_records?.length || 0,
      rewards: data.reward_penalty_history?.length || 0,
      exams: data.exams?.length || 0,
      examResults: data.exam_results?.length || 0,
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
                  <p className="text-xs text-muted-foreground mt-1">{progress}% bajarildi</p>
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
              <li>• Import qilishda mavjud ma'lumotlar yangilanadi</li>
              <li>• Faylni xavfsiz joyda saqlang</li>
              <li>• Boshqa platformaga ko'chirish uchun eksport qilingan fayldan foydalaning</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Import Confirmation Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent>
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
                    <div className="flex justify-between">
                      <span>O'quvchilar:</span>
                      <span className="font-medium">{summary.students} ta</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Guruhlar:</span>
                      <span className="font-medium">{summary.groups} ta</span>
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
                      <span>Imtihonlar:</span>
                      <span className="font-medium">{summary.exams} ta</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Imtihon natijalari:</span>
                      <span className="font-medium">{summary.examResults} ta</span>
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