import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, KeyRound, Mail, RefreshCw, Save, ShieldCheck, Trash2, UserCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { queryKeys } from '@/lib/queryClient';
import {
  changeMyPassword,
  deleteMyAvatar,
  fetchMyProfile,
  sendPasswordResetEmail,
  updateMyProfile,
  uploadMyAvatar,
} from '@/lib/data';
import type { UserRole } from '@/types';

const roleLabels: Record<UserRole, string> = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  receptionist: 'Lễ tân',
  hk_supervisor: 'HK Giám sát',
  hk_staff: 'Nhân viên HK',
  accountant: 'Kế toán',
};

function initials(name?: string) {
  return name ? name.split(' ').map(part => part[0]).slice(-2).join('').toUpperCase() : 'U';
}

export default function AccountPage() {
  const qc = useQueryClient();
  const { user, refreshUser, isMockMode } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', position_title: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.account,
    queryFn: fetchMyProfile,
  });

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      full_name: profile.full_name,
      phone: profile.phone ?? '',
      position_title: profile.position_title ?? '',
    });
  }, [profile]);

  const afterAccountMutation = async (successMessage: string) => {
    await qc.invalidateQueries({ queryKey: queryKeys.account });
    await qc.invalidateQueries({ queryKey: queryKeys.staff });
    await refreshUser();
    setMessage(successMessage);
    setError('');
  };

  const profileMut = useMutation({
    mutationFn: () => updateMyProfile(profileForm),
    onSuccess: () => afterAccountMutation('Đã cập nhật hồ sơ tài khoản.'),
    onError: (err: Error) => { setError(err.message); setMessage(''); },
  });

  const avatarMut = useMutation({
    mutationFn: uploadMyAvatar,
    onSuccess: () => afterAccountMutation('Đã cập nhật ảnh đại diện.'),
    onError: (err: Error) => { setError(err.message); setMessage(''); },
  });

  const deleteAvatarMut = useMutation({
    mutationFn: () => deleteMyAvatar(profile?.avatar_path),
    onSuccess: () => afterAccountMutation('Đã xóa ảnh đại diện.'),
    onError: (err: Error) => { setError(err.message); setMessage(''); },
  });

  const passwordMut = useMutation({
    mutationFn: () => changeMyPassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    }),
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      afterAccountMutation('Đã đổi mật khẩu đăng nhập.');
    },
    onError: (err: Error) => { setError(err.message); setMessage(''); },
  });

  const resetMut = useMutation({
    mutationFn: () => sendPasswordResetEmail(profile?.email ?? user?.email ?? ''),
    onSuccess: () => { setMessage('Đã gửi email đặt lại mật khẩu.'); setError(''); },
    onError: (err: Error) => { setError(err.message); setMessage(''); },
  });

  function handleProfileSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!profileForm.full_name.trim()) {
      setError('Họ tên không được để trống.');
      return;
    }
    profileMut.mutate();
  }

  function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      setError('Mật khẩu mới tối thiểu 8 ký tự.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    passwordMut.mutate();
  }

  function handleAvatarFile(file?: File) {
    if (!file) return;
    avatarMut.mutate(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  if (isLoading) {
    return <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải tài khoản...</div>;
  }

  const avatarUrl = profile?.avatar_url ?? user?.avatarUrl;
  const displayName = profile?.full_name ?? user?.name ?? '';
  const roles = profile?.roles ?? user?.roles ?? (user?.role ? [user.role] : []);

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserCircle size={28} color="var(--primary)" /> Tài khoản
          </h1>
          <p>Quản lý hồ sơ cá nhân, ảnh đại diện và mật khẩu đăng nhập.</p>
        </div>
      </div>

      {(message || error) && (
        <div className={error ? 'form-error' : 'account-success'} style={{ marginBottom: 16 }}>
          {error || message}
        </div>
      )}

      <div className="account-grid">
        <section className="card account-card">
          <div className="card-title"><UserCircle size={18} /> Hồ sơ cá nhân</div>
          <div className="card-subtitle">Email đăng nhập đang để read-only trong MVP.</div>
          <form onSubmit={handleProfileSubmit} style={{ display: 'grid', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Họ tên *</label>
              <input
                className="form-input"
                value={profileForm.full_name}
                onChange={event => setProfileForm(form => ({ ...form, full_name: event.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email đăng nhập</label>
              <input className="form-input" value={profile?.email ?? user?.email ?? ''} disabled />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Số điện thoại</label>
                <input
                  className="form-input"
                  value={profileForm.phone}
                  onChange={event => setProfileForm(form => ({ ...form, phone: event.target.value }))}
                  placeholder="0901234567"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Chức danh</label>
                <input
                  className="form-input"
                  value={profileForm.position_title}
                  onChange={event => setProfileForm(form => ({ ...form, position_title: event.target.value }))}
                  placeholder="Lễ tân ca sáng"
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {roles.map(role => (
                <span key={role} className="badge badge-blue">{roleLabels[role]}</span>
              ))}
              <span className={profile?.is_active ? 'badge badge-green' : 'badge badge-gray'}>
                {profile?.is_active ? 'Hoạt động' : 'Đã khóa'}
              </span>
            </div>
            <button className="btn btn-primary" type="submit" disabled={profileMut.isPending}>
              <Save size={16} /> {profileMut.isPending ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </form>
        </section>

        <section className="card account-card">
          <div className="card-title"><Camera size={18} /> Ảnh đại diện</div>
          <div className="account-avatar-preview">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} />
            ) : (
              <span>{initials(displayName)}</span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={event => handleAvatarFile(event.target.files?.[0])}
          />
          <div style={{ display: 'grid', gap: 10 }}>
            <button className="btn btn-primary" type="button" onClick={() => inputRef.current?.click()} disabled={avatarMut.isPending}>
              <Camera size={16} /> {avatarMut.isPending ? 'Đang tải...' : 'Tải ảnh mới'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => deleteAvatarMut.mutate()}
              disabled={!profile?.avatar_path || deleteAvatarMut.isPending}
            >
              <Trash2 size={16} /> Xóa ảnh
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            JPEG, PNG hoặc WebP. Tối đa 2MB, tự crop vuông 512px.
          </div>
        </section>

        <section className="card account-card account-security-card">
          <div className="card-title"><ShieldCheck size={18} /> Bảo mật đăng nhập</div>
          <form onSubmit={handlePasswordSubmit} style={{ display: 'grid', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Mật khẩu hiện tại</label>
              <input
                className="form-input"
                type="password"
                value={passwordForm.currentPassword}
                onChange={event => setPasswordForm(form => ({ ...form, currentPassword: event.target.value }))}
                required
              />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Mật khẩu mới</label>
                <input
                  className="form-input"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={event => setPasswordForm(form => ({ ...form, newPassword: event.target.value }))}
                  minLength={8}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Xác nhận mật khẩu mới</label>
                <input
                  className="form-input"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={event => setPasswordForm(form => ({ ...form, confirmPassword: event.target.value }))}
                  minLength={8}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={passwordMut.isPending}>
                <KeyRound size={16} /> {passwordMut.isPending ? 'Đang đổi...' : 'Đổi mật khẩu'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => resetMut.mutate()} disabled={resetMut.isPending || isMockMode}>
                {resetMut.isPending ? <RefreshCw size={16} /> : <Mail size={16} />} Gửi email reset
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
