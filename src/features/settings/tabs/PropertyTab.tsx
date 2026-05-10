import React from 'react';
import { Building2, Phone, MapPin, Clock } from 'lucide-react';

export default function PropertyTab() {
  return (
    <div className="card" style={{ padding: 28, maxWidth: 600 }}>
      <div className="card-title" style={{ marginBottom: 20 }}>
        <Building2 size={18} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--primary)' }} />
        Thông tin khách sạn
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        {[
          { label: 'Tên khách sạn', value: 'Grand Palace Hotel', icon: Building2 },
          { label: 'Địa chỉ', value: '123 Phố Lớn, Quận 1, TP.HCM', icon: MapPin },
          { label: 'Điện thoại', value: '028 1234 5678', icon: Phone },
          { label: 'Giờ check-in', value: '14:00', icon: Clock },
          { label: 'Giờ check-out', value: '12:00', icon: Clock },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <item.icon size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--primary-bg)', borderRadius: 10, fontSize: 12, color: 'var(--primary-dark)', fontWeight: 600 }}>
        💡 Để thay đổi thông tin khách sạn, liên hệ quản trị viên hệ thống hoặc cập nhật trực tiếp trong Supabase dashboard.
      </div>
    </div>
  );
}
