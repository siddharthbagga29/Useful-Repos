-- ═══════════════════════════════════════════════════════════════════════════
--  High Properties — Supabase schema
--  Run in: Supabase → your project → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists listings (
  id          text primary key,
  slug        text not null default '',
  title       text not null,
  type        text not null default '',
  category    text not null default 'residential',
  purpose     jsonb not null default '["buy"]'::jsonb,
  price       bigint,
  pricelabel  text not null default '',
  city        text not null default 'Gurugram',
  sector      text not null default '',
  locality    text not null default '',
  location    text not null default '',
  beds        int,
  baths       int,
  area        numeric(12,2),
  areaunit    text not null default 'sq.ft',
  status      text not null default '',
  badge       text not null default '',
  featured    boolean not null default false,
  icon        text not null default '',
  gradient    text not null default '',
  specs       jsonb not null default '[]'::jsonb,
  amenities   jsonb not null default '[]'::jsonb,
  description text not null default '',
  image       text not null default '',
  rera        text not null default '',
  postedon    date default current_date,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);
create index if not exists idx_listings_active   on listings (active, featured);
create index if not exists idx_listings_category on listings (category);
create index if not exists idx_listings_price    on listings (price);

create table if not exists leads (
  id            text primary key,
  name          text not null default '',
  phone         text not null default '',
  email         text not null default '',
  role          text not null default '',
  property_type text not null default '',
  budget        text not null default '',
  location      text not null default '',
  message       text not null default '',
  source        text not null default 'website',
  stage         text not null default 'new',
  ip            text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists idx_leads_created on leads (created_at desc);
create index if not exists idx_leads_phone   on leads (phone);

create table if not exists wa_conversations (
  id         text primary key,
  direction  text not null default 'in',
  wa_id      text not null default '',
  name       text not null default '',
  text       text not null default '',
  type       text not null default 'text',
  created_at timestamptz not null default now()
);
create index if not exists idx_wa_waid    on wa_conversations (wa_id);
create index if not exists idx_wa_created on wa_conversations (created_at desc);

create table if not exists staff (
  username   text primary key,
  hash       text not null,
  role       text not null default 'staff',
  created_at timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────
-- The API uses the service-role key, which bypasses RLS. Enabling it with no
-- permissive policy means a leaked ANON key still exposes nothing.
alter table listings         enable row level security;
alter table leads            enable row level security;
alter table wa_conversations enable row level security;
alter table staff            enable row level security;

-- Seed the three starter listings (safe to re-run).
insert into listings (id, slug, title, type, category, purpose, price, pricelabel,
                      city, sector, locality, location, beds, baths, area, areaunit,
                      status, badge, featured, icon, gradient, specs, amenities, description)
values
 ('HP-1001','3-bhk-premium-apartment-sector-99-dwarka-expressway','3 BHK Premium Apartment','Apartment','residential',
  '["buy","sell"]'::jsonb, 14500000, '₹1.45 Cr','Gurugram','Sector 99','Dwarka Expressway',
  'Sector 99, Dwarka Expressway, Gurugram', 3, 3, 1650, 'sq.ft','Ready to Move','Hot Deal', true,'🏢',
  'linear-gradient(135deg, #2c5f3f 0%, #1a3d2b 100%)',
  '[]'::jsonb,
  '["Covered parking","Power backup","Clubhouse","24×7 security","Lift"]'::jsonb,
  'Spacious 3 BHK in a gated development on the Dwarka Expressway corridor, close to the Sector 99 metro alignment and Delhi border. Ready to move with clear title and complete documentation support.'),
 ('HP-1002','office-space-dxp-business-hub-sector-108','Office Space — DXP Business Hub','Office','commercial',
  '["buy","sell","lease","rent"]'::jsonb, 8500000, '₹85 L','Gurugram','Sector 108','Dwarka Expressway',
  'Sector 108, Gurugram', null, 2, 800, 'sq.ft','Ready','Featured', true,'🏪',
  'linear-gradient(135deg, #3d2c1a 0%, #2a1d0d 100%)',
  '[]'::jsonb,
  '["3 reserved parking bays","DG backup","Central air conditioning","Fire safety compliant"]'::jsonb,
  'Fitted office floor plate in an established business hub on the Dwarka Expressway. Suitable for professional services, a satellite office or a lease-yield investment.'),
 ('HP-1003','residential-plot-sector-65-golf-course-extension','Residential Plot — Prime Location','Plot','plot',
  '["buy","sell"]'::jsonb, 28000000, '₹2.8 Cr','Gurugram','Sector 65','Golf Course Extension Road',
  'Sector 65, Golf Course Ext., Gurugram', null, null, 200, 'sq.yd','Approved','New Launch', true,'🏘',
  'linear-gradient(135deg, #1a2d3d 0%, #0d1d2a 100%)',
  '[]'::jsonb,
  '["Corner plot","Wide frontage","Licensed colony","Ready for construction"]'::jsonb,
  'Corner residential plot on Golf Course Extension Road with approved layout and clear title. Build-to-suit support and turnkey construction available in-house.')
on conflict (id) do nothing;
