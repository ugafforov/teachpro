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
  'auth/user-not-found': "Bu foydalanuvchi topilmadi",
  'auth/wrong-password': "Noto'g'ri parol",
  'auth/email-already-in-use': "Bu email allaqachon ro'yxatdan o'tgan",
  'auth/weak-password': "Parol juda oddiy (kamida 6 ta belgi bo'lishi kerak)",
  'auth/invalid-email': "Email formati noto'g'ri",
  'auth/user-disabled': "Foydalanuvchi hisobi bloklangan",
  'auth/too-many-requests': "Urinishlar soni ko'payib ketdi. Iltimos, 5 daqiqadan so'ng qayta urinib ko'ring",
  'auth/network-request-failed': "Internet aloqasi yo'q. Iltimos, tarmoq ulanishini tekshiring",
  'auth/invalid-api-key': "API kaliti noto'g'ri",
  'auth/app-deleted': "Ilova o'chirilgan",
  'auth/app-not-authorized': "Ilova ruxsat berilmagan",
  'auth/argument-error': "Argument xatosi",
  'auth/invalid-user-token': "Foydalanuvchi tokeni noto'g'ri",
  'auth/captcha-check-failed': "Captcha tekshiruvi muvaffaqiyatsiz",
  'auth/web-storage-unsupported': "Brauzer web storage ni qo'llab-quvvatlamaydi",
};

// Generic fallback messages by operation type
const OPERATION_FALLBACK_MESSAGES: Record<string, string> = {
  fetch: "Ma'lumotlarni yuklashda xatolik yuz berdi",
  create: "Ma'lumot yaratishda xatolik yuz berdi",
  update: "Ma'lumotni yangilashda xatolik yuz berdi",
  delete: "Ma'lumotni o'chirishda xatolik yuz berdi",
  auth: "Email yoki parol noto'g'ri. Iltimos, qaytadan tekshirib ko'ring",
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
  let errorMessage: string | undefined;

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    errorCode = (err.code as string) || (err.error_code as string);
    errorMessage = (err.message as string);

    // Check for Firebase error message codes if code is not directly available
    if (!errorCode && errorMessage && typeof errorMessage === 'string') {
      // Firebase errors often have the code in the message like "Firebase: Error (auth/invalid-email)."
      const match = errorMessage.match(/\(([^)]+)\)/);
      if (match) {
        errorCode = match[1];
      }
      
      // Also check for common Firebase auth error patterns
      if (errorMessage.includes('invalid-email')) {
        errorCode = 'auth/invalid-email';
      } else if (errorMessage.includes('user-not-found')) {
        errorCode = 'auth/user-not-found';
      } else if (errorMessage.includes('wrong-password')) {
        errorCode = 'auth/wrong-password';
      } else if (errorMessage.includes('email-already-in-use')) {
        errorCode = 'auth/email-already-in-use';
      } else if (errorMessage.includes('weak-password')) {
        errorCode = 'auth/weak-password';
      } else if (errorMessage.includes('too-many-requests')) {
        errorCode = 'auth/too-many-requests';
      } else if (errorMessage.includes('network-request-failed')) {
        errorCode = 'auth/network-request-failed';
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
