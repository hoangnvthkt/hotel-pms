import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  DollarSign,
  Lock,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import {
  fetchCurrentBusinessDate,
  fetchNightAuditLogs,
  fetchNightAuditPrecheck,
  queryKeys,
  runNightAudit,
} from '@/lib/data';
import { errorMessage } from '@/lib/errors';
import type { NightAuditIssue, NightAuditPrecheck } from '@/types';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
const money = (n: number) => `${fmt(n)}đ`;

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00+07:00`);
  return new Intl.DateTimeFormat('vi-VN').format(date);
};

const steps = [
  { id: 1, label: 'Pre-check', desc: 'Checkout, folio, payment, HK', icon: AlertTriangle },
  { id: 2, label: 'Post tiền phòng', desc: 'Ghi room charge cho khách đang ở', icon: DollarSign },
  { id: 3, label: 'No-show', desc: 'Đánh dấu booking quá hạn', icon: CheckCircle },
  { id: 4, label: 'Revenue', desc: 'Tính lại doanh thu trong ngày', icon: Moon },
  { id: 5, label: 'Đóng ngày', desc: 'Lock ngày cũ và mở ngày mới', icon: Lock },
];

const stepLabel: Record<string, string> = {
  pre_check: 'Pre-check',
  pre_check_passed: 'Pre-check đạt',
  pre_check_blocked: 'Pre-check bị chặn',
  revenue_recalc: 'Tính doanh thu',
  complete: 'Hoàn tất',
};

function IssueList({ title, count, items, tone }: { title: string; count: number; items: NightAuditIssue[]; tone: 'danger' | 'warning' }) {
  const border = tone === 'danger' ? '#fecaca' : '#fde68a';
  const background = tone === 'danger' ? 'var(--danger-light)' : 'var(--warning-light)';

  return (
    <div style={{ border: `1px solid ${border}`, background, borderRadius: 'var(--radius)', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <strong>{title}</strong>
        <span className={tone === 'danger' ? 'badge badge-red' : 'badge badge-yellow'}>{count}</span>
      </div>
      {items.length > 0 && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {items.slice(0, 5).map((item, index) => (
            <div
              key={`${item.bookingId ?? item.folioId ?? item.paymentId ?? item.depositId ?? item.taskId ?? index}`}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}
            >
              <span>
                {item.roomNumber ? `Phòng ${item.roomNumber} - ` : ''}
                {item.bookingNumber ?? item.folioNumber ?? item.label ?? item.status ?? 'Mục cần xử lý'}
                {item.guestName ? ` - ${item.guestName}` : ''}
              </span>
              <strong>
                {typeof item.balance === 'number'
                  ? money(item.balance)
                  : typeof item.amount === 'number'
                    ? money(item.amount)
                    : item.date
                      ? formatDate(item.date)
                      : ''}
              </strong>
            </div>
          ))}
          {items.length > 5 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Còn {items.length - 5} mục khác.</div>
          )}
        </div>
      )}
    </div>
  );
}

function PrecheckSummary({ precheck }: { precheck: NightAuditPrecheck }) {
  const cards = [
    { label: 'Blockers', value: precheck.blockersCount, color: precheck.blockersCount > 0 ? 'var(--danger)' : 'var(--success)' },
    { label: 'No-show dự kiến', value: precheck.summary.noShowCandidates, color: 'var(--accent-dark)' },
    { label: 'Room charges', value: precheck.summary.roomChargeCandidates, color: 'var(--primary)' },
    { label: 'Tiền phòng dự kiến', value: money(precheck.summary.roomChargeTotal), color: 'var(--primary-dark)' },
  ];

  return (
    <div className="audit-summary-grid">
      {cards.map(item => (
        <div key={item.label} className="kpi-card">
          <div className="kpi-label">{item.label}</div>
          <div className="kpi-value" style={{ color: item.color }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function NightAuditPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const propertyId = user?.propertyId ?? '';

  const businessDateQuery = useQuery({
    queryKey: queryKeys.businessDate,
    queryFn: () => fetchCurrentBusinessDate(propertyId),
    enabled: Boolean(propertyId),
  });

  const businessDate = businessDateQuery.data?.businessDate;

  const precheckQuery = useQuery({
    queryKey: queryKeys.nightAuditPrecheck(businessDate),
    queryFn: () => fetchNightAuditPrecheck(propertyId, businessDate!),
    enabled: Boolean(propertyId && businessDate),
    refetchInterval: 30_000,
  });

  const logsQuery = useQuery({
    queryKey: queryKeys.nightAuditLogs(businessDate),
    queryFn: () => fetchNightAuditLogs(propertyId, businessDate!),
    enabled: Boolean(propertyId && businessDate),
  });

  const runMutation = useMutation({
    mutationFn: () => runNightAudit(propertyId, businessDate!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.businessDate }),
        queryClient.invalidateQueries({ queryKey: queryKeys.nightAuditPrecheck(businessDate) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.nightAuditLogs(businessDate) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount }),
      ]);
    },
  });

  const precheck = precheckQuery.data;
  const runResult = runMutation.data;
  const closed = businessDateQuery.data?.status === 'closed' || Boolean(runResult);
  const canRun = Boolean(precheck?.canRun && !closed && !runMutation.isPending);
  const isLoading = businessDateQuery.isLoading || precheckQuery.isLoading;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.businessDate });
    if (businessDate) {
      queryClient.invalidateQueries({ queryKey: queryKeys.nightAuditPrecheck(businessDate) });
      queryClient.invalidateQueries({ queryKey: queryKeys.nightAuditLogs(businessDate) });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Night Audit</h1>
          <p>Ngày kinh doanh: {formatDate(businessDate)}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={closed ? 'badge badge-green' : 'badge badge-yellow'}>
            {closed ? 'Đã đóng' : 'Ngày đang mở'}
          </span>
          <button className="btn btn-secondary" onClick={refresh} disabled={isLoading || runMutation.isPending}>
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>
      </div>

      <div className="audit-layout">
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Moon size={16} color="var(--primary)" /> Quy trình đóng ngày
          </div>
          <div style={{ padding: '8px 0' }}>
            {steps.map((step, index) => {
              const done = Boolean(runResult) || (index === 0 && precheck?.canRun);
              const active = !runResult && ((index === 0 && !precheck?.canRun) || (index === 1 && precheck?.canRun));
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className="audit-step"
                  style={{ padding: '12px 16px', background: active ? 'var(--primary-bg)' : undefined }}
                >
                  <div className={`audit-step-num ${done ? 'done' : active ? 'active' : 'pending'}`}>{done ? '✓' : step.id}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                      <Icon size={14} /> {step.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{step.desc}</div>
                  </div>
                  {active && <ChevronRight size={15} color="var(--primary)" />}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {(businessDateQuery.error || precheckQuery.error || runMutation.error) && (
            <div className="form-error">
              {errorMessage(businessDateQuery.error ?? precheckQuery.error ?? runMutation.error, 'Không xử lý được Night Audit.')}
            </div>
          )}

          {isLoading && (
            <div className="card">
              <strong>Đang kiểm tra dữ liệu vận hành...</strong>
              <div style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 13 }}>Hệ thống đang đọc folio, payment, booking và housekeeping task.</div>
            </div>
          )}

          {precheck && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>Pre-check ngày {formatDate(precheck.businessDate)}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Night Audit chỉ được chạy khi không còn blocker nghiệp vụ.
                  </div>
                </div>
                <span className={precheck.canRun ? 'badge badge-green' : 'badge badge-red'}>
                  {precheck.canRun ? 'Sẵn sàng chạy' : 'Cần xử lý'}
                </span>
              </div>

              <PrecheckSummary precheck={precheck} />

              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                <IssueList title="Departures chưa checkout" count={precheck.summary.openDepartures} items={precheck.blockers.openDepartures} tone="danger" />
                <IssueList title="Folio còn số dư" count={precheck.summary.unpaidFolios} items={precheck.blockers.unpaidFolios} tone="danger" />
                <IssueList title="Chuyển khoản folio chờ xác nhận" count={precheck.summary.pendingPayments} items={precheck.blockers.pendingPayments} tone="warning" />
                <IssueList title="Cọc booking chờ xác nhận" count={precheck.summary.pendingDeposits} items={precheck.blockers.pendingDeposits} tone="warning" />
                <IssueList title="Housekeeping task còn mở" count={precheck.summary.openHousekeepingTasks} items={precheck.blockers.openHousekeepingTasks} tone="warning" />
                <IssueList title="Booking sẽ chuyển no-show" count={precheck.summary.noShowCandidates} items={precheck.warnings.noShowCandidates} tone="warning" />
              </div>
            </div>
          )}

          {precheck && (
            <div className="card">
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>Chạy Night Audit</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Khi chạy, hệ thống sẽ post room charge còn thiếu, đánh dấu no-show, tính doanh thu, khóa ngày hiện tại và mở ngày kế tiếp.
              </div>

              {!precheck.canRun && (
                <div className="form-error" style={{ marginBottom: 14 }}>
                  Còn {precheck.blockersCount} blocker. Xử lý các mục phía trên rồi bấm làm mới trước khi chạy.
                </div>
              )}

              {runResult && (
                <div style={{ background: 'var(--success-light)', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', padding: 14, marginBottom: 14 }}>
                  <strong style={{ color: '#166534' }}>Night Audit đã hoàn tất.</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 12 }}>
                    <div className="kpi-card"><div className="kpi-label">Room charge</div><div className="kpi-value">{runResult.postedRoomCharges}</div></div>
                    <div className="kpi-card"><div className="kpi-label">No-show</div><div className="kpi-value">{runResult.noShowBookings}</div></div>
                    <div className="kpi-card"><div className="kpi-label">Doanh thu phòng</div><div className="kpi-value">{money(runResult.roomRevenue)}</div></div>
                    <div className="kpi-card"><div className="kpi-label">Ngày mới</div><div className="kpi-value">{formatDate(runResult.nextBusinessDate)}</div></div>
                  </div>
                </div>
              )}

              <button
                className="btn btn-danger btn-lg"
                disabled={!canRun}
                onClick={() => runMutation.mutate()}
              >
                <Lock size={16} />
                {runMutation.isPending ? 'Đang đóng ngày...' : `Đóng ngày ${formatDate(businessDate)}`}
              </button>
            </div>
          )}

          <div className="card">
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 12 }}>Log Night Audit</div>
            {logsQuery.isLoading ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Đang tải log...</div>
            ) : (logsQuery.data?.length ?? 0) === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>
                <Moon size={28} className="empty-state-icon" />
                <h3>Chưa có log cho ngày này</h3>
                <p>Log sẽ xuất hiện khi Night Audit chạy thành công.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Bước</th>
                      <th>Người chạy</th>
                      <th>Tóm tắt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsQuery.data?.map(log => (
                      <tr key={log.id}>
                        <td>{formatDate(log.createdAt)}</td>
                        <td><span className="badge badge-gray">{stepLabel[log.step] ?? log.step}</span></td>
                        <td>{log.createdByName ?? 'Hệ thống'}</td>
                        <td style={{ maxWidth: 360, color: 'var(--text-secondary)' }}>
                          {Object.entries(log.summary ?? {}).slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
