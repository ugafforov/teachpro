import { db } from "./firebase";
import { logError } from "./errorUtils";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

export type FilterValue = string | number | boolean | null;
export type FirestoreRecord = Record<string, unknown>;
export type FirestoreCollectionData = Record<string, unknown[]>;

interface ImportPayload {
  version?: string;
  checksum?: string;
  data?: FirestoreCollectionData;
}

interface TimestampLike {
  seconds: number;
  nanoseconds?: number;
}

const isRecord = (value: unknown): value is FirestoreRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTimestampLike = (value: unknown): value is TimestampLike =>
  isRecord(value) && typeof value.seconds === "number";

/**
 * Fetches ALL records from a collection
 */
export async function fetchAllRecords<T extends FirestoreRecord>(
  collectionName: string,
  teacherId: string,
  additionalFilters?: Record<string, FilterValue>,
  studentIds?: string[],
): Promise<Array<T & { id: string }>> {
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
    const batches: string[][] = [];
    for (let i = 0; i < studentIds.length; i += 30) {
      batches.push(studentIds.slice(i, i + 30));
    }

    const results = await Promise.all(
      batches.map(async (batch) => {
        const batchQuery = query(finalQuery, where("student_id", "in", batch));
        const snapshot = await getDocs(batchQuery);
        return snapshot.docs.map(
          (snapshotDoc) =>
            ({ id: snapshotDoc.id, ...snapshotDoc.data() }) as T & {
              id: string;
            },
        );
      }),
    );

    return results.flat();
  }

  const snapshot = await getDocs(finalQuery);
  return snapshot.docs.map(
    (snapshotDoc) =>
      ({ id: snapshotDoc.id, ...snapshotDoc.data() }) as T & { id: string },
  );
}

/**
 * Fetches all records for export
 */
export async function fetchAllRecordsForExport<T extends FirestoreRecord>(
  collectionName: string,
  teacherId: string,
): Promise<Array<T & { id: string }>> {
  if (collectionName === "teachers") {
    const teacherDoc = await getDoc(doc(db, "teachers", teacherId));
    if (!teacherDoc.exists()) {
      return [];
    }

    return [
      {
        id: teacherDoc.id,
        ...teacherDoc.data(),
      } as T & { id: string },
    ];
  }

  const snapshot = await getDocs(
    query(collection(db, collectionName), where("teacher_id", "==", teacherId)),
  );
  return snapshot.docs.map(
    (snapshotDoc) =>
      ({ id: snapshotDoc.id, ...snapshotDoc.data() }) as T & { id: string },
  );
}

/**
 * Calculate data checksum for verification
 */
export function calculateChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
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
  importData: unknown,
  _teacherId: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const orphanedDetails: string[] = [];
  const timestampIssues: string[] = [];
  const dataTypeIssues: string[] = [];

  const payload = isRecord(importData) ? (importData as ImportPayload) : {};
  const data = isRecord(payload.data) ? payload.data : {};

  if (!payload.version) {
    errors.push("Fayl versiyasi topilmadi");
  }
  if (!payload.data || !isRecord(payload.data)) {
    errors.push("Ma'lumotlar topilmadi");
  }

  if (payload.checksum) {
    const calculatedChecksum = calculateChecksum(payload.data);
    if (calculatedChecksum !== payload.checksum) {
      errors.push("Fayl buzilgan (checksum mos kelmadi)");
    }
  } else {
    warnings.push("Checksum mavjud emas, fayl yaxlitligini tekshirib bo'lmadi");
  }

  const students = Array.isArray(data.students) ? data.students : [];
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const exams = Array.isArray(data.exams) ? data.exams : [];
  const attendanceRecords = Array.isArray(data.attendance_records)
    ? data.attendance_records
    : [];
  const examResults = Array.isArray(data.exam_results) ? data.exam_results : [];

  students.forEach((student, index) => {
    if (!isRecord(student)) return;
    if (!student.name) {
      dataTypeIssues.push(`O'quvchi #${index + 1}: ism yo'q`);
    }
    if (!student.group_name) {
      dataTypeIssues.push(`O'quvchi #${index + 1}: guruh nomi yo'q`);
    }
  });

  groups.forEach((group, index) => {
    if (!isRecord(group)) return;
    if (!group.name) {
      dataTypeIssues.push(`Guruh #${index + 1}: nom yo'q`);
    }
  });

  const groupIds = new Set(
    groups
      .filter(isRecord)
      .map((group) => group.id)
      .filter((id): id is string => typeof id === "string"),
  );
  const studentIds = new Set(
    students
      .filter(isRecord)
      .map((student) => student.id)
      .filter((id): id is string => typeof id === "string"),
  );
  const examIds = new Set(
    exams
      .filter(isRecord)
      .map((exam) => exam.id)
      .filter((id): id is string => typeof id === "string"),
  );

  attendanceRecords.forEach((record, index) => {
    if (
      !isRecord(record) ||
      typeof record.student_id !== "string" ||
      studentIds.has(record.student_id)
    ) {
      return;
    }
    orphanedDetails.push(`Davomat #${index + 1}: noto'g'ri student_id`);
  });

  examResults.forEach((result, index) => {
    if (!isRecord(result)) return;

    if (
      typeof result.exam_id === "string" &&
      !examIds.has(result.exam_id)
    ) {
      orphanedDetails.push(`Imtihon natijasi #${index + 1}: noto'g'ri exam_id`);
    }

    if (
      typeof result.student_id === "string" &&
      !studentIds.has(result.student_id)
    ) {
      orphanedDetails.push(
        `Imtihon natijasi #${index + 1}: noto'g'ri student_id`,
      );
    }
  });

  const validateTimestamps = (records: unknown[], collectionName: string) => {
    records.forEach((record, index) => {
      if (!isRecord(record) || !record.created_at) {
        return;
      }

      const createdAt = record.created_at;
      const isValidTimestamp =
        typeof createdAt === "string" ||
        createdAt instanceof Date ||
        isTimestampLike(createdAt);

      if (!isValidTimestamp) {
        timestampIssues.push(
          `${collectionName} #${index + 1}: noto'g'ri created_at formati`,
        );
      }
    });
  };

  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      validateTimestamps(value, key);
    }
  });

  const byCollection: Record<string, number> = {};
  let totalRecords = 0;
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      byCollection[key] = value.length;
      totalRecords += value.length;
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
  timestamp?: unknown;
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
    logError("firebaseHelpers:logAuditEntry", error);
  }
}
