import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { canAccessPath, firstAllowedPath } from '@/features/auth/rbac';
import LoginPage from '@/features/auth/LoginPage';
import AccountPage from '@/features/account/AccountPage';
import MainLayout from '@/layouts/MainLayout';
import DashboardPage from '@/features/dashboard/DashboardPage';
import RoomsPage from '@/features/rooms/RoomsPage';
import BookingsPage from '@/features/bookings/BookingsPage';
import GuestsPage from '@/features/guests/GuestsPage';
import GuestRequestsPage from '@/features/guest-requests/GuestRequestsPage';
import ReceptionPage from '@/features/reception/ReceptionPage';
import HousekeepingPage from '@/features/housekeeping/HousekeepingPage';
import FolioPage from '@/features/folio/FolioPage';
import CashieringPage from '@/features/cashiering/CashieringPage';
import NightAuditPage from '@/features/night-audit/NightAuditPage';
import ReportsPage from '@/features/reports/ReportsPage';
import SettingsPage from '@/features/settings/SettingsPage';
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

function RouteGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const roles = user?.roles ?? user?.role;
  if (!canAccessPath(roles, path)) {
    return <Navigate to={firstAllowedPath(roles)} replace />;
  }
  return <>{children}</>;
}

const guarded = (path: string, element: React.ReactNode) => (
  <RouteGuard path={path}>{element}</RouteGuard>
);

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={<DefaultRedirect />} />
        <Route path="dashboard" element={guarded('/dashboard', <DashboardPage />)} />
        <Route path="rooms" element={guarded('/rooms', <RoomsPage />)} />
        <Route path="bookings" element={guarded('/bookings', <BookingsPage />)} />
        <Route path="guests" element={guarded('/guests', <GuestsPage />)} />
        <Route path="guest-requests" element={guarded('/guest-requests', <GuestRequestsPage />)} />
        <Route path="reception" element={guarded('/reception', <ReceptionPage />)} />
        <Route path="housekeeping" element={guarded('/housekeeping', <HousekeepingPage />)} />
        <Route path="folio" element={guarded('/folio', <FolioPage />)} />
        <Route path="cashiering" element={guarded('/cashiering', <CashieringPage />)} />
        <Route path="night-audit" element={guarded('/night-audit', <NightAuditPage />)} />
        <Route path="reports" element={guarded('/reports', <ReportsPage />)} />
        <Route path="settings" element={guarded('/settings', <SettingsPage />)} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function DefaultRedirect() {
  const { user } = useAuth();
  return <Navigate to={firstAllowedPath(user?.roles ?? user?.role)} replace />;
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
