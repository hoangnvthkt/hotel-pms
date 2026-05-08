import React, { useState } from 'react';
import { mockBookings } from '@/mock/bookings';
import { Plus, CreditCard, Receipt, Printer } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

type FolioItem = {
  id: string; type: 'debit'|'credit'; desc: string; date: string; amount: number; source: string;
};

const buildFolio = (bookingId: string): FolioItem[] => {
  const b = mockBookings.find(bk => bk.id === bookingId);
  if (!b) return [];
  return [
    { id:'fi-1', type:'debit', desc:`Tiền phòng ${b.roomNumber} — ${b.checkIn} → ${b.checkOut} (${b.nights} đêm)`, date:b.checkIn, amount:b.totalAmount, source:'room' },
    { id:'fi-2', type:'debit', desc:'Minibar — Nước suối, bia', date:b.checkIn, amount:120000, source:'minibar' },
    { id:'fi-3', type:'debit', desc:'Dịch vụ giặt ủi', date:b.checkIn, amount:250000, source:'laundry' },
    { id:'fi-4', type:'credit', desc:`Đặt cọc (${b.depositPaid?'Đã nhận':'Chưa nhận'})`, date:b.checkIn, amount:b.depositAmount, source:'deposit' },
  ];
};

export default function FolioPage() {
  const activeBks = mockBookings.filter(b => b.status === 'checked_in');
  const [selectedId, setSelectedId] = useState(activeBks[0]?.id ?? '');
  const [addPayModal, setAddPayModal] = useState(false);
  const [addChargeModal, setAddChargeModal] = useState(false);

  const booking = mockBookings.find(b => b.id === selectedId);
  const items = buildFolio(selectedId);
  const totalDebit = items.filter(i=>i.type==='debit').reduce((s,i)=>s+i.amount,0);
  const totalCredit = items.filter(i=>i.type==='credit').reduce((s,i)=>s+i.amount,0);
  const balance = totalDebit - totalCredit;

  return (
    <div>
      <div className="page-header">
        <div><h1>Folio & Thanh toán</h1><p>{activeBks.length} phòng đang có khách</p></div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20 }}>
        {/* Booking selector */}
        <div>
          <div className="card" style={{ padding:0 }}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', fontWeight:600, fontSize:13 }}>Phòng đang có khách</div>
            {activeBks.map(b => (
              <div key={b.id} onClick={()=>setSelectedId(b.id)}
                style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-light)', cursor:'pointer', background:selectedId===b.id?'var(--accent-light)':undefined, transition:'background .15s' }}>
                <div style={{ fontWeight:700, color:selectedId===b.id?'var(--accent)':undefined }}>P.{b.roomNumber}</div>
                <div style={{ fontSize:12.5, color:'var(--text-secondary)' }}>{b.guestName}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>CO: {b.checkOut}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Folio detail */}
        <div>
          {booking ? (
            <>
              {/* Folio header */}
              <div className="card" style={{ marginBottom:16, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{booking.guestName}</div>
                  <div style={{ fontSize:13, color:'var(--text-secondary)' }}>
                    P.{booking.roomNumber} · {booking.checkIn} → {booking.checkOut} · {booking.nights} đêm
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Số dư</div>
                  <div style={{ fontSize:24, fontWeight:800, color: balance>0?'var(--danger)':balance<0?'var(--success)':'var(--text-primary)' }}>
                    {balance >= 0 ? '' : '+'}{fmt(Math.abs(balance))}đ
                  </div>
                  {balance > 0 && <div style={{ fontSize:12, color:'var(--danger)' }}>Còn nợ</div>}
                  {balance <= 0 && <div style={{ fontSize:12, color:'var(--success)' }}>Đã thanh toán đủ</div>}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                <button className="btn btn-secondary btn-sm" onClick={()=>setAddChargeModal(true)}><Plus size={13}/> Thêm charge</button>
                <button className="btn btn-primary btn-sm" onClick={()=>setAddPayModal(true)}><CreditCard size={13}/> Thanh toán</button>
                <button className="btn btn-secondary btn-sm" style={{ marginLeft:'auto' }}><Printer size={13}/> In invoice</button>
              </div>

              {/* Items table */}
              <div className="card" style={{ padding:0 }}>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Ngày</th><th>Mô tả</th><th>Debit</th><th>Credit</th></tr></thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id}>
                          <td style={{ fontSize:12 }}>{item.date}</td>
                          <td>{item.desc}</td>
                          <td className={item.type==='debit'?'folio-debit':''}>{item.type==='debit'?`${fmt(item.amount)}đ`:'—'}</td>
                          <td className={item.type==='credit'?'folio-credit':''}>{item.type==='credit'?`${fmt(item.amount)}đ`:'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:'#f9fafb', fontWeight:700 }}>
                        <td colSpan={2} style={{ padding:'12px 14px', textAlign:'right' }}>Tổng cộng</td>
                        <td style={{ padding:'12px 14px', color:'var(--danger)' }}>{fmt(totalDebit)}đ</td>
                        <td style={{ padding:'12px 14px', color:'var(--success)' }}>{fmt(totalCredit)}đ</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card empty-state"><Receipt size={40} className="empty-state-icon"/><h3>Chọn phòng để xem folio</h3></div>
          )}
        </div>
      </div>

      {/* Add payment modal */}
      {addPayModal && (
        <div className="modal-overlay" onClick={()=>setAddPayModal(false)}>
          <div className="modal" style={{ maxWidth:400 }} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Thêm thanh toán</span><button className="modal-close" onClick={()=>setAddPayModal(false)}>✕</button></div>
            <div className="modal-body">
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="form-group">
                  <label className="form-label">Phương thức</label>
                  <select className="form-input form-select">
                    <option>Tiền mặt</option><option>Chuyển khoản</option><option>QR Manual</option><option>Thẻ (Manual)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Số tiền</label>
                  <input className="form-input" type="number" defaultValue={balance} placeholder="0"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Ghi chú</label>
                  <input className="form-input" placeholder="Tùy chọn..."/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setAddPayModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={()=>setAddPayModal(false)}><CreditCard size={14}/> Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Add charge modal */}
      {addChargeModal && (
        <div className="modal-overlay" onClick={()=>setAddChargeModal(false)}>
          <div className="modal" style={{ maxWidth:400 }} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Thêm khoản phí</span><button className="modal-close" onClick={()=>setAddChargeModal(false)}>✕</button></div>
            <div className="modal-body">
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="form-group">
                  <label className="form-label">Loại dịch vụ</label>
                  <select className="form-input form-select">
                    <option>Minibar</option><option>Giặt ủi</option><option>Dịch vụ khác</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Mô tả</label>
                  <input className="form-input" placeholder="Mô tả khoản phí..."/>
                </div>
                <div className="form-group">
                  <label className="form-label">Số tiền</label>
                  <input className="form-input" type="number" placeholder="0"/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setAddChargeModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={()=>setAddChargeModal(false)}><Plus size={14}/> Thêm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
