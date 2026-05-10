import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, Shield, UserX, UserCheck } from 'lucide-react';
import { queryKeys } from '@/lib/queryClient';
import { fetchStaffProfiles, inviteStaff, deactivateStaff, setStaffRoles } from '@/lib/data';
import type { UserRole, InviteStaffPayload } from '@/types/staff';
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

export default function StaffTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canInvite = user?.role === 'admin' || user?.role === 'manager';

  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState<InviteStaffPayload>({ email: '', full_name: '', phone: '', roles: ['receptionist'] });
  const [err, setErr] = useState('');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: queryKeys.staff,
    queryFn: fetchStaffProfiles,
  });

  const inviteMut = useMutation({
    mutationFn: inviteStaff,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.staff });
      setShowInvite(false);
      setForm({ email: '', full_name: '', phone: '', roles: ['receptionist'] });
    },
    onError: (e: any) => setErr(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateStaff,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.staff }),
  });

  function toggleRole(role: UserRole) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
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

        {/* Invite form */}
        {showInvite && (
          <form onSubmit={handleInvite} style={{ background: 'var(--primary-bg)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, color: 'var(--primary-dark)' }}>
              <Mail size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Mời nhân viên mới
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Email *</label>
                <input className="form-input" type="email" required placeholder="nhanvien@gmail.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Họ tên *</label>
                <input className="form-input" required placeholder="Nguyễn Văn A"
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Số điện thoại</label>
                <input className="form-input" placeholder="0901234567"
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                <Shield size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Phân quyền *
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ALL_ROLES.filter(r => isAdmin || !['admin', 'manager', 'accountant'].includes(r.value)).map(r => {
                  const sel = form.roles.includes(r.value);
                  return (
                    <button key={r.value} type="button" onClick={() => toggleRole(r.value)}
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
            {err && <div style={{ color: 'var(--coral)', fontSize: 12, marginBottom: 10 }}>{err}</div>}
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Nhân viên', 'Email', 'Vai trò', 'Trạng thái', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)', opacity: s.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: ROLE_COLORS[s.primaryRole] ?? 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: s.primaryRole === 'accountant' ? '#111' : '#fff', fontWeight: 800, fontSize: 13,
                      }}>
                        {s.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 700 }}>{s.full_name}</div>
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 12 }}>{s.email}</td>
                  <td style={{ padding: '12px' }}>
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
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: s.is_active ? 'var(--success-light)' : 'var(--border-light)',
                      color: s.is_active ? 'var(--success)' : 'var(--text-muted)',
                    }}>
                      {s.is_active ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {isAdmin && s.id !== user?.id && s.is_active && (
                      <button className="btn btn-sm" style={{ padding: '4px 10px', background: 'var(--danger-light)', border: 'none', color: 'var(--coral)', borderRadius: 8, fontSize: 12 }}
                        onClick={() => { if (confirm(`Khóa tài khoản ${s.full_name}?`)) deactivateMut.mutate(s.id); }}>
                        <UserX size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
