/**
 * Production Environment Validator
 * Ensures all required environment variables are set correctly
 */

import { logError } from './errorUtils';

interface EnvironmentConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    functionsRegion: string;
  };
}

function validateFirebaseConfig(): { firebase: EnvironmentConfig['firebase'] } | null {
  const required = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  for (const key of required) {
    const value = import.meta.env[key as keyof ImportMeta['env']];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      logError('productionValidator.firebaseConfig', `Missing Firebase config: ${key}`);
      return null;
    }
  }

  return {
    firebase: {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
      appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
      functionsRegion: (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string) || 'us-central1'
    }
  };
}

export function validateProductionEnvironment(): EnvironmentConfig | null {
  if (import.meta.env.DEV) {
    // Development mode - log warnings but don't fail
    logError('productionValidator.validate', 'Running in development mode - some validations skipped');
    return null;
  }

  logError('productionValidator.validate', 'Validating production environment configuration...');

  const firebaseConfig = validateFirebaseConfig();
  if (!firebaseConfig) {
    logError('productionValidator.validate', 'Firebase configuration validation failed');
    return null;
  }

  const config: EnvironmentConfig = {
    ...firebaseConfig
  };

  logError('productionValidator.validate', 'All environment variables validated successfully');

  // Additional checks
  validateProductionConstraints(config);

  return config;
}

function validateProductionConstraints(config: EnvironmentConfig): void {
  const constraints = [
    {
      name: 'Firebase Project ID',
      value: config.firebase.projectId,
      pattern: /^[a-z0-9-]+$/,
      minLength: 6
    }
  ];

  for (const constraint of constraints) {
    if ('pattern' in constraint) {
      if (!constraint.pattern.test(constraint.value)) {
        logError('productionValidator.constraints', `${constraint.name} format unexpected: ${constraint.value}`);
      }
    }

    if ('minLength' in constraint && constraint.value.length < constraint.minLength) {
      logError('productionValidator.constraints', `${constraint.name} seems too short: ${constraint.value}`);
    }

    if ('shouldContain' in constraint && typeof constraint.shouldContain === 'string' && !constraint.value.includes(constraint.shouldContain)) {
      logError('productionValidator.constraints', `${constraint.name} should contain "${constraint.shouldContain}": ${constraint.value}`);
    }

    if ('shouldStartWith' in constraint && typeof constraint.shouldStartWith === 'string' && !constraint.value.startsWith(constraint.shouldStartWith)) {
      logError('productionValidator.constraints', `${constraint.name} should start with "${constraint.shouldStartWith}": ${constraint.value}`);
    }
  }
}

export function logEnvironmentInfo(): void {
  if (import.meta.env.DEV) {
    logError('productionValidator.info', 'Environment Information:');
    logError('productionValidator.info', `Mode: ${import.meta.env.MODE}`);
    logError('productionValidator.info', `Firebase Project: ${import.meta.env.VITE_FIREBASE_PROJECT_ID}`);
  } else {
    logError('productionValidator.info', 'Production environment active');
  }
}
