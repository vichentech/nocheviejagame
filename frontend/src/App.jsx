import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import GameMode from './pages/GameMode';
import ManualMode from './pages/ManualMode';
import UserLogin from './pages/UserLogin';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/" />;
  return children;
};

// Route that requires Game selected but not necessarily User logged in
const GameRoute = ({ children }) => {
  const { game, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!game) return <Navigate to="/" />;
  return children;
};

import AdminDashboard from './pages/AdminDashboard';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/" />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login-user" element={<GameRoute><UserLogin /></GameRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/game" element={<ProtectedRoute><GameMode /></ProtectedRoute>} />
      <Route path="/manual" element={<ProtectedRoute><ManualMode /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <AppRoutes />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
