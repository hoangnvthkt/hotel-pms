import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addGuestRequestComment,
  createGuestRequest,
  fetchBookings,
  fetchGuestRequests,
  fetchGuests,
  fetchOpenFolios,
  fetchRooms,
  fetchStaffProfiles,
  postGuestRequestCharge,
  queryKeys,
  updateGuestRequestStatus,
  type GuestRequestMutationInput,
} from '@/lib/data';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthContext';
import type { GuestRequest, GuestRequestSource, GuestRequestStatus, GuestRequestType } from '@/types';
import { AlertTriangle, CheckCircle, Clock, CreditCard, MessageSquareText, Plus, Search, UserPlus, X } from 'lucide-react';

const typeLabel: Record<GuestRequestType, string> = {
  service_order: 'Order dịch vụ',
  complaint: 'Khiếu nại',
  housekeeping: 'Housekeeping',
  maintenance: 'Kỹ thuật',
  billing: 'Thanh toán',
  lost_found: 'Lost & Found',
  special_request: 'Yêu cầu đặc biệt',
  feedback: 'Góp ý',
};

const statusLabel: Record<GuestRequestStatus, string> = {
  new: 'Mới',
  triaged: 'Đã phân loại',
  assigned: 'Đã giao',
  in_progress: 'Đang xử lý',
  waiting_guest: 'Chờ khách',
  waiting_vendor: 'Chờ đối tác',
  resolved: 'Đã xử lý',
  closed: 'Đã đóng',
  cancelled: 'Đã hủy',
  escalated: 'Escalated',
};

const sourceLabel: Record<GuestRequestSource, string> = {
  front_desk: 'Lễ tân',
  phone: 'Điện thoại',
  email: 'Email',
  chat: 'Chat',
  qr: 'QR',
  internal: 'Nội bộ',
  post_stay: 'Sau lưu trú',
};

const priorityLabel: Record<GuestRequest['priority'], string> = {
  low: 'Thấp',
  normal: 'Thường',
  high: 'Cao',
  urgent: 'Khẩn',
};

const statusClass: Record<GuestRequestStatus, string> = {
  new: 'badge-blue',
  triaged: 'badge-gray',
  assigned: 'badge-purple',
  in_progress: 'badge-yellow',
  waiting_guest: 'badge-yellow',
  waiting_vendor: 'badge-yellow',
  resolved: 'badge-green',
  closed: 'badge-green',
  cancelled: 'badge-gray',
  escalated: 'badge-red',
};

const blankForm: Omit<GuestRequestMutationInput, 'propertyId'> = {
  type: 'service_order',
  priority: 'normal',
  source: 'front_desk',
  title: '',
  description: '',
  bookingId: '',
  guestId: '',
  roomId: '',
  department: '',
  assignedTo: '',
  dueAt: '',
  compensationAmount: 0,
};

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
};

export default function GuestRequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | GuestRequestType>('all');
  const [statusFilter, setStatusFilter] = useState<'open' | 'all' | GuestRequestStatus>('open');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(blankForm);
  const [assigneeId, setAssigneeId] = useState('');
  const [comment, setComment] = useState('');
  const [resolution, setResolution] = useState('');
  const [chargeForm, setChargeForm] = useState({ folioId: '', description: '', amount: 0 });
  const [actionError, setActionError] = useState<string | null>(null);

  const requestsQuery = useQuery({ queryKey: queryKeys.guestRequests, queryFn: fetchGuestRequests, refetchInterval: 30_000 });
  const bookingsQuery = useQuery({ queryKey: queryKeys.bookings, queryFn: fetchBookings });
  const guestsQuery = useQuery({ queryKey: queryKeys.guests, queryFn: fetchGuests });
  const roomsQuery = useQuery({ queryKey: queryKeys.rooms, queryFn: fetchRooms });
  const staffQuery = useQuery({ queryKey: queryKeys.staff, queryFn: fetchStaffProfiles });
  const foliosQuery = useQuery({ queryKey: queryKeys.folios, queryFn: fetchOpenFolios });

  const requests = requestsQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const guests = guestsQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const staff = staffQuery.data ?? [];
  const folios = foliosQuery.data ?? [];
  const selected = requests.find(item => item.id === selectedId);
  const roles = user?.roles ?? (user?.role ? [user.role] : []);
  const canPostCharge = roles.some(role => ['admin', 'manager', 'receptionist', 'accountant'].includes(role));

  useEffect(() => {
    setAssigneeId(selected?.assignedTo ?? '');
    setResolution('');
  }, [selected?.id, selected?.assignedTo]);

  const openStatuses: GuestRequestStatus[] = ['new', 'triaged', 'assigned', 'in_progress', 'waiting_guest', 'waiting_vendor', 'escalated'];
  const filtered = requests.filter(item => {
    if (statusFilter === 'open' && !openStatuses.includes(item.status)) return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return item.requestNumber.toLowerCase().includes(q)
        || item.title.toLowerCase().includes(q)
        || item.description?.toLowerCase().includes(q)
        || item.guestName?.toLowerCase().includes(q)
        || item.roomNumber?.toLowerCase().includes(q)
        || item.assignedToName?.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = useMemo(() => ({
    open: requests.filter(item => openStatuses.includes(item.status)).length,
    urgent: requests.filter(item => openStatuses.includes(item.status) && item.priority === 'urgent').length,
    complaints: requests.filter(item => openStatuses.includes(item.status) && item.type === 'complaint').length,
    dueSoon: requests.filter(item => openStatuses.includes(item.status) && item.dueAt && Date.parse(item.dueAt) < Date.now() + 60 * 60 * 1000).length,
  }), [requests]);

  const invalidateRequests = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.guestRequests }),
      queryClient.invalidateQueries({ queryKey: queryKeys.folios }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (!user?.propertyId) throw new Error('Không xác định được khách sạn.');
      if (!form.title.trim()) throw new Error('Cần nhập tiêu đề yêu cầu.');
      return createGuestRequest({
        propertyId: user.propertyId,
        type: form.type,
        priority: form.priority,
        source: form.source,
        title: form.title,
        description: form.description,
        bookingId: form.bookingId || undefined,
        guestId: form.guestId || undefined,
        roomId: form.roomId || undefined,
        department: form.department || undefined,
        assignedTo: form.assignedTo || undefined,
        dueAt: form.dueAt || undefined,
        compensationAmount: form.compensationAmount,
      });
    },
    onSuccess: async () => {
      await invalidateRequests();
      setShowCreate(false);
      setForm(blankForm);
      setActionError(null);
    },
    onError: err => setActionError(errorMessage(err, 'Không tạo được yêu cầu khách hàng.')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, assignedTo }: { id: string; status: GuestRequestStatus; assignedTo?: string }) =>
      updateGuestRequestStatus(id, status, resolution, assignedTo),
    onSuccess: async () => {
      await invalidateRequests();
      setResolution('');
      setActionError(null);
    },
    onError: err => setActionError(errorMessage(err, 'Không cập nhật được yêu cầu khách hàng.')),
  });

  const commentMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Chưa chọn yêu cầu.');
      if (!comment.trim()) throw new Error('Cần nhập nội dung ghi chú.');
      return addGuestRequestComment(selected.id, comment, true);
    },
    onSuccess: async () => {
      await invalidateRequests();
      setComment('');
      setActionError(null);
    },
    onError: err => setActionError(errorMessage(err, 'Không thêm được ghi chú.')),
  });

  const chargeMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Chưa chọn yêu cầu.');
      const folio = folios.find(item => item.id === chargeForm.folioId);
      if (!folio) throw new Error('Chưa chọn folio đang mở.');
      if (!chargeForm.description.trim() || chargeForm.amount <= 0) throw new Error('Nhập mô tả và số tiền hợp lệ.');
      return postGuestRequestCharge(selected, folio, chargeForm.description, chargeForm.amount);
    },
    onSuccess: async () => {
      await invalidateRequests();
      setChargeForm({ folioId: '', description: '', amount: 0 });
      setActionError(null);
    },
    onError: err => setActionError(errorMessage(err, 'Không post được phí vào folio.')),
  });

  const onBookingChange = (bookingId: string) => {
    const booking = bookings.find(item => item.id === bookingId);
    setForm(current => ({
      ...current,
      bookingId,
      guestId: booking?.guestId ?? current.guestId,
      roomId: booking?.roomId ?? current.roomId,
    }));
  };

  const openDetail = (request: GuestRequest) => {
    setSelectedId(request.id);
    setAssigneeId(request.assignedTo ?? '');
    const linkedFolio = folios.find(folio => folio.bookingId === request.bookingId);
    setChargeForm({
      folioId: linkedFolio?.id ?? '',
      description: request.title,
      amount: 0,
    });
  };

  const updateStatus = (status: GuestRequestStatus, assignedTo?: string) => {
    if (!selected) return;
    statusMutation.mutate({ id: selected.id, status, assignedTo });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Yêu cầu khách hàng</h1>
          <p>{stats.open} yêu cầu mở · {stats.urgent} khẩn · {stats.complaints} khiếu nại</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> Tạo yêu cầu</button>
      </div>

      {actionError && <div className="form-error" style={{ marginBottom: 12 }}>{actionError}</div>}

      <div className="audit-summary-grid" style={{ marginBottom: 16 }}>
        <div className="kpi-card"><div className="kpi-label">Đang mở</div><div className="kpi-value">{stats.open}</div></div>
        <div className="kpi-card"><div className="kpi-label">Khẩn</div><div className="kpi-value" style={{ color: 'var(--danger)' }}>{stats.urgent}</div></div>
        <div className="kpi-card"><div className="kpi-label">Khiếu nại</div><div className="kpi-value" style={{ color: 'var(--accent-dark)' }}>{stats.complaints}</div></div>
        <div className="kpi-card"><div className="kpi-label">Sắp/quá hạn</div><div className="kpi-value" style={{ color: stats.dueSoon > 0 ? 'var(--danger)' : 'var(--success)' }}>{stats.dueSoon}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <div className="search-box">
            <Search size={15} color="var(--text-muted)" />
            <input placeholder="Tìm mã, khách, phòng, nội dung..." value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <select className="form-input form-select" value={typeFilter} onChange={event => setTypeFilter(event.target.value as any)}>
            <option value="all">Tất cả loại</option>
            {Object.entries(typeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="form-input form-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value as any)}>
            <option value="open">Đang mở</option>
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="guest-request-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Yêu cầu</th>
                <th>Khách/phòng</th>
                <th>Ưu tiên</th>
                <th>Trạng thái</th>
                <th>Phụ trách</th>
                <th>Hạn xử lý</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} onClick={() => openDetail(item)} style={{ cursor: 'pointer' }}>
                  <td><strong>{item.requestNumber}</strong></td>
                  <td>
                    <div className="guest-request-cell">
                      <div style={{ fontWeight: 800 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                        {typeLabel[item.type]} · {sourceLabel[item.source]}
                      </div>
                      {item.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{item.description}</div>}
                    </div>
                  </td>
                  <td>
                    <div className="guest-request-cell guest-request-cell-sm">
                      <div>{item.guestName ?? 'Chưa gắn khách'}</div>
                      <small style={{ color: 'var(--text-secondary)' }}>
                        {item.roomNumber ? `P.${item.roomNumber}` : item.bookingNumber ?? '—'}
                      </small>
                    </div>
                  </td>
                  <td><span className={`badge priority-${item.priority}`}>{priorityLabel[item.priority]}</span></td>
                  <td><span className={`badge ${statusClass[item.status]}`}>{statusLabel[item.status]}</span></td>
                  <td>{item.assignedToName ?? <span className="text-muted">Chưa giao</span>}</td>
                  <td>{item.dueAt ? formatDateTime(item.dueAt) : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 28 }}>
                    Chưa có yêu cầu phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedId('')} />
          <aside className="drawer guest-request-drawer" onClick={event => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <div className="modal-title">{selected.requestNumber}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{typeLabel[selected.type]} · {selected.guestName ?? 'Chưa gắn khách'}</div>
              </div>
              <button className="modal-close" onClick={() => setSelectedId('')}><X size={18} /></button>
            </div>
            <div className="drawer-body guest-request-detail-grid">
              <div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span className={`badge ${statusClass[selected.status]}`}>{statusLabel[selected.status]}</span>
                  <span className={`badge priority-${selected.priority}`}>{priorityLabel[selected.priority]}</span>
                  {selected.folioItemId && <span className="badge badge-green">Đã post folio</span>}
                </div>
                <h3 style={{ margin: '0 0 8px' }}>{selected.title}</h3>
                {selected.description && <p className="guest-request-long-text">{selected.description}</p>}
              </div>

              <div className="card guest-request-section">
                <div className="kpi-label">Thông tin liên kết</div>
                <div style={{ display: 'grid', gap: 7, fontSize: 13, marginTop: 10 }}>
                  <div><strong>Booking:</strong> {selected.bookingNumber ?? '—'}</div>
                  <div><strong>Khách:</strong> {selected.guestName ?? '—'} {selected.guestPhone ? `· ${selected.guestPhone}` : ''}</div>
                  <div><strong>Phòng:</strong> {selected.roomNumber ? `P.${selected.roomNumber}` : '—'}</div>
                  <div><strong>Bộ phận:</strong> {selected.department}</div>
                  <div><strong>Người tạo:</strong> {selected.createdByName ?? '—'}</div>
                  <div><strong>Tạo lúc:</strong> {formatDateTime(selected.createdAt)}</div>
                </div>
              </div>

              <div className="card guest-request-section">
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Cập nhật xử lý</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <select
                    className="form-input form-select"
                    value={assigneeId}
                    onChange={event => setAssigneeId(event.target.value)}
                  >
                    <option value="">Chưa giao phụ trách</option>
                    {staff.filter(item => item.is_active).map(item => (
                      <option key={item.id} value={item.id}>{item.full_name}</option>
                    ))}
                  </select>
                  <textarea className="form-input" rows={3} placeholder="Kết quả xử lý / lý do escalation..." value={resolution} onChange={event => setResolution(event.target.value)} />
                  <div className="guest-request-action-grid">
                    <button className="btn btn-secondary btn-sm" disabled={statusMutation.isPending} onClick={() => updateStatus('triaged')}><AlertTriangle size={13} /> Tiếp nhận</button>
                    <button className="btn btn-secondary btn-sm" disabled={statusMutation.isPending || !assigneeId} onClick={() => updateStatus('assigned', assigneeId)}><UserPlus size={13} /> Giao xử lý</button>
                    <button className="btn btn-primary btn-sm" disabled={statusMutation.isPending} onClick={() => updateStatus('in_progress')}><Clock size={13} /> Bắt đầu</button>
                    <button className="btn btn-secondary btn-sm" disabled={statusMutation.isPending} onClick={() => updateStatus('waiting_guest')}>Chờ khách</button>
                    <button className="btn btn-secondary btn-sm" disabled={statusMutation.isPending} onClick={() => updateStatus('waiting_vendor')}>Chờ đối tác</button>
                    <button className="btn btn-danger btn-sm" disabled={statusMutation.isPending} onClick={() => updateStatus('escalated')}><AlertTriangle size={13} /> Escalate</button>
                    <button className="btn btn-success btn-sm" disabled={statusMutation.isPending} onClick={() => updateStatus('resolved')}><CheckCircle size={13} /> Hoàn thành</button>
                    <button className="btn btn-secondary btn-sm" disabled={statusMutation.isPending} onClick={() => updateStatus('closed')}>Đóng yêu cầu</button>
                  </div>
                </div>
              </div>

              {canPostCharge && (
                <div className="card guest-request-section">
                  <div style={{ fontWeight: 800, marginBottom: 10 }}>Post phí dịch vụ vào folio</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <select className="form-input form-select" value={chargeForm.folioId} onChange={event => setChargeForm(f => ({ ...f, folioId: event.target.value }))}>
                      <option value="">Chọn folio đang mở</option>
                      {folios.map(folio => (
                        <option key={folio.id} value={folio.id}>P.{folio.roomNumber} · {folio.guestName} · Balance {fmt(folio.balance)}đ</option>
                      ))}
                    </select>
                    <input className="form-input" placeholder="Mô tả charge" value={chargeForm.description} onChange={event => setChargeForm(f => ({ ...f, description: event.target.value }))} />
                    <input className="form-input" type="number" min={0} placeholder="Số tiền" value={chargeForm.amount || ''} onChange={event => setChargeForm(f => ({ ...f, amount: Number(event.target.value) }))} />
                    <button className="btn btn-primary btn-sm" disabled={chargeMutation.isPending || Boolean(selected.folioItemId)} onClick={() => chargeMutation.mutate()}>
                      <CreditCard size={13} /> {selected.folioItemId ? 'Đã post vào folio' : 'Post vào folio'}
                    </button>
                  </div>
                </div>
              )}

              <div className="card guest-request-section">
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Ghi chú xử lý</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <textarea className="form-input" rows={3} placeholder="Thêm ghi chú nội bộ..." value={comment} onChange={event => setComment(event.target.value)} />
                  <button className="btn btn-secondary btn-sm" onClick={() => commentMutation.mutate()} disabled={commentMutation.isPending}><MessageSquareText size={13} /> Lưu ghi chú</button>
                  <div className="guest-request-note-list">
                    {(selected.comments ?? []).map(item => (
                      <div key={item.id} style={{ borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
                        <div style={{ fontSize: 13 }}>{item.comment}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{item.createdByName ?? 'Nhân viên'} · {formatDateTime(item.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <form className="modal" style={{ maxWidth: 760 }} onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); createMutation.mutate(); }}>
            <div className="modal-header">
              <span className="modal-title">Tạo yêu cầu khách hàng</span>
              <button type="button" className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Loại yêu cầu</label>
                  <select className="form-input form-select" value={form.type} onChange={event => setForm(f => ({ ...f, type: event.target.value as GuestRequestType }))}>
                    {Object.entries(typeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ưu tiên</label>
                  <select className="form-input form-select" value={form.priority} onChange={event => setForm(f => ({ ...f, priority: event.target.value as GuestRequest['priority'] }))}>
                    {Object.entries(priorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Nguồn tiếp nhận</label>
                  <select className="form-input form-select" value={form.source} onChange={event => setForm(f => ({ ...f, source: event.target.value as GuestRequestSource }))}>
                    {Object.entries(sourceLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Hạn xử lý</label>
                  <input className="form-input" type="datetime-local" value={form.dueAt} onChange={event => setForm(f => ({ ...f, dueAt: event.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Booking</label>
                  <select className="form-input form-select" value={form.bookingId} onChange={event => onBookingChange(event.target.value)}>
                    <option value="">Không gắn booking</option>
                    {bookings.map(booking => (
                      <option key={booking.id} value={booking.id}>{booking.bookingNumber} · {booking.guestName} · P.{booking.roomNumber}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Khách</label>
                  <select className="form-input form-select" value={form.guestId} onChange={event => setForm(f => ({ ...f, guestId: event.target.value }))}>
                    <option value="">Chọn khách</option>
                    {guests.map(guest => <option key={guest.id} value={guest.id}>{guest.fullName} · {guest.phone}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Phòng</label>
                  <select className="form-input form-select" value={form.roomId} onChange={event => setForm(f => ({ ...f, roomId: event.target.value }))}>
                    <option value="">Không gắn phòng</option>
                    {rooms.map(room => <option key={room.id} value={room.id}>P.{room.number} · {room.roomTypeName}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Người phụ trách</label>
                  <select className="form-input form-select" value={form.assignedTo} onChange={event => setForm(f => ({ ...f, assignedTo: event.target.value }))}>
                    <option value="">Giao sau</option>
                    {staff.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Tiêu đề</label>
                  <input className="form-input" value={form.title} onChange={event => setForm(f => ({ ...f, title: event.target.value }))} placeholder="VD: Khách order buffet tối cho 2 người" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Nội dung</label>
                  <textarea className="form-input" rows={4} value={form.description} onChange={event => setForm(f => ({ ...f, description: event.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}><UserPlus size={14} /> Tạo yêu cầu</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
