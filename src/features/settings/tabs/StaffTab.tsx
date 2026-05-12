import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Mail, Plus, Save, Shield, UserCheck, UserX, X } from 'lucide-react';
import { queryKeys } from '@/lib/queryClient';
import {
  deactivateStaff,
  fetchStaffProfiles,
  inviteStaff,
  reactivateStaff,
  sendPasswordResetEmail,
  setStaffRoles,
  updateStaffProfile,
} from '@/lib/data';
import type { InviteStaffPayload, StaffProfile, UserRole } from '@/types/staff';
import { useAuth } from '@/features/auth/AuthContext';

const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Quản trị viên' },
  { value: 'manager', label: 'Quản lý' },
  { value: 'receptionist', label: 'Lễ tân' },
  { value: 'hk_supervisor', label: 'HK Giám sát' },
  { value: 'hk_staff', label: 'Nhân viên HK' },
  { value: 'accountant', label: 'Kế toán' },
];

const ROLE_COLORS: Record<UserRole, string> = {
  admin: '#EF6C4A', manager: '#5DADE2', receptionist: '#2BA8A2',
  hk_supervisor: '#9b59b6', hk_staff: '#27AE60', accountant: '#FFD23F',
};

const restrictedManagerRoles: UserRole[] = ['admin', 'manager', 'accountant'];

function staffInitials(name: string) {
  return name.split(' ').map(part => part[0]).slice(-2).join('').toUpperCase();
}

function StaffAvatar({ staff, size = 34 }: { staff: StaffProfile; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: ROLE_COLORS[staff.primaryRole] ?? 'var(--primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: staff.primaryRole === 'accountant' ? '#111' : '#fff',
      fontWeight: 800, fontSize: Math.max(12, size / 3),
      overflow: 'hidden',
    }}>
      {staff.avatar_url ? <img src={staff.avatar_url} alt={staff.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : staffInitials(staff.full_name)}
    </div>
  );
}

export default function StaffTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canInvite = isAdmin || isManager;

  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState<InviteStaffPayload>({ email: '', full_name: '', phone: '', roles: ['receptionist'] });
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState<StaffProfile | null>(null);
  const [detailForm, setDetailForm] = useState({ full_name: '', phone: '', position_title: '' });
  const [roleDraft, setRoleDraft] = useState<UserRole[]>([]);
  const [detailMessage, setDetailMessage] = useState('');
  const [detailError, setDetailError] = useState('');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: queryKeys.staff,
    queryFn: fetchStaffProfiles,
  });

  const refreshStaff = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.staff });
    await qc.invalidateQueries({ queryKey: queryKeys.account });
  };

  const inviteMut = useMutation({
    mutationFn: inviteStaff,
    onSuccess: () => {
      refreshStaff();
      setShowInvite(false);
      setForm({ email: '', full_name: '', phone: '', roles: ['receptionist'] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const saveProfileMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Chưa chọn nhân viên.');
      return updateStaffProfile(selected.id, {
        full_name: detailForm.full_name,
        phone: detailForm.phone,
        position_title: detailForm.position_title,
      });
    },
    onSuccess: () => {
      refreshStaff();
      setDetailMessage('Đã cập nhật hồ sơ nhân viên.');
      setDetailError('');
    },
    onError: (e: Error) => { setDetailError(e.message); setDetailMessage(''); },
  });

  const rolesMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Chưa chọn nhân viên.');
      if (!roleDraft.length) throw new Error('Chọn ít nhất 1 role.');
      return setStaffRoles(selected.id, roleDraft);
    },
    onSuccess: () => {
      refreshStaff();
      setDetailMessage('Đã cập nhật phân quyền.');
      setDetailError('');
    },
    onError: (e: Error) => { setDetailError(e.message); setDetailMessage(''); },
  });

  const activeMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => active ? deactivateStaff(id) : reactivateStaff(id),
    onSuccess: () => {
      refreshStaff();
      setDetailMessage('Đã cập nhật trạng thái tài khoản.');
      setDetailError('');
      setSelected(current => current ? { ...current, is_active: !current.is_active } : current);
    },
    onError: (e: Error) => { setDetailError(e.message); setDetailMessage(''); },
  });

  const resetMut = useMutation({
    mutationFn: (email: string) => sendPasswordResetEmail(email),
    onSuccess: () => { setDetailMessage('Đã gửi email đặt lại mật khẩu.'); setDetailError(''); },
    onError: (e: Error) => { setDetailError(e.message); setDetailMessage(''); },
  });

  function canManageStaff(target: StaffProfile | null) {
    if (!user || !target || target.id === user.id) return false;
    if (isAdmin) return true;
    if (!isManager) return false;
    return !target.roles.some(role => restrictedManagerRoles.includes(role));
  }

  function availableRolesForCurrentUser() {
    return ALL_ROLES.filter(role => isAdmin || !restrictedManagerRoles.includes(role.value));
  }

  function toggleInviteRole(role: UserRole) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
  }

  function toggleDetailRole(role: UserRole) {
    setRoleDraft(roles => roles.includes(role) ? roles.filter(item => item !== role) : [...roles, role]);
  }

  function openStaff(staffItem: StaffProfile) {
    setSelected(staffItem);
    setDetailForm({
      full_name: staffItem.full_name,
      phone: staffItem.phone ?? '',
      position_title: staffItem.position_title ?? '',
    });
    setRoleDraft(staffItem.roles);
    setDetailError('');
    setDetailMessage('');
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!form.roles.length) { setErr('Chọn ít nhất 1 role'); return; }
    inviteMut.mutate(form);
  }

  return (
    <div>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>Danh sách nhân viên</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{staff.length} thành viên</div>
          </div>
          {canInvite && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(s => !s)} style={{ gap: 6, borderRadius: 20, padding: '7px 16px' }}>
              <Plus size={14} /> Mời nhân viên
            </button>
          )}
        </div>

        {showInvite && (
          <form onSubmit={handleInvite} style={{ background: 'var(--primary-bg)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, color: 'var(--primary-dark)' }}>
              <Mail size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Mời nhân viên mới
            </div>
            <div className="form-grid-2" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" required placeholder="nhanvien@gmail.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Họ tên *</label>
                <input className="form-input" required placeholder="Nguyễn Văn A"
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Số điện thoại</label>
                <input className="form-input" placeholder="0901234567"
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>
                <Shield size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Phân quyền *
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {availableRolesForCurrentUser().map(r => {
                  const sel = form.roles.includes(r.value);
                  return (
                    <button key={r.value} type="button" onClick={() => toggleInviteRole(r.value)}
                      style={{
                        padding: '5px 14px', borderRadius: 20, border: `2px solid ${sel ? ROLE_COLORS[r.value] : 'var(--border)'}`,
                        background: sel ? ROLE_COLORS[r.value] : 'transparent',
                        color: sel ? (r.value === 'accountant' ? '#111' : '#fff') : 'var(--text-secondary)',
                        fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      }}>
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {err && <div className="form-error" style={{ marginBottom: 10 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={inviteMut.isPending}>
                {inviteMut.isPending ? 'Đang gửi...' : 'Gửi lời mời'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowInvite(false)}>Hủy</button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Đang tải...</div>
        ) : staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Chưa có nhân viên nào</div>
        ) : (
          <div className="table-wrap" style={{ borderWidth: 1 }}>
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  {['Nhân viên', 'Email', 'Vai trò', 'Trạng thái', ''].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id} onClick={() => openStaff(s)} style={{ opacity: s.is_active ? 1 : 0.5, cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StaffAvatar staff={s} />
                        <div>
                          <div style={{ fontWeight: 800 }}>{s.full_name}</div>
                          {s.position_title && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.position_title}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{s.email}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {s.roles.map(r => (
                          <span key={r} style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: ROLE_COLORS[r] + '22', color: ROLE_COLORS[r],
                            border: `1px solid ${ROLE_COLORS[r]}44`,
                          }}>
                            {ALL_ROLES.find(x => x.value === r)?.label ?? r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: s.is_active ? 'var(--success-light)' : 'var(--border-light)',
                        color: s.is_active ? 'var(--success)' : 'var(--text-muted)',
                      }}>
                        {s.is_active ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {canManageStaff(s) && (
                        <button
                          className="btn btn-sm"
                          style={{ padding: '4px 10px', background: s.is_active ? 'var(--danger-light)' : 'var(--success-light)', border: 'none', color: s.is_active ? 'var(--coral)' : 'var(--success)', borderRadius: 8, fontSize: 12 }}
                          onClick={(event) => { event.stopPropagation(); activeMut.mutate({ id: s.id, active: s.is_active }); }}
                        >
                          {s.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <aside className="drawer" onClick={event => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <div className="modal-title">Tài khoản nhân viên</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{selected.email}</div>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>

            <div className="drawer-body" style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <StaffAvatar staff={selected} size={72} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{selected.full_name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{selected.position_title || 'Chưa đặt chức danh'}</div>
                  <span className={selected.is_active ? 'badge badge-green' : 'badge badge-gray'} style={{ marginTop: 8 }}>
                    {selected.is_active ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </div>
              </div>

              {(detailMessage || detailError) && (
                <div className={detailError ? 'form-error' : 'account-success'}>{detailError || detailMessage}</div>
              )}

              <div style={{ display: 'grid', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Họ tên</label>
                  <input className="form-input" value={detailForm.full_name}
                    disabled={!canManageStaff(selected)}
                    onChange={e => setDetailForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Số điện thoại</label>
                  <input className="form-input" value={detailForm.phone}
                    disabled={!canManageStaff(selected)}
                    onChange={e => setDetailForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Chức danh</label>
                  <input className="form-input" value={detailForm.position_title}
                    disabled={!canManageStaff(selected)}
                    onChange={e => setDetailForm(f => ({ ...f, position_title: e.target.value }))} />
                </div>
                <button className="btn btn-primary" disabled={!canManageStaff(selected) || saveProfileMut.isPending} onClick={() => saveProfileMut.mutate()}>
                  <Save size={16} /> Lưu thông tin
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div className="form-label" style={{ marginBottom: 8 }}>Phân quyền</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availableRolesForCurrentUser().map(r => {
                    const sel = roleDraft.includes(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        disabled={!canManageStaff(selected)}
                        onClick={() => toggleDetailRole(r.value)}
                        style={{
                          padding: '5px 14px', borderRadius: 20, border: `2px solid ${sel ? ROLE_COLORS[r.value] : 'var(--border)'}`,
                          background: sel ? ROLE_COLORS[r.value] : 'transparent',
                          color: sel ? (r.value === 'accountant' ? '#111' : '#fff') : 'var(--text-secondary)',
                          fontWeight: 700, fontSize: 12, cursor: canManageStaff(selected) ? 'pointer' : 'not-allowed',
                          opacity: canManageStaff(selected) ? 1 : 0.6,
                        }}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
                <button className="btn btn-secondary" style={{ marginTop: 12 }} disabled={!canManageStaff(selected) || rolesMut.isPending} onClick={() => rolesMut.mutate()}>
                  <Shield size={16} /> Lưu phân quyền
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'grid', gap: 10 }}>
                <button className="btn btn-secondary" disabled={!canManageStaff(selected) || resetMut.isPending} onClick={() => resetMut.mutate(selected.email)}>
                  <KeyRound size={16} /> Gửi email reset mật khẩu
                </button>
                <button
                  className={selected.is_active ? 'btn btn-danger' : 'btn btn-success'}
                  disabled={!canManageStaff(selected) || activeMut.isPending}
                  onClick={() => activeMut.mutate({ id: selected.id, active: selected.is_active })}
                >
                  {selected.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                  {selected.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
