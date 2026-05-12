import { describe, expect, it } from 'vitest';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('maps duplicate guest document errors to a guest-specific message', () => {
    expect(errorMessage({
      message: 'duplicate key value violates unique constraint "guests_property_id_document_type_document_number_key"',
    })).toBe('Khách có loại giấy tờ và số giấy tờ này đã tồn tại.');
  });

  it('maps invalid uuid property errors to a reloadable account/property message', () => {
    expect(errorMessage({ message: 'invalid input syntax for type uuid: "prop-001"' }))
      .toBe('Không xác định được khách sạn hợp lệ. Vui lòng tải lại trang rồi thử lại.');
  });
});
