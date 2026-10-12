-- ============================================================
-- STOCK ADJUSTMENTS TABLE — Run this in Supabase SQL Editor
-- ============================================================

create table if not exists stock_adjustments (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id),
  product_name text,
  product_code text,
  old_qty numeric,
  new_qty numeric,
  difference numeric,
  reason text,
  notes text,
  created_at timestamptz default now()
);

alter table stock_adjustments enable row level security;

create policy "allow all" on stock_adjustments for all using (true) with check (true);

-- ── SUPPLIER BALANCE ADJUSTMENTS (audit trail) ───────────
create table if not exists supplier_adjustments (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid references suppliers(id),
  supplier_name text,
  old_balance numeric,
  new_balance numeric,
  difference numeric,
  reason text,
  notes text,
  created_at timestamptz default now()
);
alter table supplier_adjustments enable row level security;
create policy "allow all" on supplier_adjustments for all using (true) with check (true);

-- ── IMEI / SERIAL NUMBER TRACKING ────────────────────────
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS imei text;
