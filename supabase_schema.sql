-- ============================================================
-- DJOKO PRO ACCOUNTING — Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── SETTINGS ──────────────────────────────────────────────
create table if not exists settings (
  id uuid primary key default uuid_generate_v4(),
  company text default 'DJOKO',
  address text,
  phone text,
  email text,
  vat_number text,
  invoice_prefix text default 'INV-',
  po_prefix text default 'PO-',
  payment_terms int default 30,
  base_currency text default 'USD',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
insert into settings (company) values ('DJOKO') on conflict do nothing;

-- ── CUSTOMERS ─────────────────────────────────────────────
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  address text,
  tax_number text,
  currency text default 'USD',
  opening_balance numeric default 0,
  created_at timestamptz default now()
);

-- ── SUPPLIERS ─────────────────────────────────────────────
create table if not exists suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  address text,
  tax_number text,
  currency text default 'USD',
  opening_balance numeric default 0,
  created_at timestamptz default now()
);

-- ── PRODUCTS / STOCK ──────────────────────────────────────
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  code text not null,
  name text not null,
  description text,
  category text default 'General',
  uom text default 'Each',
  sku text,
  qty numeric default 0,
  reorder_level numeric default 10,
  cost_price numeric default 0,
  sell_price numeric default 0,
  created_at timestamptz default now()
);

-- ── INVOICES ──────────────────────────────────────────────
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  number text not null unique,
  customer_id uuid references customers(id),
  customer_name text,
  date date not null,
  due_date date,
  currency text default 'USD',
  subtotal numeric default 0,
  discount_pct numeric default 0,
  total numeric default 0,
  base_amount numeric default 0,
  cogs numeric default 0,
  paid_amount numeric default 0,
  balance numeric default 0,
  status text default 'pending',
  notes text,
  created_at timestamptz default now()
);

-- ── INVOICE LINE ITEMS ────────────────────────────────────
create table if not exists invoice_lines (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references invoices(id) on delete cascade,
  product_id uuid references products(id),
  product_name text,
  product_code text,
  qty numeric default 1,
  unit_price numeric default 0,
  discount_pct numeric default 0,
  line_total numeric default 0,
  cogs numeric default 0
);

-- ── PURCHASE ORDERS ───────────────────────────────────────
create table if not exists purchases (
  id uuid primary key default uuid_generate_v4(),
  number text not null unique,
  supplier_id uuid references suppliers(id),
  supplier_name text,
  date date not null,
  delivery_date date,
  currency text default 'USD',
  total numeric default 0,
  base_amount numeric default 0,
  paid_amount numeric default 0,
  balance numeric default 0,
  status text default 'pending',
  created_at timestamptz default now()
);

-- ── PURCHASE LINE ITEMS ───────────────────────────────────
create table if not exists purchase_lines (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid references purchases(id) on delete cascade,
  product_id uuid references products(id),
  product_name text,
  product_code text,
  qty numeric default 1,
  unit_cost numeric default 0,
  line_total numeric default 0
);

-- ── CUSTOMER RECEIPTS ─────────────────────────────────────
create table if not exists receipts (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  customer_id uuid references customers(id),
  customer_name text,
  invoice_id uuid references invoices(id),
  invoice_number text,
  currency text default 'USD',
  amount numeric default 0,
  base_amount numeric default 0,
  method text default 'Bank transfer',
  note text,
  created_at timestamptz default now()
);

-- ── SUPPLIER PAYMENTS ─────────────────────────────────────
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  supplier_id uuid references suppliers(id),
  supplier_name text,
  purchase_id uuid references purchases(id),
  purchase_number text,
  currency text default 'USD',
  amount numeric default 0,
  base_amount numeric default 0,
  method text default 'Bank transfer',
  note text,
  created_at timestamptz default now()
);

-- ── EXPENSES ──────────────────────────────────────────────
create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  category text not null,
  description text not null,
  payee text,
  currency text default 'USD',
  amount numeric default 0,
  base_amount numeric default 0,
  reference text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — disable for single-company use
-- (Enable and configure if you add user authentication)
-- ============================================================
alter table settings enable row level security;
alter table customers enable row level security;
alter table suppliers enable row level security;
alter table products enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table purchases enable row level security;
alter table purchase_lines enable row level security;
alter table receipts enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;

-- Allow all access (anon key) — fine for single-company internal tool
create policy "allow all" on settings for all using (true) with check (true);
create policy "allow all" on customers for all using (true) with check (true);
create policy "allow all" on suppliers for all using (true) with check (true);
create policy "allow all" on products for all using (true) with check (true);
create policy "allow all" on invoices for all using (true) with check (true);
create policy "allow all" on invoice_lines for all using (true) with check (true);
create policy "allow all" on purchases for all using (true) with check (true);
create policy "allow all" on purchase_lines for all using (true) with check (true);
create policy "allow all" on receipts for all using (true) with check (true);
create policy "allow all" on payments for all using (true) with check (true);
create policy "allow all" on expenses for all using (true) with check (true);

-- ============================================================
-- Done! All tables created.
-- ============================================================
