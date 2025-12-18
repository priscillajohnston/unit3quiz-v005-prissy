import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBdyHWpEZTMh2PkFSorM3cuZAtjwAs1Wxk',
  authDomain: 'unit3quiz-v005-prissy.firebaseapp.com',
  projectId: 'unit3quiz-v005-prissy',
  storageBucket: 'unit3quiz-v005-prissy.firebasestorage.app',
  messagingSenderId: '437410570190',
  appId: '1:437410570190:web:10cfbf08a1f560ea5c959f',
  measurementId: 'G-YN8YTS4HB5',
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
})
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()
let analytics = null

if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app)
      }
    })
    .catch(() => {
      analytics = null
    })
}

export { analytics, app, auth, db, googleProvider }

