-- Coloring Poster — initial schema: generations (AI pipeline attempts) and
-- orders (checkout + Gelato fulfillment). See PROJECT_BRIEF.md mục 3, 4, 6, 7.

create extension if not exists pgcrypto;

create table generations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_address inet,
  source_image_path text not null,
  paper_size text not null check (paper_size in ('30x40', '50x70', '70x100')),
  -- prompt/model/size/seed used for both AI calls — replayed unchanged to
  -- produce the paid, watermark-free version (mục 3 bước 4).
  ai_params jsonb not null,
  preview_image_path text,
  clean_image_path text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

-- Free-tier abuse limiting: count today's rows per email (mục 4).
create index generations_email_created_at_idx on generations (email, created_at);

create table orders (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations(id),
  email text not null,
  paper_size text not null check (paper_size in ('30x40', '50x70', '70x100')),
  paper_type text not null default 'premium_matte' check (paper_type in ('premium_matte', 'archival_matte')),
  has_frame boolean not null default false,
  shipping_address jsonb not null,
  base_price_cents integer,
  shipping_price_cents integer,
  sale_price_cents integer not null,
  currency text not null default 'USD',
  -- 'paid_stub' = stub checkout success (mục 7) until a real gateway is wired up.
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid_stub', 'paid', 'failed', 'refunded')),
  gelato_order_id text,
  fulfillment_status text not null default 'not_submitted' check (fulfillment_status in ('not_submitted', 'submitted', 'printing', 'shipped', 'delivered', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_email_idx on orders (email);

create function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_set_updated_at
  before update on orders
  for each row
  execute function set_updated_at();

-- No customer-facing accounts (mục 8-9): both tables are written/read only
-- by server API routes via the service-role client. RLS enabled with no
-- policies denies anon/authenticated access entirely.
alter table generations enable row level security;
alter table orders enable row level security;
