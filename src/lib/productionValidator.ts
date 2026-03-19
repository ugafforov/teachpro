/**
 * Production Environment Validator
 * Ensures all required environment variables are set correctly
 */

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
  ai: {
    apiKey: string;
    model: string;
    baseUrl: string;
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
      console.error(`❌ Missing Firebase config: ${key}`);
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

function validateAIConfig(): { ai: EnvironmentConfig['ai'] } | null {
  const required = [
    'VITE_AI_API_KEY',
    'VITE_AI_MODEL',
    'VITE_AI_BASE_URL'
  ];

  for (const key of required) {
    const value = import.meta.env[key as keyof ImportMeta['env']];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      console.error(`❌ Missing AI config: ${key}`);
      return null;
    }
  }

  return {
    ai: {
      apiKey: import.meta.env.VITE_AI_API_KEY as string,
      model: import.meta.env.VITE_AI_MODEL as string,
      baseUrl: import.meta.env.VITE_AI_BASE_URL as string
    }
  };
}

export function validateProductionEnvironment(): EnvironmentConfig | null {
  if (import.meta.env.DEV) {
    // Development mode - log warnings but don't fail
    console.warn('⚠️ Running in development mode - some validations skipped');
    return null;
  }

  console.log('🔍 Validating production environment configuration...');

  const firebaseConfig = validateFirebaseConfig();
  if (!firebaseConfig) {
    console.error('❌ Firebase configuration validation failed');
    return null;
  }

  const aiConfig = validateAIConfig();
  if (!aiConfig) {
    console.error('❌ AI configuration validation failed');
    return null;
  }

  const config: EnvironmentConfig = {
    ...firebaseConfig,
    ...aiConfig
  };

  console.log('✅ All environment variables validated successfully');

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
    },
    {
      name: 'AI Model',
      value: config.ai.model,
      shouldContain: 'gemini'
    },
    {
      name: 'AI Base URL',
      value: config.ai.baseUrl,
      shouldStartWith: 'https://'
    }
  ];

  for (const constraint of constraints) {
    if ('pattern' in constraint) {
      if (!constraint.pattern.test(constraint.value)) {
        console.warn(`⚠️ ${constraint.name} format unexpected: ${constraint.value}`);
      }
    }

    if ('minLength' in constraint && constraint.value.length < constraint.minLength) {
      console.warn(`⚠️ ${constraint.name} seems too short: ${constraint.value}`);
    }

    if ('shouldContain' in constraint && !constraint.value.includes(constraint.shouldContain)) {
      console.warn(`⚠️ ${constraint.name} should contain "${constraint.shouldContain}": ${constraint.value}`);
    }

    if ('shouldStartWith' in constraint && !constraint.value.startsWith(constraint.shouldStartWith)) {
      console.warn(`⚠️ ${constraint.name} should start with "${constraint.shouldStartWith}": ${constraint.value}`);
    }
  }
}

export function logEnvironmentInfo(): void {
  if (import.meta.env.DEV) {
    console.log('📝 Environment Information:');
    console.log(`  Mode: ${import.meta.env.MODE}`);
    console.log(`  Firebase Project: ${import.meta.env.VITE_FIREBASE_PROJECT_ID}`);
    console.log(`  AI Model: ${import.meta.env.VITE_AI_MODEL}`);
  } else {
    console.log('🚀 Production environment active');
  }
}
