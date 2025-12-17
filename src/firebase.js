import { getApp, getApps, initializeApp } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missingConfig = Object.entries(firebaseConfig).filter(
  ([, value]) => value === undefined || value === ''
)

if (missingConfig.length > 0) {
  console.warn(
    `Missing Firebase configuration values: ${missingConfig
      .map(([key]) => key)
      .join(', ')}. Check your environment configuration.`
  )
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
})

export { app, db }

