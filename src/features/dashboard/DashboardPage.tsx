import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import {
  BedDouble, Users, TrendingUp, DollarSign,
  ArrowUpRight, ArrowDownRight, CheckCircle, AlertCircle,
  Clock, Sparkles, CalendarCheck, LogOut
} from 'lucide-react';
import { mockDashboardStats, mockOccupancyTrend, mockRevenueBreakdown, mockBookingSources } from '@/mock/reports';
import { fetchBookings, fetchDashboardStats, fetchHKTasks, queryKeys } from '@/lib/data';
import { format } from 'date-fns';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

function StatCard({ label, value, trendValue, icon: Icon, color, trend }: {
  label: string; value: string; trendValue?: string;
  icon: React.ElementType; color: string; trend?: 'up'|'down';
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-accent" style={{ background: color }}></div>
      <div className="stat-card-content">
        <div className="stat-card-top">
           <div className="stat-card-icon-wrap" style={{ color: color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
             <Icon size={18} />
           </div>
           {trendValue && (
             <div className={`stat-card-trend ${trend}`}>
               {trend === 'up' && '+'}{trendValue}
             </div>
           )}
        </div>
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">{value}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const statsQuery = useQuery({ queryKey: queryKeys.dashboard, queryFn: fetchDashboardStats, refetchInterval: 30_000 });
  const bookingsQuery = useQuery({ queryKey: queryKeys.bookings, queryFn: fetchBookings, refetchInterval: 30_000 });
  const hkQuery = useQuery({ queryKey: queryKeys.hkTasks, queryFn: fetchHKTasks, refetchInterval: 30_000 });

  const s = statsQuery.data ?? mockDashboardStats;
  const bookings = bookingsQuery.data ?? [];
  const hkTasks = hkQuery.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const arrivals = bookings.filter(b => b.checkIn === today && b.status === 'confirmed');
  const departures = bookings.filter(b => b.checkOut === today && b.status === 'checked_in');
  const pendingHK = hkTasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

  return (
    <div className="dashboard-layout">
      <div className="dashboard-main">
        <div className="page-header" style={{ marginBottom: 24, padding: '10px 0' }}>
          <div>
            <div className="stat-card-label" style={{ color: 'var(--coral)', marginBottom: 6 }}>PERFORMANCE OVERVIEW</div>
            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.5px' }}>Analytics Dashboard</h1>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 20 }}>
              <Clock size={14} /> Hôm nay
            </button>
            <button className="btn btn-primary btn-sm" style={{ borderRadius: 20, padding: '8px 24px' }}>
              Night Audit
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid-4 mb-20">
          <StatCard label="Công suất phòng" value={`${s.occupancyRate}%`}
            trendValue="12.5%" icon={BedDouble}
            color="var(--accent)" trend="up" />
          <StatCard label="Doanh thu hôm nay" value={`${fmt(s.todayRevenue)}đ`}
            trendValue="8.2%" icon={DollarSign}
            color="var(--primary)" trend="up" />
          <StatCard label="ADR" value={`${fmt(s.adr)}đ`}
            trendValue="2.1%" icon={TrendingUp}
            color="var(--coral)" trend="down" />
          <StatCard label="Khách trong nhà" value={String(s.inHouseGuests)}
            trendValue="Tốt" icon={Users}
            color="var(--primary-light)" trend="up" />
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
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={.25}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="%" domain={[0,100]} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Công suất']} contentStyle={{ fontSize:12, borderRadius:12, border:'none', boxShadow:'0 8px 30px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="occupancy" stroke="var(--primary)" strokeWidth={3} fill="url(#occ)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-title">Nguồn đặt phòng</div>
            <div className="card-subtitle">Phân bổ theo kênh</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={mockBookingSources} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  dataKey="value" nameKey="name" paddingAngle={4} cornerRadius={4}>
                  {mockBookingSources.map((entry, i) => {
                    const colors = ['var(--primary)', 'var(--accent)', 'var(--coral)', 'var(--primary-light)', 'var(--text-muted)'];
                    return <Cell key={i} fill={colors[i % colors.length]} stroke="transparent" />;
                  })}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v}%`, '']} contentStyle={{ fontSize:12, borderRadius:12, border:'none', boxShadow:'0 8px 30px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12, fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue bar */}
        <div className="card mb-20">
          <div className="card-title">Doanh thu theo tháng</div>
          <div className="card-subtitle">Phòng vs Dịch vụ (5 tháng gần nhất)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockRevenueBreakdown} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v/1e6).toFixed(0)}M`} />
              <Tooltip formatter={(v:number) => [`${fmt(v)}đ`, '']} contentStyle={{ fontSize:12, borderRadius:12, border:'none', boxShadow:'0 8px 30px rgba(0,0,0,0.1)' }} cursor={{fill: 'var(--primary-bg)'}} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12, fontWeight: 600 }} />
              <Bar dataKey="room" name="Phòng" fill="var(--primary)" radius={[4,4,0,0]} />
              <Bar dataKey="service" name="Dịch vụ" fill="var(--accent)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Side Panel (Insights) */}
      <div className="dashboard-side">
        <div className="side-header">
           <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <Users size={18} color="var(--primary)" />
           </div>
           Insights
        </div>
        
        <div className="section-gap" style={{ marginTop: 16 }}>
          {/* Arrivals */}
          <div className="card card-sm">
            <div className="flex items-center justify-between mb-16">
              <div className="card-title" style={{ marginBottom:0, fontSize: 14 }}>
                <CheckCircle size={15} style={{ color:'var(--success)', verticalAlign:'middle', marginRight:6 }} />
                Đến hôm nay
              </div>
              <span className="badge badge-green">{arrivals.length} khách</span>
            </div>
            {arrivals.length === 0 && <div className="text-sm text-muted" style={{ textAlign:'center', padding:'10px 0' }}>Không có khách đến</div>}
            {arrivals.map(b => (
              <div key={b.id} style={{ padding:'10px 0', borderBottom:'1px dashed var(--border-light)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{b.guestName}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-secondary)' }}>P.{b.roomNumber} · {b.roomTypeName}</div>
                </div>
                <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px', fontSize: 12 }}>Check-in</button>
              </div>
            ))}
          </div>

          {/* Departures */}
          <div className="card card-sm">
            <div className="flex items-center justify-between mb-16">
              <div className="card-title" style={{ marginBottom:0, fontSize: 14 }}>
                <LogOut size={15} style={{ color:'var(--accent-dark)', verticalAlign:'middle', marginRight:6 }} />
                Đi hôm nay
              </div>
              <span className="badge badge-yellow">{departures.length} phòng</span>
            </div>
            {departures.length === 0 && <div className="text-sm text-muted" style={{ textAlign:'center', padding:'10px 0' }}>Không có khách đi</div>}
            {departures.map(b => (
              <div key={b.id} style={{ padding:'10px 0', borderBottom:'1px dashed var(--border-light)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{b.guestName}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-secondary)' }}>P.{b.roomNumber}</div>
                </div>
                <button className="btn btn-secondary btn-sm" style={{ padding: '4px 12px', fontSize: 12 }}>Folio</button>
              </div>
            ))}
          </div>

          {/* HK tasks */}
          <div className="card card-sm">
            <div className="flex items-center justify-between mb-16">
              <div className="card-title" style={{ marginBottom:0, fontSize: 14 }}>
                <Sparkles size={15} style={{ color:'var(--coral)', verticalAlign:'middle', marginRight:6 }} />
                HK chờ xử lý
              </div>
              <span className="badge badge-red">{pendingHK.length} task</span>
            </div>
            {pendingHK.map(t => (
              <div key={t.id} style={{ padding:'9px 0', borderBottom:'1px dashed var(--border-light)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>Phòng {t.roomNumber}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-secondary)' }}>
                    {t.assignedToName ?? 'Chưa giao'} · {t.taskType === 'checkout_clean' ? 'Dọn CO' : 'Dọn ngày'}
                  </div>
                </div>
                <span className={`status-dot ${t.status === 'in_progress' ? 'dot-blue' : 'dot-yellow'}`}></span>
              </div>
            ))}
            {pendingHK.length === 0 && <div className="text-sm text-muted" style={{ textAlign:'center', padding:'10px 0' }}>Tất cả đã xong ✓</div>}
          </div>

          {/* Alert row */}
          {s.unpaidFolios > 0 && (
            <div style={{ background:'var(--coral-light)', border:'none', borderRadius:'var(--radius-lg)', padding:'14px', display:'flex', alignItems:'flex-start', gap:10, color: 'var(--coral-dark)' }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize:13, fontWeight:800, marginBottom: 4 }}>
                  {s.unpaidFolios} Folio chưa thanh toán
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Cần xử lý trước khi Audit.</div>
                <button className="btn btn-sm" style={{ background:'var(--coral)', color:'#fff', border:'none', borderRadius: 20 }}>Xem folio</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

