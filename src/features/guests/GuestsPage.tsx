import React, { useState } from 'react';
import { mockGuests } from '@/mock/guests';
import type { Guest } from '@/types';
import { Search, Plus, Star, ShieldAlert, Globe } from 'lucide-react';

const fmt = (n:number) => new Intl.NumberFormat('vi-VN').format(n);

export default function GuestsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all'|'vip'|'blacklist'>('all');
  const [selected, setSelected] = useState<Guest|null>(null);

  const filtered = mockGuests.filter(g => {
    if (filter === 'vip' && !g.isVip) return false;
    if (filter === 'blacklist' && !g.isBlacklisted) return false;
    if (search) {
      const q = search.toLowerCase();
      return g.fullName.toLowerCase().includes(q) || g.phone.includes(q) || g.documentNumber.includes(q) || (g.email?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div><h1>Khách hàng</h1><p>{mockGuests.length} hồ sơ · {mockGuests.filter(g=>g.isVip).length} VIP</p></div>
        <button className="btn btn-primary btn-sm"><Plus size={14}/> Thêm khách</button>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div className="search-box" style={{ flex:1, minWidth:240 }}>
          <Search size={15} color="var(--text-muted)"/>
          <input placeholder="Tìm tên, SĐT, CCCD/Passport..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {(['all','vip','blacklist'] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{ padding:'6px 14px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', background:filter===f?'var(--accent)':'var(--bg-card)', color:filter===f?'#fff':'var(--text-secondary)', cursor:'pointer', fontSize:12.5, fontWeight:500 }}>
            {f==='all'?'Tất cả':f==='vip'?'⭐ VIP':'🚫 Blacklist'}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Khách</th><th>Liên hệ</th><th>Giấy tờ</th><th>Quốc tịch</th><th>Số lần lưu trú</th><th>Tổng chi tiêu</th><th>Nhãn</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <tr key={g.id} style={{ cursor:'pointer' }} onClick={()=>setSelected(g)}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:34, height:34, borderRadius:'50%', background: g.isVip?'linear-gradient(135deg,#f59e0b,#ef4444)':g.isBlacklisted?'#fecaca':'var(--accent-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color: g.isVip?'#fff':g.isBlacklisted?'#991b1b':'var(--accent)', flexShrink:0 }}>
                        {g.firstName[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight:600 }}>{g.fullName}</div>
                        {g.notes && <div style={{ fontSize:11, color:'var(--text-muted)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.notes}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize:13 }}>{g.phone}</div>
                    {g.email && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{g.email}</div>}
                  </td>
                  <td>
                    <div style={{ fontSize:12, fontFamily:'monospace' }}>{g.documentNumber}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{g.documentType==='cccd'?'CCCD':g.documentType==='passport'?'Passport':'Khác'}</div>
                  </td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Globe size={13} color="var(--text-muted)"/>
                      <span style={{ fontSize:13 }}>{g.nationality}</span>
                    </div>
                  </td>
                  <td style={{ textAlign:'center', fontWeight:600 }}>{g.totalStays}</td>
                  <td style={{ fontWeight:600 }}>{fmt(g.totalSpent)}đ</td>
                  <td>
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                      {g.isVip && <span className="badge badge-yellow"><Star size={10}/> VIP</span>}
                      {g.isBlacklisted && <span className="badge badge-red"><ShieldAlert size={10}/> Blacklist</span>}
                      {g.loyaltyCode && <span className="badge badge-purple">{g.loyaltyCode}</span>}
                    </div>
                  </td>
                  <td><button className="btn btn-ghost btn-sm">Xem</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="empty-state"><Globe size={40} className="empty-state-icon"/><h3>Không tìm thấy</h3></div>
        )}
      </div>

      {/* Guest profile drawer */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={()=>setSelected(null)}/>
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background: selected.isVip?'linear-gradient(135deg,#f59e0b,#ef4444)':'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#fff' }}>{selected.firstName[0]}</div>
                  <div>
                    <div className="modal-title">{selected.fullName}</div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{selected.nationality} · {selected.totalStays} lần lưu trú</div>
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              {selected.isBlacklisted && (
                <div style={{ background:'var(--danger-light)', border:'1px solid #fecaca', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:16, fontSize:13, color:'#991b1b' }}>
                  <ShieldAlert size={14} style={{ verticalAlign:'middle', marginRight:6 }}/>
                  <strong>Blacklisted:</strong> {selected.blacklistReason}
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                {[
                  ['Họ tên', selected.fullName],
                  ['SĐT', selected.phone],
                  ['Email', selected.email ?? '—'],
                  ['Giới tính', selected.gender ?? '—'],
                  ['Ngày sinh', selected.dateOfBirth ?? '—'],
                  ['Quốc tịch', selected.nationality],
                  ['Nghề nghiệp', selected.occupation ?? '—'],
                  ['Địa chỉ', selected.currentAddress ?? '—'],
                  ['Loại giấy tờ', selected.documentType.toUpperCase()],
                  ['Số giấy tờ', selected.documentNumber],
                  ['Ngày cấp', selected.documentIssueDate ?? '—'],
                  ['Nơi cấp', selected.documentIssuePlace ?? '—'],
                  ['Tổng lưu trú', `${selected.totalStays} lần`],
                  ['Tổng chi tiêu', `${fmt(selected.totalSpent)}đ`],
                ].map(([k,v])=>(
                  <div key={String(k)}>
                    <div className="form-label">{k}</div>
                    <div style={{ marginTop:3, fontWeight:500, fontSize:13 }}>{v}</div>
                  </div>
                ))}
                {selected.notes && <div style={{ gridColumn:'span 2' }}>
                  <div className="form-label">Ghi chú</div>
                  <div style={{ marginTop:3, fontSize:13, color:'var(--text-secondary)' }}>{selected.notes}</div>
                </div>}
              </div>
            </div>
            <div className="drawer-footer">
              <button className="btn btn-secondary flex-1" onClick={()=>setSelected(null)}>Đóng</button>
              <button className="btn btn-primary flex-1">Chỉnh sửa</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
