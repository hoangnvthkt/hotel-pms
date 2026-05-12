import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import type { Booking, BookingDeposit, BookingService, PaymentStatus } from '@/types';
import { Printer, X } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

const statusLabel: Record<PaymentStatus, string> = {
  draft: 'Nháp',
  pending_verification: 'Chờ xác nhận',
  posted: 'Đã thu',
  finalized: 'Đã đối soát',
  voided: 'Đã void',
  refunded: 'Đã hoàn',
};

const serviceDateLabel = (value?: string) => value ? value.split('-').reverse().join('/') : 'Theo lịch lưu trú';

export default function BookingConfirmationModal({
  booking,
  services,
  deposits,
  onClose,
}: {
  booking: Booking;
  services: BookingService[];
  deposits: BookingDeposit[];
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState('');
  const roomTotal = booking.nights * booking.ratePerNight;
  const serviceTotal = services.reduce((sum, service) => sum + service.totalAmount, 0);
  const postedDeposit = deposits
    .filter(deposit => ['posted', 'finalized'].includes(deposit.status))
    .reduce((sum, deposit) => sum + deposit.amount, 0);
  const pendingDeposit = deposits
    .filter(deposit => deposit.status === 'pending_verification')
    .reduce((sum, deposit) => sum + deposit.amount, 0);

  const qrPayload = useMemo(() => booking.bookingNumber, [booking.bookingNumber]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 180,
      color: { dark: '#111827', light: '#ffffff' },
    }).then(url => {
      if (!cancelled) setQrUrl(url);
    }).catch(() => {
      if (!cancelled) setQrUrl('');
    });
    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  useEffect(() => {
    document.body.classList.add('booking-confirmation-print-mode');
    return () => document.body.classList.remove('booking-confirmation-print-mode');
  }, []);

  return (
    <div className="modal-overlay booking-confirmation-overlay" onClick={onClose}>
      <div className="modal booking-confirmation-modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header no-print">
          <span className="modal-title">Phiếu xác nhận đặt phòng</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
              <Printer size={14} /> Lưu/In PDF
            </button>
            <button type="button" className="modal-close" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="booking-confirmation-print">
          <div className="confirmation-brand-row">
            <div>
              <div className="confirmation-brand">GRAND PALACE HOTEL</div>
              <div className="confirmation-subtitle">Phiếu xác nhận đặt phòng</div>
            </div>
            <div className="confirmation-qr-box">
              {qrUrl ? <img src={qrUrl} alt={`QR ${booking.bookingNumber}`} /> : <div className="confirmation-qr-fallback">{booking.bookingNumber}</div>}
              <div>{booking.bookingNumber}</div>
            </div>
          </div>

          <div className="confirmation-status-row">
            <div>
              <span>Mã đặt phòng</span>
              <strong>{booking.bookingNumber}</strong>
            </div>
            <div>
              <span>Ngày xác nhận</span>
              <strong>{new Date().toLocaleDateString('vi-VN')}</strong>
            </div>
            <div>
              <span>Trạng thái</span>
              <strong>{booking.status === 'tentative' ? 'Tạm giữ' : 'Đã xác nhận'}</strong>
            </div>
          </div>

          <section className="confirmation-section">
            <h3>Thông tin khách hàng</h3>
            <div className="confirmation-grid">
              <Info label="Khách hàng" value={booking.guestName} />
              <Info label="Số điện thoại" value={booking.guestPhone} />
              <Info label="Nguồn booking" value={booking.source} />
              <Info label="Mã tham chiếu" value={booking.externalReference ?? '—'} />
            </div>
          </section>

          <section className="confirmation-section">
            <h3>Thông tin lưu trú</h3>
            <div className="confirmation-grid">
              <Info label="Phòng" value={`${booking.roomNumber} · ${booking.roomTypeName}`} />
              <Info label="Check-in" value={`${booking.checkIn} sau 14:00`} />
              <Info label="Check-out" value={`${booking.checkOut} trước 12:00`} />
              <Info label="Số khách" value={`${booking.adults} người lớn, ${booking.children} trẻ em`} />
              <Info label="Số đêm" value={`${booking.nights} đêm`} />
              <Info label="Giá phòng/đêm" value={`${fmt(booking.ratePerNight)}đ`} />
            </div>
          </section>

          <section className="confirmation-section">
            <h3>Dịch vụ đi kèm</h3>
            {services.length > 0 ? (
              <table className="confirmation-table">
                <thead>
                  <tr>
                    <th>Dịch vụ</th>
                    <th>Ngày dùng</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(service => (
                    <tr key={service.id}>
                      <td>
                        <strong>{service.serviceName}</strong>
                        {service.notes && <small>{service.notes}</small>}
                      </td>
                      <td>{serviceDateLabel(service.serviceDate)}</td>
                      <td>{service.quantity}</td>
                      <td>{fmt(service.unitPrice)}đ</td>
                      <td>{fmt(service.totalAmount)}đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="confirmation-empty">Chưa có dịch vụ đi kèm.</div>
            )}
          </section>

          <section className="confirmation-section">
            <h3>Chi phí dự kiến</h3>
            <div className="confirmation-totals">
              <Line label="Tiền phòng" value={roomTotal} />
              <Line label="Dịch vụ đi kèm" value={serviceTotal} />
              <Line label="Tổng dự kiến" value={booking.totalAmount} strong />
              <Line label="Yêu cầu đặt cọc" value={booking.depositAmount} />
              <Line label="Cọc đã xác nhận" value={postedDeposit} />
              {pendingDeposit > 0 && <Line label="Cọc chờ xác nhận" value={pendingDeposit} muted />}
            </div>
          </section>

          {deposits.length > 0 && (
            <section className="confirmation-section">
              <h3>Lịch sử cọc</h3>
              <table className="confirmation-table">
                <thead>
                  <tr><th>Ngày</th><th>Phương thức</th><th>Trạng thái</th><th>Số tiền</th></tr>
                </thead>
                <tbody>
                  {deposits.map(deposit => (
                    <tr key={deposit.id}>
                      <td>{new Date(deposit.receivedAt).toLocaleDateString('vi-VN')}</td>
                      <td>{deposit.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</td>
                      <td>{statusLabel[deposit.status]}</td>
                      <td>{fmt(deposit.amount)}đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {booking.notes && (
            <section className="confirmation-section">
              <h3>Ghi chú</h3>
              <p className="confirmation-note">{booking.notes}</p>
            </section>
          )}

          <div className="confirmation-signatures">
            <div>
              <span>Khách hàng xác nhận</span>
              <strong>{booking.guestName}</strong>
            </div>
            <div>
              <span>Đại diện khách sạn</span>
              <strong>Grand Palace Hotel</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="confirmation-info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Line({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`confirmation-total-line${strong ? ' strong' : ''}${muted ? ' muted' : ''}`}>
      <span>{label}</span>
      <strong>{fmt(value)}đ</strong>
    </div>
  );
}
