import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type TeacherVerificationStatus = "pending" | "approved" | "rejected";

export interface TeacherProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  school?: string;
  created_at: string;
  verification_status: TeacherVerificationStatus;
  institution_name?: string;
  institution_address?: string;
  requested_at: string;
  rejection_reason?: string;
  approved_at?: unknown;
  is_approved?: boolean;
}

type TeacherDocData = Partial<Omit<TeacherProfile, "id">> &
  Record<string, unknown>;

const isVerificationStatus = (
  value: unknown,
): value is TeacherVerificationStatus =>
  value === "pending" || value === "approved" || value === "rejected";

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

function resolveVerificationStatus(
  data: TeacherDocData,
): TeacherVerificationStatus {
  if (isVerificationStatus(data.verification_status)) {
    return data.verification_status;
  }

  if (data.is_approved === true) {
    return "approved";
  }

  if (toOptionalString(data.rejection_reason)) {
    return "rejected";
  }

  return "pending";
}

export function normalizeTeacherProfile(
  id: string,
  data: TeacherDocData,
): TeacherProfile {
  const createdAt =
    toOptionalString(data.created_at) ?? new Date(0).toISOString();
  const requestedAt = toOptionalString(data.requested_at) ?? createdAt;

  return {
    id,
    name: toOptionalString(data.name) ?? "",
    email: toOptionalString(data.email) ?? "",
    phone: toOptionalString(data.phone),
    school: toOptionalString(data.school),
    created_at: createdAt,
    verification_status: resolveVerificationStatus(data),
    institution_name: toOptionalString(data.institution_name),
    institution_address: toOptionalString(data.institution_address),
    requested_at: requestedAt,
    rejection_reason: toOptionalString(data.rejection_reason),
    approved_at: data.approved_at,
    is_approved:
      typeof data.is_approved === "boolean" ? data.is_approved : undefined,
  };
}

export async function fetchTeacherProfile(
  uid: string,
): Promise<TeacherProfile | null> {
  const teacherDoc = await getDoc(doc(db, "teachers", uid));
  if (!teacherDoc.exists()) {
    return null;
  }

  return normalizeTeacherProfile(
    teacherDoc.id,
    teacherDoc.data() as TeacherDocData,
  );
}
