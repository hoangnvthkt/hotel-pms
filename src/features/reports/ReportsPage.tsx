import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { mockOccupancyTrend, mockRevenueBreakdown, mockBookingSources, mockDashboardStats } from '@/mock/reports';
import { fetchDashboardStats, queryKeys } from '@/lib/data';
import { Download, FileText } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

export default function ReportsPage() {
  const statsQuery = useQuery({ queryKey: queryKeys.dashboard, queryFn: fetchDashboardStats, refetchInterval: 30_000 });
  const s = statsQuery.data ?? mockDashboardStats;
  return (
    <div>
      <div className="page-header">
        <div><h1>Báo cáo</h1><p>Tổng hợp dữ liệu vận hành</p></div>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm"><Download size={14}/> Excel</button>
          <button className="btn btn-secondary btn-sm"><FileText size={14}/> PDF</button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid-4 mb-20">
        {[
          { label:'Doanh thu tháng', value:`${fmt(s.monthRevenue)}đ`, color:'var(--accent)' },
          { label:'Công suất tháng', value:`${s.occupancyRate}%`, color:'var(--success)' },
          { label:'ADR tháng', value:`${fmt(s.adr)}đ`, color:'var(--purple)' },
          { label:'RevPAR tháng', value:`${fmt(s.revpar)}đ`, color:'var(--warning)' },
        ].map(item=>(
          <div key={item.label} className="card" style={{ textAlign:'center' }}>
            <div className="kpi-label">{item.label}</div>
            <div className="kpi-number" style={{ color:item.color, marginTop:8 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-20">
        <div className="card">
          <div className="card-title">Doanh thu theo tháng</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={mockRevenueBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
              <XAxis dataKey="month" tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1e6).toFixed(0)}M`}/>
              <Tooltip formatter={(v:number)=>[`${fmt(v)}đ`,'']} contentStyle={{fontSize:12,borderRadius:8}}/>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12}}/>
              <Bar dataKey="room" name="Phòng" fill="#3b82f6" radius={[4,4,0,0]}/>
              <Bar dataKey="service" name="Dịch vụ" fill="#10b981" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="card-title">Xu hướng công suất</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={mockOccupancyTrend}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
              <XAxis dataKey="date" tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false} unit="%"/>
              <Tooltip contentStyle={{fontSize:12,borderRadius:8}}/>
              <Area type="monotone" dataKey="occupancy" name="Công suất" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#g1)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Nguồn đặt phòng</div>
          <div style={{display:'flex', alignItems:'center', gap:20}}>
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={mockBookingSources} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {mockBookingSources.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{flex:1}}>
              {mockBookingSources.map(s=>(
                <div key={s.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--border-light)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:10,height:10,borderRadius:2,background:s.color}}/>
                    <span style={{fontSize:13}}>{s.name}</span>
                  </div>
                  <strong>{s.value}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Báo cáo khai báo lưu trú (C65)</div>
          <div style={{fontSize:13.5, color:'var(--text-secondary)', marginBottom:16}}>
            Xuất danh sách khách lưu trú theo quy định TT 01/2024/TT-BCA để nộp cơ quan công an.
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{padding:'12px 14px', background:'var(--bg-hover)', borderRadius:'var(--radius-sm)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:13,fontWeight:500}}>C65 hôm nay</span>
              <button className="btn btn-primary btn-sm"><Download size={13}/> Xuất Excel</button>
            </div>
            <div style={{padding:'12px 14px', background:'var(--bg-hover)', borderRadius:'var(--radius-sm)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:13,fontWeight:500}}>C65 tháng này</span>
              <button className="btn btn-secondary btn-sm"><FileText size={13}/> Xuất PDF</button>
            </div>
          </div>
          <div style={{marginTop:16, padding:'12px', background:'var(--accent-light)', borderRadius:'var(--radius-sm)', fontSize:12.5, color:'var(--accent)'}}>
            ℹ Dữ liệu xuất theo trường bắt buộc: Họ tên, ngày sinh, giới tính, CCCD/Passport, quốc tịch, thời gian lưu trú.
          </div>
        </div>
      </div>
    </div>
  );
}
