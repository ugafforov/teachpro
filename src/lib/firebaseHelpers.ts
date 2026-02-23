import { db } from "./firebase";
import { logError } from "./errorUtils";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  limit,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { PRESENT_POINTS, LATE_POINTS } from "./studentScoreCalculator";

/**
 * Fetches ALL records from a collection
 */
export async function fetchAllRecords<T>(
  collectionName: string,
  teacherId: string,
  additionalFilters?: Record<string, any>,
  studentIds?: string[],
): Promise<T[]> {
  const baseQuery = query(
    collection(db, collectionName),
    where("teacher_id", "==", teacherId),
  );

  let finalQuery = baseQuery;
  if (additionalFilters) {
    Object.entries(additionalFilters).forEach(([key, value]) => {
      finalQuery = query(finalQuery, where(key, "==", value));
    });
  }

  if (studentIds && studentIds.length > 0) {
    // Firestore "in" query limit is 30. We batch the requests.
    const batches: string[][] = [];
    for (let i = 0; i < studentIds.length; i += 30) {
      batches.push(studentIds.slice(i, i + 30));
    }

    const results = await Promise.all(
      batches.map(async (batch) => {
        const q = query(finalQuery, where("student_id", "in", batch));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
      }),
    );

    return results.flat() as T[];
  }

  const snapshot = await getDocs(finalQuery);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as any) as T[];
}

/**
 * Fetches all records for export
 */
export async function fetchAllRecordsForExport<T>(
  collectionName: string,
  teacherId: string,
): Promise<T[]> {
  const q = query(
    collection(db, collectionName),
    where("teacher_id", "==", teacherId),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as any) as T[];
}

/**
 * Calculate data checksum for verification
 */
export function calculateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
}

/**
 * Validation result interface for import validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalRecords: number;
    byCollection: Record<string, number>;
    hasOrphanedReferences: boolean;
    orphanedDetails: string[];
    timestampIssues: string[];
    dataTypeIssues: string[];
  };
}

/**
 * Validate import data before importing
 */
export async function validateImportData(
  importData: any,
  teacherId: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const orphanedDetails: string[] = [];
  const timestampIssues: string[] = [];
  const dataTypeIssues: string[] = [];

  // 1. Validate file structure
  if (!importData.version) {
    errors.push("Fayl versiyasi topilmadi");
  }
  if (!importData.data) {
    errors.push("Ma'lumotlar topilmadi");
  }

  // 2. Validate checksum
  if (importData.checksum) {
    const calculatedChecksum = calculateChecksum(importData.data);
    if (calculatedChecksum !== importData.checksum) {
      errors.push("Fayl buzilgan (checksum mos kelmadi)");
    }
  } else {
    warnings.push("Checksum mavjud emas, fayl yaxlitligini tekshirib bo'lmadi");
  }

  // 3. Validate data types and required fields
  const data = importData.data;

  // Validate students
  if (data.students && Array.isArray(data.students)) {
    data.students.forEach((student: any, index: number) => {
      if (!student.name) {
        dataTypeIssues.push(`O'quvchi #${index + 1}: ism yo'q`);
      }
      if (!student.group_name) {
        dataTypeIssues.push(`O'quvchi #${index + 1}: guruh nomi yo'q`);
      }
    });
  }

  // Validate groups
  if (data.groups && Array.isArray(data.groups)) {
    data.groups.forEach((group: any, index: number) => {
      if (!group.name) {
        dataTypeIssues.push(`Guruh #${index + 1}: nom yo'q`);
      }
    });
  }

  // 4. Check for orphaned references
  const groupIds = new Set((data.groups || []).map((g: any) => g.id));
  const studentIds = new Set((data.students || []).map((s: any) => s.id));
  const examIds = new Set((data.exams || []).map((e: any) => e.id));

  // Check attendance records reference valid students
  (data.attendance_records || []).forEach((record: any, index: number) => {
    if (record.student_id && !studentIds.has(record.student_id)) {
      orphanedDetails.push(`Davomat #${index + 1}: noto'g'ri student_id`);
    }
  });

  // Check exam_results reference valid exams and students
  (data.exam_results || []).forEach((result: any, index: number) => {
    if (result.exam_id && !examIds.has(result.exam_id)) {
      orphanedDetails.push(`Imtihon natijasi #${index + 1}: noto'g'ri exam_id`);
    }
    if (result.student_id && !studentIds.has(result.student_id)) {
      orphanedDetails.push(
        `Imtihon natijasi #${index + 1}: noto'g'ri student_id`,
      );
    }
  });

  // 5. Validate timestamps
  const validateTimestamps = (records: any[], collectionName: string) => {
    records.forEach((record: any, index: number) => {
      if (record.created_at) {
        const isValidTimestamp =
          typeof record.created_at === "string" ||
          record.created_at.seconds !== undefined ||
          record.created_at instanceof Date;

        if (!isValidTimestamp) {
          timestampIssues.push(
            `${collectionName} #${index + 1}: noto'g'ri created_at formati`,
          );
        }
      }
    });
  };

  Object.keys(data).forEach((key) => {
    if (Array.isArray(data[key])) {
      validateTimestamps(data[key], key);
    }
  });

  // 6. Calculate summary
  const byCollection: Record<string, number> = {};
  let totalRecords = 0;

  Object.keys(data).forEach((key) => {
    if (Array.isArray(data[key])) {
      byCollection[key] = data[key].length;
      totalRecords += data[key].length;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalRecords,
      byCollection,
      hasOrphanedReferences: orphanedDetails.length > 0,
      orphanedDetails,
      timestampIssues,
      dataTypeIssues,
    },
  };
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  teacher_id: string;
  action: "export" | "import" | "import_failed";
  timestamp?: any;
  details: {
    recordCounts?: Record<string, number>;
    checksum?: string;
    version?: string;
    errorMessage?: string;
  };
  metadata?: {
    userAgent?: string;
    fileSize?: number;
  };
}

/**
 * Log audit entry for export/import operations
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<void> {
  try {
    await addDoc(collection(db, "audit_logs"), {
      ...entry,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    // Silently fail - don't block export/import if audit logging fails
    logError("firebaseHelpers:logAuditEntry", error);
  }
}
