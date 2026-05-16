import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adjustBookingStay, checkInBooking, checkOutBooking, fetchBookings, queryKeys } from '@/lib/data';
import type { Booking } from '@/types';
import StayAdjustmentModal, { type StayAdjustmentTarget } from '@/components/StayAdjustmentModal';
import { CalendarClock, CheckCircle, LogOut, UserPlus, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';

const today = new Date().toISOString().slice(0, 10);
const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
type ReceptionTab = 'arrivals'|'inhouse'|'departures';

function parseReceptionTab(value: string | null): ReceptionTab | null {
  return value === 'arrivals' || value === 'inhouse' || value === 'departures' ? value : null;
}

export default function ReceptionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const routeTab = parseReceptionTab(searchParams.get('tab'));
  const [tab, setTab] = useState<ReceptionTab>(routeTab ?? 'arrivals');
  const [actionError, setActionError] = useState<string | null>(null);
  const [stayModal, setStayModal] = useState<StayAdjustmentTarget | null>(null);
  const bookingsQuery = useQuery({ queryKey: queryKeys.bookings, queryFn: fetchBookings, refetchInterval: 30_000 });
  const bookings = bookingsQuery.data ?? [];

  useEffect(() => {
    if (routeTab) setTab(routeTab);
  }, [routeTab]);

  const arrivals = bookings.filter(b => b.checkIn === today && b.status === 'confirmed');
  const inHouse = bookings.filter(b => b.status === 'checked_in');
  const departures = bookings.filter(b => b.checkOut === today && b.status === 'checked_in');

  const counts = { arrivals: arrivals.length, inhouse: inHouse.length, departures: departures.length };
  const lists: Record<string, Booking[]> = { arrivals, inhouse: inHouse, departures };
  const current = lists[tab];

  const invalidateOps = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms }),
      queryClient.invalidateQueries({ queryKey: queryKeys.folios }),
      queryClient.invalidateQueries({ queryKey: queryKeys.hkTasks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashierSessions }),
    ]);
  };

  const checkInMutation = useMutation({
    mutationFn: (booking: Booking) => checkInBooking(booking.id, booking.roomId),
    onSuccess: async () => {
      await invalidateOps();
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Không check-in được.'),
  });

  const checkOutMutation = useMutation({
    mutationFn: (booking: Booking) => checkOutBooking(booking.id),
    onSuccess: async () => {
      await invalidateOps();
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Không check-out được.'),
  });

  const stayMutation = useMutation({
    mutationFn: ({ bookingId, newCheckOut, reason }: { bookingId: string; newCheckOut: string; reason: string }) =>
      adjustBookingStay(bookingId, newCheckOut, reason),
    onSuccess: async () => {
      await invalidateOps();
      setStayModal(null);
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Không điều chỉnh được lưu trú.'),
  });

  const openStayModal = (booking: Booking) => {
    setStayModal({
      bookingId: booking.id,
      guestName: booking.guestName,
      roomNumber: booking.roomNumber,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights: booking.nights,
      ratePerNight: booking.ratePerNight,
    });
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Lễ tân</h1><p>{format(new Date(), 'EEEE, dd/MM/yyyy')}</p></div>
        <button className="btn btn-primary btn-sm"><UserPlus size={14}/> Walk-in</button>
      </div>
      {actionError && <div className="form-error" style={{ marginBottom:12 }}>{actionError}</div>}

      {/* Tab bar */}
      <div className="reception-tabs">
        {([
          { key:'arrivals', label:'Đến hôm nay', icon:CheckCircle, color:'var(--success)' },
          { key:'inhouse', label:'Đang ở', icon:ArrowRightLeft, color:'var(--accent)' },
          { key:'departures', label:'Rời hôm nay', icon:LogOut, color:'var(--danger)' },
        ] as const).map(({ key, label, icon: Icon, color }) => (
          <div key={key} onClick={() => setTab(key)}
            style={{ background: tab===key?'var(--bg-card)':'transparent', border: tab===key?'2px solid var(--accent)':'2px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'18px 20px', cursor:'pointer', transition:'all .15s' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <Icon size={20} color={color}/>
              <span style={{ fontSize:13.5, fontWeight:600, color:'var(--text-secondary)' }}>{label}</span>
            </div>
            <div style={{ fontSize:32, fontWeight:800, color }}>{counts[key]}</div>
          </div>
        ))}
      </div>

      {/* Action list */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {current.map(b => (
          <div key={b.id} className="card" style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:'var(--accent-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, color:'var(--accent)', flexShrink:0 }}>
              {b.roomNumber}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{b.guestName}</div>
              <div style={{ fontSize:12.5, color:'var(--text-secondary)', marginTop:2 }}>
                {b.roomTypeName} · {b.adults} người lớn · {b.nights} đêm · {fmt(b.totalAmount)}đ
              </div>
              {b.notes && <div style={{ fontSize:12, color:'var(--warning)', marginTop:3 }}>⚠ {b.notes}</div>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ textAlign:'center', fontSize:12 }}>
                <div style={{ fontWeight:600 }}>CI: {b.checkIn}</div>
                <div style={{ color:'var(--text-secondary)' }}>CO: {b.checkOut}</div>
              </div>
              {tab === 'arrivals' && <button className="btn btn-primary" disabled={checkInMutation.isPending} onClick={()=>checkInMutation.mutate(b)}>✓ Check-in</button>}
              {tab === 'inhouse' && (
                <>
                  <button className="btn btn-secondary btn-sm"><ArrowRightLeft size={14}/> Đổi phòng</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => openStayModal(b)}><CalendarClock size={14}/> Gia hạn</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/folio?bookingId=${b.id}`)}>Folio</button>
                </>
              )}
              {tab === 'departures' && (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={() => openStayModal(b)}><CalendarClock size={14}/> Gia hạn</button>
                  <button className="btn btn-primary" disabled={checkOutMutation.isPending} onClick={()=>checkOutMutation.mutate(b)}>⬡ Check-out</button>
                </>
              )}
            </div>
          </div>
        ))}
        {current.length === 0 && (
          <div className="card empty-state">
            <CheckCircle size={40} style={{ color:'var(--border)' }}/>
            <h3>Không có khách</h3>
            <p>Tab này hiện trống</p>
          </div>
        )}
      </div>
      {stayModal && (
        <StayAdjustmentModal
          target={stayModal}
          isPending={stayMutation.isPending}
          onClose={() => setStayModal(null)}
          onSubmit={(newCheckOut, reason) => stayMutation.mutate({ bookingId: stayModal.bookingId, newCheckOut, reason })}
        />
      )}
    </div>
  );
}
