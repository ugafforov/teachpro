import { z } from 'zod';

// Student validation schema
export const studentSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Ism kiritish majburiy")
    .max(100, "Ism 100 belgidan oshmasligi kerak"),
  student_id: z.string()
    .trim()
    .max(50, "O'quvchi ID 50 belgidan oshmasligi kerak")
    .optional()
    .or(z.literal('')),
  email: z.string()
    .trim()
    .email("Noto'g'ri email formati")
    .max(255, "Email 255 belgidan oshmasligi kerak")
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .trim()
    .regex(/^\+?[0-9]{9,15}$/, "Noto'g'ri telefon raqami formati")
    .optional()
    .or(z.literal('')),
  parent_phone: z.string()
    .trim()
    .regex(/^\+?[0-9]{9,15}$/, "Noto'g'ri telefon raqami formati")
    .optional()
    .or(z.literal('')),
  age: z.number()
    .int("Yosh butun son bo'lishi kerak")
    .min(5, "Yosh 5 dan kam bo'lmasligi kerak")
    .max(100, "Yosh 100 dan oshmasligi kerak")
    .optional()
}).refine((data) => {
  // If email is provided, validate it's not just whitespace
  if (data.email && data.email.length > 0) {
    return data.email.length >= 3;
  }
  return true;
}, {
  message: "Email kamida 3 belgidan iborat bo'lishi kerak",
  path: ["email"]
});

// Group validation schema
export const groupSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Guruh nomi kiritish majburiy")
    .max(100, "Guruh nomi 100 belgidan oshmasligi kerak"),
  description: z.string()
    .trim()
    .max(500, "Tavsif 500 belgidan oshmasligi kerak")
    .optional()
    .or(z.literal(''))
});

// Exam validation schema
export const examSchema = z.object({
  exam_name: z.string()
    .trim()
    .min(1, "Imtihon nomi kiritish majburiy")
    .max(200, "Imtihon nomi 200 belgidan oshmasligi kerak"),
  exam_date: z.string()
    .min(1, "Imtihon sanasini tanlash majburiy"),
  group_id: z.string()
    .min(1, "Guruhni tanlash majburiy")
});

// Exam result validation schema
export const examResultSchema = z.object({
  score: z.number()
    .min(0, "Ball 0 dan kam bo'lmasligi kerak")
    .max(100, "Ball 100 dan oshmasligi kerak"),
  notes: z.string()
    .trim()
    .max(1000, "Izoh 1000 belgidan oshmasligi kerak")
    .optional()
    .or(z.literal(''))
});

// Score validation schema (for daily scores)
export const scoreSchema = z.object({
  score: z.number()
    .min(0, "Ball 0 dan kam bo'lmasligi kerak")
    .max(5, "Ball 5 dan oshmasligi kerak"),
  reason: z.string()
    .trim()
    .max(500, "Sabab 500 belgidan oshmasligi kerak")
    .optional()
    .or(z.literal(''))
});

// Reward/Penalty validation schema
export const rewardPenaltySchema = z.object({
  points: z.number()
    .min(0.1, "Ball 0 dan katta bo'lishi kerak")
    .max(100, "Ball 100 dan oshmasligi kerak"),
  reason: z.string()
    .trim()
    .min(1, "Sabab kiritish majburiy")
    .max(500, "Sabab 500 belgidan oshmasligi kerak")
});

// Attendance notes validation
export const attendanceNotesSchema = z.object({
  notes: z.string()
    .trim()
    .max(500, "Izoh 500 belgidan oshmasligi kerak")
    .optional()
    .or(z.literal(''))
});

// Helper function to format validation errors for toast
export const formatValidationError = (error: z.ZodError): string => {
  return error.errors.map(err => err.message).join(', ');
};
