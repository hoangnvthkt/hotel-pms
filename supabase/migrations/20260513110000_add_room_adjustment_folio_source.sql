-- Add a dedicated folio source for room-charge reconciliation adjustments.

alter type public.folio_item_source_type add value if not exists 'room_adjustment';
