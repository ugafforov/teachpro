# TeachPro CRM

A comprehensive teacher management system built with React, TypeScript, and Firebase.

## Project Overview

TeachPro CRM is a full-featured classroom management application that helps teachers:
- Manage student information and groups
- Track attendance records
- Create and manage exams
- Calculate student scores and rankings
- Generate AI-powered analysis reports
- Archive and restore data

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication, Cloud Functions)
- **AI Integration**: Google Gemini API
- **State Management**: React Query
- **PDF Generation**: jsPDF
- **Excel Export**: xlsx

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore enabled
- Google Gemini API key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd TeachProCopy

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Firebase and API keys
```

### Environment Variables

Create a `.env` file with the following variables:

```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_FUNCTIONS_REGION=us-central1
```

### Development

```bash
# Start development server
npm run dev

# Run TypeScript compiler
npm run type-check

# Run linter
npm run lint

# Run tests
npm test
```

### Deployment

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore Database
3. Enable Authentication (Email/Password)
4. Create a web app and copy the configuration
5. Deploy Firestore rules from `firestore.rules`
6. Deploy Cloud Functions from the `functions/` directory

### Cloud Functions Setup

```bash
cd functions
npm install
cp .env.example .env
# Add your GEMINI_API_KEY to .env
cd ..
firebase deploy --only functions
```

## Security

This project implements comprehensive security measures:
- Firebase Authentication for user access
- Firestore security rules for data protection
- Server-side AI API calls via Cloud Functions
- Rate limiting on critical operations
- Audit logging for admin actions

See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for detailed security analysis.

## Features

### Student Management
- Add, edit, and delete students
- Student profiles with detailed information
- Import students from Excel
- Export student data

### Group Management
- Create and manage student groups
- Group-specific attendance tracking
- Group statistics and analytics

### Attendance Tracking
- Daily attendance recording
- Multiple attendance statuses (present, late, absent)
- Attendance history and statistics
- Attendance journal view

### Exam Management
- Create exams with custom parameters
- Record exam results
- Exam analytics and reports
- Export exam data to Excel

### AI Analysis
- AI-powered student performance analysis
- Automated insights generation
- Natural language queries
- Visual analytics dashboards

### Data Management
- Full data backup/restore
- Archive old records
- Soft-delete with recovery
- Data export in JSON format

## Testing

```bash
# Run unit tests with Vitest
npm test

# Run tests with UI
npm run test:ui

# Run tests in watch mode
npm run test:watch
```

## Project Structure

```
src/
├── components/        # React components
│   ├── exam/         # Exam-related components
│   ├── ui/           # shadcn/ui components
│   └── ...           # Other components
├── lib/              # Utility functions and helpers
│   ├── firebase.ts   # Firebase configuration
│   ├── errorUtils.ts # Error handling utilities
│   └── ...
├── hooks/            # Custom React hooks
├── pages/            # Page components
└── App.tsx           # Main app component

functions/            # Firebase Cloud Functions
├── src/
│   └── index.ts      # Functions entry point
└── package.json

tests/               # E2E tests (Playwright)
vitest.config.ts     # Vitest configuration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is proprietary software.

## Support

For issues and questions, please contact the development team.
