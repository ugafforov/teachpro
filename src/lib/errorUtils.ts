/**
 * Error utility functions for secure error handling
 * These functions sanitize error messages to prevent information leakage
 */

// Map common database error codes to user-friendly messages
const ERROR_CODE_MESSAGES: Record<string, string> = {
  // Firebase/Firestore error codes
  'permission-denied': "Kirishga ruxsat yo'q",
  'not-found': "Ma'lumot topilmadi",
  'already-exists': "Bu ma'lumot allaqachon mavjud",
  'failed-precondition': "Amaliyotni bajarib bo'lmadi",
  'resource-exhausted': "Limit tugadi",
  'unavailable': "Xizmat vaqtincha ishlamayapti",
  'deadline-exceeded': "Kutish vaqti tugadi",

  // Auth error codes
  'auth/invalid-credential': "Noto'g'ri email yoki parol",
  'auth/user-not-found': "Foydalanuvchi topilmadi",
  'auth/wrong-password': "Noto'g'ri parol",
  'auth/email-already-in-use': "Bu email allaqachon ro'yxatdan o'tgan",
  'auth/weak-password': "Parol juda oddiy",
  'auth/invalid-email': "Email formati noto'g'ri",
  'auth/user-disabled': "Foydalanuvchi bloklangan",
  'auth/too-many-requests': "Urinishlar soni ko'payib ketdi. Keyinroq urinib ko'ring",
};

// Generic fallback messages by operation type
const OPERATION_FALLBACK_MESSAGES: Record<string, string> = {
  fetch: "Ma'lumotlarni yuklashda xatolik yuz berdi",
  create: "Ma'lumot yaratishda xatolik yuz berdi",
  update: "Ma'lumotni yangilashda xatolik yuz berdi",
  delete: "Ma'lumotni o'chirishda xatolik yuz berdi",
  auth: "Autentifikatsiya xatosi",
  import: "Import qilishda xatolik yuz berdi",
  export: "Eksport qilishda xatolik yuz berdi",
  default: "Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring",
};

interface SanitizedError {
  message: string;
  code?: string;
}

/**
 * Sanitizes database/API errors to prevent information leakage
 * Returns a user-friendly message in Uzbek
 */
export function sanitizeError(
  error: unknown,
  operation: 'fetch' | 'create' | 'update' | 'delete' | 'auth' | 'import' | 'export' | 'default' = 'default'
): SanitizedError {
  // Handle null/undefined
  if (!error) {
    return { message: OPERATION_FALLBACK_MESSAGES[operation] };
  }

  // Extract error code if available
  let errorCode: string | undefined;

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    errorCode = (err.code as string) || (err.error_code as string);

    // Check for Firebase error message codes if code is not directly available
    if (!errorCode && err.message && typeof err.message === 'string') {
      // Firebase errors often have the code in the message like "Firebase: Error (auth/invalid-email)."
      const match = err.message.match(/\(([^)]+)\)/);
      if (match) {
        errorCode = match[1];
      }
    }
  }

  // Return mapped message if code exists
  if (errorCode && ERROR_CODE_MESSAGES[errorCode]) {
    return {
      message: ERROR_CODE_MESSAGES[errorCode],
      code: errorCode
    };
  }

  // Return operation-specific fallback
  return {
    message: OPERATION_FALLBACK_MESSAGES[operation],
    code: errorCode
  };
}

/**
 * Logs errors only in development mode
 */
export function logError(context: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  }
}

/**
 * Safe error logger that doesn't expose sensitive data in production
 */
export function safeLogError(context: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  } else {
    // In production, log only a generic message with context
    console.error(`[${context}] An error occurred`);
  }
}
