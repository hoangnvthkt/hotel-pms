import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import LoginPage from '@/features/auth/LoginPage';
import MainLayout from '@/layouts/MainLayout';
import DashboardPage from '@/features/dashboard/DashboardPage';
import RoomsPage from '@/features/rooms/RoomsPage';
import BookingsPage from '@/features/bookings/BookingsPage';
import GuestsPage from '@/features/guests/GuestsPage';
import ReceptionPage from '@/features/reception/ReceptionPage';
import HousekeepingPage from '@/features/housekeeping/HousekeepingPage';
import FolioPage from '@/features/folio/FolioPage';
import NightAuditPage from '@/features/night-audit/NightAuditPage';
import ReportsPage from '@/features/reports/ReportsPage';
import '@/styles/index.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0f1117' }}>
      <div style={{ textAlign:'center', color:'#94a3b8' }}>
        <div style={{ width:40, height:40, border:'3px solid #3b82f6', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 16px' }}/>
        <div>Đang tải...</div>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="guests" element={<GuestsPage />} />
        <Route path="reception" element={<ReceptionPage />} />
        <Route path="housekeeping" element={<HousekeepingPage />} />
        <Route path="folio" element={<FolioPage />} />
        <Route path="night-audit" element={<NightAuditPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-secondary)' }}>
            <div style={{ fontSize:40, marginBottom:16 }}>⚙️</div>
            <h2>Cài đặt — Coming soon</h2>
          </div>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
