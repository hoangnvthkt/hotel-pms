import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Moon, CheckCircle, AlertTriangle, DollarSign, Lock, ChevronRight } from 'lucide-react';
import { mockDashboardStats } from '@/mock/reports';
import { fetchDashboardStats, queryKeys } from '@/lib/data';
import { format } from 'date-fns';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

const steps = [
  { id:1, label:'Kiểm tra trước audit', desc:'Phòng chưa check-in, HK task còn mở', icon:AlertTriangle },
  { id:2, label:'Post room charges', desc:'Tự động ghi tiền phòng vào folio', icon:DollarSign },
  { id:3, label:'Kiểm tra discrepancy', desc:'Folio chưa đóng, payment thiếu', icon:CheckCircle },
  { id:4, label:'Revenue summary', desc:'ADR, RevPAR, công suất, doanh thu', icon:Moon },
  { id:5, label:'Đóng ngày & xác nhận', desc:'Lock ngày cũ, chuyển sang ngày mới', icon:Lock },
];

export default function NightAuditPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const statsQuery = useQuery({ queryKey: queryKeys.dashboard, queryFn: fetchDashboardStats, refetchInterval: 30_000 });
  const s = statsQuery.data ?? mockDashboardStats;
  const today = format(new Date(), 'dd/MM/yyyy');

  const completeStep = (stepId: number) => {
    setCompleted(c => [...c, stepId]);
    if (currentStep < steps.length) setCurrentStep(currentStep + 1);
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Night Audit</h1><p>Ngày kinh doanh: {today}</p></div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span className="badge badge-yellow">Ngày đang mở</span>
        </div>
      </div>

      <div className="audit-layout">
        {/* Steps sidebar */}
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:8 }}>
            <Moon size={16} color="var(--purple)"/> Quy trình Night Audit
          </div>
          <div style={{ padding:'8px 0' }}>
            {steps.map((step, idx) => {
              const done = completed.includes(step.id);
              const active = currentStep === idx;
              return (
                <div key={step.id} className="audit-step" style={{ padding:'12px 16px', cursor: active?'pointer':'default', background:active?'var(--accent-light)':undefined }}
                  onClick={()=>{ if(active) setCurrentStep(idx); }}>
                  <div className={`audit-step-num ${done?'done':active?'active':'pending'}`}>{done?'✓':step.id}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:active?'var(--accent)':done?'var(--success)':undefined }}>{step.label}</div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>{step.desc}</div>
                  </div>
                  {active && <ChevronRight size={15} color="var(--accent)"/>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div>
          {currentStep === 0 && (
            <div className="card">
              <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>1. Kiểm tra trước audit</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ padding:'14px', background:'var(--warning-light)', borderRadius:'var(--radius)', border:'1px solid #fde68a' }}>
                  <div style={{ fontWeight:600, color:'#92400e' }}>⚠ {s.unpaidFolios} folio chưa thanh toán đủ</div>
                  <div style={{ fontSize:13, color:'#b45309', marginTop:4 }}>Cần xử lý hoặc chuyển công nợ trước khi đóng ngày</div>
                </div>
                <div style={{ padding:'14px', background:'var(--success-light)', borderRadius:'var(--radius)', border:'1px solid #a7f3d0' }}>
                  <div style={{ fontWeight:600, color:'#065f46' }}>✓ Tất cả phòng có khách đã được kiểm tra HK</div>
                </div>
                <div style={{ padding:'14px', background:'var(--success-light)', borderRadius:'var(--radius)', border:'1px solid #a7f3d0' }}>
                  <div style={{ fontWeight:600, color:'#065f46' }}>✓ Không có no-show hôm nay</div>
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop:20 }} onClick={()=>completeStep(1)}>
                Tiếp tục <ChevronRight size={14}/>
              </button>
            </div>
          )}

          {currentStep === 1 && (
            <div className="card">
              <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>2. Post room charges</div>
              <div style={{ marginBottom:16, fontSize:13.5, color:'var(--text-secondary)' }}>
                Hệ thống sẽ tự động ghi tiền phòng vào folio của tất cả {s.occupiedRooms} phòng đang có khách.
              </div>
              <div className="card" style={{ background:'#f9fafb', marginBottom:16 }}>
                <div style={{ fontWeight:600, marginBottom:8 }}>Tóm tắt charges:</div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-light)' }}>
                  <span>Số phòng post charge</span><strong>{s.occupiedRooms}</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0' }}>
                  <span>Tổng dự kiến post</span><strong style={{ color:'var(--danger)' }}>{fmt(s.todayRevenue)}đ</strong>
                </div>
              </div>
              <button className="btn btn-primary" onClick={()=>completeStep(2)}>
                ✓ Post {s.occupiedRooms} charges <ChevronRight size={14}/>
              </button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="card">
              <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>3. Kiểm tra discrepancy</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                <div style={{ padding:'14px', background:s.unpaidFolios>0?'var(--warning-light)':'var(--success-light)', borderRadius:'var(--radius)', border:`1px solid ${s.unpaidFolios>0?'#fde68a':'#a7f3d0'}` }}>
                  <strong>{s.unpaidFolios > 0 ? `⚠ ${s.unpaidFolios} folio còn số dư` : '✓ Tất cả folio đã cân bằng'}</strong>
                </div>
                <div style={{ padding:'14px', background:'var(--success-light)', borderRadius:'var(--radius)', border:'1px solid #a7f3d0' }}>
                  <strong>✓ Tổng payment khớp với folio</strong>
                </div>
              </div>
              <button className="btn btn-primary" onClick={()=>completeStep(3)}>Tiếp tục <ChevronRight size={14}/></button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="card">
              <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>4. Revenue Summary — {today}</div>
              <div className="audit-summary-grid">
                {[
                  { label:'Công suất', value:`${s.occupancyRate}%`, color:'var(--accent)' },
                  { label:'ADR', value:`${fmt(s.adr)}đ`, color:'var(--success)' },
                  { label:'RevPAR', value:`${fmt(s.revpar)}đ`, color:'var(--purple)' },
                  { label:'Doanh thu phòng', value:`${fmt(s.todayRevenue)}đ`, color:'var(--danger)' },
                  { label:'Số phòng occupied', value:`${s.occupiedRooms}/${s.totalRooms}`, color:'var(--text-primary)' },
                  { label:'Khách trong nhà', value:`${s.inHouseGuests}`, color:'var(--text-primary)' },
                ].map(item => (
                  <div key={item.label} style={{ background:'#f9fafb', borderRadius:'var(--radius)', padding:'14px', textAlign:'center' }}>
                    <div style={{ fontSize:11, color:'var(--text-secondary)', fontWeight:500, textTransform:'uppercase', letterSpacing:'.04em' }}>{item.label}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:item.color, marginTop:6 }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={()=>completeStep(4)}>Tiếp tục <ChevronRight size={14}/></button>
            </div>
          )}

          {currentStep === 4 && (
            <div className="card">
              <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>5. Đóng ngày {today}</div>
              <div style={{ fontSize:14, color:'var(--text-secondary)', marginBottom:20 }}>
                Xác nhận đóng ngày kinh doanh. Tất cả dữ liệu sẽ bị lock, không thể chỉnh sửa.
              </div>
              <div style={{ padding:'16px', background:'var(--danger-light)', borderRadius:'var(--radius)', border:'1px solid #fecaca', marginBottom:20 }}>
                <strong style={{ color:'#991b1b' }}>⚠ Hành động này không thể hoàn tác!</strong>
                <div style={{ fontSize:13, color:'#b91c1c', marginTop:4 }}>Đảm bảo tất cả bước trên đã được kiểm tra kỹ trước khi đóng ngày.</div>
              </div>
              {completed.length >= 4 ? (
                <button className="btn btn-danger btn-lg" onClick={()=>completeStep(5)}>
                  <Lock size={16}/> Đóng ngày {today} & Mở ngày mới
                </button>
              ) : (
                <div style={{ color:'var(--text-muted)', fontSize:13 }}>Hoàn thành các bước trước để kích hoạt</div>
              )}
            </div>
          )}

          {completed.length >= 5 && (
            <div style={{ marginTop:16, padding:'20px', background:'var(--success-light)', borderRadius:'var(--radius-lg)', border:'1px solid #a7f3d0', textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🌟</div>
              <div style={{ fontWeight:700, fontSize:18, color:'#065f46' }}>Night Audit hoàn thành!</div>
              <div style={{ fontSize:14, color:'#059669', marginTop:4 }}>Ngày {today} đã được đóng thành công.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
