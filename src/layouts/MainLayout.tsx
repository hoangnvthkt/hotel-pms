import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';
import { canAccessPath, firstAllowedPath } from '@/features/auth/rbac';
import { dismissNotification, fetchHKTasks, fetchNotifications, fetchUnreadNotificationCount, markAllNotificationsRead, markNotificationRead, queryKeys } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, BedDouble, CalendarDays, Users, ConciergeBell,
  Sparkles, Receipt, Landmark, Moon, BarChart3, Settings, LogOut, Menu, Bell, X, MessageSquareText
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'main' },
  { to: '/rooms', icon: BedDouble, label: 'Quản lý phòng', section: 'main' },
  { to: '/bookings', icon: CalendarDays, label: 'Đặt phòng', section: 'main' },
  { to: '/guests', icon: Users, label: 'Khách hàng', section: 'main' },
  { to: '/guest-requests', icon: MessageSquareText, label: 'Yêu cầu khách', section: 'operations' },
  { to: '/reception', icon: ConciergeBell, label: 'Lễ tân', section: 'operations' },
  { to: '/housekeeping', icon: Sparkles, label: 'Housekeeping', section: 'operations' },
  { to: '/folio', icon: Receipt, label: 'Folio & Thanh toán', section: 'operations' },
  { to: '/cashiering', icon: Landmark, label: 'Đối soát', section: 'operations' },
  { to: '/night-audit', icon: Moon, label: 'Night Audit', section: 'operations' },
  { to: '/reports', icon: BarChart3, label: 'Báo cáo', section: 'management' },
  { to: '/settings', icon: Settings, label: 'Cài đặt', section: 'management' },
];

const roleLabels: Record<string, string> = {
  admin: 'Quản trị viên', manager: 'Quản lý', receptionist: 'Lễ tân',
  hk_supervisor: 'HK Giám sát', hk_staff: 'Nhân viên HK', accountant: 'Kế toán',
};

function UserAvatar({ src, initials, title }: { src?: string; initials: string; title?: string }) {
  return (
    <div className="sidebar-avatar" title={title}>
      {src ? <img src={src} alt={title ?? initials} /> : initials}
    </div>
  );
}

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const sections = [
    { key: 'main', label: 'Chính' },
    { key: 'operations', label: 'Vận hành' },
    { key: 'management', label: 'Quản lý' },
  ];

  const initials = user ? user.name.split(' ').map(w=>w[0]).slice(-2).join('') : 'U';
  const roles = user?.roles ?? user?.role;

  const allowedNavItems = navItems.filter(item => canAccessPath(roles, item.to));
  const pageTitle = location.pathname.startsWith('/account')
    ? 'Tài khoản'
    : allowedNavItems.find(n => location.pathname.startsWith(n.to))?.label ?? 'Hotel PMS';
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => fetchNotifications(12),
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });
  const notificationCountQuery = useQuery({
    queryKey: queryKeys.notificationCount,
    queryFn: fetchUnreadNotificationCount,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });
  const hkTasksQuery = useQuery({
    queryKey: queryKeys.hkTasks,
    queryFn: fetchHKTasks,
    enabled: Boolean(user && canAccessPath(roles, '/housekeeping')),
    refetchInterval: 30_000,
  });
  const unreadCount = notificationCountQuery.data ?? 0;
  const hkOpenCount = (hkTasksQuery.data ?? []).filter(task => ['pending', 'in_progress', 'done', 'rejected'].includes(task.status)).length;

  useEffect(() => {
    if (!showNotifications) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) setShowNotifications(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [showNotifications]);

  useEffect(() => {
    const client = supabase;
    if (!client || !user) return;
    const channel = client
      .channel(`layout-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'housekeeping_tasks',
        filter: `property_id=eq.${user.propertyId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.hkTasks });
        queryClient.invalidateQueries({ queryKey: queryKeys.rooms });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'guest_requests',
        filter: `property_id=eq.${user.propertyId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.guestRequests });
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount });
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [queryClient, user]);

  const openNotification = async (notificationId: string, actionUrl?: string) => {
    await markNotificationRead(notificationId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount }),
    ]);
    setShowNotifications(false);
    if (actionUrl) navigate(actionUrl);
  };

  const markAllRead = async () => {
    await markAllNotificationsRead();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount }),
    ]);
  };

  const dismiss = async (notificationId: string) => {
    await dismissNotification(notificationId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount }),
    ]);
  };

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
            const items = navItems
              .filter(n => n.section === sec.key)
              .filter(item => allowedNavItems.some(allowed => allowed.to === item.to));
            if (items.length === 0) return null;
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
                    {item.to === '/housekeeping' && hkOpenCount > 0 && !collapsed && (
                      <span className="nav-badge">{hkOpenCount}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => navigate('/account')} title="Tài khoản">
            <UserAvatar src={user?.avatarUrl} initials={initials} title={user?.name} />
            {!collapsed && (
              <>
                <div className="sidebar-user-info">
                  <div className="user-name">{user?.name}</div>
                  <div className="user-role">{roleLabels[user?.role ?? ''] ?? user?.role}</div>
                </div>
                <button
                  type="button"
                  className="topbar-btn"
                  title="Đăng xuất"
                  onClick={(event) => { event.stopPropagation(); handleLogout(); }}
                  style={{ marginLeft: 'auto', width: 30, height: 30 }}
                >
                  <LogOut size={15} />
                </button>
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
          {!canAccessPath(roles, location.pathname) && location.pathname !== firstAllowedPath(roles) && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(firstAllowedPath(roles))}>
              Về màn hình được phân quyền
            </button>
          )}
          <div className="topbar-date">
            {format(new Date(), 'EEEE, dd/MM/yyyy', { locale: vi })}
          </div>
          <div className="topbar-actions">
            <div className="notification-menu" ref={notificationRef}>
              <button className="topbar-btn" onClick={() => setShowNotifications(value => !value)} title="Thông báo">
                <Bell size={17} />
                {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <strong>Thông báo</strong>
                    <button className="btn btn-ghost btn-sm" onClick={markAllRead} disabled={unreadCount === 0}>Đọc hết</button>
                  </div>
                  <div className="notification-list">
                    {(notificationsQuery.data ?? []).map(item => (
                      <div key={item.id} className={`notification-item ${item.readAt ? '' : 'unread'} ${item.severity}`}>
                        <button className="notification-main" onClick={() => openNotification(item.id, item.actionUrl)}>
                          <span>{item.title}</span>
                          {item.body && <small>{item.body}</small>}
                          <em>{new Date(item.createdAt).toLocaleString('vi-VN')}</em>
                        </button>
                        <button className="notification-dismiss" onClick={() => dismiss(item.id)} title="Ẩn thông báo">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    {(notificationsQuery.data ?? []).length === 0 && (
                      <div className="notification-empty">Chưa có thông báo.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button className="topbar-btn" style={{ padding: 0, borderRadius: '50%' }} onClick={() => navigate('/account')} title="Tài khoản">
              <UserAvatar src={user?.avatarUrl} initials={initials} title={user?.name} />
            </button>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
