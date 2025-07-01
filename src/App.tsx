
import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import AuthPage from './components/AuthPage'
import Dashboard from './components/Dashboard'
import { supabase } from './integrations/supabase/client'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Router>
        <div className="min-h-screen w-full">
          <Routes>
            <Route 
              path="/" 
              element={isAuthenticated ? <Dashboard /> : <Navigate to="/auth" replace />} 
            />
            <Route 
              path="/auth" 
              element={!isAuthenticated ? <AuthPage /> : <Navigate to="/" replace />} 
            />
          </Routes>
        </div>
        <Toaster />
      </Router>
    </TooltipProvider>
  )
}

export default App
