import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addFolioCharge, fetchOpenFolios, queryKeys, recordFolioPayment } from '@/lib/data';
import type { Folio, FolioItemSourceType, PaymentMethod } from '@/types';
import { Plus, CreditCard, Receipt, Printer } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

export default function FolioPage() {
  const queryClient = useQueryClient();
  const foliosQuery = useQuery({ queryKey: queryKeys.folios, queryFn: fetchOpenFolios, refetchInterval: 30_000 });
  const folios = foliosQuery.data ?? [];
  const [selectedId, setSelectedId] = useState('');
  const [addPayModal, setAddPayModal] = useState(false);
  const [addChargeModal, setAddChargeModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ method: 'cash' as PaymentMethod, amount: 0, reference: '' });
  const [chargeForm, setChargeForm] = useState({ sourceType: 'manual_service' as FolioItemSourceType, description: '', amount: 0 });

  const effectiveSelectedId = selectedId || folios[0]?.id || '';
  const folio = folios.find(f => f.id === effectiveSelectedId);
  const items = folio?.items ?? [];
  const totalDebit = folio?.totalDebits ?? 0;
  const totalCredit = folio?.totalCredits ?? 0;
  const balance = folio?.balance ?? 0;

  const refreshFolios = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.folios }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
    ]);
  };

  const chargeMutation = useMutation({
    mutationFn: () => {
      if (!folio) throw new Error('Chưa chọn folio.');
      if (!chargeForm.description.trim() || chargeForm.amount <= 0) throw new Error('Nhập mô tả và số tiền charge hợp lệ.');
      return addFolioCharge(folio, chargeForm.sourceType, chargeForm.description, chargeForm.amount);
    },
    onSuccess: async () => {
      await refreshFolios();
      setAddChargeModal(false);
      setChargeForm({ sourceType: 'manual_service', description: '', amount: 0 });
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Không thêm được charge.'),
  });

  const paymentMutation = useMutation({
    mutationFn: () => {
      if (!folio) throw new Error('Chưa chọn folio.');
      if (paymentForm.amount <= 0) throw new Error('Số tiền thanh toán phải lớn hơn 0.');
      return recordFolioPayment(folio, paymentForm.method, paymentForm.amount, paymentForm.reference);
    },
    onSuccess: async () => {
      await refreshFolios();
      setAddPayModal(false);
      setPaymentForm({ method: 'cash', amount: 0, reference: '' });
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Không ghi nhận được thanh toán.'),
  });

  return (
    <div>
      <div className="page-header">
        <div><h1>Folio & Thanh toán</h1><p>{folios.length} folio đang mở</p></div>
      </div>
      {actionError && <div className="form-error" style={{ marginBottom:12 }}>{actionError}</div>}

      <div className="folio-layout">
        {/* Booking selector */}
        <div>
          <div className="card" style={{ padding:0 }}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', fontWeight:600, fontSize:13 }}>Phòng đang có khách</div>
            {folios.map(f => (
              <div key={f.id} onClick={()=>setSelectedId(f.id)}
                style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-light)', cursor:'pointer', background:effectiveSelectedId===f.id?'var(--accent-light)':undefined, transition:'background .15s' }}>
                <div style={{ fontWeight:700, color:effectiveSelectedId===f.id?'var(--accent)':undefined }}>P.{f.roomNumber}</div>
                <div style={{ fontSize:12.5, color:'var(--text-secondary)' }}>{f.guestName}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>CO: {f.checkOut}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Folio detail */}
        <div>
          {folio ? (
            <>
              {/* Folio header */}
              <div className="card" style={{ marginBottom:16, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:16 }}>{folio.guestName}</div>
                  <div style={{ fontSize:13, color:'var(--text-secondary)' }}>
                    P.{folio.roomNumber} · {folio.checkIn} → {folio.checkOut}
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
                <button className="btn btn-primary btn-sm" onClick={()=>{ setPaymentForm(f=>({...f, amount: Math.max(balance, 0)})); setAddPayModal(true); }}><CreditCard size={13}/> Thanh toán</button>
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
                          <td>{item.description}</td>
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
                  <select className="form-input form-select" value={paymentForm.method} onChange={e=>setPaymentForm(f=>({...f, method:e.target.value as PaymentMethod}))}>
                    <option value="cash">Tiền mặt</option><option value="bank_transfer">Chuyển khoản</option><option value="qr_manual">QR Manual</option><option value="card_manual">Thẻ (Manual)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Số tiền</label>
                  <input className="form-input" type="number" value={paymentForm.amount || Math.max(balance, 0)} onChange={e=>setPaymentForm(f=>({...f, amount:Number(e.target.value)}))} placeholder="0"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Ghi chú</label>
                  <input className="form-input" value={paymentForm.reference} onChange={e=>setPaymentForm(f=>({...f, reference:e.target.value}))} placeholder="Tùy chọn..."/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setAddPayModal(false)}>Hủy</button>
              <button className="btn btn-primary" disabled={paymentMutation.isPending} onClick={()=>paymentMutation.mutate()}><CreditCard size={14}/> Xác nhận</button>
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
                  <select className="form-input form-select" value={chargeForm.sourceType} onChange={e=>setChargeForm(f=>({...f, sourceType:e.target.value as FolioItemSourceType}))}>
                    <option value="minibar">Minibar</option><option value="laundry">Giặt ủi</option><option value="manual_service">Dịch vụ khác</option><option value="other">Khác</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Mô tả</label>
                  <input className="form-input" value={chargeForm.description} onChange={e=>setChargeForm(f=>({...f, description:e.target.value}))} placeholder="Mô tả khoản phí..."/>
                </div>
                <div className="form-group">
                  <label className="form-label">Số tiền</label>
                  <input className="form-input" type="number" value={chargeForm.amount || ''} onChange={e=>setChargeForm(f=>({...f, amount:Number(e.target.value)}))} placeholder="0"/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setAddChargeModal(false)}>Hủy</button>
              <button className="btn btn-primary" disabled={chargeMutation.isPending} onClick={()=>chargeMutation.mutate()}><Plus size={14}/> Thêm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
