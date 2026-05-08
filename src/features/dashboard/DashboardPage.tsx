import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  BedDouble, Users, TrendingUp, DollarSign,
  ArrowUpRight, ArrowDownRight, CheckCircle, AlertCircle,
  Clock, Sparkles, CalendarCheck, LogOut
} from 'lucide-react';
import { mockDashboardStats, mockOccupancyTrend, mockRevenueBreakdown, mockBookingSources } from '@/mock/reports';
import { mockBookings } from '@/mock/bookings';
import { mockHKTasks } from '@/mock/housekeeping';
import { format } from 'date-fns';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

function StatCard({ label, value, sub, icon: Icon, iconBg, trend }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; trend?: 'up'|'down';
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <div>
          <div className="stat-card-label">{label}</div>
          <div className="stat-card-value" style={{ marginTop: 6 }}>{value}</div>
        </div>
        <div className="stat-card-icon" style={{ background: iconBg }}>
          <Icon size={20} color="#fff" />
        </div>
      </div>
      {sub && (
        <div className="stat-card-sub">
          {trend === 'up' && <ArrowUpRight size={13} className="stat-trend-up" />}
          {trend === 'down' && <ArrowDownRight size={13} className="stat-trend-down" />}
          {sub}
        </div>
      )}
    </div>
  );
}

const today = new Date().toISOString().slice(0, 10);
const arrivals = mockBookings.filter(b => b.checkIn === today && b.status === 'confirmed');
const departures = mockBookings.filter(b => b.checkOut === today && b.status === 'checked_in');
const pendingHK = mockHKTasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

export default function DashboardPage() {
  const s = mockDashboardStats;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Tổng quan hoạt động — {format(new Date(), 'dd/MM/yyyy')}</p>
        </div>
        <button className="btn btn-primary btn-sm">
          <CalendarCheck size={14} /> Night Audit
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid-4 mb-20">
        <StatCard label="Công suất phòng" value={`${s.occupancyRate}%`}
          sub={`${s.occupiedRooms}/${s.totalRooms} phòng`} icon={BedDouble}
          iconBg="linear-gradient(135deg,#3b82f6,#6366f1)" trend="up" />
        <StatCard label="Doanh thu hôm nay" value={`${fmt(s.todayRevenue)}đ`}
          sub="So với hôm qua +12%" icon={DollarSign}
          iconBg="linear-gradient(135deg,#10b981,#06b6d4)" trend="up" />
        <StatCard label="ADR" value={`${fmt(s.adr)}đ`}
          sub="Giá phòng bình quân" icon={TrendingUp}
          iconBg="linear-gradient(135deg,#8b5cf6,#ec4899)" />
        <StatCard label="Khách trong nhà" value={String(s.inHouseGuests)}
          sub={`${s.todayArrivals} đến · ${s.todayDepartures} đi hôm nay`} icon={Users}
          iconBg="linear-gradient(135deg,#f59e0b,#ef4444)" />
      </div>

      {/* Charts Row */}
      <div className="grid-2 mb-20">
        <div className="card">
          <div className="card-title">Công suất & Doanh thu (7 ngày)</div>
          <div className="card-subtitle">Xu hướng tuần hiện tại</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mockOccupancyTrend}>
              <defs>
                <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={.25}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="%" domain={[0,100]} />
              <Tooltip formatter={(v: number) => [`${v}%`, 'Công suất']} contentStyle={{ fontSize:12, borderRadius:8, border:'1px solid #e5e7eb' }} />
              <Area type="monotone" dataKey="occupancy" stroke="#3b82f6" strokeWidth={2.5} fill="url(#occ)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Nguồn đặt phòng</div>
          <div className="card-subtitle">Phân bổ theo kênh</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={mockBookingSources} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                dataKey="value" nameKey="name" paddingAngle={3}>
                {mockBookingSources.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v}%`, '']} contentStyle={{ fontSize:12, borderRadius:8 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue bar */}
      <div className="card mb-20">
        <div className="card-title">Doanh thu theo tháng</div>
        <div className="card-subtitle">Phòng vs Dịch vụ (5 tháng gần nhất)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={mockRevenueBreakdown} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false}
              tickFormatter={v => `${(v/1e6).toFixed(0)}M`} />
            <Tooltip formatter={(v:number) => [`${fmt(v)}đ`, '']} contentStyle={{ fontSize:12, borderRadius:8 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
            <Bar dataKey="room" name="Phòng" fill="#3b82f6" radius={[4,4,0,0]} />
            <Bar dataKey="service" name="Dịch vụ" fill="#10b981" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Operations panels */}
      <div className="grid-3">
        {/* Arrivals */}
        <div className="card">
          <div className="flex items-center justify-between mb-16">
            <div className="card-title" style={{ marginBottom:0 }}>
              <CheckCircle size={15} style={{ color:'var(--success)', verticalAlign:'middle', marginRight:6 }} />
              Đến hôm nay ({arrivals.length})
            </div>
            <span className="badge badge-green">{arrivals.length} khách</span>
          </div>
          {arrivals.length === 0 && <div className="text-sm text-muted" style={{ textAlign:'center', padding:'20px 0' }}>Không có khách đến</div>}
          {arrivals.map(b => (
            <div key={b.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border-light)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>{b.guestName}</div>
                <div style={{ fontSize:11.5, color:'var(--text-secondary)' }}>P.{b.roomNumber} · {b.roomTypeName}</div>
              </div>
              <button className="btn btn-primary btn-sm">Check-in</button>
            </div>
          ))}
        </div>

        {/* Departures */}
        <div className="card">
          <div className="flex items-center justify-between mb-16">
            <div className="card-title" style={{ marginBottom:0 }}>
              <LogOut size={15} style={{ color:'var(--accent)', verticalAlign:'middle', marginRight:6 }} />
              Đi hôm nay ({departures.length})
            </div>
            <span className="badge badge-blue">{departures.length} phòng</span>
          </div>
          {departures.length === 0 && <div className="text-sm text-muted" style={{ textAlign:'center', padding:'20px 0' }}>Không có khách đi</div>}
          {departures.map(b => (
            <div key={b.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border-light)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>{b.guestName}</div>
                <div style={{ fontSize:11.5, color:'var(--text-secondary)' }}>P.{b.roomNumber} · Check-out</div>
              </div>
              <button className="btn btn-secondary btn-sm">Folio</button>
            </div>
          ))}
        </div>

        {/* HK tasks */}
        <div className="card">
          <div className="flex items-center justify-between mb-16">
            <div className="card-title" style={{ marginBottom:0 }}>
              <Sparkles size={15} style={{ color:'var(--purple)', verticalAlign:'middle', marginRight:6 }} />
              HK chờ xử lý ({pendingHK.length})
            </div>
            <span className="badge badge-purple">{pendingHK.length} task</span>
          </div>
          {pendingHK.map(t => (
            <div key={t.id} style={{ padding:'9px 0', borderBottom:'1px solid var(--border-light)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>Phòng {t.roomNumber}</div>
                <div style={{ fontSize:11.5, color:'var(--text-secondary)' }}>
                  {t.assignedToName ?? 'Chưa giao'} · {t.taskType === 'checkout_clean' ? 'Dọn checkout' : 'Dọn hàng ngày'}
                </div>
              </div>
              <span className={`badge ${t.status === 'in_progress' ? 'badge-blue' : 'badge-yellow'}`}>
                {t.status === 'in_progress' ? 'Đang làm' : 'Chờ'}
              </span>
            </div>
          ))}
          {pendingHK.length === 0 && <div className="text-sm text-muted" style={{ textAlign:'center', padding:'20px 0' }}>Tất cả đã xong ✓</div>}
        </div>
      </div>

      {/* Alert row */}
      {s.unpaidFolios > 0 && (
        <div style={{ marginTop:20, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'var(--radius)', padding:'14px 18px', display:'flex', alignItems:'center', gap:10 }}>
          <AlertCircle size={18} color="#f59e0b" />
          <span style={{ fontSize:13.5, color:'#92400e', fontWeight:500 }}>
            Có <strong>{s.unpaidFolios}</strong> folio chưa thanh toán — Cần xử lý trước khi Night Audit
          </span>
          <button className="btn btn-sm" style={{ marginLeft:'auto', background:'#f59e0b', color:'#fff', border:'none' }}>Xem folio</button>
        </div>
      )}
    </div>
  );
}
