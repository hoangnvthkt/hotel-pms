import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mockLostFound } from '@/mock/housekeeping';
import { fetchHKTasks, queryKeys, updateHKTaskStatus } from '@/lib/data';
import type { HKTask, HKTaskStatus } from '@/types';
import { Sparkles, Package, CheckCircle, XCircle, Clock, Play } from 'lucide-react';

const statusCfg: Record<HKTaskStatus, { label: string; color: string; bg: string }> = {
  pending:   { label:'Chờ',       color:'#92400e', bg:'#fffbeb' },
  in_progress:{ label:'Đang làm', color:'#1e40af', bg:'#eff6ff' },
  done:      { label:'Hoàn thành',color:'#065f46', bg:'#ecfdf5' },
  inspected: { label:'Đã duyệt',  color:'#5b21b6', bg:'#f5f3ff' },
  rejected:  { label:'Từ chối',   color:'#991b1b', bg:'#fef2f2' },
};
const taskTypeLabel: Record<string, string> = {
  checkout_clean:'Dọn Checkout', daily_service:'Dọn hàng ngày',
  turndown:'Dọn tối', inspection:'Kiểm tra', deep_clean:'Dọn sâu',
};
const priorityStyle: Record<string, string> = {
  urgent:'priority-urgent', high:'priority-high', normal:'priority-normal', low:'priority-low',
};

type Column = { key: HKTaskStatus; label: string };
const columns: Column[] = [
  { key:'pending', label:'Chờ' },
  { key:'in_progress', label:'Đang làm' },
  { key:'done', label:'Xong — Chờ kiểm' },
  { key:'inspected', label:'Đã duyệt' },
];

export default function HousekeepingPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'board'|'lost'>('board');
  const [actionError, setActionError] = useState<string | null>(null);
  const tasksQuery = useQuery({ queryKey: queryKeys.hkTasks, queryFn: fetchHKTasks, refetchInterval: 30_000 });
  const tasks = tasksQuery.data ?? [];

  const rejected = tasks.filter(t => t.status === 'rejected');

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: HKTaskStatus }) => updateHKTaskStatus(id, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.hkTasks }),
        queryClient.invalidateQueries({ queryKey: queryKeys.rooms }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
      setActionError(null);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Không cập nhật được task housekeeping.'),
  });

  const moveTask = (id: string, newStatus: HKTaskStatus) => {
    statusMutation.mutate({ id, status: newStatus });
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Housekeeping</h1><p>{tasks.filter(t=>t.status==='pending').length} task chờ · {tasks.filter(t=>t.status==='done').length} cần kiểm tra</p></div>
        <div className="flex gap-8">
          {(['board','lost'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{ padding:'7px 16px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', background:tab===t?'var(--accent)':'var(--bg-card)', color:tab===t?'#fff':'var(--text-secondary)', cursor:'pointer', fontSize:13, fontWeight:500 }}>
              {t==='board'?'Kanban Board':'Lost & Found'}
            </button>
          ))}
        </div>
      </div>
      {actionError && <div className="form-error" style={{ marginBottom:12 }}>{actionError}</div>}

      {tab === 'board' ? (
        <>
          {/* Kanban board */}
          <div className="hk-board">
            {columns.map(col => {
              const colTasks = tasks.filter(t => t.status === col.key);
              return (
                <div key={col.key} style={{ background:'#f8f9fc', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
                  {/* Column header */}
                  <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:700, fontSize:13 }}>{col.label}</span>
                    <span style={{ background:'var(--border)', borderRadius:20, padding:'1px 8px', fontSize:12, fontWeight:700 }}>{colTasks.length}</span>
                  </div>
                  {/* Tasks */}
                  <div style={{ padding:8, display:'flex', flexDirection:'column', gap:8, minHeight:200 }}>
                    {colTasks.map(task => (
                      <div key={task.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'12px', boxShadow:'var(--shadow-sm)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                          <div style={{ fontWeight:700, fontSize:15 }}>P.{task.roomNumber}</div>
                          <span className={`badge ${priorityStyle[task.priority]}`} style={{ fontSize:10.5 }}>{task.priority}</span>
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:6 }}>{taskTypeLabel[task.taskType]}</div>
                        {task.assignedToName
                          ? <div style={{ fontSize:12, fontWeight:500 }}>👤 {task.assignedToName}</div>
                          : <div style={{ fontSize:12, color:'var(--danger)' }}>⚠ Chưa giao</div>
                        }
                        {task.inspectionNotes && <div style={{ fontSize:11.5, color:'var(--text-secondary)', marginTop:4, fontStyle:'italic' }}>"{task.inspectionNotes}"</div>}
                        {/* Action buttons */}
                        <div style={{ marginTop:10, display:'flex', gap:6 }}>
                          {task.status === 'pending' && (
                            <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={()=>moveTask(task.id,'in_progress')}>
                              <Play size={11}/> Bắt đầu
                            </button>
                          )}
                          {task.status === 'in_progress' && (
                            <button className="btn btn-success btn-sm" style={{ flex:1 }} onClick={()=>moveTask(task.id,'done')}>
                              <CheckCircle size={11}/> Xong
                            </button>
                          )}
                          {task.status === 'done' && (
                            <>
                              <button className="btn btn-success btn-sm" style={{ flex:1 }} onClick={()=>moveTask(task.id,'inspected')}>✓ Duyệt</button>
                              <button className="btn btn-danger btn-sm" onClick={()=>moveTask(task.id,'rejected')}><XCircle size={12}/></button>
                            </>
                          )}
                          {task.status === 'rejected' && (
                            <button className="btn btn-secondary btn-sm" style={{ flex:1 }} onClick={()=>moveTask(task.id,'pending')}>
                              <Clock size={11}/> Làm lại
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-muted)', fontSize:13 }}>Trống</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rejected */}
          {rejected.length > 0 && (
            <div className="card" style={{ borderLeft:'3px solid var(--danger)' }}>
              <div className="card-title" style={{ color:'var(--danger)', marginBottom:10 }}>⚠ Bị từ chối ({rejected.length})</div>
              {rejected.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid var(--border-light)' }}>
                  <strong>P.{t.roomNumber}</strong>
                  <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{t.inspectorName}: "{t.inspectionNotes}"</span>
                  <button className="btn btn-secondary btn-sm" style={{ marginLeft:'auto' }} onClick={()=>moveTask(t.id,'pending')}>Làm lại</button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        // Lost & Found
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:600 }}>Lost & Found ({mockLostFound.length})</span>
            <button className="btn btn-primary btn-sm"><Package size={14}/> Ghi nhận vật</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Vật phẩm</th><th>Tìm thấy tại</th><th>Người tìm</th><th>Thời gian</th><th>Trạng thái</th><th>Lưu trữ</th></tr></thead>
              <tbody>
                {mockLostFound.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight:600 }}>{item.description}</td>
                    <td>P.{item.roomNumber} (T{item.floor})</td>
                    <td>{item.foundBy}</td>
                    <td style={{ fontSize:12 }}>{new Date(item.foundAt).toLocaleString('vi-VN')}</td>
                    <td><span className={`badge ${item.status==='claimed'?'badge-green':'badge-yellow'}`}>{item.status==='claimed'?'Đã trả':'Đang lưu'}</span></td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{item.storageLocation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
