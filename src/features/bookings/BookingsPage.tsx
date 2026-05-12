import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Booking, BookingService, BookingSource, BookingStatus, PaymentMethod, PaymentStatus } from '@/types';
import { Search, Plus, ChevronLeft, ChevronRight, CalendarDays, CheckCircle, FileText, Trash2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  cancelBooking,
  checkAvailability,
  checkInBooking,
  checkOutBooking,
  createBooking,
  fetchBookings,
  fetchBookingDeposits,
  fetchBookingServices,
  fetchGuests,
  fetchRoomRates,
  fetchRooms,
  fetchRoomTypes,
  queryKeys,
  recordBookingDeposit,
  verifyPayment,
} from '@/lib/data';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthContext';
import BookingConfirmationModal from './BookingConfirmationModal';

const statusBadge: Record<BookingStatus, string> = {
  tentative:'badge-yellow', confirmed:'badge-green', checked_in:'badge-blue',
  checked_out:'badge-gray', cancelled:'badge-gray', no_show:'badge-red',
};
const statusLabel: Record<BookingStatus, string> = {
  tentative:'Tạm giữ', confirmed:'Đã xác nhận', checked_in:'Đang ở',
  checked_out:'Đã rời', cancelled:'Đã hủy', no_show:'No-show',
};
const barClass: Record<BookingStatus, string> = {
  tentative:'bar-tentative', confirmed:'bar-confirmed', checked_in:'bar-checked-in',
  checked_out:'bar-cancelled', cancelled:'bar-cancelled', no_show:'bar-no-show',
};
const sourceLabels: Record<BookingSource, string> = {
  direct: 'Trực tiếp',
  walk_in: 'Walk-in',
  phone: 'Điện thoại',
  facebook: 'Facebook',
  ota_manual: 'OTA thủ công',
  website_later: 'Website',
};

const fmt = (n:number) => new Intl.NumberFormat('vi-VN').format(n);
type CreateStatus = Extract<BookingStatus, 'tentative' | 'confirmed'>;
const paymentStatusLabel: Record<PaymentStatus, string> = {
  draft: 'Nháp',
  pending_verification: 'Chờ xác nhận',
  posted: 'Đã thu',
  finalized: 'Đã đối soát',
  voided: 'Đã void',
  refunded: 'Đã hoàn',
};
const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  qr_manual: 'QR thủ công',
  card_manual: 'Thẻ thủ công',
  gateway_later: 'Gateway sau',
};

type BookingServiceDraft = {
  serviceCode: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  serviceDate: string;
  notes: string;
};

const servicePresets: Array<{ serviceCode: string; serviceName: string; unitPrice: number }> = [
  { serviceCode: 'breakfast_buffet', serviceName: 'Buffet sáng', unitPrice: 250000 },
  { serviceCode: 'lunch', serviceName: 'Ăn trưa', unitPrice: 350000 },
  { serviceCode: 'dinner', serviceName: 'Ăn tối', unitPrice: 450000 },
  { serviceCode: 'airport_transfer', serviceName: 'Đưa đón sân bay', unitPrice: 600000 },
  { serviceCode: 'other', serviceName: 'Dịch vụ khác', unitPrice: 0 },
];

const serviceDraftTotal = (service: BookingServiceDraft) =>
  Math.max(1, Number(service.quantity) || 1) * Math.max(0, Number(service.unitPrice) || 0);

export default function BookingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list'|'calendar'>('list');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<BookingStatus|'all'>('all');
  const [calStart, setCalStart] = useState(new Date());
  const [selected, setSelected] = useState<Booking|null>(null);
  const [confirmationBooking, setConfirmationBooking] = useState<Booking|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState({
    guestId: '',
    roomTypeId: '',
    roomId: '',
    checkIn: new Date().toISOString().slice(0, 10),
    checkOut: addDays(new Date(), 1).toISOString().slice(0, 10),
    adults: 1,
    children: 0,
    status: 'confirmed' as CreateStatus,
    source: 'direct' as BookingSource,
    rateCode: 'BAR',
    ratePerNight: 800000,
    depositAmount: 0,
    depositPaid: false,
    externalReference: '',
    notes: '',
    services: [] as BookingServiceDraft[],
  });
  const [depositForm, setDepositForm] = useState({
    method: 'cash' as PaymentMethod,
    amount: 0,
    reference: '',
    evidencePath: '',
  });

  const bookingsQuery = useQuery({ queryKey: queryKeys.bookings, queryFn: fetchBookings, refetchInterval: 30_000 });
  const roomsQuery = useQuery({ queryKey: queryKeys.rooms, queryFn: fetchRooms, refetchInterval: 30_000 });
  const guestsQuery = useQuery({ queryKey: queryKeys.guests, queryFn: fetchGuests });
  const roomTypesQuery = useQuery({ queryKey: queryKeys.roomTypes, queryFn: fetchRoomTypes });
  const depositsQuery = useQuery({
    queryKey: queryKeys.bookingDeposits(selected?.id),
    queryFn: () => fetchBookingDeposits(selected?.id ?? ''),
    enabled: Boolean(selected?.id),
  });
  const bookingServicesQuery = useQuery({
    queryKey: queryKeys.bookingServices(selected?.id),
    queryFn: () => fetchBookingServices(selected?.id ?? ''),
    enabled: Boolean(selected?.id),
  });
  const confirmationServicesQuery = useQuery({
    queryKey: queryKeys.bookingServices(confirmationBooking?.id),
    queryFn: () => fetchBookingServices(confirmationBooking?.id ?? ''),
    enabled: Boolean(confirmationBooking?.id),
  });
  const confirmationDepositsQuery = useQuery({
    queryKey: queryKeys.bookingDeposits(confirmationBooking?.id),
    queryFn: () => fetchBookingDeposits(confirmationBooking?.id ?? ''),
    enabled: Boolean(confirmationBooking?.id),
  });
  const ratesQuery = useQuery({
    queryKey: [...queryKeys.roomRates, bookingForm.roomTypeId],
    queryFn: () => fetchRoomRates(bookingForm.roomTypeId),
    enabled: showCreate && Boolean(bookingForm.roomTypeId),
  });

  const bookings = bookingsQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const guests = guestsQuery.data ?? [];
  const roomTypes = roomTypesQuery.data ?? [];
  const roomRates = ratesQuery.data ?? [];
  const propertyId = user?.propertyId ?? rooms[0]?.propertyId ?? guests[0]?.propertyId ?? '';
  const datesValid = bookingForm.checkOut > bookingForm.checkIn;
  const deposits = depositsQuery.data ?? [];
  const bookingServices = bookingServicesQuery.data ?? [];
  const serviceDraftTotalAmount = bookingForm.services.reduce((sum, service) => sum + serviceDraftTotal(service), 0);
  const roomDraftTotalAmount = Math.max(1, Math.ceil((Date.parse(`${bookingForm.checkOut}T12:00:00+07:00`) - Date.parse(`${bookingForm.checkIn}T14:00:00+07:00`)) / 86_400_000)) * bookingForm.ratePerNight;
  const userRoles = user?.roles ?? (user?.role ? [user.role] : []);
  const canVerifyPayments = userRoles.some(role => ['admin', 'manager', 'accountant'].includes(role));

  const availableRoomsQuery = useQuery({
    queryKey: queryKeys.availability(bookingForm.roomTypeId, bookingForm.checkIn, bookingForm.checkOut),
    queryFn: () => checkAvailability(propertyId, bookingForm.roomTypeId, bookingForm.checkIn, bookingForm.checkOut),
    enabled: showCreate && Boolean(propertyId && bookingForm.roomTypeId && datesValid),
  });
  const availableRooms = availableRoomsQuery.data ?? [];

  useEffect(() => {
    if (!bookingForm.roomTypeId && roomTypes[0]) {
      setBookingForm(form => ({ ...form, roomTypeId: roomTypes[0].id, roomId: '' }));
    }
  }, [bookingForm.roomTypeId, roomTypes]);

  useEffect(() => {
    if (!showCreate || roomRates.length === 0) return;
    const activeRates = roomRates.filter(rate => rate.isActive);
    const current = activeRates.find(rate => rate.rateCode === bookingForm.rateCode);
    const next = current ?? activeRates[0];
    if (next && (!current || bookingForm.ratePerNight <= 0)) {
      setBookingForm(form => ({ ...form, rateCode: next.rateCode, ratePerNight: next.amount }));
    }
  }, [bookingForm.rateCode, bookingForm.ratePerNight, roomRates, showCreate]);

  useEffect(() => {
    if (!showCreate) return;
    if (availableRooms.length === 0) {
      setBookingForm(form => ({ ...form, roomId: '' }));
      return;
    }
    if (!availableRooms.some(room => room.id === bookingForm.roomId)) {
      setBookingForm(form => ({ ...form, roomId: availableRooms[0].id }));
    }
  }, [availableRooms, bookingForm.roomId, showCreate]);

  const roomTypeNameById = useMemo(() => {
    return new Map(roomTypes.map(type => [type.id, type.name]));
  }, [roomTypes]);

  const filtered = bookings.filter(b => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (search && !b.guestName.toLowerCase().includes(search.toLowerCase()) && !b.bookingNumber.includes(search) && !b.roomNumber.includes(search)) return false;
    return true;
  });

  const calDays = Array.from({ length: 14 }, (_, i) => addDays(calStart, i));
  const calRooms = [...rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  const getBookingForRoomDay = (roomId: string, day: Date) => {
    const d = format(day, 'yyyy-MM-dd');
    return bookings.find(b => b.roomId === roomId && b.checkIn <= d && b.checkOut > d);
  };

  const addServiceDraft = (preset = servicePresets[0]) => {
    setBookingForm(form => ({
      ...form,
      services: [
        ...form.services,
        {
          serviceCode: preset.serviceCode,
          serviceName: preset.serviceName,
          quantity: 1,
          unitPrice: preset.unitPrice,
          serviceDate: '',
          notes: '',
        },
      ],
    }));
  };

  const updateServiceDraft = (index: number, patch: Partial<BookingServiceDraft>) => {
    setBookingForm(form => ({
      ...form,
      services: form.services.map((service, idx) => idx === index ? { ...service, ...patch } : service),
    }));
  };

  const removeServiceDraft = (index: number) => {
    setBookingForm(form => ({
      ...form,
      services: form.services.filter((_, idx) => idx !== index),
    }));
  };

  const invalidateOperations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
      queryClient.invalidateQueries({ queryKey: ['bookingServices'] }),
      queryClient.invalidateQueries({ queryKey: ['bookingDeposits'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentQueue }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashierSessions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms }),
      queryClient.invalidateQueries({ queryKey: queryKeys.folios }),
      queryClient.invalidateQueries({ queryKey: queryKeys.hkTasks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const guestId = bookingForm.guestId || guests[0]?.id;
      const roomId = bookingForm.roomId;
      if (!propertyId) throw new Error('Không xác định được khách sạn hiện tại.');
      if (!guestId) throw new Error('Cần chọn khách trước khi tạo booking.');
      if (!bookingForm.roomTypeId) throw new Error('Cần chọn loại phòng.');
      if (!roomId || !availableRooms.some(room => room.id === roomId)) throw new Error('Cần chọn phòng còn trống trong khoảng ngày đã chọn.');
      if (!datesValid) throw new Error('Ngày check-out phải sau check-in.');
      return createBooking({
        propertyId,
        guestId,
        roomId,
        checkIn: bookingForm.checkIn,
        checkOut: bookingForm.checkOut,
        adults: bookingForm.adults,
        children: bookingForm.children,
        status: bookingForm.status,
        source: bookingForm.source,
        rateCode: bookingForm.rateCode.trim() || 'BAR',
        ratePerNight: bookingForm.ratePerNight,
        depositAmount: bookingForm.depositAmount,
        depositPaid: false,
        externalReference: bookingForm.externalReference.trim() || undefined,
        notes: bookingForm.notes,
        services: bookingForm.services
          .filter(service => service.serviceName.trim())
          .map(service => ({
            serviceCode: service.serviceCode.trim() || 'other',
            serviceName: service.serviceName.trim(),
            quantity: Math.max(1, Number(service.quantity) || 1),
            unitPrice: Math.max(0, Number(service.unitPrice) || 0),
            serviceDate: service.serviceDate || undefined,
            notes: service.notes.trim() || undefined,
          })),
      });
    },
    onSuccess: async (bookingId) => {
      await invalidateOperations();
      const latestBookings = await queryClient.fetchQuery({ queryKey: queryKeys.bookings, queryFn: fetchBookings });
      const created = latestBookings.find(booking => booking.id === bookingId) ?? null;
      setSelected(created);
      setConfirmationBooking(created);
      setShowCreate(false);
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không tạo được booking.')),
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => cancelBooking(bookingId, 'Hủy từ giao diện PMS'),
    onSuccess: async () => {
      await invalidateOperations();
      setSelected(null);
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không hủy được booking.')),
  });

  const checkInMutation = useMutation({
    mutationFn: (booking: Booking) => checkInBooking(booking.id, booking.roomId),
    onSuccess: async () => {
      await invalidateOperations();
      setSelected(null);
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không check-in được.')),
  });

  const checkOutMutation = useMutation({
    mutationFn: (bookingId: string) => checkOutBooking(bookingId),
    onSuccess: async () => {
      await invalidateOperations();
      setSelected(null);
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không check-out được.')),
  });

  const depositMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Chưa chọn booking.');
      if (depositForm.amount <= 0) throw new Error('Số tiền cọc phải lớn hơn 0.');
      return recordBookingDeposit(selected, depositForm.method, depositForm.amount, depositForm.reference, depositForm.evidencePath);
    },
    onSuccess: async () => {
      await invalidateOperations();
      setDepositForm({ method: 'cash', amount: 0, reference: '', evidencePath: '' });
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không ghi nhận được đặt cọc.')),
  });

  const verifyDepositMutation = useMutation({
    mutationFn: (depositId: string) => verifyPayment(depositId, 'deposit', 'approve'),
    onSuccess: async () => {
      await invalidateOperations();
      setActionError(null);
    },
    onError: (err) => setActionError(errorMessage(err, 'Không xác nhận được đặt cọc.')),
  });

  const availabilityMessage = !datesValid
    ? 'Ngày check-out phải sau check-in.'
    : availableRoomsQuery.isLoading
      ? 'Đang kiểm tra phòng trống...'
      : availableRoomsQuery.error
        ? errorMessage(availableRoomsQuery.error, 'Không kiểm tra được phòng trống.')
        : `${availableRooms.length} phòng trống`;

  return (
    <div>
      <div className="page-header">
        <div><h1>Đặt phòng</h1><p>{bookings.length} booking · {bookings.filter(b=>b.status==='checked_in').length} đang ở</p></div>
        <div className="flex gap-8">
          <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
            {(['list','calendar'] as const).map(v => (
              <button key={v} onClick={()=>setView(v)}
                style={{ padding:'7px 14px', background:view===v?'var(--accent)':'var(--bg-card)', color:view===v?'#fff':'var(--text-secondary)', border:'none', cursor:'pointer', fontSize:13, fontWeight:500 }}>
                {v==='list'?'Danh sách':'Lịch'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowCreate(true)}><Plus size={14}/> Tạo booking</button>
        </div>
      </div>
      {actionError && <div className="form-error" style={{ marginBottom:12 }}>{actionError}</div>}

      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div className="search-box" style={{ flex:1, minWidth:220 }}>
          <Search size={15} color="var(--text-muted)"/>
          <input placeholder="Tìm khách, số phòng, booking..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {(['all','confirmed','checked_in','tentative','checked_out','cancelled'] as const).map(s=>(
          <button key={s} onClick={()=>setFilterStatus(s)}
            style={{ padding:'6px 14px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', background:filterStatus===s?'var(--accent)':'var(--bg-card)', color:filterStatus===s?'#fff':'var(--text-secondary)', cursor:'pointer', fontSize:12.5, fontWeight:500 }}>
            {s==='all'?'Tất cả':statusLabel[s]}
          </button>
        ))}
      </div>

      {view === 'list' ? (
        <div className="card" style={{ padding:0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Số BK</th><th>Khách</th><th>Phòng</th><th>Check-in</th><th>Check-out</th><th>Đêm</th><th>Nguồn</th><th>Trạng thái</th><th>Tổng tiền</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} style={{ cursor:'pointer' }} onClick={()=>setSelected(b)}>
                    <td><span style={{ fontFamily:'monospace', fontWeight:700, fontSize:13 }}>{b.bookingNumber}</span></td>
                    <td>
                      <div style={{ fontWeight:600 }}>{b.guestName}</div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{b.guestPhone}</div>
                    </td>
                    <td><strong>P.{b.roomNumber}</strong><div style={{ fontSize:12, color:'var(--text-secondary)' }}>{b.roomTypeName}</div></td>
                    <td style={{ fontSize:13 }}>{b.checkIn}</td>
                    <td style={{ fontSize:13 }}>{b.checkOut}</td>
                    <td style={{ textAlign:'center' }}>{b.nights}</td>
                    <td><span className="badge badge-gray">{sourceLabels[b.source] ?? b.source}</span></td>
                    <td><span className={`badge ${statusBadge[b.status]}`}>{statusLabel[b.status]}</span></td>
                    <td style={{ fontWeight:600 }}>{fmt(b.totalAmount)}đ</td>
                    <td><button className="btn btn-ghost btn-sm">Chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="empty-state"><CalendarDays size={40} className="empty-state-icon"/><h3>Không có booking</h3></div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflowX:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm btn-icon" onClick={()=>setCalStart(d=>addDays(d,-7))}><ChevronLeft size={15}/></button>
            <span style={{ fontWeight:600, fontSize:14 }}>{format(calStart,'dd/MM')} — {format(addDays(calStart,13),'dd/MM/yyyy')}</span>
            <button className="btn btn-secondary btn-sm btn-icon" onClick={()=>setCalStart(d=>addDays(d,7))}><ChevronRight size={15}/></button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setCalStart(new Date())}>Hôm nay</button>
          </div>

          <div style={{ minWidth: 900 }}>
            <div style={{ display:'grid', gridTemplateColumns:'80px repeat(14, 1fr)', borderBottom:'1px solid var(--border)', background:'#f9fafb' }}>
              <div style={{ padding:'8px 10px', fontSize:11, fontWeight:600, color:'var(--text-secondary)' }}>Phòng</div>
              {calDays.map((d,i) => {
                const isToday = format(d,'yyyy-MM-dd') === format(new Date(),'yyyy-MM-dd');
                return (
                  <div key={i} style={{ padding:'6px 4px', textAlign:'center', borderLeft:'1px solid var(--border-light)', background:isToday?'#eff6ff':undefined }}>
                    <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{format(d,'EEE',{locale:vi})}</div>
                    <div style={{ fontSize:13, fontWeight: isToday?800:600, color:isToday?'var(--accent)':'var(--text-primary)' }}>{format(d,'dd')}</div>
                  </div>
                );
              })}
            </div>

            {calRooms.map(room => (
              <div key={room.id} style={{ display:'grid', gridTemplateColumns:'80px repeat(14, 1fr)', borderBottom:'1px solid var(--border-light)', minHeight:38 }}>
                <div style={{ padding:'8px 10px', fontSize:13, fontWeight:600, borderRight:'1px solid var(--border)', display:'flex', alignItems:'center' }}>
                  {room.number}
                </div>
                {calDays.map((d,i) => {
                  const bk = getBookingForRoomDay(room.id, d);
                  const isStart = bk && format(d,'yyyy-MM-dd') === bk.checkIn;
                  return (
                    <div key={i} style={{ borderLeft:'1px solid var(--border-light)', padding:'4px 2px', position:'relative', display:'flex', alignItems:'center' }}>
                      {bk && isStart && (
                        <div className={`booking-bar ${barClass[bk.status]}`}
                          style={{ position:'absolute', left:2, right:2, zIndex:2, cursor:'pointer' }}
                          onClick={()=>setSelected(bk)}
                          title={`${bk.guestName} · ${bk.checkIn} → ${bk.checkOut}`}>
                          {bk.guestName.split(' ').slice(-1)[0]}
                        </div>
                      )}
                      {bk && !isStart && (
                        <div className={`booking-bar ${barClass[bk.status]}`} style={{ position:'absolute', left:0, right:2, zIndex:1, opacity:.6, cursor:'pointer' }} onClick={()=>setSelected(bk)}/>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <>
          <div className="drawer-overlay" onClick={()=>setSelected(null)}/>
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <div className="modal-title">{selected.bookingNumber}</div>
                <span className={`badge ${statusBadge[selected.status]}`} style={{ marginTop:4 }}>{statusLabel[selected.status]}</span>
              </div>
              <button className="modal-close" onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {[
                  ['Khách', selected.guestName],
                  ['SĐT', selected.guestPhone],
                  ['Phòng', `${selected.roomNumber} — ${selected.roomTypeName}`],
                  ['Nguồn', sourceLabels[selected.source] ?? selected.source],
                  ['Check-in', selected.checkIn],
                  ['Check-out', selected.checkOut],
                  ['Số đêm', selected.nights],
                  ['Khách', `${selected.adults} người lớn, ${selected.children} trẻ em`],
                  ['Giá/đêm', `${fmt(selected.ratePerNight)}đ`],
                  ['Tổng cộng', `${fmt(selected.totalAmount)}đ`],
                  ['Đặt cọc', `${fmt(selected.depositAmount)}đ ${selected.depositPaid?'✓':''}`],
                ].map(([k,v]) => (
                  <div key={String(k)}>
                    <div className="form-label">{k}</div>
                    <div style={{ marginTop:3, fontWeight:500 }}>{v}</div>
                  </div>
                ))}
                {selected.notes && (
                  <div style={{ gridColumn:'span 2' }}>
                    <div className="form-label">Ghi chú</div>
                    <div style={{ marginTop:3, color:'var(--text-secondary)', fontSize:13 }}>{selected.notes}</div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Dịch vụ đi kèm</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Hiển thị trên phiếu xác nhận gửi khách.</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfirmationBooking(selected)}>
                    <FileText size={13} /> PDF xác nhận
                  </button>
                </div>
                {bookingServices.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {bookingServices.map(service => (
                      <div key={service.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius)' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{service.serviceName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {service.quantity} x {fmt(service.unitPrice)}đ{service.serviceDate ? ` · ${service.serviceDate}` : ''}
                          </div>
                        </div>
                        <div style={{ fontWeight: 900 }}>{fmt(service.totalAmount)}đ</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Booking chưa có dịch vụ đi kèm.</div>
                )}
              </div>

              <div style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Cọc & xác nhận thanh toán</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Chuyển khoản chỉ được tính sau khi kế toán/quản lý xác nhận.
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="form-label">Yêu cầu cọc</div>
                    <div style={{ fontWeight: 900 }}>{fmt(selected.depositAmount)}đ</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {deposits.map(deposit => (
                    <div key={deposit.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius)' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{paymentMethodLabel[deposit.method]} · {fmt(deposit.amount)}đ</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {deposit.reference ?? 'Không có reference'} · {deposit.receiptNumber ?? 'Chưa có receipt'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className={`badge ${deposit.status === 'pending_verification' ? 'badge-yellow' : deposit.status === 'voided' ? 'badge-gray' : 'badge-green'}`}>
                          {paymentStatusLabel[deposit.status]}
                        </span>
                        {canVerifyPayments && deposit.status === 'pending_verification' && (
                          <button className="btn btn-primary btn-sm" disabled={verifyDepositMutation.isPending} onClick={() => verifyDepositMutation.mutate(deposit.id)}>
                            <CheckCircle size={13} /> Duyệt
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {deposits.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chưa ghi nhận cọc.</div>}
                </div>

                {['tentative', 'confirmed'].includes(selected.status) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Phương thức</label>
                      <select className="form-input form-select" value={depositForm.method} onChange={e => setDepositForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}>
                        <option value="cash">Tiền mặt</option>
                        <option value="bank_transfer">Chuyển khoản</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Số tiền</label>
                      <input className="form-input" type="number" value={depositForm.amount || ''} onChange={e => setDepositForm(f => ({ ...f, amount: Number(e.target.value) }))} placeholder="0" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reference</label>
                      <input className="form-input" value={depositForm.reference} onChange={e => setDepositForm(f => ({ ...f, reference: e.target.value }))} placeholder={depositForm.method === 'bank_transfer' ? 'Mã giao dịch...' : 'Ghi chú...'} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Chứng từ</label>
                      <input className="form-input" value={depositForm.evidencePath} onChange={e => setDepositForm(f => ({ ...f, evidencePath: e.target.value }))} placeholder="storage/path hoặc ghi chú ảnh..." />
                    </div>
                    <button className="btn btn-secondary" style={{ gridColumn: 'span 2' }} disabled={depositMutation.isPending} onClick={() => depositMutation.mutate()}>
                      Ghi nhận cọc
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="drawer-footer">
              <button className="btn btn-secondary flex-1" onClick={()=>setSelected(null)}>Đóng</button>
              {['tentative','confirmed'].includes(selected.status) && <button className="btn btn-danger" disabled={cancelMutation.isPending} onClick={()=>cancelMutation.mutate(selected.id)}>Hủy</button>}
              {selected.status==='confirmed' && <button className="btn btn-primary flex-1" disabled={checkInMutation.isPending} onClick={()=>checkInMutation.mutate(selected)}>Check-in</button>}
              {selected.status==='checked_in' && <button className="btn btn-primary flex-1" disabled={checkOutMutation.isPending} onClick={()=>checkOutMutation.mutate(selected.id)}>Check-out</button>}
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={()=>setShowCreate(false)}>
          <form className="modal" style={{ maxWidth:720 }} onClick={e=>e.stopPropagation()} onSubmit={e=>{ e.preventDefault(); createMutation.mutate(); }}>
            <div className="modal-header">
              <span className="modal-title">Tạo booking</span>
              <button type="button" className="modal-close" onClick={()=>setShowCreate(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:14 }}>
                <div className="form-group">
                  <label className="form-label">Khách</label>
                  <select className="form-input form-select" value={bookingForm.guestId || guests[0]?.id || ''} onChange={e=>setBookingForm(f=>({...f, guestId:e.target.value}))}>
                    {guests.map(g => <option key={g.id} value={g.id}>{g.fullName} · {g.phone}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Trạng thái</label>
                  <select className="form-input form-select" value={bookingForm.status} onChange={e=>setBookingForm(f=>({...f, status:e.target.value as CreateStatus}))}>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="tentative">Tạm giữ</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Check-in</label><input className="form-input" type="date" value={bookingForm.checkIn} onChange={e=>setBookingForm(f=>({...f, checkIn:e.target.value, roomId:''}))}/></div>
                <div className="form-group"><label className="form-label">Check-out</label><input className="form-input" type="date" value={bookingForm.checkOut} onChange={e=>setBookingForm(f=>({...f, checkOut:e.target.value, roomId:''}))}/></div>
                <div className="form-group">
                  <label className="form-label">Loại phòng</label>
                  <select className="form-input form-select" value={bookingForm.roomTypeId} onChange={e=>setBookingForm(f=>({...f, roomTypeId:e.target.value, roomId:''}))}>
                    {roomTypes.map(type => <option key={type.id} value={type.id}>{type.name} · {fmt(type.basePrice)}đ</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Phòng trống</label>
                  <select className="form-input form-select" value={bookingForm.roomId} disabled={!datesValid || availableRoomsQuery.isLoading || availableRooms.length === 0} onChange={e=>setBookingForm(f=>({...f, roomId:e.target.value}))}>
                    {availableRooms.length === 0 ? (
                      <option value="">Không có phòng trống</option>
                    ) : availableRooms.map(r => (
                      <option key={r.id} value={r.id}>P.{r.number} · tầng {r.floor} · {roomTypeNameById.get(r.roomTypeId) ?? 'Loại phòng'}</option>
                    ))}
                  </select>
                  <div style={{ fontSize:12, fontWeight:700, color: availableRooms.length ? 'var(--success)' : 'var(--text-muted)' }}>
                    {availabilityMessage}
                  </div>
                </div>
                <div className="form-group"><label className="form-label">Người lớn</label><input className="form-input" type="number" min={1} value={bookingForm.adults} onChange={e=>setBookingForm(f=>({...f, adults:Number(e.target.value)}))}/></div>
                <div className="form-group"><label className="form-label">Trẻ em</label><input className="form-input" type="number" min={0} value={bookingForm.children} onChange={e=>setBookingForm(f=>({...f, children:Number(e.target.value)}))}/></div>
                <div className="form-group">
                  <label className="form-label">Nguồn</label>
                  <select className="form-input form-select" value={bookingForm.source} onChange={e=>setBookingForm(f=>({...f, source:e.target.value as BookingSource}))}>
                    {(Object.keys(sourceLabels) as BookingSource[]).map(source => <option key={source} value={source}>{sourceLabels[source]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Rate code</label>
                  <select className="form-input form-select" value={bookingForm.rateCode} onChange={e=>{
                    const rate = roomRates.find(item => item.rateCode === e.target.value);
                    setBookingForm(f=>({...f, rateCode:e.target.value, ratePerNight: rate?.amount ?? f.ratePerNight}));
                  }}>
                    {roomRates.filter(rate => rate.isActive).length === 0 ? (
                      <option value={bookingForm.rateCode}>{bookingForm.rateCode}</option>
                    ) : roomRates.filter(rate => rate.isActive).map(rate => (
                      <option key={rate.id} value={rate.rateCode}>{rate.rateCode} · {rate.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Giá/đêm</label><input className="form-input" type="number" min={0} value={bookingForm.ratePerNight} onChange={e=>setBookingForm(f=>({...f, ratePerNight:Number(e.target.value)}))}/></div>
                <div className="form-group"><label className="form-label">Yêu cầu đặt cọc</label><input className="form-input" type="number" min={0} value={bookingForm.depositAmount} onChange={e=>setBookingForm(f=>({...f, depositAmount:Number(e.target.value)}))}/></div>
                <div className="form-group"><label className="form-label">Mã tham chiếu</label><input className="form-input" value={bookingForm.externalReference} onChange={e=>setBookingForm(f=>({...f, externalReference:e.target.value}))}/></div>
                <div style={{ fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center' }}>Cọc được ghi nhận trong chi tiết booking sau khi tạo.</div>

                <div style={{ gridColumn:'span 2', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:10 }}>
                    <div>
                      <div style={{ fontWeight:800 }}>Dịch vụ đi kèm</div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)' }}>Buffet sáng, ăn trưa/tối hoặc dịch vụ khác nếu khách yêu cầu.</div>
                    </div>
                    <select className="form-input form-select" style={{ width:210 }} onChange={e => {
                      const preset = servicePresets.find(item => item.serviceCode === e.target.value) ?? servicePresets[0];
                      addServiceDraft(preset);
                      e.currentTarget.value = '';
                    }} defaultValue="">
                      <option value="" disabled>Thêm dịch vụ</option>
                      {servicePresets.map(preset => <option key={preset.serviceCode} value={preset.serviceCode}>{preset.serviceName}</option>)}
                    </select>
                  </div>
                  {bookingForm.services.length > 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {bookingForm.services.map((service, index) => (
                        <div key={index} style={{ display:'grid', gridTemplateColumns:'1.2fr 78px 120px 130px 34px', gap:8, alignItems:'center' }}>
                          <input className="form-input" value={service.serviceName} onChange={e => updateServiceDraft(index, { serviceName: e.target.value })} placeholder="Tên dịch vụ" />
                          <input className="form-input" type="number" min={1} value={service.quantity} onChange={e => updateServiceDraft(index, { quantity: Number(e.target.value) })} />
                          <input className="form-input" type="number" min={0} value={service.unitPrice} onChange={e => updateServiceDraft(index, { unitPrice: Number(e.target.value) })} />
                          <input className="form-input" type="date" value={service.serviceDate} onChange={e => updateServiceDraft(index, { serviceDate: e.target.value })} />
                          <button type="button" className="btn btn-secondary btn-icon" onClick={() => removeServiceDraft(index)} title="Xóa dịch vụ"><Trash2 size={14} /></button>
                          <input className="form-input" style={{ gridColumn:'span 5' }} value={service.notes} onChange={e => updateServiceDraft(index, { notes: e.target.value })} placeholder="Ghi chú dịch vụ nếu có" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color:'var(--text-muted)', fontSize:13 }}>Chưa thêm dịch vụ đi kèm.</div>
                  )}
                </div>

                <div style={{ gridColumn:'span 2', display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
                  <div className="kpi-card"><div className="kpi-label">Tiền phòng</div><div className="kpi-value">{fmt(roomDraftTotalAmount)}đ</div></div>
                  <div className="kpi-card"><div className="kpi-label">Dịch vụ</div><div className="kpi-value">{fmt(serviceDraftTotalAmount)}đ</div></div>
                  <div className="kpi-card"><div className="kpi-label">Tổng dự kiến</div><div className="kpi-value">{fmt(roomDraftTotalAmount + serviceDraftTotalAmount)}đ</div></div>
                </div>
                <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Ghi chú</label><textarea className="form-input" rows={2} value={bookingForm.notes} onChange={e=>setBookingForm(f=>({...f, notes:e.target.value}))}/></div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={()=>setShowCreate(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || availableRoomsQuery.isLoading || availableRooms.length === 0}>
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo booking'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmationBooking && (
        <BookingConfirmationModal
          booking={confirmationBooking}
          services={confirmationServicesQuery.data ?? (confirmationBooking.id === selected?.id ? bookingServices : [])}
          deposits={confirmationDepositsQuery.data ?? (confirmationBooking.id === selected?.id ? deposits : [])}
          onClose={() => setConfirmationBooking(null)}
        />
      )}
    </div>
  );
}
