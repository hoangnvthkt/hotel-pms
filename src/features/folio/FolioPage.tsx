import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addFolioCharge, fetchOpenFolios, queryKeys, recordFolioPayment, requestRefund, verifyPayment } from '@/lib/data';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthContext';
import type { Folio, FolioItemSourceType, PaymentMethod, PaymentStatus } from '@/types';
import { CheckCircle, CreditCard, FileText, Plus, Printer, Receipt, RotateCcw } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

const methodLabel: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  qr_manual: 'QR thủ công',
  card_manual: 'Thẻ thủ công',
  gateway_later: 'Gateway sau',
};

const statusLabel: Record<PaymentStatus, string> = {
  draft: 'Nháp',
  pending_verification: 'Chờ xác nhận',
  posted: 'Đã thu',
  finalized: 'Đã đối soát',
  voided: 'Đã void',
  refunded: 'Đã hoàn',
};

type Tab = 'folio' | 'payments' | 'refunds' | 'receipts';

export default function FolioPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const foliosQuery = useQuery({ queryKey: queryKeys.folios, queryFn: fetchOpenFolios, refetchInterval: 30_000 });
  const folios = foliosQuery.data ?? [];
  const [selectedId, setSelectedId] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('folio');
  const [addPayModal, setAddPayModal] = useState(false);
  const [addChargeModal, setAddChargeModal] = useState(false);
  const [refundModal, setRefundModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ method: 'cash' as PaymentMethod, amount: 0, reference: '', evidencePath: '' });
  const [chargeForm, setChargeForm] = useState({ sourceType: 'manual_service' as FolioItemSourceType, description: '', amount: 0 });
  const [refundForm, setRefundForm] = useState({ amount: 0, reason: '', paymentId: '' });

  const effectiveSelectedId = selectedId || folios[0]?.id || '';
  const folio = folios.find(f => f.id === effectiveSelectedId);
  const items = folio?.items ?? [];
  const payments = folio?.payments ?? [];
  const receipts = folio?.receipts ?? [];
  const totalDebit = folio?.totalDebits ?? 0;
  const totalCredit = folio?.totalCredits ?? 0;
  const balance = folio?.balance ?? 0;
  const pendingTotal = payments.filter(p => p.status === 'pending_verification').reduce((sum, item) => sum + item.amount, 0);
  const canVerify = ['admin', 'manager', 'accountant'].includes(user?.role ?? '');

  const refreshFolios = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.folios }),
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentQueue }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashierSessions }),
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
    onError: (err) => setActionError(errorMessage(err, 'Không thêm được charge.')),
  });

  const paymentMutation = useMutation({
    mutationFn: () => {
      if (!folio) throw new Error('Chưa chọn folio.');
      if (paymentForm.amount <= 0) throw new Error('Số tiền thanh toán phải lớn hơn 0.');
      return recordFolioPayment(folio, paymentForm.method, paymentForm.amount, paymentForm.reference, paymentForm.evidencePath);
    },
    onSuccess: async () => {
      await refreshFolios();
      setAddPayModal(false);
      setPaymentForm({ method: 'cash', amount: 0, reference: '', evidencePath: '' });
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không ghi nhận được thanh toán.')),
  });

  const verifyMutation = useMutation({
    mutationFn: (paymentId: string) => verifyPayment(paymentId, 'payment', 'approve'),
    onSuccess: async () => {
      await refreshFolios();
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không xác nhận được chuyển khoản.')),
  });

  const refundMutation = useMutation({
    mutationFn: () => {
      if (!folio) throw new Error('Chưa chọn folio.');
      if (refundForm.amount <= 0 || !refundForm.reason.trim()) throw new Error('Nhập số tiền và lý do hoàn tiền.');
      return requestRefund(folio, refundForm.paymentId || null, refundForm.amount, refundForm.reason);
    },
    onSuccess: async () => {
      await refreshFolios();
      setRefundModal(false);
      setRefundForm({ amount: 0, reason: '', paymentId: '' });
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không tạo được yêu cầu hoàn tiền.')),
  });

  const openPaymentModal = () => {
    setPaymentForm(f => ({ ...f, amount: Math.max(balance, 0), method: 'cash' }));
    setAddPayModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Folio & Cashiering</h1>
          <p>{folios.length} folio đang mở · {pendingTotal > 0 ? `${fmt(pendingTotal)}đ chờ xác nhận` : 'không có payment pending'}</p>
        </div>
      </div>
      {actionError && <div className="form-error" style={{ marginBottom: 12 }}>{actionError}</div>}

      <div className="folio-layout">
        <div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>Phòng đang có khách</div>
            {folios.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => { setSelectedId(f.id); setActiveTab('folio'); }}
                style={{ width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', background: effectiveSelectedId === f.id ? 'var(--primary-bg)' : 'transparent' }}
              >
                <div style={{ fontWeight: 800, color: effectiveSelectedId === f.id ? 'var(--primary-dark)' : undefined }}>P.{f.roomNumber}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{f.guestName}</div>
                <div style={{ fontSize: 12, color: f.balance > 0 ? 'var(--danger)' : 'var(--success)', marginTop: 2 }}>
                  Balance: {fmt(f.balance)}đ
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          {folio ? (
            <>
              <div className="card" style={{ marginBottom: 16, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{folio.guestName}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    P.{folio.roomNumber} · {folio.checkIn} → {folio.checkOut}
                  </div>
                  {pendingTotal > 0 && <div style={{ marginTop: 6 }}><span className="badge badge-yellow">{fmt(pendingTotal)}đ chuyển khoản chờ xác nhận</span></div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Số dư hợp lệ</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: balance > 0 ? 'var(--danger)' : balance < 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                    {balance >= 0 ? '' : '+'}{fmt(Math.abs(balance))}đ
                  </div>
                  <div style={{ fontSize: 12, color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {balance > 0 ? 'Còn phải thu' : 'Đã đủ hoặc dư tiền'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {(['folio', 'payments', 'refunds', 'receipts'] as const).map(tab => (
                  <button key={tab} className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(tab)}>
                    {tab === 'folio' ? 'Folio' : tab === 'payments' ? 'Thanh toán' : tab === 'refunds' ? 'Hoàn tiền' : 'Receipt'}
                  </button>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => setAddChargeModal(true)}><Plus size={13} /> Thêm charge</button>
                <button className="btn btn-primary btn-sm" onClick={openPaymentModal}><CreditCard size={13} /> Thu tiền</button>
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => window.print()}><Printer size={13} /> In folio</button>
              </div>

              {activeTab === 'folio' && (
                <div className="card" style={{ padding: 0 }}>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Ngày</th><th>Mô tả</th><th>Debit</th><th>Credit</th></tr></thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={item.id}>
                            <td style={{ fontSize: 12 }}>{item.date}</td>
                            <td>{item.description}</td>
                            <td className={item.type === 'debit' ? 'folio-debit' : ''}>{item.type === 'debit' ? `${fmt(item.amount)}đ` : '—'}</td>
                            <td className={item.type === 'credit' ? 'folio-credit' : ''}>{item.type === 'credit' ? `${fmt(item.amount)}đ` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f9fafb', fontWeight: 800 }}>
                          <td colSpan={2} style={{ padding: '12px 14px', textAlign: 'right' }}>Tổng cộng</td>
                          <td style={{ padding: '12px 14px', color: 'var(--danger)' }}>{fmt(totalDebit)}đ</td>
                          <td style={{ padding: '12px 14px', color: 'var(--success)' }}>{fmt(totalCredit)}đ</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'payments' && (
                <div className="card" style={{ padding: 0 }}>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Thời gian</th><th>Phương thức</th><th>Reference</th><th>Số tiền</th><th>Trạng thái</th><th>Receipt</th><th></th></tr></thead>
                      <tbody>
                        {payments.map(payment => (
                          <tr key={payment.id}>
                            <td style={{ fontSize: 12 }}>{new Date(payment.receivedAt).toLocaleString('vi-VN')}</td>
                            <td>{methodLabel[payment.method]}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{payment.reference ?? '—'}</td>
                            <td style={{ fontWeight: 800 }}>{fmt(payment.amount)}đ</td>
                            <td><span className={`badge ${payment.status === 'pending_verification' ? 'badge-yellow' : payment.status === 'voided' ? 'badge-gray' : 'badge-green'}`}>{statusLabel[payment.status]}</span></td>
                            <td>{payment.receiptNumber ?? '—'}</td>
                            <td>
                              {canVerify && payment.status === 'pending_verification' && (
                                <button className="btn btn-primary btn-sm" disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate(payment.id)}>
                                  <CheckCircle size={13} /> Duyệt
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {payments.length === 0 && <div className="empty-state"><h3>Chưa có thanh toán</h3></div>}
                </div>
              )}

              {activeTab === 'refunds' && (
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>Yêu cầu hoàn tiền</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Receptionist tạo yêu cầu, accountant/manager duyệt ở bước đối soát.</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setRefundForm({ amount: Math.max(-balance, 0), reason: '', paymentId: payments.find(p => ['posted', 'finalized'].includes(p.status))?.id ?? '' }); setRefundModal(true); }}>
                      <RotateCcw size={13} /> Tạo yêu cầu
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'receipts' && (
                <div className="card" style={{ padding: 0 }}>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Số biên nhận</th><th>Loại</th><th>Phương thức</th><th>Số tiền</th><th>Ngày phát hành</th><th>Trạng thái</th></tr></thead>
                      <tbody>
                        {receipts.map(receipt => (
                          <tr key={receipt.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 800 }}>{receipt.receiptNumber}</td>
                            <td>{receipt.receiptType === 'deposit' ? 'Cọc' : receipt.receiptType === 'refund' ? 'Hoàn tiền' : 'Thanh toán'}</td>
                            <td>{receipt.method ? methodLabel[receipt.method] : '—'}</td>
                            <td style={{ fontWeight: 800 }}>{fmt(receipt.amount)}đ</td>
                            <td>{new Date(receipt.issuedAt).toLocaleString('vi-VN')}</td>
                            <td><span className="badge badge-green">{receipt.status === 'issued' ? 'Đã phát hành' : 'Đã void'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {receipts.length === 0 && <div className="empty-state"><FileText size={36} className="empty-state-icon" /><h3>Chưa có receipt</h3></div>}
                </div>
              )}
            </>
          ) : (
            <div className="card empty-state"><Receipt size={40} className="empty-state-icon" /><h3>Chọn phòng để xem folio</h3></div>
          )}
        </div>
      </div>

      {addPayModal && (
        <div className="modal-overlay" onClick={() => setAddPayModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Ghi nhận thanh toán</span><button className="modal-close" onClick={() => setAddPayModal(false)}>✕</button></div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Phương thức</label>
                  <select className="form-input form-select" value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}>
                    <option value="cash">Tiền mặt</option>
                    <option value="bank_transfer">Chuyển khoản</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Số tiền</label>
                  <input className="form-input" type="number" value={paymentForm.amount || ''} onChange={e => setPaymentForm(f => ({ ...f, amount: Number(e.target.value) }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Mã giao dịch / ghi chú</label>
                  <input className="form-input" value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} placeholder={paymentForm.method === 'bank_transfer' ? 'Mã chuyển khoản...' : 'Tùy chọn...'} />
                </div>
                {paymentForm.method === 'bank_transfer' && (
                  <div className="form-group">
                    <label className="form-label">Đường dẫn chứng từ</label>
                    <input className="form-input" value={paymentForm.evidencePath} onChange={e => setPaymentForm(f => ({ ...f, evidencePath: e.target.value }))} placeholder="storage/path hoặc ghi chú ảnh..." />
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chuyển khoản sẽ ở trạng thái chờ xác nhận và chưa trừ balance.</div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAddPayModal(false)}>Hủy</button>
              <button className="btn btn-primary" disabled={paymentMutation.isPending} onClick={() => paymentMutation.mutate()}><CreditCard size={14} /> Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {addChargeModal && (
        <div className="modal-overlay" onClick={() => setAddChargeModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Thêm khoản phí</span><button className="modal-close" onClick={() => setAddChargeModal(false)}>✕</button></div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Loại dịch vụ</label>
                  <select className="form-input form-select" value={chargeForm.sourceType} onChange={e => setChargeForm(f => ({ ...f, sourceType: e.target.value as FolioItemSourceType }))}>
                    <option value="minibar">Minibar</option><option value="laundry">Giặt ủi</option><option value="manual_service">Dịch vụ khác</option><option value="other">Khác</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Mô tả</label><input className="form-input" value={chargeForm.description} onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Số tiền</label><input className="form-input" type="number" value={chargeForm.amount || ''} onChange={e => setChargeForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAddChargeModal(false)}>Hủy</button>
              <button className="btn btn-primary" disabled={chargeMutation.isPending} onClick={() => chargeMutation.mutate()}><Plus size={14} /> Thêm</button>
            </div>
          </div>
        </div>
      )}

      {refundModal && (
        <div className="modal-overlay" onClick={() => setRefundModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Yêu cầu hoàn tiền</span><button className="modal-close" onClick={() => setRefundModal(false)}>✕</button></div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Payment gốc</label>
                  <select className="form-input form-select" value={refundForm.paymentId} onChange={e => setRefundForm(f => ({ ...f, paymentId: e.target.value }))}>
                    <option value="">Không chọn</option>
                    {payments.filter(p => ['posted', 'finalized'].includes(p.status)).map(payment => (
                      <option key={payment.id} value={payment.id}>{methodLabel[payment.method]} · {fmt(payment.amount)}đ · {payment.reference ?? payment.id.slice(0, 8)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Số tiền</label><input className="form-input" type="number" value={refundForm.amount || ''} onChange={e => setRefundForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
                <div className="form-group"><label className="form-label">Lý do</label><textarea className="form-input" rows={3} value={refundForm.reason} onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRefundModal(false)}>Hủy</button>
              <button className="btn btn-primary" disabled={refundMutation.isPending} onClick={() => refundMutation.mutate()}><RotateCcw size={14} /> Tạo yêu cầu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
