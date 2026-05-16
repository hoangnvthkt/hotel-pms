import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  assignHKTask,
  createHKTask,
  createLostFound,
  fetchHKStaff,
  fetchHKTasks,
  fetchLostFound,
  fetchRooms,
  queryKeys,
  updateHKTaskStatus,
  updateLostFoundStatus,
  type HKTaskMutationInput,
} from '@/lib/data';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/features/auth/AuthContext';
import { hasPermission } from '@/features/auth/rbac';
import type { HKTask, HKTaskStatus, LostFoundItem } from '@/types';
import { CheckCircle, Clock, Package, Play, Plus, Search, Sparkles, UserPlus, XCircle } from 'lucide-react';

const taskTypeLabel: Record<HKTask['taskType'], string> = {
  checkout_clean: 'Dọn checkout',
  daily_service: 'Dọn hằng ngày',
  turndown: 'Dọn tối',
  inspection: 'Kiểm tra',
  deep_clean: 'Dọn sâu',
};

const lostFoundStatusLabel: Record<LostFoundItem['status'], string> = {
  stored: 'Đang lưu',
  claimed: 'Đã trả',
  disposed: 'Đã xử lý',
};

const priorityStyle: Record<HKTask['priority'], string> = {
  urgent: 'priority-urgent',
  high: 'priority-high',
  normal: 'priority-normal',
  low: 'priority-low',
};

type Column = { key: HKTaskStatus; label: string };
const columns: Column[] = [
  { key: 'pending', label: 'Chờ' },
  { key: 'in_progress', label: 'Đang làm' },
  { key: 'done', label: 'Xong - chờ kiểm' },
  { key: 'inspected', label: 'Đã duyệt' },
];

const blankTaskForm: Omit<HKTaskMutationInput, 'propertyId'> = {
  roomId: '',
  taskType: 'daily_service',
  priority: 'normal',
  notes: '',
  assignedTo: '',
};

export default function HousekeepingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const routeStatusFilter = searchParams.get('status') === 'open' ? 'open' : 'all';
  const [tab, setTab] = useState<'board' | 'lost'>('board');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open'>(routeStatusFilter);
  const [floorFilter, setFloorFilter] = useState<'all' | string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'unassigned' | string>('all');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskForm, setTaskForm] = useState(blankTaskForm);
  const [lostForm, setLostForm] = useState({ description: '', roomId: '', storageLocation: '', notes: '' });
  const [actionError, setActionError] = useState<string | null>(null);

  const roles = user?.roles ?? (user?.role ? [user.role] : []);
  const canAssign = hasPermission(roles, 'housekeeping:assign');
  const isHKStaffOnly = roles.includes('hk_staff') && !canAssign;

  const tasksQuery = useQuery({ queryKey: queryKeys.hkTasks, queryFn: fetchHKTasks, refetchInterval: 30_000 });
  const roomsQuery = useQuery({ queryKey: queryKeys.rooms, queryFn: fetchRooms });
  const staffQuery = useQuery({ queryKey: [...queryKeys.staff, 'hk'], queryFn: fetchHKStaff });
  const lostFoundQuery = useQuery({ queryKey: queryKeys.lostFound, queryFn: fetchLostFound });

  const rooms = roomsQuery.data ?? [];
  const hkStaff = staffQuery.data ?? [];
  const rawTasks = tasksQuery.data ?? [];
  const lostFound = lostFoundQuery.data ?? [];
  const floors = useMemo(() => [...new Set(rawTasks.map(task => task.floor))].sort((a, b) => a - b), [rawTasks]);

  useEffect(() => {
    setStatusFilter(routeStatusFilter);
    if (routeStatusFilter === 'open') setTab('board');
  }, [routeStatusFilter]);

  const tasks = rawTasks.filter(task => {
    if (isHKStaffOnly && task.assignedTo !== user?.id) return false;
    if (statusFilter === 'open' && !['pending', 'in_progress', 'done', 'rejected'].includes(task.status)) return false;
    if (floorFilter !== 'all' && String(task.floor) !== floorFilter) return false;
    if (assigneeFilter === 'unassigned' && task.assignedTo) return false;
    if (!['all', 'unassigned'].includes(assigneeFilter) && task.assignedTo !== assigneeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return task.roomNumber.toLowerCase().includes(q)
        || taskTypeLabel[task.taskType].toLowerCase().includes(q)
        || task.assignedToName?.toLowerCase().includes(q)
        || task.notes?.toLowerCase().includes(q);
    }
    return true;
  });
  const rejected = tasks.filter(task => task.status === 'rejected');
  const openCount = rawTasks.filter(task => ['pending', 'in_progress', 'done', 'rejected'].includes(task.status)).length;

  const invalidateHK = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.hkTasks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationCount }),
    ]);
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: HKTaskStatus; notes?: string }) => updateHKTaskStatus(id, status, notes),
    onSuccess: async () => {
      await invalidateHK();
      setActionError(null);
    },
    onError: err => setActionError(errorMessage(err, 'Không cập nhật được task housekeeping.')),
  });

  const assignMutation = useMutation({
    mutationFn: ({ taskId, staffId }: { taskId: string; staffId: string }) => assignHKTask(taskId, staffId),
    onSuccess: async () => {
      await invalidateHK();
      setActionError(null);
    },
    onError: err => setActionError(errorMessage(err, 'Không giao được task housekeeping.')),
  });

  const createTaskMutation = useMutation({
    mutationFn: () => {
      if (!user?.propertyId) throw new Error('Không xác định được khách sạn.');
      if (!taskForm.roomId) throw new Error('Cần chọn phòng.');
      return createHKTask({
        propertyId: user.propertyId,
        roomId: taskForm.roomId,
        taskType: taskForm.taskType,
        priority: taskForm.priority,
        notes: taskForm.notes,
        assignedTo: taskForm.assignedTo || undefined,
      });
    },
    onSuccess: async () => {
      await invalidateHK();
      setTaskForm(blankTaskForm);
      setShowCreateTask(false);
      setActionError(null);
    },
    onError: err => setActionError(errorMessage(err, 'Không tạo được task housekeeping.')),
  });

  const createLostFoundMutation = useMutation({
    mutationFn: () => {
      if (!lostForm.description.trim()) throw new Error('Cần nhập mô tả vật thất lạc.');
      return createLostFound({
        description: lostForm.description,
        roomId: lostForm.roomId || undefined,
        storageLocation: lostForm.storageLocation,
        notes: lostForm.notes,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.lostFound });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      setLostForm({ description: '', roomId: '', storageLocation: '', notes: '' });
      setActionError(null);
    },
    onError: err => setActionError(errorMessage(err, 'Không ghi nhận được vật thất lạc.')),
  });

  const updateLostStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LostFoundItem['status'] }) => updateLostFoundStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.lostFound });
      setActionError(null);
    },
    onError: err => setActionError(errorMessage(err, 'Không cập nhật được Lost & Found.')),
  });

  const moveTask = (id: string, newStatus: HKTaskStatus) => {
    let notes: string | undefined;
    if (newStatus === 'rejected') {
      notes = window.prompt('Lý do từ chối task này?') ?? undefined;
      if (!notes?.trim()) return;
    }
    statusMutation.mutate({ id, status: newStatus, notes });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Housekeeping</h1>
          <p>{openCount} task mở · {rawTasks.filter(t => t.status === 'done').length} cần kiểm tra</p>
        </div>
        <div className="flex gap-8">
          {(['board', 'lost'] as const).map(item => (
            <button key={item} onClick={() => setTab(item)}
              style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: tab === item ? 'var(--accent)' : 'var(--bg-card)', color: tab === item ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              {item === 'board' ? 'Kanban Board' : 'Lost & Found'}
            </button>
          ))}
          {tab === 'board' && canAssign && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateTask(true)}><Plus size={14} /> Tạo task</button>
          )}
        </div>
      </div>
      {actionError && <div className="form-error" style={{ marginBottom: 12 }}>{actionError}</div>}

      {tab === 'board' ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 220px 130px', gap: 10 }}>
              <div className="search-box">
                <Search size={15} color="var(--text-muted)" />
                <input placeholder="Tìm phòng, nhân viên, loại task..." value={search} onChange={event => setSearch(event.target.value)} />
              </div>
              <select className="form-input form-select" value={floorFilter} onChange={event => setFloorFilter(event.target.value)}>
                <option value="all">Tất cả tầng</option>
                {floors.map(floor => <option key={floor} value={String(floor)}>Tầng {floor}</option>)}
              </select>
              <select className="form-input form-select" value={assigneeFilter} onChange={event => setAssigneeFilter(event.target.value)}>
                <option value="all">Tất cả nhân viên</option>
                <option value="unassigned">Chưa giao</option>
                {hkStaff.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
              </select>
              <button className={`btn btn-sm ${statusFilter === 'open' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(statusFilter === 'open' ? 'all' : 'open')}>
                Task mở
              </button>
            </div>
          </div>

          <div className="hk-board">
            {columns.map(col => {
              const colTasks = tasks.filter(task => task.status === col.key);
              return (
                <div key={col.key} style={{ background: '#f8f9fc', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{col.label}</span>
                    <span style={{ background: 'var(--border)', borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>{colTasks.length}</span>
                  </div>
                  <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 220 }}>
                    {colTasks.map(task => (
                      <div key={task.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ fontWeight: 800, fontSize: 15 }}>P.{task.roomNumber}</div>
                          <span className={`badge ${priorityStyle[task.priority]}`} style={{ fontSize: 10.5 }}>{task.priority}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{taskTypeLabel[task.taskType]}</div>
                        {task.assignedToName
                          ? <div style={{ fontSize: 12, fontWeight: 600 }}>Phụ trách: {task.assignedToName}</div>
                          : <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 700 }}>Chưa giao</div>
                        }
                        {task.notes && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>{task.notes}</div>}
                        {task.inspectionNotes && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4, fontStyle: 'italic' }}>"{task.inspectionNotes}"</div>}

                        {canAssign && (
                          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                            <select className="form-input form-select" value={task.assignedTo ?? ''} onChange={event => event.target.value && assignMutation.mutate({ taskId: task.id, staffId: event.target.value })}>
                              <option value="">Giao nhân viên</option>
                              {hkStaff.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
                            </select>
                            <button className="btn btn-secondary btn-icon" title="Giao task"><UserPlus size={14} /></button>
                          </div>
                        )}

                        <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                          {task.status === 'pending' && (
                            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => moveTask(task.id, 'in_progress')}>
                              <Play size={11} /> Bắt đầu
                            </button>
                          )}
                          {task.status === 'in_progress' && (
                            <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => moveTask(task.id, 'done')}>
                              <CheckCircle size={11} /> Xong
                            </button>
                          )}
                          {task.status === 'done' && canAssign && (
                            <>
                              <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => moveTask(task.id, 'inspected')}>Duyệt</button>
                              <button className="btn btn-danger btn-sm" onClick={() => moveTask(task.id, 'rejected')}><XCircle size={12} /></button>
                            </>
                          )}
                          {task.status === 'rejected' && (
                            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => moveTask(task.id, 'pending')}>
                              <Clock size={11} /> Làm lại
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Trống</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {rejected.length > 0 && (
            <div className="card" style={{ borderLeft: '3px solid var(--danger)' }}>
              <div className="card-title" style={{ color: 'var(--danger)', marginBottom: 10 }}>Bị từ chối ({rejected.length})</div>
              {rejected.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <strong>P.{task.roomNumber}</strong>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{task.inspectorName}: "{task.inspectionNotes}"</span>
                  <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => moveTask(task.id, 'pending')}>Làm lại</button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1.3fr 160px 1fr auto', gap: 10, alignItems: 'end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Mô tả vật thất lạc</label>
              <input className="form-input" value={lostForm.description} onChange={event => setLostForm(form => ({ ...form, description: event.target.value }))} placeholder="Ví, sạc điện thoại, hộ chiếu..." />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Phòng</label>
              <select className="form-input form-select" value={lostForm.roomId} onChange={event => setLostForm(form => ({ ...form, roomId: event.target.value }))}>
                <option value="">Không rõ</option>
                {rooms.map(room => <option key={room.id} value={room.id}>P.{room.number}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Vị trí lưu trữ</label>
              <input className="form-input" value={lostForm.storageLocation} onChange={event => setLostForm(form => ({ ...form, storageLocation: event.target.value }))} placeholder="Tủ Lost & Found..." />
            </div>
            <button className="btn btn-primary" disabled={createLostFoundMutation.isPending} onClick={() => createLostFoundMutation.mutate()}>
              <Package size={14} /> Ghi nhận
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Vật phẩm</th><th>Tìm thấy tại</th><th>Người tìm</th><th>Thời gian</th><th>Trạng thái</th><th>Lưu trữ</th><th></th></tr></thead>
              <tbody>
                {lostFound.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 700 }}>{item.description}</td>
                    <td>{item.roomNumber ? `P.${item.roomNumber}${item.floor ? ` (T${item.floor})` : ''}` : 'Không rõ'}</td>
                    <td>{item.foundBy ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{new Date(item.foundAt).toLocaleString('vi-VN')}</td>
                    <td><span className={`badge ${item.status === 'claimed' ? 'badge-green' : item.status === 'disposed' ? 'badge-gray' : 'badge-yellow'}`}>{lostFoundStatusLabel[item.status]}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.storageLocation ?? '—'}</td>
                    <td>
                      <select className="form-input form-select" value={item.status} onChange={event => updateLostStatusMutation.mutate({ id: item.id, status: event.target.value as LostFoundItem['status'] })}>
                        <option value="stored">Đang lưu</option>
                        <option value="claimed">Đã trả</option>
                        <option value="disposed">Đã xử lý</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateTask && (
        <div className="modal-overlay" onClick={() => setShowCreateTask(false)}>
          <form className="modal" style={{ maxWidth: 560 }} onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); createTaskMutation.mutate(); }}>
            <div className="modal-header">
              <span className="modal-title">Tạo task Housekeeping</span>
              <button type="button" className="modal-close" onClick={() => setShowCreateTask(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Phòng</label>
                  <select className="form-input form-select" value={taskForm.roomId} onChange={event => setTaskForm(form => ({ ...form, roomId: event.target.value }))}>
                    <option value="">Chọn phòng</option>
                    {rooms.map(room => <option key={room.id} value={room.id}>P.{room.number} · tầng {room.floor}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Loại task</label>
                  <select className="form-input form-select" value={taskForm.taskType} onChange={event => setTaskForm(form => ({ ...form, taskType: event.target.value as HKTask['taskType'] }))}>
                    {Object.entries(taskTypeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ưu tiên</label>
                  <select className="form-input form-select" value={taskForm.priority} onChange={event => setTaskForm(form => ({ ...form, priority: event.target.value as HKTask['priority'] }))}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Giao cho</label>
                  <select className="form-input form-select" value={taskForm.assignedTo} onChange={event => setTaskForm(form => ({ ...form, assignedTo: event.target.value }))}>
                    <option value="">Chưa giao</option>
                    {hkStaff.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Ghi chú</label>
                  <textarea className="form-input" rows={3} value={taskForm.notes} onChange={event => setTaskForm(form => ({ ...form, notes: event.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateTask(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={createTaskMutation.isPending}><Sparkles size={14} /> Tạo task</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
