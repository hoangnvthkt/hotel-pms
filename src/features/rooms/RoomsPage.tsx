import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRoomTypes, fetchRooms, queryKeys } from '@/lib/data';
import type { Room, RoomStatus } from '@/types';
import { Search, Filter, Grid3X3, List, BedDouble, Wrench } from 'lucide-react';

const statusConfig: Record<RoomStatus, { label: string; cls: string; dot: string }> = {
  vacant_clean:   { label: 'Sạch — Sẵn sàng', cls: 'vacant-clean',  dot: 'dot-green' },
  occupied:       { label: 'Đang có khách',    cls: 'occupied',      dot: 'dot-blue'  },
  vacant_dirty:   { label: 'Trống — Bẩn',      cls: 'vacant-dirty',  dot: 'dot-yellow'},
  inspected:      { label: 'Đã kiểm tra',       cls: 'inspected',     dot: 'dot-purple'},
  out_of_order:   { label: 'Bảo trì / OOO',    cls: 'out-of-order',  dot: 'dot-red'   },
  blocked:        { label: 'Đã block',          cls: 'blocked',       dot: 'dot-gray'  },
  occupied_dirty: { label: 'Có khách — Cần dọn', cls:'occupied-dirty', dot:'dot-yellow'},
  occupied_clean: { label: 'Có khách — Sạch',  cls: 'occupied-clean', dot:'dot-blue'  },
};

const statusCounts = (rooms: Room[]) => ({
  vacant_clean:   rooms.filter(r=>r.status==='vacant_clean').length,
  occupied:       rooms.filter(r=>r.status==='occupied').length,
  vacant_dirty:   rooms.filter(r=>r.status==='vacant_dirty').length,
  inspected:      rooms.filter(r=>r.status==='inspected').length,
  out_of_order:   rooms.filter(r=>r.status==='out_of_order').length,
  occupied_dirty: rooms.filter(r=>r.status==='occupied_dirty').length,
});

export default function RoomsPage() {
  const [view, setView] = useState<'grid'|'list'>('grid');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<RoomStatus|'all'>('all');
  const [filterFloor, setFilterFloor] = useState<number|'all'>('all');
  const [filterType, setFilterType] = useState('all');
  const [selectedRoom, setSelectedRoom] = useState<Room|null>(null);
  const roomsQuery = useQuery({ queryKey: queryKeys.rooms, queryFn: fetchRooms, refetchInterval: 30_000 });
  const roomTypesQuery = useQuery({ queryKey: queryKeys.roomTypes, queryFn: fetchRoomTypes });

  const floors = [1,2,3,4,5];
  const rooms = roomsQuery.data ?? [];
  const roomTypes = roomTypesQuery.data ?? [];
  const counts = statusCounts(rooms);

  const filtered = rooms.filter(r => {
    if (filterFloor !== 'all' && r.floor !== filterFloor) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterType !== 'all' && r.roomTypeId !== filterType) return false;
    if (search && !r.number.includes(search) && !(r.currentGuestName?.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div><h1>Quản lý phòng</h1><p>{rooms.length || 50} phòng · 5 tầng · {roomTypes.length || 5} loại phòng</p></div>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm"><Filter size={14}/> Lọc</button>
          <button className="btn btn-primary btn-sm"><BedDouble size={14}/> Thêm phòng</button>
        </div>
      </div>

      {/* Status summary */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {(Object.entries(counts) as [RoomStatus, number][]).map(([status, count]) => (
          <button key={status}
            onClick={() => setFilterStatus(s => s === status ? 'all' : status)}
            style={{
              display:'flex', alignItems:'center', gap:7, padding:'7px 14px',
              background: filterStatus === status ? 'var(--accent)' : 'var(--bg-card)',
              border: filterStatus === status ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:12.5, fontWeight:500,
              color: filterStatus === status ? '#fff' : 'var(--text-secondary)', transition:'all .15s',
            }}>
            <span className={`status-dot ${statusConfig[status].dot}`} />
            {statusConfig[status].label} <strong>{count}</strong>
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
        <div className="search-box" style={{ flex:1, minWidth:200 }}>
          <Search size={15} color="var(--text-muted)" />
          <input placeholder="Tìm phòng hoặc khách..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        {/* Floor tabs */}
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={()=>setFilterFloor('all')}
            style={{ padding:'6px 14px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', background: filterFloor==='all'?'var(--accent)':'var(--bg-card)', color: filterFloor==='all'?'#fff':'var(--text-secondary)', cursor:'pointer', fontSize:13, fontWeight:500 }}>Tất cả</button>
          {floors.map(f=>(
            <button key={f} onClick={()=>setFilterFloor(f===filterFloor?'all':f)}
              style={{ padding:'6px 12px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', background: filterFloor===f?'var(--accent)':'var(--bg-card)', color: filterFloor===f?'#fff':'var(--text-secondary)', cursor:'pointer', fontSize:13, fontWeight:500 }}>
              T{f}
            </button>
          ))}
        </div>
        {/* View toggle */}
        <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
          <button onClick={()=>setView('grid')} style={{ padding:'6px 10px', background:view==='grid'?'var(--accent)':'var(--bg-card)', color:view==='grid'?'#fff':'var(--text-secondary)', border:'none', cursor:'pointer' }}><Grid3X3 size={15}/></button>
          <button onClick={()=>setView('list')} style={{ padding:'6px 10px', background:view==='list'?'var(--accent)':'var(--bg-card)', color:view==='list'?'#fff':'var(--text-secondary)', border:'none', cursor:'pointer' }}><List size={15}/></button>
        </div>
      </div>

      {view === 'grid' ? (
        // Grid view — grouped by floor
        <div className="section-gap">
          {floors.filter(f => filterFloor === 'all' || filterFloor === f).map(floor => {
            const floorRooms = filtered.filter(r => r.floor === floor);
            if (floorRooms.length === 0) return null;
            return (
              <div key={floor}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ background:'var(--bg-hover)', padding:'2px 10px', borderRadius:20 }}>Tầng {floor}</span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{floorRooms.length} phòng</span>
                </div>
                <div className="room-grid">
                  {floorRooms.map(room => (
                    <div key={room.id} className={`room-card ${statusConfig[room.status].cls}`}
                      onClick={() => setSelectedRoom(room)}>
                      <div className="room-number">{room.number}</div>
                      <div className="room-type-label">{room.roomTypeName.replace('Phòng ','')}</div>
                      {room.currentGuestName && <div className="room-guest">{room.currentGuestName}</div>}
                      {room.checkOutDate && (
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
                          CO: {room.checkOutDate}
                        </div>
                      )}
                      <div className={`room-status-label`} style={{
                        color: statusConfig[room.status].cls === 'vacant-clean' ? '#065f46'
                          : statusConfig[room.status].cls === 'occupied' ? '#1e40af'
                          : statusConfig[room.status].cls === 'vacant-dirty' ? '#92400e'
                          : statusConfig[room.status].cls === 'inspected' ? '#5b21b6'
                          : '#991b1b'
                      }}>
                        {room.status === 'out_of_order' ? '⚠ OOO' : statusConfig[room.status].label.split(' — ')[0].split(' — ')[0]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="empty-state">
              <BedDouble size={40} className="empty-state-icon" />
              <h3>Không tìm thấy phòng nào</h3>
              <p>Thử thay đổi bộ lọc</p>
            </div>
          )}
        </div>
      ) : (
        // List view
        <div className="card" style={{ padding:0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Phòng</th><th>Loại</th><th>Tầng</th><th>Trạng thái</th>
                  <th>Khách hiện tại</th><th>Checkout</th><th>Ghi chú</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(room => (
                  <tr key={room.id} style={{ cursor:'pointer' }} onClick={()=>setSelectedRoom(room)}>
                    <td><strong style={{ fontSize:15 }}>{room.number}</strong></td>
                    <td style={{ fontSize:12.5, color:'var(--text-secondary)' }}>{room.roomTypeName}</td>
                    <td>T{room.floor}</td>
                    <td>
                      <span className="flex items-center gap-8">
                        <span className={`status-dot ${statusConfig[room.status].dot}`}/>
                        <span style={{ fontSize:12.5 }}>{statusConfig[room.status].label}</span>
                      </span>
                    </td>
                    <td>{room.currentGuestName ?? <span className="text-muted">—</span>}</td>
                    <td>{room.checkOutDate ?? <span className="text-muted">—</span>}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{room.notes ?? '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm">Chi tiết</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Room detail modal */}
      {selectedRoom && (
        <div className="modal-overlay" onClick={()=>setSelectedRoom(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Phòng {selectedRoom.number} — {selectedRoom.roomTypeName}</span>
              <button className="modal-close" onClick={()=>setSelectedRoom(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
                <div><div className="form-label">Trạng thái</div>
                  <span className="flex items-center gap-8 mt-4">
                    <span className={`status-dot ${statusConfig[selectedRoom.status].dot}`}/>
                    {statusConfig[selectedRoom.status].label}
                  </span>
                </div>
                <div><div className="form-label">Tầng</div><div className="mt-4">Tầng {selectedRoom.floor}</div></div>
                {selectedRoom.currentGuestName && <>
                  <div><div className="form-label">Khách</div><div className="mt-4 font-600">{selectedRoom.currentGuestName}</div></div>
                  <div><div className="form-label">Check-out</div><div className="mt-4">{selectedRoom.checkOutDate}</div></div>
                </>}
                {selectedRoom.notes && <div style={{ gridColumn:'span 2' }}><div className="form-label">Ghi chú</div><div className="mt-4" style={{ color:'var(--danger)' }}>{selectedRoom.notes}</div></div>}
              </div>
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
                <div className="form-label" style={{ marginBottom:10 }}>Thay đổi trạng thái</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {(['vacant_clean','vacant_dirty','out_of_order','blocked'] as RoomStatus[]).map(s=>(
                    <button key={s} className="btn btn-secondary btn-sm"
                      style={{ opacity: s===selectedRoom.status ? .5:1 }}>
                      {statusConfig[s].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setSelectedRoom(null)}>Đóng</button>
              <button className="btn btn-primary"><Wrench size={14}/> Tạo ticket bảo trì</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
