import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Landmark, RefreshCcw, XCircle } from 'lucide-react';
import { fetchCashierSessions, fetchPaymentVerificationQueue, queryKeys, verifyPayment } from '@/lib/data';
import { errorMessage } from '@/lib/errors';
import type { PaymentMethod, PaymentStatus } from '@/types';

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

export default function CashieringPage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const queueQuery = useQuery({ queryKey: queryKeys.paymentQueue, queryFn: fetchPaymentVerificationQueue, refetchInterval: 30_000 });
  const sessionsQuery = useQuery({ queryKey: queryKeys.cashierSessions, queryFn: fetchCashierSessions, refetchInterval: 30_000 });
  const queue = queueQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentQueue }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashierSessions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.folios }),
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
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

  const pendingTotal = queue.reduce((sum, item) => sum + item.amount, 0);
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
              <tr><th>Thu ngân</th><th>Mở ca</th><th>Trạng thái</th><th>Tiền đầu ca</th><th>Đã thu</th><th>Đã hoàn</th><th>Dự kiến</th><th>Chênh lệch</th></tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.id}>
                  <td style={{ fontWeight: 700 }}>{session.cashierName ?? session.cashierId}</td>
                  <td style={{ fontSize: 12 }}>{new Date(session.openedAt).toLocaleString('vi-VN')}</td>
                  <td><span className={`badge ${session.status === 'open' ? 'badge-green' : 'badge-gray'}`}>{session.status}</span></td>
                  <td>{fmt(session.openingFloat)}đ</td>
                  <td className="folio-credit">{fmt(session.cashReceived)}đ</td>
                  <td className="folio-debit">{fmt(session.cashRefunded)}đ</td>
                  <td style={{ fontWeight: 800 }}>{fmt(session.expectedCash)}đ</td>
                  <td>{typeof session.variance === 'number' ? `${fmt(session.variance)}đ` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sessions.length === 0 && (
          <div className="empty-state"><h3>Chưa có ca tiền mặt</h3></div>
        )}
      </div>
    </div>
  );
}
