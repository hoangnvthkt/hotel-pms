import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Eye, Landmark, LockKeyhole, RefreshCcw, ShieldCheck, XCircle } from 'lucide-react';
import { approveCashierSession, closeCashierSession, fetchCashierSessionTransactions, fetchCashierSessions, fetchOpenFolios, fetchPaymentVerificationQueue, queryKeys, verifyPayment } from '@/lib/data';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthContext';
import type { CashierSession, Folio, PaymentMethod, PaymentStatus } from '@/types';

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

const sessionStatusLabel: Record<CashierSession['status'], string> = {
  open: 'Đang mở',
  closed: 'Chờ duyệt',
  approved: 'Đã duyệt',
  voided: 'Đã void',
};

const transactionKindLabel = {
  deposit: 'Cọc',
  payment: 'Thu folio',
  refund: 'Hoàn tiền',
};

const sumFolioItems = (folio: Folio, predicate: (item: Folio['items'][number]) => boolean) =>
  folio.items.filter(predicate).reduce((sum, item) => sum + item.amount, 0);

const folioRoomCharges = (folio: Folio) =>
  folio.projection?.projectedRoomCharges ?? sumFolioItems(folio, item => item.type === 'debit' && item.sourceType === 'room');

const folioServiceCharges = (folio: Folio) =>
  folio.projection?.serviceCharges ?? sumFolioItems(folio, item => item.type === 'debit' && item.sourceType !== 'room' && item.sourceType !== 'room_adjustment');

const folioDepositCredits = (folio: Folio) =>
  folio.projection?.depositCredits ?? sumFolioItems(folio, item => item.type === 'credit' && item.sourceType === 'deposit');

const folioPaymentCredits = (folio: Folio) =>
  folio.projection?.paymentCredits ?? sumFolioItems(folio, item => item.type === 'credit' && item.sourceType === 'payment');

const folioPendingPayments = (folio: Folio) =>
  folio.projection?.pendingPayments ?? (folio.payments ?? []).filter(item => item.status === 'pending_verification').reduce((sum, item) => sum + item.amount, 0);

const folioProjectedBalance = (folio: Folio) =>
  folio.projection?.projectedBalance ?? folio.balance;

const varianceLabel = (variance?: number) => {
  if (typeof variance !== 'number') return 'Chưa nhập';
  if (variance === 0) return 'Đúng tiền';
  return variance > 0 ? 'Thu dư' : 'Thu thiếu';
};

const varianceColor = (variance?: number) => {
  if (typeof variance !== 'number' || variance === 0) return 'var(--success)';
  return variance > 0 ? 'var(--warning)' : 'var(--danger)';
};

export default function CashieringPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [closeSessionId, setCloseSessionId] = useState<string>('');
  const [approveSessionId, setApproveSessionId] = useState<string>('');
  const [closeForm, setCloseForm] = useState({ declaredCash: 0, note: '' });
  const [approveForm, setApproveForm] = useState({ note: '' });
  const queueQuery = useQuery({ queryKey: queryKeys.paymentQueue, queryFn: fetchPaymentVerificationQueue, refetchInterval: 30_000 });
  const sessionsQuery = useQuery({ queryKey: queryKeys.cashierSessions, queryFn: fetchCashierSessions, refetchInterval: 30_000 });
  const foliosQuery = useQuery({ queryKey: queryKeys.folios, queryFn: fetchOpenFolios, refetchInterval: 30_000 });
  const sessionTransactionsQuery = useQuery({
    queryKey: ['cashierSessionTransactions', selectedSessionId],
    queryFn: () => fetchCashierSessionTransactions(selectedSessionId),
    enabled: Boolean(selectedSessionId),
  });
  const queue = queueQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const folios = foliosQuery.data ?? [];
  const selectedSession = sessions.find(session => session.id === selectedSessionId);
  const closeSession = sessions.find(session => session.id === closeSessionId);
  const approveSession = sessions.find(session => session.id === approveSessionId);
  const roles = user?.roles ?? (user?.role ? [user.role] : []);
  const isFinanceRole = roles.some(role => ['admin', 'manager', 'accountant'].includes(role));

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentQueue }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashierSessions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.folios }),
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: ['cashierSessionTransactions'] }),
    ]);
  };

  const verifyMutation = useMutation({
    mutationFn: ({ id, kind, decision }: { id: string; kind: 'payment' | 'deposit'; decision: 'approve' | 'reject' }) =>
      verifyPayment(id, kind, decision),
    onSuccess: async () => {
      await refresh();
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không xử lý được giao dịch.')),
  });

  const closeMutation = useMutation({
    mutationFn: () => {
      if (!closeSession) throw new Error('Chưa chọn ca cần đóng.');
      if (closeForm.declaredCash < 0) throw new Error('Tiền thực tế không hợp lệ.');
      return closeCashierSession(closeSession.id, closeForm.declaredCash, closeForm.note);
    },
    onSuccess: async () => {
      await refresh();
      setCloseSessionId('');
      setCloseForm({ declaredCash: 0, note: '' });
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không đóng được ca tiền mặt.')),
  });

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!approveSession) throw new Error('Chưa chọn ca cần duyệt.');
      return approveCashierSession(approveSession.id, 'approve', approveForm.note);
    },
    onSuccess: async () => {
      await refresh();
      setApproveSessionId('');
      setApproveForm({ note: '' });
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không duyệt được ca tiền mặt.')),
  });

  const openCloseModal = (session: CashierSession) => {
    setCloseSessionId(session.id);
    setCloseForm({ declaredCash: session.expectedCash, note: session.note ?? '' });
  };

  const openApproveModal = (session: CashierSession) => {
    setApproveSessionId(session.id);
    setApproveForm({ note: session.note ?? '' });
  };

  const pendingTotal = queue.reduce((sum, item) => sum + item.amount, 0);
  const totalProjectedCharges = folios.reduce((sum, folio) => sum + folioRoomCharges(folio) + folioServiceCharges(folio), 0);
  const totalDeposits = folios.reduce((sum, folio) => sum + folioDepositCredits(folio), 0);
  const totalPayments = folios.reduce((sum, folio) => sum + folioPaymentCredits(folio), 0);
  const totalReceivable = folios.reduce((sum, folio) => sum + Math.max(folioProjectedBalance(folio), 0), 0);
  const openCash = sessions
    .filter(session => session.status === 'open')
    .reduce((sum, session) => sum + session.expectedCash, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Đối soát thanh toán</h1>
          <p>{queue.length} chuyển khoản chờ xác nhận · Tiền mặt dự kiến {fmt(openCash)}đ</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={refresh}>
          <RefreshCcw size={14} /> Làm mới
        </button>
      </div>

      {actionError && <div className="form-error" style={{ marginBottom: 12 }}>{actionError}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 800 }}>CHỜ XÁC NHẬN</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{fmt(pendingTotal)}đ</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 800 }}>CA TIỀN MẶT ĐANG MỞ</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{sessions.filter(s => s.status === 'open').length}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="text-muted" style={{ fontSize: 12, fontWeight: 800 }}>TIỀN MẶT DỰ KIẾN</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{fmt(openCash)}đ</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 800 }}>
          Công nợ folio đang mở
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, padding: 16 }}>
          <div className="kpi-card"><div className="kpi-label">Tạm tính phải thu</div><div className="kpi-value">{fmt(totalProjectedCharges)}đ</div></div>
          <div className="kpi-card"><div className="kpi-label">Cọc đã áp dụng</div><div className="kpi-value" style={{ color: 'var(--success)' }}>{fmt(totalDeposits)}đ</div></div>
          <div className="kpi-card"><div className="kpi-label">Đã thu folio</div><div className="kpi-value" style={{ color: 'var(--success)' }}>{fmt(totalPayments)}đ</div></div>
          <div className="kpi-card"><div className="kpi-label">Pending</div><div className="kpi-value" style={{ color: pendingTotal > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{fmt(pendingTotal)}đ</div></div>
          <div className="kpi-card"><div className="kpi-label">Còn phải thu</div><div className="kpi-value" style={{ color: totalReceivable > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(totalReceivable)}đ</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Khách / Phòng</th>
                <th>Tiền phòng</th>
                <th>Dịch vụ</th>
                <th>Cọc</th>
                <th>Đã thu</th>
                <th>Pending</th>
                <th>Còn phải thu</th>
              </tr>
            </thead>
            <tbody>
              {folios.map(folio => {
                const roomCharges = folioRoomCharges(folio);
                const serviceCharges = folioServiceCharges(folio);
                const depositCredits = folioDepositCredits(folio);
                const paymentCredits = folioPaymentCredits(folio);
                const pending = folioPendingPayments(folio);
                const balance = folioProjectedBalance(folio);
                return (
                  <tr key={folio.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{folio.guestName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>P.{folio.roomNumber}</div>
                    </td>
                    <td>{fmt(roomCharges)}đ</td>
                    <td>{fmt(serviceCharges)}đ</td>
                    <td className="folio-credit">{fmt(depositCredits)}đ</td>
                    <td className="folio-credit">{fmt(paymentCredits)}đ</td>
                    <td>{fmt(pending)}đ</td>
                    <td style={{ fontWeight: 900, color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(balance)}đ</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {folios.length === 0 && <div className="empty-state"><h3>Không có folio đang mở</h3></div>}
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 800 }}>
          Chuyển khoản chờ xác nhận
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Loại</th>
                <th>Khách / Booking</th>
                <th>Phương thức</th>
                <th>Reference</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {queue.map(item => (
                <tr key={`${item.kind}-${item.id}`}>
                  <td><span className="badge badge-blue">{item.kind === 'deposit' ? 'Cọc' : 'Folio'}</span></td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{item.guestName ?? 'Không rõ'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.bookingNumber ?? '—'} {item.roomNumber ? `· P.${item.roomNumber}` : ''}</div>
                  </td>
                  <td>{methodLabel[item.method]}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.reference ?? '—'}</td>
                  <td style={{ fontWeight: 800 }}>{fmt(item.amount)}đ</td>
                  <td><span className="badge badge-yellow">{statusLabel[item.status]}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-primary btn-sm" disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate({ id: item.id, kind: item.kind, decision: 'approve' })}>
                        <CheckCircle size={13} /> Duyệt
                      </button>
                      <button className="btn btn-secondary btn-sm" disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate({ id: item.id, kind: item.kind, decision: 'reject' })}>
                        <XCircle size={13} /> Từ chối
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {queue.length === 0 && (
          <div className="empty-state">
            <Landmark size={40} className="empty-state-icon" />
            <h3>Không có giao dịch chờ xác nhận</h3>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 800 }}>
          Ca tiền mặt
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thu ngân</th>
                <th>Mở ca</th>
                <th>Trạng thái</th>
                <th>Tiền đầu ca</th>
                <th>Đã thu</th>
                <th>Đã hoàn</th>
                <th>Hệ thống</th>
                <th>Thực tế</th>
                <th>Chênh lệch</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => {
                const canClose = session.status === 'open' && (session.cashierId === user?.id || isFinanceRole);
                const canApprove = session.status === 'closed' && isFinanceRole;
                return (
                  <tr key={session.id}>
                    <td style={{ fontWeight: 700 }}>{session.cashierName ?? session.cashierId}</td>
                    <td style={{ fontSize: 12 }}>
                      <div>{new Date(session.openedAt).toLocaleString('vi-VN')}</div>
                      {session.closedAt && <div className="text-muted">Đóng: {new Date(session.closedAt).toLocaleString('vi-VN')}</div>}
                    </td>
                    <td><span className={`badge ${session.status === 'open' ? 'badge-green' : session.status === 'closed' ? 'badge-yellow' : 'badge-gray'}`}>{sessionStatusLabel[session.status]}</span></td>
                    <td>{fmt(session.openingFloat)}đ</td>
                    <td className="folio-credit">{fmt(session.cashReceived)}đ</td>
                    <td className="folio-debit">{fmt(session.cashRefunded)}đ</td>
                    <td style={{ fontWeight: 800 }}>{fmt(session.expectedCash)}đ</td>
                    <td>{typeof session.declaredCash === 'number' ? `${fmt(session.declaredCash)}đ` : '—'}</td>
                    <td>
                      <div style={{ fontWeight: 900, color: varianceColor(session.variance) }}>
                        {typeof session.variance === 'number' ? `${session.variance > 0 ? '+' : ''}${fmt(session.variance)}đ` : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: varianceColor(session.variance) }}>{varianceLabel(session.variance)}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSessionId(session.id)}>
                          <Eye size={13} /> Chi tiết
                        </button>
                        {canClose && (
                          <button className="btn btn-primary btn-sm" onClick={() => openCloseModal(session)}>
                            <LockKeyhole size={13} /> Đóng ca
                          </button>
                        )}
                        {canApprove && (
                          <button className="btn btn-primary btn-sm" onClick={() => openApproveModal(session)}>
                            <ShieldCheck size={13} /> Duyệt
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sessions.length === 0 && (
          <div className="empty-state"><h3>Chưa có ca tiền mặt</h3></div>
        )}
      </div>

      {selectedSession && (
        <div className="card" style={{ padding: 0, marginTop: 20 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ fontWeight: 800 }}>Chi tiết ca · {selectedSession.cashierName ?? selectedSession.cashierId}</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSessionId('')}>Đóng</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, padding: 16 }}>
            <div className="kpi-card"><div className="kpi-label">Hệ thống</div><div className="kpi-value">{fmt(selectedSession.expectedCash)}đ</div></div>
            <div className="kpi-card"><div className="kpi-label">Thực tế</div><div className="kpi-value">{typeof selectedSession.declaredCash === 'number' ? `${fmt(selectedSession.declaredCash)}đ` : '—'}</div></div>
            <div className="kpi-card"><div className="kpi-label">Chênh lệch</div><div className="kpi-value" style={{ color: varianceColor(selectedSession.variance) }}>{typeof selectedSession.variance === 'number' ? `${selectedSession.variance > 0 ? '+' : ''}${fmt(selectedSession.variance)}đ` : '—'}</div></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Thời gian</th><th>Loại</th><th>Khách / Booking</th><th>Phương thức</th><th>Reference</th><th>Số tiền</th><th>Receipt</th><th>Trạng thái</th></tr>
              </thead>
              <tbody>
                {(sessionTransactionsQuery.data ?? []).map(item => (
                  <tr key={`${item.kind}-${item.id}`}>
                    <td style={{ fontSize: 12 }}>{new Date(item.occurredAt).toLocaleString('vi-VN')}</td>
                    <td><span className={`badge ${item.kind === 'refund' ? 'badge-yellow' : 'badge-blue'}`}>{transactionKindLabel[item.kind]}</span></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{item.guestName ?? 'Không rõ'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.bookingNumber ?? '—'} {item.roomNumber ? `· P.${item.roomNumber}` : ''}</div>
                    </td>
                    <td>{item.method ? methodLabel[item.method] : '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.reference ?? '—'}</td>
                    <td style={{ fontWeight: 800, color: item.kind === 'refund' ? 'var(--danger)' : 'var(--success)' }}>{item.kind === 'refund' ? '-' : '+'}{fmt(item.amount)}đ</td>
                    <td>{item.receiptNumber ?? '—'}</td>
                    <td><span className={`badge ${item.status === 'pending_verification' ? 'badge-yellow' : item.status === 'voided' ? 'badge-gray' : 'badge-green'}`}>{statusLabel[item.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sessionTransactionsQuery.isLoading && <div className="empty-state"><h3>Đang tải giao dịch...</h3></div>}
          {!sessionTransactionsQuery.isLoading && (sessionTransactionsQuery.data ?? []).length === 0 && <div className="empty-state"><h3>Ca chưa có giao dịch</h3></div>}
        </div>
      )}

      {closeSession && (
        <div className="modal-overlay" onClick={() => setCloseSessionId('')}>
          <div className="modal" style={{ maxWidth: 430 }} onClick={event => event.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Đóng ca tiền mặt</span><button className="modal-close" onClick={() => setCloseSessionId('')}>x</button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="kpi-card">
                  <div className="kpi-label">Tiền hệ thống</div>
                  <div className="kpi-value">{fmt(closeSession.expectedCash)}đ</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Tiền thực tế nhân viên nộp</label>
                  <input className="form-input" type="number" min={0} value={closeForm.declaredCash || ''} onChange={event => setCloseForm(form => ({ ...form, declaredCash: Number(event.target.value) }))} />
                </div>
                <div style={{ fontWeight: 800, color: varianceColor(closeForm.declaredCash - closeSession.expectedCash) }}>
                  Chênh lệch: {closeForm.declaredCash - closeSession.expectedCash > 0 ? '+' : ''}{fmt(closeForm.declaredCash - closeSession.expectedCash)}đ
                </div>
                <div className="form-group">
                  <label className="form-label">Ghi chú</label>
                  <textarea className="form-input" rows={3} value={closeForm.note} onChange={event => setCloseForm(form => ({ ...form, note: event.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCloseSessionId('')}>Hủy</button>
              <button className="btn btn-primary" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate()}><LockKeyhole size={14} /> Xác nhận đóng ca</button>
            </div>
          </div>
        </div>
      )}

      {approveSession && (
        <div className="modal-overlay" onClick={() => setApproveSessionId('')}>
          <div className="modal" style={{ maxWidth: 430 }} onClick={event => event.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Duyệt đối soát ca</span><button className="modal-close" onClick={() => setApproveSessionId('')}>x</button></div>
            <div className="modal-body">
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="audit-summary-grid">
                  <div className="kpi-card"><div className="kpi-label">Hệ thống</div><div className="kpi-value">{fmt(approveSession.expectedCash)}đ</div></div>
                  <div className="kpi-card"><div className="kpi-label">Thực tế</div><div className="kpi-value">{fmt(approveSession.declaredCash ?? 0)}đ</div></div>
                  <div className="kpi-card"><div className="kpi-label">Chênh lệch</div><div className="kpi-value" style={{ color: varianceColor(approveSession.variance) }}>{approveSession.variance && approveSession.variance > 0 ? '+' : ''}{fmt(approveSession.variance ?? 0)}đ</div></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Ghi chú kế toán {approveSession.variance ? '(bắt buộc nếu lệch)' : ''}</label>
                  <textarea className="form-input" rows={3} value={approveForm.note} onChange={event => setApproveForm(form => ({ ...form, note: event.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setApproveSessionId('')}>Hủy</button>
              <button className="btn btn-primary" disabled={approveMutation.isPending || ((approveSession.variance ?? 0) !== 0 && !approveForm.note.trim())} onClick={() => approveMutation.mutate()}><ShieldCheck size={14} /> Duyệt ca</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
