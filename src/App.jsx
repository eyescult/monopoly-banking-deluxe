import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import SetUsernamePage from './pages/SetUsernamePage';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import LandingPage from './pages/LandingPage';
import PropertiesPage from './pages/PropertiesPage';
import TradePage from './pages/TradePage';
import './styles.css';

import { useLocation } from 'react-router-dom';

/**
 * Kimlik doğrulaması gerektiren rotalar için koruyucu bileşen.
 * Kullanıcı giriş yapmamışsa giriş sayfasına yönlendirir.
 */
function ProtectedRoute({ children }) {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user || user.id === '') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Kullanıcı adı belirlenmemişse zorunlu olarak o sayfaya yönlendir
  if (!user.name || user.name === '') {
    return <Navigate to="/set-username" replace />;
  }

  return children;
}

/**
 * Kullanıcı adı belirleme sayfası için koruyucu bileşen.
 * Sadece giriş yapmış kullanıcıların erişmesini sağlar.
 */
function UsernameRoute({ children }) {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user || user.id === '') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/**
 * Giriş sayfası gibi sadece giriş yapmamış kullanıcıların göreceği rotalar için koruyucu bileşen.
 */
function PublicRoute({ children }) {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (user && user.id !== '') {
    // Zaten giriş yapmışsa ana sayfaya (veya kullanıcı adı yoksa oraya) yönlendir
    if (!user.name || user.name === '') {
      return <Navigate to="/set-username" replace />;
    }
    return <Navigate to="/app" replace />;
  }

  return children;
}

function App() {
  const initialize = useAuthStore(state => state.initialize);

  // Uygulama başladığında oturumu kontrol et ve dinleyiciyi başlat
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      {/* Global Bildirim Sistemi (Toast) */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            borderRadius: '8px',
            padding: '12px 20px',
          },
          success: {
            iconTheme: {
              primary: '#4CAF50',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#F44336',
              secondary: '#fff',
            },
          },
        }}
        containerStyle={{
          top: 20,
        }}
        limit={3}
      />

      {/* Rota Tanımlamaları */}
      <Routes>
        {/* Landing Page Routes (SEO Friendly) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/tr" element={<LandingPage />} />
        <Route path="/en" element={<LandingPage />} />
        <Route path="/de" element={<LandingPage />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        <Route
          path="/set-username"
          element={
            <UsernameRoute>
              <SetUsernamePage />
            </UsernameRoute>
          }
        />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/game/:gameId"
          element={
            <ProtectedRoute>
              <GamePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/properties"
          element={
            <ProtectedRoute>
              <PropertiesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trades"
          element={
            <ProtectedRoute>
              <TradePage />
            </ProtectedRoute>
          }
        />

        {/* Bilinmeyen rotaları ana sayfaya yönlendir */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
