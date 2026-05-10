import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createGuest, deleteGuest, fetchGuests, queryKeys, updateGuest, type GuestMutationInput } from '@/lib/data';
import { useAuth } from '@/features/auth/AuthContext';
import type { Guest } from '@/types';
import { Search, Plus, Star, ShieldAlert, Globe, Trash2 } from 'lucide-react';

const fmt = (n:number) => new Intl.NumberFormat('vi-VN').format(n);

const blankGuest = (propertyId: string): GuestMutationInput => ({
  propertyId,
  firstName: '',
  lastName: '',
  phone: '',
  nationality: 'Việt Nam',
  documentType: 'cccd',
  documentNumber: '',
  documentIssueDate: '',
  documentIssuePlace: '',
  dateOfBirth: '',
  gender: 'male',
  occupation: '',
  currentAddress: '',
  stayPurpose: 'Lưu trú du lịch/công tác',
  email: '',
  notes: '',
  isVip: false,
  isBlacklisted: false,
  blacklistReason: '',
  loyaltyCode: '',
  marketingConsent: false,
});

const guestToForm = (guest: Guest): GuestMutationInput => ({
  propertyId: guest.propertyId,
  firstName: guest.firstName,
  lastName: guest.lastName,
  fullName: guest.fullName,
  email: guest.email ?? '',
  phone: guest.phone,
  nationality: guest.nationality,
  documentType: guest.documentType,
  documentNumber: guest.documentNumber,
  documentIssueDate: guest.documentIssueDate ?? '',
  documentIssuePlace: guest.documentIssuePlace ?? '',
  dateOfBirth: guest.dateOfBirth ?? '',
  gender: guest.gender ?? 'male',
  occupation: guest.occupation ?? '',
  currentAddress: guest.currentAddress ?? '',
  stayPurpose: guest.stayPurpose ?? '',
  marketingConsent: guest.marketingConsent ?? false,
  isVip: guest.isVip,
  isBlacklisted: guest.isBlacklisted,
  blacklistReason: guest.blacklistReason ?? '',
  loyaltyCode: guest.loyaltyCode ?? '',
  notes: guest.notes ?? '',
});

export default function GuestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all'|'vip'|'blacklist'>('all');
  const [selected, setSelected] = useState<Guest|null>(null);
  const [editing, setEditing] = useState<Guest|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GuestMutationInput>(() => blankGuest(user?.propertyId ?? 'prop-001'));
  const [formError, setFormError] = useState<string | null>(null);
  const guestsQuery = useQuery({ queryKey: queryKeys.guests, queryFn: fetchGuests });
  const guests = guestsQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.documentNumber.trim()) {
        throw new Error('Vui lòng nhập họ tên, SĐT và số giấy tờ.');
      }
      if (!form.dateOfBirth || !form.documentIssueDate || !form.documentIssuePlace || !form.occupation || !form.currentAddress || !form.stayPurpose) {
        throw new Error('Cần đủ trường C65: ngày sinh, ngày/nơi cấp, nghề nghiệp, địa chỉ, lý do lưu trú.');
      }
      if (editing) await updateGuest(editing.id, form);
      else await createGuest(form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.guests });
      setShowForm(false);
      setEditing(null);
      setForm(blankGuest(user?.propertyId ?? 'prop-001'));
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : 'Không lưu được hồ sơ khách.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGuest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.guests });
      setSelected(null);
    },
    onError: (err) => alert(err instanceof Error ? err.message : 'Không xóa được khách.'),
  });

  const openCreate = () => {
    setSelected(null);
    setEditing(null);
    setForm(blankGuest(user?.propertyId ?? guests[0]?.propertyId ?? 'prop-001'));
    setShowForm(true);
    setFormError(null);
  };

  const openEdit = (guest: Guest) => {
    setSelected(null);
    setEditing(guest);
    setForm(guestToForm(guest));
    setShowForm(true);
    setFormError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(blankGuest(user?.propertyId ?? 'prop-001'));
    setFormError(null);
  };

  const filtered = guests.filter(g => {
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
        <div><h1>Khách hàng</h1><p>{guests.length} hồ sơ · {guests.filter(g=>g.isVip).length} VIP</p></div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={14}/> Thêm khách</button>
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
              <button className="btn btn-danger" disabled={deleteMutation.isPending} onClick={()=>deleteMutation.mutate(selected.id)}><Trash2 size={14}/> Xóa</button>
              <button className="btn btn-primary flex-1" onClick={()=>openEdit(selected)}>Chỉnh sửa</button>
            </div>
          </div>
        </>
      )}

      {showForm && !selected && (
        <div className="modal-overlay" onClick={closeForm}>
          <form className="modal" style={{ maxWidth:760 }} onClick={e=>e.stopPropagation()} onSubmit={e=>{ e.preventDefault(); saveMutation.mutate(); }}>
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Chỉnh sửa khách' : 'Thêm khách'}</span>
              <button type="button" className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="form-error" style={{ marginBottom:12 }}>{formError}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:14 }}>
                <div className="form-group"><label className="form-label">Họ</label><input className="form-input" value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Tên đệm/tên</label><input className="form-input" value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">SĐT</label><input className="form-input" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email ?? ''} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Quốc tịch</label><input className="form-input" value={form.nationality} onChange={e=>setForm(f=>({...f,nationality:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Giới tính</label><select className="form-input form-select" value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value as GuestMutationInput['gender']}))}><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></div>
                <div className="form-group"><label className="form-label">Ngày sinh</label><input className="form-input" type="date" value={form.dateOfBirth ?? ''} onChange={e=>setForm(f=>({...f,dateOfBirth:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Nghề nghiệp</label><input className="form-input" value={form.occupation ?? ''} onChange={e=>setForm(f=>({...f,occupation:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Loại giấy tờ</label><select className="form-input form-select" value={form.documentType} onChange={e=>setForm(f=>({...f,documentType:e.target.value as GuestMutationInput['documentType']}))}><option value="cccd">CCCD</option><option value="passport">Passport</option><option value="other">Khác</option></select></div>
                <div className="form-group"><label className="form-label">Số giấy tờ</label><input className="form-input" value={form.documentNumber} onChange={e=>setForm(f=>({...f,documentNumber:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Ngày cấp</label><input className="form-input" type="date" value={form.documentIssueDate ?? ''} onChange={e=>setForm(f=>({...f,documentIssueDate:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Nơi cấp</label><input className="form-input" value={form.documentIssuePlace ?? ''} onChange={e=>setForm(f=>({...f,documentIssuePlace:e.target.value}))}/></div>
                <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Nơi ở hiện tại</label><input className="form-input" value={form.currentAddress ?? ''} onChange={e=>setForm(f=>({...f,currentAddress:e.target.value}))}/></div>
                <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Lý do lưu trú</label><input className="form-input" value={form.stayPurpose ?? ''} onChange={e=>setForm(f=>({...f,stayPurpose:e.target.value}))}/></div>
                <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Ghi chú</label><textarea className="form-input" rows={2} value={form.notes ?? ''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}><input type="checkbox" checked={Boolean(form.isVip)} onChange={e=>setForm(f=>({...f,isVip:e.target.checked}))}/> VIP</label>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}><input type="checkbox" checked={Boolean(form.isBlacklisted)} onChange={e=>setForm(f=>({...f,isBlacklisted:e.target.checked}))}/> Blacklist</label>
                {form.isBlacklisted && <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Lý do blacklist</label><input className="form-input" value={form.blacklistReason ?? ''} onChange={e=>setForm(f=>({...f,blacklistReason:e.target.value}))}/></div>}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeForm}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Đang lưu...' : 'Lưu hồ sơ'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
