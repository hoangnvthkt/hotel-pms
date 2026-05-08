import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { mockUsers } from '@/mock/users';

export default function LoginPage() {
  const { login } = useAuth();
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
    };
    if (creds[role]) { setEmail(creds[role].e); setPassword(creds[role].p); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      {/* Background Ornaments */}
      <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'var(--primary-light)', opacity:0.2, top:-50, left:-50, filter:'blur(40px)' }} />
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'var(--accent)', opacity:0.15, bottom:-100, right:-100, filter:'blur(60px)' }} />

      <div style={{ width:'100%', maxWidth:480, zIndex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
        
        {/* Flip7 Retro Logo Group */}
        <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', marginBottom:40 }}>
          {/* Fan Cards Background */}
          <div style={{ position:'absolute', top: -30, width:140, height:180, zIndex:-1 }}>
            <div style={{ position:'absolute', width:80, height:110, background:'var(--coral)', border:'3px solid var(--primary-dark)', borderRadius:8, transform:'rotate(-24deg)', left:-10, top:20 }}/>
            <div style={{ position:'absolute', width:80, height:110, background:'var(--sky-blue)', border:'3px solid var(--primary-dark)', borderRadius:8, transform:'rotate(-12deg)', left:10, top:10 }}/>
            <div style={{ position:'absolute', width:80, height:110, background:'var(--accent)', border:'3px solid var(--primary-dark)', borderRadius:8, transform:'rotate(0deg)', left:30, top:0 }}/>
            <div style={{ position:'absolute', width:80, height:110, background:'var(--success)', border:'3px solid var(--primary-dark)', borderRadius:8, transform:'rotate(12deg)', left:50, top:10 }}/>
            <div style={{ position:'absolute', width:80, height:110, background:'var(--primary-light)', border:'3px solid var(--primary-dark)', borderRadius:8, transform:'rotate(24deg)', left:70, top:20 }}/>
          </div>

          {/* Ribbon Banner */}
          <div className="ribbon-banner">
            <div className="ribbon-tail-left"></div>
            <div className="ribbon-main">GRAND PALACE</div>
            <div className="ribbon-tail-right"></div>
          </div>
          <div style={{ 
            background:'var(--cream)', 
            border:'3px solid var(--primary-dark)', 
            padding:'4px 16px', 
            borderRadius:'99px',
            transform:'rotate(-2deg)',
            fontWeight:800,
            color:'var(--primary-dark)',
            boxShadow:'0 4px 0 var(--primary-dark)',
            marginTop:-10,
            zIndex:11
          }}>
            HOTEL PMS
          </div>
        </div>

        {/* Login Card */}
        <div className="card" style={{ width:'100%', padding:'32px', background:'var(--bg-card)' }}>
          <h2 style={{ fontSize:22, fontWeight:900, color:'var(--primary-dark)', marginBottom:8, textAlign:'center' }}>Đăng nhập</h2>
          <p style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)', marginBottom:32, textAlign:'center' }}>Nhập thông tin nhân viên của bạn</p>

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
              <div style={{ background:'var(--coral-light)', border:'2px solid var(--coral)', borderRadius:'var(--radius-md)', padding:'12px 16px', fontSize:14, fontWeight:700, color:'#fff', textAlign:'center', animation:'bounce-scale .3s' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ marginTop:8 }}>
              {loading ? 'ĐANG ĐĂNG NHẬP...' : 'VÀO CA LÀM VIỆC'}
            </button>
          </form>

          {/* Quick login */}
          <div style={{ marginTop:32 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ flex:1, height:2, borderTop:'2px dashed var(--border)' }}/>
              <span style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>Đăng nhập nhanh</span>
              <div style={{ flex:1, height:2, borderTop:'2px dashed var(--border)' }}/>
            </div>
            
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {(['admin','manager','receptionist','hk_supervisor'] as const).map(role => (
                <button key={role} onClick={()=>quickLogin(role)} className="btn btn-secondary btn-sm" style={{ textTransform:'capitalize' }}>
                  {role === 'hk_supervisor' ? 'HK Supervisor' : role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
