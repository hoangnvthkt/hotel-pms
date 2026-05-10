import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import {
  createRoomRate,
  createRoomType,
  deleteRoomRate,
  deleteRoomType,
  fetchMetadataOptions,
  fetchRoomRates,
  fetchRoomTypes,
  queryKeys,
  updateRoomRate,
  updateRoomType,
} from '@/lib/data';
import type { RoomRate, RoomType } from '@/types';
import type { MetadataOption } from '@/types/metadata';

type RoomTypeForm = {
  code: string;
  name: string;
  maxOccupancy: string;
  bedType: string;
  area: string;
  amenities: string[];
  description: string;
  basePrice: string;
};

type RoomRateForm = {
  rateCode: string;
  name: string;
  amount: string;
  currency: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

const emptyRoomTypeForm: RoomTypeForm = {
  code: '',
  name: '',
  maxOccupancy: '2',
  bedType: '',
  area: '',
  amenities: [],
  description: '',
  basePrice: '',
};

const emptyRoomRateForm: RoomRateForm = {
  rateCode: 'BAR',
  name: 'Best Available Rate',
  amount: '',
  currency: 'VND',
  startDate: '',
  endDate: '',
  isActive: true,
};

const fmtMoney = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;

function roomRateToForm(rate: RoomRate): RoomRateForm {
  return {
    rateCode: rate.rateCode,
    name: rate.name,
    amount: String(rate.amount),
    currency: rate.currency,
    startDate: rate.startDate ?? '',
    endDate: rate.endDate ?? '',
    isActive: rate.isActive,
  };
}

function activeOptions(options: MetadataOption[]) {
  return options.filter(option => option.is_active);
}

function resolveOptionCode(value: string, options: MetadataOption[]) {
  return options.find(option => option.code === value || option.label === value)?.code ?? value;
}

function optionLabel(value: string, options: MetadataOption[]) {
  return options.find(option => option.code === value || option.label === value)?.label ?? value;
}

function roomTypeToForm(roomType: RoomType, bedTypes: MetadataOption[], roomFeatures: MetadataOption[]): RoomTypeForm {
  return {
    code: roomType.code,
    name: roomType.name,
    maxOccupancy: String(roomType.maxOccupancy),
    bedType: resolveOptionCode(roomType.bedType, bedTypes),
    area: roomType.area ? String(roomType.area) : '',
    amenities: roomType.amenities.map(item => resolveOptionCode(item, roomFeatures)),
    description: roomType.description,
    basePrice: String(roomType.basePrice),
  };
}

export default function RoomTypesTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'manager';

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);
  const [typeForm, setTypeForm] = useState<RoomTypeForm>(emptyRoomTypeForm);
  const [showRateForm, setShowRateForm] = useState(false);
  const [editingRate, setEditingRate] = useState<RoomRate | null>(null);
  const [rateForm, setRateForm] = useState<RoomRateForm>(emptyRoomRateForm);
  const [formError, setFormError] = useState('');

  const roomTypesQuery = useQuery({
    queryKey: queryKeys.roomTypes,
    queryFn: fetchRoomTypes,
  });

  const roomTypes = roomTypesQuery.data ?? [];
  const selectedType = useMemo(
    () => roomTypes.find(roomType => roomType.id === selectedTypeId) ?? null,
    [roomTypes, selectedTypeId],
  );

  const ratesQuery = useQuery({
    queryKey: [...queryKeys.roomRates, selectedTypeId],
    queryFn: () => fetchRoomRates(selectedTypeId ?? undefined),
    enabled: Boolean(selectedTypeId),
  });

  const bedTypesQuery = useQuery({
    queryKey: queryKeys.metadataOptions('bed_type'),
    queryFn: () => fetchMetadataOptions('bed_type'),
  });

  const roomFeaturesQuery = useQuery({
    queryKey: queryKeys.metadataOptions('room_feature'),
    queryFn: () => fetchMetadataOptions('room_feature'),
  });

  const rateCodesQuery = useQuery({
    queryKey: queryKeys.metadataOptions('rate_code'),
    queryFn: () => fetchMetadataOptions('rate_code'),
  });

  const rates = ratesQuery.data ?? [];
  const bedTypeOptions = bedTypesQuery.data ?? [];
  const roomFeatureOptions = roomFeaturesQuery.data ?? [];
  const rateCodeOptions = rateCodesQuery.data ?? [];
  const bedTypes = activeOptions(bedTypeOptions);
  const roomFeatures = activeOptions(roomFeatureOptions);
  const rateCodes = activeOptions(rateCodeOptions);

  useEffect(() => {
    if (roomTypes.length === 0) {
      setSelectedTypeId(null);
      return;
    }
    if (!selectedTypeId || !roomTypes.some(roomType => roomType.id === selectedTypeId)) {
      setSelectedTypeId(roomTypes[0].id);
    }
  }, [roomTypes, selectedTypeId]);

  const invalidateRoomTypes = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.roomTypes }),
      qc.invalidateQueries({ queryKey: queryKeys.rooms }),
      qc.invalidateQueries({ queryKey: queryKeys.bookings }),
      qc.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
  };

  const invalidateRates = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.roomRates });
  };

  function buildRoomTypeInput() {
    const maxOccupancy = Number(typeForm.maxOccupancy);
    const area = typeForm.area ? Number(typeForm.area) : undefined;
    const basePrice = Number(typeForm.basePrice);

    if (!typeForm.code.trim()) throw new Error('Code loại phòng là bắt buộc.');
    if (!/^[A-Za-z0-9_-]+$/.test(typeForm.code.trim())) throw new Error('Code chỉ gồm chữ, số, gạch ngang hoặc gạch dưới.');
    if (!typeForm.name.trim()) throw new Error('Tên loại phòng là bắt buộc.');
    if (!Number.isInteger(maxOccupancy) || maxOccupancy < 1) throw new Error('Sức chứa phải là số nguyên lớn hơn 0.');
    if (!typeForm.bedType.trim()) throw new Error('Cần chọn loại giường từ Danh mục.');
    if (area !== undefined && (!Number.isFinite(area) || area < 0)) throw new Error('Diện tích không hợp lệ.');
    if (!Number.isFinite(basePrice) || basePrice < 0) throw new Error('Giá cơ bản không hợp lệ.');

    return {
      propertyId: user?.propertyId ?? roomTypes[0]?.propertyId ?? 'prop-001',
      code: typeForm.code,
      name: typeForm.name,
      maxOccupancy,
      bedType: typeForm.bedType,
      area,
      amenities: typeForm.amenities,
      description: typeForm.description,
      basePrice,
    };
  }

  function buildRoomRateInput() {
    if (!selectedType) throw new Error('Cần chọn loại phòng trước khi tạo giá.');
    const amount = Number(rateForm.amount);
    if (!rateForm.rateCode.trim()) throw new Error('Cần chọn mã giá từ Danh mục.');
    if (!rateForm.name.trim()) throw new Error('Tên bảng giá là bắt buộc.');
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Giá / đêm không hợp lệ.');
    if (rateForm.rateCode.toUpperCase() === 'SEASONAL' && (!rateForm.startDate || !rateForm.endDate)) {
      throw new Error('Giá mùa vụ cần ngày bắt đầu và ngày kết thúc.');
    }
    if (rateForm.startDate && rateForm.endDate && rateForm.startDate > rateForm.endDate) {
      throw new Error('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
    }

    return {
      propertyId: selectedType.propertyId,
      roomTypeId: selectedType.id,
      rateCode: rateForm.rateCode,
      name: rateForm.name,
      amount,
      currency: rateForm.currency || 'VND',
      startDate: rateForm.startDate || undefined,
      endDate: rateForm.endDate || undefined,
      isActive: rateForm.isActive,
    };
  }

  const createTypeMut = useMutation({
    mutationFn: () => createRoomType(buildRoomTypeInput()),
    onSuccess: async roomType => {
      await invalidateRoomTypes();
      setSelectedTypeId(roomType.id);
      setShowTypeForm(false);
      setEditingType(null);
      setFormError('');
    },
    onError: err => setFormError(err instanceof Error ? err.message : 'Không tạo được loại phòng.'),
  });

  const updateTypeMut = useMutation({
    mutationFn: () => {
      if (!editingType) throw new Error('Chưa chọn loại phòng cần sửa.');
      const { propertyId: _propertyId, ...input } = buildRoomTypeInput();
      return updateRoomType(editingType.id, input);
    },
    onSuccess: async () => {
      await invalidateRoomTypes();
      setShowTypeForm(false);
      setEditingType(null);
      setFormError('');
    },
    onError: err => setFormError(err instanceof Error ? err.message : 'Không cập nhật được loại phòng.'),
  });

  const deleteTypeMut = useMutation({
    mutationFn: deleteRoomType,
    onSuccess: async () => {
      await invalidateRoomTypes();
      await invalidateRates();
      setFormError('');
    },
    onError: err => setFormError(err instanceof Error ? err.message : 'Không xóa được loại phòng.'),
  });

  const createRateMut = useMutation({
    mutationFn: () => createRoomRate(buildRoomRateInput()),
    onSuccess: async () => {
      await invalidateRates();
      setShowRateForm(false);
      setEditingRate(null);
      setFormError('');
    },
    onError: err => setFormError(err instanceof Error ? err.message : 'Không tạo được bảng giá.'),
  });

  const updateRateMut = useMutation({
    mutationFn: () => {
      if (!editingRate) throw new Error('Chưa chọn bảng giá cần sửa.');
      return updateRoomRate(editingRate.id, buildRoomRateInput());
    },
    onSuccess: async () => {
      await invalidateRates();
      setShowRateForm(false);
      setEditingRate(null);
      setFormError('');
    },
    onError: err => setFormError(err instanceof Error ? err.message : 'Không cập nhật được bảng giá.'),
  });

  const toggleRateMut = useMutation({
    mutationFn: (rate: RoomRate) => updateRoomRate(rate.id, { isActive: !rate.isActive }),
    onSuccess: invalidateRates,
    onError: err => setFormError(err instanceof Error ? err.message : 'Không đổi được trạng thái bảng giá.'),
  });

  const deleteRateMut = useMutation({
    mutationFn: deleteRoomRate,
    onSuccess: invalidateRates,
    onError: err => setFormError(err instanceof Error ? err.message : 'Không xóa được bảng giá.'),
  });

  function openCreateType() {
    setEditingType(null);
    setTypeForm({ ...emptyRoomTypeForm, bedType: bedTypes[0]?.code ?? '' });
    setShowTypeForm(true);
    setFormError('');
  }

  function openEditType(roomType: RoomType) {
    setEditingType(roomType);
    setTypeForm(roomTypeToForm(roomType, bedTypeOptions, roomFeatureOptions));
    setShowTypeForm(true);
    setFormError('');
  }

  function openCreateRate() {
    const firstRateCode = rateCodes[0];
    setEditingRate(null);
    setRateForm({
      ...emptyRoomRateForm,
      rateCode: firstRateCode?.code ?? '',
      name: firstRateCode?.label ?? '',
      amount: selectedType ? String(selectedType.basePrice) : '',
    });
    setShowRateForm(true);
    setFormError('');
  }

  function openEditRate(rate: RoomRate) {
    setEditingRate(rate);
    const resolvedRateCode = resolveOptionCode(rate.rateCode, rateCodeOptions);
    setRateForm({ ...roomRateToForm(rate), rateCode: resolvedRateCode });
    setShowRateForm(true);
    setFormError('');
  }

  function toggleAmenity(code: string) {
    setTypeForm(form => ({
      ...form,
      amenities: form.amenities.includes(code)
        ? form.amenities.filter(item => item !== code)
        : [...form.amenities, code],
    }));
  }

  const typePending = createTypeMut.isPending || updateTypeMut.isPending;
  const ratePending = createRateMut.isPending || updateRateMut.isPending;

  return (
    <div>
      {formError && <div className="form-error" style={{ marginBottom: 16 }}>{formError}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 2 }}>Loại phòng</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{roomTypes.length} loại đang cấu hình</div>
            </div>
            {canWrite && (
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreateType}>
                <Plus size={14} /> Thêm loại
              </button>
            )}
          </div>

          {roomTypesQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Đang tải...</div>
          ) : roomTypes.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <h3>Chưa có loại phòng</h3>
              <p>Tạo loại phòng đầu tiên để gán phòng và bảng giá.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomTypes.map(roomType => {
                const selected = selectedTypeId === roomType.id;
                return (
                  <div
                    key={roomType.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTypeId(roomType.id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedTypeId(roomType.id);
                      }
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 14,
                      borderRadius: 8,
                      border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: selected ? 'var(--primary-bg)' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 900, fontSize: 14 }}>{roomType.name}</span>
                          <span className="badge badge-gray" style={{ fontFamily: 'monospace' }}>{roomType.code}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                          Tối đa {roomType.maxOccupancy} khách · {optionLabel(roomType.bedType, bedTypeOptions)}
                          {roomType.area > 0 ? ` · ${roomType.area} m2` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 900, color: 'var(--primary-dark)' }}>{fmtMoney(roomType.basePrice)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>giá cơ bản</div>
                      </div>
                    </div>

                    {(roomType.description || roomType.amenities.length > 0 || canWrite) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 12 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                          {roomType.amenities.slice(0, 4).map(item => (
                            <span key={item} style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-dark)', background: '#fff', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px' }}>
                              {optionLabel(item, roomFeatureOptions)}
                            </span>
                          ))}
                          {roomType.amenities.length > 4 && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>+{roomType.amenities.length - 4}</span>
                          )}
                        </div>
                        {canWrite && (
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm btn-icon"
                              title="Sửa loại phòng"
                              onClick={event => {
                                event.stopPropagation();
                                openEditType(roomType);
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm btn-icon"
                              title="Xóa loại phòng"
                              disabled={deleteTypeMut.isPending}
                              onClick={event => {
                                event.stopPropagation();
                                if (confirm(`Xóa loại phòng "${roomType.name}"? Chỉ xóa được khi chưa có phòng sử dụng.`)) {
                                  deleteTypeMut.mutate(roomType.id);
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 2 }}>Bảng giá</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
                {selectedType ? `${selectedType.code} · ${selectedType.name}` : 'Chọn loại phòng'}
              </div>
            </div>
            {canWrite && selectedType && (
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreateRate}>
                <Plus size={14} /> Thêm giá
              </button>
            )}
          </div>

          {!selectedType ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <h3>Chưa chọn loại phòng</h3>
              <p>Chọn một loại phòng bên trái để xem và sửa bảng giá.</p>
            </div>
          ) : ratesQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Đang tải...</div>
          ) : rates.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <h3>Chưa có bảng giá</h3>
              <p>Thêm mã giá trong Danh mục rồi tạo bảng giá cho loại phòng này.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderWidth: 1 }}>
              <table>
                <thead>
                  <tr>
                    <th>Mã giá</th>
                    <th>Tên</th>
                    <th>Giá / đêm</th>
                    <th>Hiệu lực</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rates.map(rate => (
                    <tr key={rate.id} style={{ opacity: rate.isActive ? 1 : 0.55 }}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 900, color: 'var(--primary-dark)' }}>{rate.rateCode}</span></td>
                      <td style={{ fontWeight: 700 }}>{rate.name}</td>
                      <td style={{ fontWeight: 900 }}>{fmtMoney(rate.amount)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {rate.startDate || rate.endDate ? `${rate.startDate ?? '...'} -> ${rate.endDate ?? '...'}` : 'Luôn áp dụng'}
                      </td>
                      <td>
                        <span className={`badge ${rate.isActive ? 'badge-green' : 'badge-gray'}`}>
                          {rate.isActive ? 'Hoạt động' : 'Tắt'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {canWrite && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button type="button" className="btn btn-secondary btn-sm btn-icon" title="Sửa bảng giá" onClick={() => openEditRate(rate)}>
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm btn-icon"
                              title={rate.isActive ? 'Tắt bảng giá' : 'Bật bảng giá'}
                              disabled={toggleRateMut.isPending}
                              onClick={() => toggleRateMut.mutate(rate)}
                            >
                              {rate.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm btn-icon"
                              title="Xóa bảng giá"
                              disabled={deleteRateMut.isPending}
                              onClick={() => {
                                if (confirm(`Xóa bảng giá "${rate.name}"?`)) deleteRateMut.mutate(rate.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showTypeForm && (
        <div className="modal-overlay" onClick={() => setShowTypeForm(false)}>
          <form
            className="modal"
            style={{ maxWidth: 680 }}
            onClick={event => event.stopPropagation()}
            onSubmit={event => {
              event.preventDefault();
              setFormError('');
              if (editingType) updateTypeMut.mutate();
              else createTypeMut.mutate();
            }}
          >
            <div className="modal-header">
              <span className="modal-title">{editingType ? 'Sửa loại phòng' : 'Thêm loại phòng'}</span>
              <button type="button" className="modal-close" onClick={() => setShowTypeForm(false)}>x</button>
            </div>
            <div className="modal-body">
              {formError && <div className="form-error" style={{ marginBottom: 14 }}>{formError}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Code</label>
                  <input className="form-input" required value={typeForm.code} onChange={event => setTypeForm(form => ({ ...form, code: event.target.value }))} placeholder="STD" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tên loại phòng</label>
                  <input className="form-input" required value={typeForm.name} onChange={event => setTypeForm(form => ({ ...form, name: event.target.value }))} placeholder="Phòng Standard" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sức chứa</label>
                  <input className="form-input" required type="number" min={1} step={1} value={typeForm.maxOccupancy} onChange={event => setTypeForm(form => ({ ...form, maxOccupancy: event.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Loại giường</label>
                  <select
                    className="form-input form-select"
                    required
                    value={typeForm.bedType}
                    onChange={event => setTypeForm(form => ({ ...form, bedType: event.target.value }))}
                  >
                    <option value="" disabled>{bedTypesQuery.isLoading ? 'Đang tải...' : 'Chọn loại giường'}</option>
                    {bedTypes.map(option => (
                      <option key={option.id} value={option.code}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Diện tích m2</label>
                  <input className="form-input" type="number" min={0} step="0.1" value={typeForm.area} onChange={event => setTypeForm(form => ({ ...form, area: event.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Giá cơ bản</label>
                  <input className="form-input" required type="number" min={0} step={1000} value={typeForm.basePrice} onChange={event => setTypeForm(form => ({ ...form, basePrice: event.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Tiện nghi</label>
                  {roomFeaturesQuery.isLoading ? (
                    <div style={{ color: 'var(--text-muted)', fontWeight: 700, padding: '10px 0' }}>Đang tải...</div>
                  ) : roomFeatures.length === 0 ? (
                    <div className="form-error">Chưa có tùy chọn trong Danh mục / Tiện nghi, đặc điểm phòng.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {roomFeatures.map(option => {
                        const checked = typeForm.amenities.includes(option.code);
                        return (
                          <label
                            key={option.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 7,
                              padding: '7px 10px',
                              borderRadius: 20,
                              border: checked ? '1px solid var(--primary)' : '1px solid var(--border)',
                              background: checked ? 'var(--primary-bg)' : '#fff',
                              color: checked ? 'var(--primary-dark)' : 'var(--text-secondary)',
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            <input type="checkbox" checked={checked} onChange={() => toggleAmenity(option.code)} />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Mô tả</label>
                  <textarea className="form-input" rows={3} value={typeForm.description} onChange={event => setTypeForm(form => ({ ...form, description: event.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowTypeForm(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={typePending}>{editingType ? 'Lưu' : 'Tạo'}</button>
            </div>
          </form>
        </div>
      )}

      {showRateForm && (
        <div className="modal-overlay" onClick={() => setShowRateForm(false)}>
          <form
            className="modal"
            style={{ maxWidth: 560 }}
            onClick={event => event.stopPropagation()}
            onSubmit={event => {
              event.preventDefault();
              setFormError('');
              if (editingRate) updateRateMut.mutate();
              else createRateMut.mutate();
            }}
          >
            <div className="modal-header">
              <span className="modal-title">{editingRate ? 'Sửa bảng giá' : 'Thêm bảng giá'}</span>
              <button type="button" className="modal-close" onClick={() => setShowRateForm(false)}>x</button>
            </div>
            <div className="modal-body">
              {formError && <div className="form-error" style={{ marginBottom: 14 }}>{formError}</div>}
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Loại phòng</label>
                  <input className="form-input" value={selectedType ? `${selectedType.code} · ${selectedType.name}` : ''} disabled />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Mã giá</label>
                    <select className="form-input form-select" value={rateForm.rateCode} onChange={event => {
                      const nextCode = event.target.value;
                      const option = rateCodes.find(item => item.code === nextCode);
                      setRateForm(form => ({ ...form, rateCode: nextCode, name: option?.label ?? form.name }));
                    }} required>
                      <option value="" disabled>{rateCodesQuery.isLoading ? 'Đang tải...' : 'Chọn mã giá'}</option>
                      {rateCodes.map(option => (
                        <option key={option.id} value={option.code}>{option.code} · {option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Giá / đêm</label>
                    <input className="form-input" required type="number" min={0} step={1000} value={rateForm.amount} onChange={event => setRateForm(form => ({ ...form, amount: event.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Tên bảng giá</label>
                  <input className="form-input" required value={rateForm.name} onChange={event => setRateForm(form => ({ ...form, name: event.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Từ ngày</label>
                    <input className="form-input" type="date" value={rateForm.startDate} onChange={event => setRateForm(form => ({ ...form, startDate: event.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Đến ngày</label>
                    <input className="form-input" type="date" value={rateForm.endDate} onChange={event => setRateForm(form => ({ ...form, endDate: event.target.value }))} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, color: 'var(--primary-dark)' }}>
                  <input type="checkbox" checked={rateForm.isActive} onChange={event => setRateForm(form => ({ ...form, isActive: event.target.checked }))} />
                  Đang hoạt động
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowRateForm(false)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={ratePending}>{editingRate ? 'Lưu' : 'Tạo'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
