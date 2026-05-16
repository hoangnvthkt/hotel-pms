import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import type { Booking, BookingDeposit, BookingService, PaymentStatus } from '@/types';
import { Download, Printer, X } from 'lucide-react';

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

async function imageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function downloadBookingConfirmationPdf({
  booking,
  services,
  deposits,
  qrUrl,
  roomTotal,
  serviceTotal,
  postedDeposit,
  pendingDeposit,
}: {
  booking: Booking;
  services: BookingService[];
  deposits: BookingDeposit[];
  qrUrl: string;
  roomTotal: number;
  serviceTotal: number;
  postedDeposit: number;
  pendingDeposit: number;
}) {
  const canvas = document.createElement('canvas');
  const width = 1240;
  const height = Math.max(1754, 1320 + services.length * 58 + deposits.length * 46 + (booking.notes ? 120 : 0));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không tạo được canvas PDF.');

  const margin = 70;
  const contentWidth = width - margin * 2;
  let y = 64;

  const text = (value: string, x: number, top: number, size = 22, weight = '400', color = '#111827') => {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, top);
  };
  const line = (fromX: number, fromY: number, toX: number, toY: number, color = '#111827', size = 2) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  };
  const box = (x: number, top: number, w: number, h: number, stroke = '#e5e7eb', fill = '#ffffff') => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, 10);
    ctx.fill();
    ctx.stroke();
  };
  const section = (title: string) => {
    y += 34;
    text(title.toUpperCase(), margin, y, 20, '700');
    y += 18;
  };
  const infoGrid = (items: Array<{ label: string; value: string }>) => {
    const gap = 14;
    const colW = (contentWidth - gap) / 2;
    items.forEach((item, index) => {
      const x = margin + (index % 2) * (colW + gap);
      const top = y + Math.floor(index / 2) * 82;
      box(x, top, colW, 68);
      text(item.label.toUpperCase(), x + 16, top + 24, 15, '700', '#6b7280');
      text(item.value || '-', x + 16, top + 52, 20, '700');
    });
    y += Math.ceil(items.length / 2) * 82;
  };
  const totalLine = (label: string, value: number, strong = false, muted = false) => {
    const x = width - margin - 430;
    box(x, y, 430, 44, strong ? '#111827' : '#e5e7eb', strong ? '#111827' : muted ? '#fffbeb' : '#ffffff');
    text(label, x + 18, y + 29, 18, strong ? '700' : '400', strong ? '#ffffff' : muted ? '#92400e' : '#374151');
    text(`${fmt(value)}đ`, x + 250, y + 29, 18, '700', strong ? '#ffffff' : '#111827');
    y += 44;
  };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  text('GRAND PALACE HOTEL', margin, y, 36, '900');
  text('Phiếu xác nhận đặt phòng', margin, y + 42, 22, '700', '#4b5563');
  const pdfQrUrl = qrUrl || await QRCode.toDataURL(booking.bookingNumber, { errorCorrectionLevel: 'M', margin: 1, width: 180 });
  try {
    const qr = await imageFromDataUrl(pdfQrUrl);
    ctx.drawImage(qr, width - margin - 150, y - 14, 150, 150);
  } catch {
    box(width - margin - 150, y - 14, 150, 150, '#111827');
    text(booking.bookingNumber, width - margin - 138, y + 66, 16, '700');
  }
  text(booking.bookingNumber, width - margin - 150, y + 158, 16, '700', '#374151');
  y += 178;
  line(margin, y, width - margin, y, '#111827', 3);
  y += 28;

  const statusBoxes = [
    ['Mã đặt phòng', booking.bookingNumber],
    ['Ngày xác nhận', new Date().toLocaleDateString('vi-VN')],
    ['Trạng thái', booking.status === 'tentative' ? 'Tạm giữ' : 'Đã xác nhận'],
  ];
  statusBoxes.forEach(([label, value], index) => {
    const gap = 14;
    const colW = (contentWidth - gap * 2) / 3;
    const x = margin + index * (colW + gap);
    box(x, y, colW, 76);
    text(label.toUpperCase(), x + 16, y + 28, 15, '700', '#6b7280');
    text(value, x + 16, y + 58, 20, '700');
  });
  y += 82;

  section('Thông tin khách hàng');
  infoGrid([
    { label: 'Khách hàng', value: booking.guestName },
    { label: 'Số điện thoại', value: booking.guestPhone },
    { label: 'Nguồn booking', value: booking.source },
    { label: 'Mã tham chiếu', value: booking.externalReference ?? '-' },
  ]);

  section('Thông tin lưu trú');
  infoGrid([
    { label: 'Phòng', value: `${booking.roomNumber} · ${booking.roomTypeName}` },
    { label: 'Check-in', value: `${booking.checkIn} sau 14:00` },
    { label: 'Check-out', value: `${booking.checkOut} trước 12:00` },
    { label: 'Số khách', value: `${booking.adults} người lớn, ${booking.children} trẻ em` },
    { label: 'Số đêm', value: `${booking.nights} đêm` },
    { label: 'Giá phòng/đêm', value: `${fmt(booking.ratePerNight)}đ` },
  ]);

  section('Dịch vụ đi kèm');
  if (services.length === 0) {
    box(margin, y, contentWidth, 54);
    text('Chưa có dịch vụ đi kèm.', margin + 16, y + 34, 18, '400', '#4b5563');
    y += 60;
  } else {
    box(margin, y, contentWidth, 42, '#e5e7eb', '#f9fafb');
    text('Dịch vụ', margin + 14, y + 28, 16, '700', '#4b5563');
    text('Ngày dùng', margin + 430, y + 28, 16, '700', '#4b5563');
    text('SL', margin + 650, y + 28, 16, '700', '#4b5563');
    text('Đơn giá', margin + 730, y + 28, 16, '700', '#4b5563');
    text('Thành tiền', margin + 920, y + 28, 16, '700', '#4b5563');
    y += 42;
    services.forEach(service => {
      box(margin, y, contentWidth, 52);
      text(service.serviceName, margin + 14, y + 22, 18, '700');
      if (service.notes) text(service.notes, margin + 14, y + 43, 14, '400', '#6b7280');
      text(serviceDateLabel(service.serviceDate), margin + 430, y + 32, 16);
      text(String(service.quantity), margin + 650, y + 32, 16);
      text(`${fmt(service.unitPrice)}đ`, margin + 730, y + 32, 16);
      text(`${fmt(service.totalAmount)}đ`, margin + 920, y + 32, 16, '700');
      y += 52;
    });
  }

  section('Chi phí dự kiến');
  totalLine('Tiền phòng', roomTotal);
  totalLine('Dịch vụ đi kèm', serviceTotal);
  totalLine('Tổng dự kiến', booking.totalAmount, true);
  totalLine('Yêu cầu đặt cọc', booking.depositAmount);
  totalLine('Cọc đã xác nhận', postedDeposit);
  if (pendingDeposit > 0) totalLine('Cọc chờ xác nhận', pendingDeposit, false, true);

  if (deposits.length > 0) {
    section('Lịch sử cọc');
    box(margin, y, contentWidth, 42, '#e5e7eb', '#f9fafb');
    text('Ngày', margin + 14, y + 28, 16, '700', '#4b5563');
    text('Phương thức', margin + 260, y + 28, 16, '700', '#4b5563');
    text('Trạng thái', margin + 560, y + 28, 16, '700', '#4b5563');
    text('Số tiền', margin + 900, y + 28, 16, '700', '#4b5563');
    y += 42;
    deposits.forEach(deposit => {
      box(margin, y, contentWidth, 42);
      text(new Date(deposit.receivedAt).toLocaleDateString('vi-VN'), margin + 14, y + 28, 16);
      text(deposit.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản', margin + 260, y + 28, 16);
      text(statusLabel[deposit.status], margin + 560, y + 28, 16);
      text(`${fmt(deposit.amount)}đ`, margin + 900, y + 28, 16, '700');
      y += 42;
    });
  }

  if (booking.notes) {
    section('Ghi chú');
    box(margin, y, contentWidth, 58);
    text(booking.notes, margin + 16, y + 36, 18, '400', '#4b5563');
    y += 70;
  }

  y += 64;
  line(margin + 80, y, margin + 430, y);
  line(width - margin - 430, y, width - margin - 80, y);
  text('Khách hàng xác nhận', margin + 150, y + 34, 18, '400', '#6b7280');
  text(booking.guestName, margin + 150, y + 64, 20, '700');
  text('Đại diện khách sạn', width - margin - 350, y + 34, 18, '400', '#6b7280');
  text('Grand Palace Hotel', width - margin - 350, y + 64, 20, '700');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageData = canvas.toDataURL('image/png', 1);
  const imageHeight = canvas.height * pageWidth / canvas.width;
  let remainingHeight = imageHeight;
  let position = 0;

  pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight);
  remainingHeight -= pageHeight;
  while (remainingHeight > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imageData, 'PNG', 0, position, pageWidth, imageHeight);
    remainingHeight -= pageHeight;
  }
  pdf.save(`booking-confirmation-${booking.bookingNumber}.pdf`);
}

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
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
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

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadBookingConfirmationPdf({ booking, services, deposits, qrUrl, roomTotal, serviceTotal, postedDeposit, pendingDeposit });
    } catch {
      window.alert('Không tạo được file PDF. Vui lòng thử lại.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="modal-overlay booking-confirmation-overlay" onClick={onClose}>
      <div className="modal booking-confirmation-modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header no-print">
          <span className="modal-title">Phiếu xác nhận đặt phòng</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={isDownloadingPdf} onClick={handleDownloadPdf}>
              <Download size={14} /> {isDownloadingPdf ? 'Đang tạo...' : 'Tải PDF'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
              <Printer size={14} /> In
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
