-- Step 12 — ConsumptionSignal attribution pipeline indexes
-- Deduplication lookup: has this signal already produced an economic_event?
create index if not exists economic_event_attribution_basis_idx
  on economic_event(attribution_basis)
  where attribution_basis is not null;

-- Deduplication lookup on signal side
create index if not exists consumption_signal_dedup_idx
  on consumption_signal(session_ref, signal_type, projection_id);
