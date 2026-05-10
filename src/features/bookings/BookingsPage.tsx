import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Booking, BookingSource, BookingStatus } from '@/types';
import { Search, Plus, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cancelBooking, checkInBooking, checkOutBooking, createBooking, fetchBookings, fetchGuests, fetchRooms, queryKeys } from '@/lib/data';
import { useAuth } from '@/features/auth/AuthContext';

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

const fmt = (n:number) => new Intl.NumberFormat('vi-VN').format(n);

export default function BookingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list'|'calendar'>('list');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<BookingStatus|'all'>('all');
  const [calStart, setCalStart] = useState(new Date());
  const [selected, setSelected] = useState<Booking|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState({
    guestId: '',
    roomId: '',
    checkIn: new Date().toISOString().slice(0, 10),
    checkOut: addDays(new Date(), 1).toISOString().slice(0, 10),
    adults: 1,
    children: 0,
    source: 'direct' as BookingSource,
    rateCode: 'BAR',
    ratePerNight: 800000,
    depositAmount: 0,
    depositPaid: false,
    notes: '',
  });
  const bookingsQuery = useQuery({ queryKey: queryKeys.bookings, queryFn: fetchBookings, refetchInterval: 30_000 });
  const roomsQuery = useQuery({ queryKey: queryKeys.rooms, queryFn: fetchRooms, refetchInterval: 30_000 });
  const guestsQuery = useQuery({ queryKey: queryKeys.guests, queryFn: fetchGuests });
  const bookings = bookingsQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const guests = guestsQuery.data ?? [];

  const filtered = bookings.filter(b => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (search && !b.guestName.toLowerCase().includes(search.toLowerCase()) && !b.bookingNumber.includes(search) && !b.roomNumber.includes(search)) return false;
    return true;
  });

  // Calendar: show 14 days from calStart
  const calDays = Array.from({ length: 14 }, (_, i) => addDays(calStart, i));
  const calRooms = rooms.filter(r => bookings.some(b => b.roomId === r.id)).slice(0, 15);

  const getBookingForRoomDay = (roomId: string, day: Date) => {
    const d = format(day, 'yyyy-MM-dd');
    return bookings.find(b => b.roomId === roomId && b.checkIn <= d && b.checkOut > d);
  };

  const invalidateOperations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms }),
      queryClient.invalidateQueries({ queryKey: queryKeys.folios }),
      queryClient.invalidateQueries({ queryKey: queryKeys.hkTasks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const guestId = bookingForm.guestId || guests[0]?.id;
      const roomId = bookingForm.roomId || rooms.find(r => r.status === 'vacant_clean')?.id || rooms[0]?.id;
      if (!guestId || !roomId) throw new Error('Cần chọn khách và phòng.');
      if (bookingForm.checkOut <= bookingForm.checkIn) throw new Error('Ngày check-out phải sau check-in.');
      return createBooking({
        propertyId: user?.propertyId ?? rooms[0]?.propertyId ?? guests[0]?.propertyId ?? 'prop-001',
        guestId,
        roomId,
        checkIn: bookingForm.checkIn,
        checkOut: bookingForm.checkOut,
        adults: bookingForm.adults,
        children: bookingForm.children,
        source: bookingForm.source,
        rateCode: bookingForm.rateCode,
        ratePerNight: bookingForm.ratePerNight,
        depositAmount: bookingForm.depositAmount,
        depositPaid: bookingForm.depositPaid,
        notes: bookingForm.notes,
      });
    },
    onSuccess: async () => {
      await invalidateOperations();
      setShowCreate(false);
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Không tạo được booking.'),
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => cancelBooking(bookingId, 'Hủy từ giao diện PMS'),
    onSuccess: async () => {
      await invalidateOperations();
      setSelected(null);
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Không hủy được booking.'),
  });

  const checkInMutation = useMutation({
    mutationFn: (booking: Booking) => checkInBooking(booking.id, booking.roomId),
    onSuccess: async () => {
      await invalidateOperations();
      setSelected(null);
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Không check-in được.'),
  });

  const checkOutMutation = useMutation({
    mutationFn: (bookingId: string) => checkOutBooking(bookingId),
    onSuccess: async () => {
      await invalidateOperations();
      setSelected(null);
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Không check-out được.'),
  });

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

      {/* Filters */}
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
                    <td><span className="badge badge-gray">{b.source}</span></td>
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
        // Calendar / timeline view
        <div className="card" style={{ padding:0, overflowX:'auto' }}>
          {/* Navigation */}
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm btn-icon" onClick={()=>setCalStart(d=>addDays(d,-7))}><ChevronLeft size={15}/></button>
            <span style={{ fontWeight:600, fontSize:14 }}>{format(calStart,'dd/MM')} — {format(addDays(calStart,13),'dd/MM/yyyy')}</span>
            <button className="btn btn-secondary btn-sm btn-icon" onClick={()=>setCalStart(d=>addDays(d,7))}><ChevronRight size={15}/></button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setCalStart(new Date())}>Hôm nay</button>
          </div>

          <div style={{ minWidth: 900 }}>
            {/* Header row */}
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

            {/* Room rows */}
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

      {/* Booking detail drawer */}
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
                  ['Nguồn', selected.source],
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
          <form className="modal" style={{ maxWidth:620 }} onClick={e=>e.stopPropagation()} onSubmit={e=>{ e.preventDefault(); createMutation.mutate(); }}>
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
                  <label className="form-label">Phòng</label>
                  <select className="form-input form-select" value={bookingForm.roomId || rooms.find(r=>r.status==='vacant_clean')?.id || rooms[0]?.id || ''} onChange={e=>setBookingForm(f=>({...f, roomId:e.target.value}))}>
                    {rooms.map(r => <option key={r.id} value={r.id}>P.{r.number} · {r.roomTypeName} · {r.status}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Check-in</label><input className="form-input" type="date" value={bookingForm.checkIn} onChange={e=>setBookingForm(f=>({...f, checkIn:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Check-out</label><input className="form-input" type="date" value={bookingForm.checkOut} onChange={e=>setBookingForm(f=>({...f, checkOut:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Người lớn</label><input className="form-input" type="number" min={1} value={bookingForm.adults} onChange={e=>setBookingForm(f=>({...f, adults:Number(e.target.value)}))}/></div>
                <div className="form-group"><label className="form-label">Trẻ em</label><input className="form-input" type="number" min={0} value={bookingForm.children} onChange={e=>setBookingForm(f=>({...f, children:Number(e.target.value)}))}/></div>
                <div className="form-group"><label className="form-label">Nguồn</label><select className="form-input form-select" value={bookingForm.source} onChange={e=>setBookingForm(f=>({...f, source:e.target.value as BookingSource}))}><option value="direct">Direct</option><option value="walk_in">Walk-in</option><option value="phone">Phone</option><option value="facebook">Facebook</option><option value="ota_manual">OTA Manual</option></select></div>
                <div className="form-group"><label className="form-label">Rate code</label><input className="form-input" value={bookingForm.rateCode} onChange={e=>setBookingForm(f=>({...f, rateCode:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Giá/đêm</label><input className="form-input" type="number" min={0} value={bookingForm.ratePerNight} onChange={e=>setBookingForm(f=>({...f, ratePerNight:Number(e.target.value)}))}/></div>
                <div className="form-group"><label className="form-label">Đặt cọc</label><input className="form-input" type="number" min={0} value={bookingForm.depositAmount} onChange={e=>setBookingForm(f=>({...f, depositAmount:Number(e.target.value)}))}/></div>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}><input type="checkbox" checked={bookingForm.depositPaid} onChange={e=>setBookingForm(f=>({...f, depositPaid:e.target.checked}))}/> Đã nhận cọc</label>
                <div className="form-group" style={{ gridColumn:'span 2' }}><label className="form-label">Ghi chú</label><textarea className="form-input" rows={2} value={bookingForm.notes} onChange={e=>setBookingForm(f=>({...f, notes:e.target.value}))}/></div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={()=>setShowCreate(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>Tạo booking</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
