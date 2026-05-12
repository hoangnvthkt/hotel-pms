import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const { login, isMockMode, error: authError, resetAuthCache } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@grandpalace.vn');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(email, password);
    if (!ok) setError('Email hoặc mật khẩu không đúng');
    else navigate('/dashboard');
    setLoading(false);
  };

  const quickLogin = (role: string) => {
    const creds: Record<string, {e:string,p:string}> = {
      admin: { e: 'admin@grandpalace.vn', p: 'admin123' },
      manager: { e: 'manager@grandpalace.vn', p: 'manager123' },
      receptionist: { e: 'huong@grandpalace.vn', p: 'recept123' },
      hk_supervisor: { e: 'lan@grandpalace.vn', p: 'hksuper123' },
      hk_staff: { e: 'mai@grandpalace.vn', p: 'hkstaff123' },
      accountant: { e: 'ketoan@grandpalace.vn', p: 'acct123' },
    };
    if (creds[role]) { setEmail(creds[role].e); setPassword(creds[role].p); }
  };

  const clearStaleSession = () => {
    resetAuthCache();
    setError('');
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width:'100%', maxWidth:440, display:'flex', flexDirection:'column', alignItems:'stretch', gap:20 }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:52, height:52, borderRadius:'var(--radius-md)', background:'var(--primary)', color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:22, marginBottom:14 }}>
            GP
          </div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text-primary)', marginBottom:4 }}>Grand Palace PMS</h1>
          <p style={{ fontSize:14, color:'var(--text-secondary)' }}>Quản lý lễ tân, phòng, folio và housekeeping</p>
        </div>

        <div className="card" style={{ width:'100%', padding:'32px', background:'var(--bg-card)' }}>
          <h2 style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', marginBottom:8, textAlign:'center' }}>Đăng nhập</h2>
          <p style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:28, textAlign:'center' }}>
            {isMockMode ? 'Chế độ demo đang dùng mock data' : 'Đăng nhập bằng tài khoản Supabase Auth'}
          </p>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                className="form-input"
                placeholder="email@grandpalace.vn"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu</label>
              <input
                type="password" value={password} onChange={e=>setPassword(e.target.value)} required
                className="form-input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div style={{ background:'var(--danger-light)', border:'1px solid #fecaca', borderRadius:'var(--radius-md)', padding:'12px 16px', fontSize:14, fontWeight:700, color:'var(--danger)', textAlign:'center' }}>
                {error}
              </div>
            )}
            {authError && !error && (
              <div style={{ background:'var(--danger-light)', border:'1px solid #fecaca', borderRadius:'var(--radius-md)', padding:'12px 16px', display:'flex', flexDirection:'column', gap:10, alignItems:'stretch' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--danger)', textAlign:'center' }}>{authError}</div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearStaleSession}>
                  Xóa phiên đăng nhập cũ
                </button>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ marginTop:8 }}>
              {loading ? 'Đang đăng nhập...' : 'Vào ca làm việc'}
            </button>
          </form>

          {isMockMode && (
            <div style={{ marginTop:32 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                <div style={{ flex:1, height:1, background:'var(--border)' }}/>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>Đăng nhập nhanh</span>
                <div style={{ flex:1, height:1, background:'var(--border)' }}/>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {(['admin','manager','receptionist','hk_supervisor','hk_staff','accountant'] as const).map(role => (
                  <button key={role} type="button" onClick={()=>quickLogin(role)} className="btn btn-secondary btn-sm">
                    {role === 'hk_supervisor' ? 'HK Supervisor' : role === 'hk_staff' ? 'HK Staff' : role === 'accountant' ? 'Kế toán' : role}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
