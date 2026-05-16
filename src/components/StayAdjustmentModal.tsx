import React, { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

export type StayAdjustmentTarget = {
  bookingId: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  ratePerNight: number;
};

type Props = {
  target: StayAdjustmentTarget;
  isPending?: boolean;
  onClose: () => void;
  onSubmit: (newCheckOut: string, reason: string) => void;
};

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function diffNights(checkIn: string, checkOut: string) {
  return Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000));
}

export default function StayAdjustmentModal({ target, isPending, onClose, onSubmit }: Props) {
  const minCheckOut = useMemo(() => addDays(target.checkIn, 1), [target.checkIn]);
  const [newCheckOut, setNewCheckOut] = useState(target.checkOut);
  const [reason, setReason] = useState('');

  const newNights = diffNights(target.checkIn, newCheckOut);
  const oldRoomTotal = target.nights * target.ratePerNight;
  const newRoomTotal = newNights * target.ratePerNight;
  const delta = newRoomTotal - oldRoomTotal;
  const invalid = newCheckOut < minCheckOut || newCheckOut === target.checkOut || !reason.trim();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="modal"
        style={{ maxWidth: 460 }}
        onClick={event => event.stopPropagation()}
        onSubmit={event => {
          event.preventDefault();
          if (!invalid) onSubmit(newCheckOut, reason.trim());
        }}
      >
        <div className="modal-header">
          <span className="modal-title">Gia hạn / điều chỉnh lưu trú</span>
          <button type="button" className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--accent-light)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                {target.roomNumber}
              </div>
              <div>
                <div style={{ fontWeight: 800 }}>{target.guestName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{target.checkIn} {'->'} {target.checkOut} · {target.nights} đêm</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Ngày checkout mới</label>
              <input
                className="form-input"
                type="date"
                min={minCheckOut}
                value={newCheckOut}
                onChange={event => setNewCheckOut(event.target.value)}
              />
            </div>

            <div className="audit-summary-grid">
              <div className="kpi-card">
                <div className="kpi-label">Số đêm mới</div>
                <div className="kpi-value">{newNights}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Tiền phòng mới</div>
                <div className="kpi-value">{fmt(newRoomTotal)}đ</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Chênh lệch</div>
                <div className="kpi-value" style={{ color: delta < 0 ? 'var(--success)' : delta > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {delta > 0 ? '+' : delta < 0 ? '-' : ''}{fmt(Math.abs(delta))}đ
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Lý do</label>
              <textarea
                className="form-input"
                rows={3}
                value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder="Ví dụ: khách trả phòng sớm, khách ở thêm 1 đêm..."
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={invalid || isPending}>
            <CalendarClock size={14} /> Lưu điều chỉnh
          </button>
        </div>
      </form>
    </div>
  );
}
