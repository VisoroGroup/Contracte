import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TemplatesPage from './pages/templates/TemplatesPage';
import UploadTemplatePage from './pages/templates/UploadTemplatePage';
import EditTemplatePage from './pages/templates/EditTemplatePage';
import ContractsPage from './pages/contracts/ContractsPage';
import NewContractPage from './pages/contracts/NewContractPage';
import ContractDetailPage from './pages/contracts/ContractDetailPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/templates/upload" element={<ProtectedRoute adminOnly><UploadTemplatePage /></ProtectedRoute>} />
          <Route path="/templates/:id/edit" element={<ProtectedRoute adminOnly><EditTemplatePage /></ProtectedRoute>} />
          <Route path="/contracts" element={<ContractsPage />} />
          <Route path="/contracts/new" element={<NewContractPage />} />
          <Route path="/contracts/:id" element={<ContractDetailPage />} />
          <Route path="/settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
