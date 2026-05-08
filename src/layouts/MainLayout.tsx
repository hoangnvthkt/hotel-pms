import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import {
  LayoutDashboard, BedDouble, CalendarDays, Users, ConciergeBell,
  Sparkles, Receipt, Moon, BarChart3, Settings, LogOut, Menu, Bell, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'main' },
  { to: '/rooms', icon: BedDouble, label: 'Quản lý phòng', section: 'main' },
  { to: '/bookings', icon: CalendarDays, label: 'Đặt phòng', section: 'main' },
  { to: '/guests', icon: Users, label: 'Khách hàng', section: 'main' },
  { to: '/reception', icon: ConciergeBell, label: 'Lễ tân', section: 'operations' },
  { to: '/housekeeping', icon: Sparkles, label: 'Housekeeping', section: 'operations', badge: 4 },
  { to: '/folio', icon: Receipt, label: 'Folio & Thanh toán', section: 'operations' },
  { to: '/night-audit', icon: Moon, label: 'Night Audit', section: 'operations' },
  { to: '/reports', icon: BarChart3, label: 'Báo cáo', section: 'management' },
  { to: '/settings', icon: Settings, label: 'Cài đặt', section: 'management' },
];

const roleLabels: Record<string, string> = {
  admin: 'Quản trị viên', manager: 'Quản lý', receptionist: 'Lễ tân',
  hk_supervisor: 'HK Giám sát', hk_staff: 'Nhân viên HK', accountant: 'Kế toán',
};

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const sections = [
    { key: 'main', label: 'Chính' },
    { key: 'operations', label: 'Vận hành' },
    { key: 'management', label: 'Quản lý' },
  ];

  const initials = user ? user.name.split(' ').map(w=>w[0]).slice(-2).join('') : 'U';

  const pageTitle = navItems.find(n => location.pathname.startsWith(n.to))?.label ?? 'Hotel PMS';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        {/* Flip7 Retro Sidebar Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">H</div>
          {!collapsed && (
            <div>
              <div className="sidebar-logo-text">GRAND PALACE</div>
              <div className="sidebar-logo-sub">Hotel PMS</div>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {sections.map(sec => {
            const items = navItems.filter(n => n.section === sec.key);
            return (
              <div key={sec.key}>
                {!collapsed && <div className="sidebar-section-label">{sec.label}</div>}
                {items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <item.icon size={18} className="nav-icon" />
                    <span className="nav-label">{item.label}</span>
                    {item.badge && !collapsed && (
                      <span className="nav-badge">{item.badge}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={handleLogout} title="Đăng xuất">
            <div className="sidebar-avatar">{initials}</div>
            {!collapsed && (
              <>
                <div className="sidebar-user-info">
                  <div className="user-name">{user?.name}</div>
                  <div className="user-role">{roleLabels[user?.role ?? ''] ?? user?.role}</div>
                </div>
                <LogOut size={15} style={{ color:'#6b7280', marginLeft:'auto' }} />
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <header className="topbar">
          <button className="topbar-toggle" onClick={() => setCollapsed(c => !c)}>
            <Menu size={17} />
          </button>
          <div className="topbar-title">{pageTitle}</div>
          <div className="topbar-date">
            {format(new Date(), 'EEEE, dd/MM/yyyy', { locale: vi })}
          </div>
          <div className="topbar-actions">
            <button className="topbar-btn">
              <Bell size={17} />
              <span className="badge-dot" />
            </button>
            <div className="sidebar-avatar" style={{ cursor:'default' }}>{initials}</div>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
