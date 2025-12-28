/**
 * Error utility functions for secure error handling
 * These functions sanitize error messages to prevent information leakage
 */

// Map common database error codes to user-friendly messages
const ERROR_CODE_MESSAGES: Record<string, string> = {
  'PGRST116': "Ma'lumot topilmadi",
  'PGRST301': "Kirishga ruxsat yo'q",
  '23505': "Bu ma'lumot allaqachon mavjud",
  '23503': "Bog'liq ma'lumotlar mavjud",
  '23502': "Majburiy maydonlar to'ldirilmagan",
  '42501': "Bu amaliyotga ruxsatingiz yo'q",
  '42P01': "Tizimda xatolik yuz berdi",
  'invalid_credentials': "Noto'g'ri email yoki parol",
  'user_already_exists': "Bu email allaqachon ro'yxatdan o'tgan",
  'email_not_confirmed': "Email tasdiqlanmagan",
  'invalid_grant': "Noto'g'ri email yoki parol",
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
    
    // Check for Supabase auth errors
    if (err.message && typeof err.message === 'string') {
      const authErrorMatch = err.message.match(/invalid_credentials|user_already_exists|email_not_confirmed|invalid_grant/i);
      if (authErrorMatch) {
        errorCode = authErrorMatch[0].toLowerCase();
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
