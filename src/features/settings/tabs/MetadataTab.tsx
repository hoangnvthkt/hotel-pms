import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, PowerOff, Power, Lock, ChevronRight, Trash2 } from 'lucide-react';
import { queryKeys } from '@/lib/queryClient';
import {
  fetchMetadataOptions, createMetadataOption,
  updateMetadataOption, deactivateMetadataOption, reactivateMetadataOption, deleteMetadataOption
} from '@/lib/data';
import { METADATA_CATEGORY_LABELS } from '@/types/metadata';
import type { MetadataCategory, MetadataOption } from '@/types/metadata';
import { useAuth } from '@/features/auth/AuthContext';

const CATEGORIES = Object.keys(METADATA_CATEGORY_LABELS) as MetadataCategory[];

export default function MetadataTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canWrite = isAdmin || user?.role === 'manager';

  const [selectedCat, setSelectedCat] = useState<MetadataCategory>('guest_type');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MetadataOption | null>(null);
  const [form, setForm] = useState({ code: '', label: '', description: '' });
  const [err, setErr] = useState('');

  const { data: options = [], isLoading } = useQuery({
    queryKey: queryKeys.metadataOptions(selectedCat),
    queryFn: () => fetchMetadataOptions(selectedCat),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.metadataOptions(selectedCat) });

  const createMut = useMutation({
    mutationFn: createMetadataOption,
    onSuccess: () => { invalidate(); setShowForm(false); setForm({ code: '', label: '', description: '' }); },
    onError: (e: any) => setErr(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: any }) => updateMetadataOption(id, input),
    onSuccess: () => { invalidate(); setEditing(null); },
    onError: (e: any) => setErr(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateMetadataOption,
    onSuccess: invalidate,
  });

  const reactivateMut = useMutation({
    mutationFn: reactivateMetadataOption,
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: deleteMetadataOption,
    onSuccess: invalidate,
    onError: (e: any) => {
      // Typically fails if there's a foreign key constraint
      alert(`Không thể xóa: ${e.message}`);
    }
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (editing) {
      updateMut.mutate({ id: editing.id, input: { label: form.label, description: form.description || null } });
    } else {
      createMut.mutate({
        property_id: user?.propertyId ?? '',
        category: selectedCat,
        code: form.code,
        label: form.label,
        description: form.description || null,
        sort_order: options.length,
        is_active: true,
        system_locked: false,
        extra: null,
      });
    }
  }

  function openEdit(opt: MetadataOption) {
    if (opt.system_locked) return;
    setEditing(opt);
    setForm({ code: opt.code, label: opt.label, description: opt.description ?? '' });
    setShowForm(true);
    setErr('');
  }

  function openCreate() {
    setEditing(null);
    setForm({ code: '', label: '', description: '' });
    setShowForm(true);
    setErr('');
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
      {/* Category sidebar */}
      <div className="card" style={{ padding: '8px 0', height: 'fit-content' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => { setSelectedCat(cat); setShowForm(false); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', border: 'none', borderRadius: 0,
              background: selectedCat === cat ? 'var(--primary-bg)' : 'transparent',
              color: selectedCat === cat ? 'var(--primary-dark)' : 'var(--text-secondary)',
              fontWeight: selectedCat === cat ? 800 : 600, fontSize: 13, cursor: 'pointer',
              textAlign: 'left', borderLeft: selectedCat === cat ? '3px solid var(--primary)' : '3px solid transparent',
            }}
          >
            {METADATA_CATEGORY_LABELS[cat]}
            <ChevronRight size={14} />
          </button>
        ))}
      </div>

      {/* Options panel */}
      <div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 2 }}>{METADATA_CATEGORY_LABELS[selectedCat]}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{options.length} tùy chọn</div>
            </div>
            {canWrite && (
              <button className="btn btn-primary btn-sm" onClick={openCreate} style={{ gap: 6, borderRadius: 20, padding: '7px 16px' }}>
                <Plus size={14} /> Thêm
              </button>
            )}
          </div>

          {/* Inline form */}
          {showForm && (
            <form onSubmit={handleSubmit} style={{ background: 'var(--primary-bg)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, color: 'var(--primary-dark)' }}>
                {editing ? '✏️ Chỉnh sửa' : '➕ Thêm mới'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Code *</label>
                  <input
                    className="form-input" placeholder="vd: vip_guest hoặc BAR" required
                    value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    disabled={!!editing} style={{ opacity: editing ? 0.6 : 1 }}
                    pattern="^[A-Za-z0-9_-]+$" title="Chỉ chữ, số, dấu gạch dưới, hoặc gạch ngang"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Tên hiển thị *</label>
                  <input className="form-input" placeholder="vd: VIP" required
                    value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Mô tả (tùy chọn)</label>
                <input className="form-input" placeholder="Ghi chú thêm..."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {err && <div style={{ color: 'var(--coral)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending || updateMut.isPending}>
                  {editing ? 'Lưu' : 'Tạo'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Hủy</button>
              </div>
            </form>
          )}

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Đang tải...</div>
          ) : options.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Chưa có tùy chọn nào</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Code', 'Tên hiển thị', 'Mô tả', 'Trạng thái', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {options.map(opt => (
                  <tr key={opt.id} style={{ borderBottom: '1px solid var(--border-light)', opacity: opt.is_active ? 1 : 0.5 }}>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary-dark)', fontWeight: 700 }}>
                      {opt.code}
                      {opt.system_locked && <Lock size={11} style={{ marginLeft: 4, verticalAlign: 'middle', color: 'var(--text-muted)' }} />}
                    </td>
                    <td style={{ padding: '10px', fontWeight: 700 }}>{opt.label}</td>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)', fontSize: 12 }}>{opt.description ?? '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: opt.is_active ? 'var(--success-light)' : 'var(--border-light)',
                        color: opt.is_active ? 'var(--success)' : 'var(--text-muted)',
                      }}>
                        {opt.is_active ? 'Hoạt động' : 'Tắt'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      {canWrite && !opt.system_locked && (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }} onClick={() => openEdit(opt)} title="Chỉnh sửa">
                            <Pencil size={12} />
                          </button>
                          {opt.is_active ? (
                            <button className="btn btn-sm" style={{ padding: '4px 10px', background: 'var(--border-light)', border: 'none', color: 'var(--text-muted)', borderRadius: 8 }}
                              onClick={() => deactivateMut.mutate(opt.id)} title="Tạm ẩn">
                              <PowerOff size={12} />
                            </button>
                          ) : (
                            <button className="btn btn-sm" style={{ padding: '4px 10px', background: 'var(--success-light)', border: 'none', color: 'var(--success)', borderRadius: 8 }}
                              onClick={() => reactivateMut.mutate(opt.id)} title="Hiển thị lại">
                              <Power size={12} />
                            </button>
                          )}
                          {isAdmin && (
                            <button className="btn btn-sm" style={{ padding: '4px 10px', background: 'var(--danger-light, #fee2e2)', border: 'none', color: 'var(--coral, #ef4444)', borderRadius: 8 }}
                              onClick={() => {
                                if (confirm(`Bạn có chắc chắn muốn xóa "${opt.label}" không? Thao tác này không thể hoàn tác.`)) {
                                  deleteMut.mutate(opt.id);
                                }
                              }} title="Xóa vĩnh viễn">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
