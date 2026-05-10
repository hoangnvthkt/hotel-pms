import React, { useState } from 'react';
import { Settings, Tag, BedDouble, Users, Building2 } from 'lucide-react';
import MetadataTab from './tabs/MetadataTab';
import RoomTypesTab from './tabs/RoomTypesTab';
import StaffTab from './tabs/StaffTab';
import PropertyTab from './tabs/PropertyTab';

const TABS = [
  { key: 'metadata', label: 'Danh mục', icon: Tag },
  { key: 'rooms', label: 'Loại phòng & giá', icon: BedDouble },
  { key: 'staff', label: 'Nhân viên', icon: Users },
  { key: 'property', label: 'Khách sạn', icon: Building2 },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('metadata');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--coral)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            CẤU HÌNH HỆ THỐNG
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={26} color="var(--primary)" /> Cài đặt
          </h1>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--primary-bg)', padding: 4, borderRadius: 14, width: 'fit-content' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 20px', borderRadius: 10, border: 'none',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                background: active ? '#fff' : 'transparent',
                color: active ? 'var(--primary-dark)' : 'var(--text-secondary)',
                boxShadow: active ? '0 2px 8px rgba(43,168,162,0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'metadata' && <MetadataTab />}
      {activeTab === 'rooms' && <RoomTypesTab />}
      {activeTab === 'staff' && <StaffTab />}
      {activeTab === 'property' && <PropertyTab />}
    </div>
  );
}
