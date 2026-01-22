# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

TeachPro is a teacher management platform for Uzbekistan-based educators. It tracks student groups, attendance, exams, rewards/penalties, and generates statistics/rankings. The UI is in Uzbek language.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State/Data**: TanStack React Query + Firebase (Firestore + Auth)
- **Routing**: react-router-dom
- **Validation**: Zod
- **Charts**: Recharts
- **Export**: jspdf, xlsx

## Commands

```bash
# Install dependencies
npm install

# Development server (runs on port 8080)
npm run dev

# Production build
npm run build

# Development build
npm run build:dev

# Lint
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Path Alias
`@/*` maps to `src/*` — use this for all imports.

### Key Directories

- `src/lib/` — Core utilities and Firebase integration
- `src/components/` — React components (feature components + shadcn/ui)
- `src/components/ui/` — shadcn/ui primitives
- `src/components/statistics/` — Statistics and analytics components
- `src/pages/` — Route page components
- `src/hooks/` — Custom React hooks

### Data Layer

**Firebase/Firestore** is the primary backend:
- `src/lib/firebase.ts` — Firebase init, auth helpers, CRUD helpers
- `src/lib/firebaseHelpers.ts` — Batch fetching, import/export validation, audit logging

**Firestore Collections**:
- `teachers` — Teacher profiles with approval status
- `admins` — Admin user records
- `groups` — Student groups (per teacher)
- `students` — Student records (per teacher/group)
- `attendance_records` — Daily attendance
- `exams` — Exam definitions
- `exam_results` — Student exam scores
- `reward_penalty_history` — Mukofot (rewards), Jarima (penalties), Baho (grades)
- `audit_logs` — Import/export activity

### Score Calculation System

`src/lib/studentScoreCalculator.ts` contains the centralized scoring logic:

```
totalScore = rewardPenaltyPoints + attendancePoints

Where:
- rewardPenaltyPoints = mukofotPoints - jarimaPoints
- attendancePoints = (presentCount × 1) + (lateCount × 0.5)
- attendancePercentage = (present + late) / totalClasses × 100
- efficiency = attendancePercentage
```

Attendance status values: `'present'`, `'late'`, `'absent_with_reason'`, `'absent_without_reason'`

### Authentication Flow

1. `AuthPage.tsx` — Sign in/sign up forms
2. `Index.tsx` — Auth state listener, routes to:
   - `AdminPanel` if user is in `admins` collection
   - `PendingApproval` if teacher's `verification_status === 'pending'`
   - `Dashboard` for approved teachers

Teacher approval states: `'pending'` | `'approved'` | `'rejected'`

### Environment Variables

Required Firebase config (prefix with `VITE_`):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Time Handling

All dates use Tashkent timezone (UTC+5). Use `getTashkentDate()` and `getTashkentToday()` from `src/lib/utils.ts` for date operations.

### Error Handling

Use utilities from `src/lib/errorUtils.ts`:
- `sanitizeError(error, operation)` — Returns user-friendly Uzbek error messages
- `logError(context, error)` — Logs errors only in development mode

### Validation

Use Zod schemas from `src/lib/validations.ts` for form validation:
- `studentSchema`, `groupSchema`, `examSchema`, `examResultSchema`, `scoreSchema`, `rewardPenaltySchema`

## TypeScript Configuration

The project has relaxed TypeScript settings:
- `noImplicitAny: false`
- `strictNullChecks: false`
- `noUnusedLocals: false`
- `noUnusedParameters: false`

## UI Patterns

- Toast notifications: Use `sonner` via `<Sonner />` component
- Forms: shadcn/ui components with react-hook-form + Zod resolvers
- Icons: lucide-react
- Responsive: Mobile-first with Tailwind breakpoints
