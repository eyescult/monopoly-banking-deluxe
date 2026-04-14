-- Berlin Monopoly Property + Trading System (additive rollout)
-- This migration is additive and does not alter existing public.users/public.games tables.

create schema if not exists berlin_v2;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'property_type') then
    create type berlin_v2.property_type as enum ('property', 'station', 'utility', 'special');
  end if;

  if not exists (select 1 from pg_type where typname = 'trade_status') then
    create type berlin_v2.trade_status as enum ('pending', 'accepted', 'rejected');
  end if;
end $$;

create table if not exists berlin_v2.games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists berlin_v2.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

create table if not exists berlin_v2.properties (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references berlin_v2.games(id) on delete cascade,
  position int not null check (position between 0 and 39),
  name text not null,
  group_name text,
  type berlin_v2.property_type not null,
  price int not null default 0 check (price >= 0),
  rent_base int not null default 0 check (rent_base >= 0),
  house_price int not null default 0 check (house_price >= 0),
  hotel_price int not null default 0 check (hotel_price >= 0),
  owner_id uuid references berlin_v2.profiles(id) on delete set null,
  houses int not null default 0 check (houses between 0 and 4),
  is_hotel boolean not null default false,
  is_mortgaged boolean not null default false,
  mortgage_value int not null default 0 check (mortgage_value >= 0),
  created_at timestamptz not null default now(),
  unique (game_id, position)
);

create table if not exists berlin_v2.player_properties (
  player_id uuid not null references berlin_v2.profiles(id) on delete cascade,
  property_id uuid not null references berlin_v2.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, property_id)
);

create table if not exists berlin_v2.trades (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references berlin_v2.games(id) on delete cascade,
  from_player uuid not null references berlin_v2.profiles(id) on delete cascade,
  to_player uuid not null references berlin_v2.profiles(id) on delete cascade,
  offered_money int not null default 0 check (offered_money >= 0),
  requested_money int not null default 0 check (requested_money >= 0),
  offered_properties uuid[] not null default '{}',
  requested_properties uuid[] not null default '{}',
  status berlin_v2.trade_status not null default 'pending',
  created_at timestamptz not null default now(),
  check (from_player <> to_player)
);

create or replace function berlin_v2.sync_player_property_owner()
returns trigger
language plpgsql
as $$
begin
  delete from berlin_v2.player_properties where property_id = new.id;
  if new.owner_id is not null then
    insert into berlin_v2.player_properties (player_id, property_id)
    values (new.owner_id, new.id)
    on conflict (player_id, property_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_player_property_owner on berlin_v2.properties;
create trigger trg_sync_player_property_owner
after insert or update of owner_id on berlin_v2.properties
for each row
execute function berlin_v2.sync_player_property_owner();

create index if not exists idx_v2_properties_game_id on berlin_v2.properties(game_id);
create index if not exists idx_v2_properties_owner_id on berlin_v2.properties(owner_id);
create index if not exists idx_v2_player_properties_player_id on berlin_v2.player_properties(player_id);
create index if not exists idx_v2_player_properties_property_id on berlin_v2.player_properties(property_id);
create index if not exists idx_v2_trades_game_id on berlin_v2.trades(game_id);
create index if not exists idx_v2_trades_from_player on berlin_v2.trades(from_player);
create index if not exists idx_v2_trades_to_player on berlin_v2.trades(to_player);
create index if not exists idx_v2_trades_status on berlin_v2.trades(status);

alter table berlin_v2.games enable row level security;
alter table berlin_v2.profiles enable row level security;
alter table berlin_v2.properties enable row level security;
alter table berlin_v2.player_properties enable row level security;
alter table berlin_v2.trades enable row level security;

drop policy if exists "Profiles are self readable" on berlin_v2.profiles;
create policy "Profiles are self readable"
  on berlin_v2.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles are self writable" on berlin_v2.profiles;
create policy "Profiles are self writable"
  on berlin_v2.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Games are readable by authenticated users" on berlin_v2.games;
create policy "Games are readable by authenticated users"
  on berlin_v2.games for select
  using (auth.uid() is not null);

drop policy if exists "Games are insertable by authenticated users" on berlin_v2.games;
create policy "Games are insertable by authenticated users"
  on berlin_v2.games for insert
  with check (auth.uid() is not null);

drop policy if exists "Properties are visible to game players" on berlin_v2.properties;
create policy "Properties are visible to game players"
  on berlin_v2.properties for select
  using (auth.uid() is not null);

drop policy if exists "Property owner can update property" on berlin_v2.properties;
create policy "Property owner can update property"
  on berlin_v2.properties for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Authenticated users can insert properties" on berlin_v2.properties;
create policy "Authenticated users can insert properties"
  on berlin_v2.properties for insert
  with check (auth.uid() is not null);

drop policy if exists "Player properties are self readable" on berlin_v2.player_properties;
create policy "Player properties are self readable"
  on berlin_v2.player_properties for select
  using (
    player_id = auth.uid()
    or exists (
      select 1 from berlin_v2.properties p
      where p.id = property_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Player properties are self writable" on berlin_v2.player_properties;
create policy "Player properties are self writable"
  on berlin_v2.player_properties for all
  using (player_id = auth.uid())
  with check (player_id = auth.uid());

drop policy if exists "Trades visible to participants" on berlin_v2.trades;
create policy "Trades visible to participants"
  on berlin_v2.trades for select
  using (auth.uid() = from_player or auth.uid() = to_player);

drop policy if exists "Trades insertable by sender" on berlin_v2.trades;
create policy "Trades insertable by sender"
  on berlin_v2.trades for insert
  with check (auth.uid() = from_player);

drop policy if exists "Trades updatable by participants" on berlin_v2.trades;
create policy "Trades updatable by participants"
  on berlin_v2.trades for update
  using (auth.uid() = from_player or auth.uid() = to_player)
  with check (auth.uid() = from_player or auth.uid() = to_player);

create or replace function berlin_v2.seed_berlin_board(game_id_input uuid)
returns void
language plpgsql
security definer
as $$
begin
  if exists (
    select 1 from berlin_v2.properties
    where game_id = game_id_input
  ) then
    return;
  end if;

  insert into berlin_v2.properties (
    game_id, position, name, group_name, type, price, rent_base,
    house_price, hotel_price, mortgage_value
  )
  select
    game_id_input, b.position, b.name, b.group_name, b.type::berlin_v2.property_type,
    b.price, b.rent_base, b.house_price, b.hotel_price, b.mortgage_value
  from (
    values
      (0, 'Start', null, 'special', 0, 0, 0, 0, 0),
      (1, 'Checkpoint Charlie', 'Brown', 'property', 60, 2, 50, 50, 30),
      (2, 'Gemeinschaftsfeld', null, 'special', 0, 0, 0, 0, 0),
      (3, 'Siegessäule', 'Brown', 'property', 60, 4, 50, 50, 30),
      (4, 'Steuer', null, 'special', 0, 0, 0, 0, 0),
      (5, 'Bahnhof Zoo', 'White', 'station', 200, 25, 0, 0, 100),
      (6, 'Oranienburger Straße', 'Light Blue', 'property', 100, 6, 50, 50, 50),
      (7, 'Chance', null, 'special', 0, 0, 0, 0, 0),
      (8, 'Simon-Dach-Straße', 'Light Blue', 'property', 100, 6, 50, 50, 50),
      (9, 'Die Hackeschen Höfe', 'Light Blue', 'property', 120, 8, 50, 50, 60),
      (10, 'Jail', null, 'special', 0, 0, 0, 0, 0),
      (11, 'Tiergarten', 'Pink', 'property', 140, 10, 100, 100, 70),
      (12, 'Sony Center', 'White', 'utility', 150, 10, 0, 0, 75),
      (13, 'Olympiastadion', 'Pink', 'property', 140, 10, 100, 100, 70),
      (14, 'Strandbad Wannsee', 'Pink', 'property', 160, 12, 100, 100, 80),
      (15, 'Flughafen Schönefeld', 'White', 'station', 200, 25, 0, 0, 100),
      (16, 'Brandenburger Tor', 'Orange', 'property', 180, 14, 100, 100, 90),
      (17, 'Gemeinschaftsfeld', null, 'special', 0, 0, 0, 0, 0),
      (18, 'Gedächtniskirche', 'Orange', 'property', 180, 14, 100, 100, 90),
      (19, 'Reichstag', 'Orange', 'property', 200, 16, 100, 100, 100),
      (20, 'Frei Parken', null, 'special', 0, 0, 0, 0, 0),
      (21, 'Tränenpalast', 'Red', 'property', 220, 18, 150, 150, 110),
      (22, 'Chance', null, 'special', 0, 0, 0, 0, 0),
      (23, 'Museumsinsel', 'Red', 'property', 220, 18, 150, 150, 110),
      (24, 'Philharmonie', 'Red', 'property', 240, 20, 150, 150, 120),
      (25, 'Lehrter Bahnhof', 'White', 'station', 200, 25, 0, 0, 100),
      (26, 'Kollwitzplatz', 'Yellow', 'property', 260, 22, 150, 150, 130),
      (27, 'Gendarmenmarkt', 'Yellow', 'property', 260, 22, 150, 150, 130),
      (28, 'Fernsehturm', 'White', 'utility', 150, 10, 0, 0, 75),
      (29, 'Pariser Platz', 'Yellow', 'property', 280, 24, 150, 150, 140),
      (30, 'Gehe ins Gefängnis', null, 'special', 0, 0, 0, 0, 0),
      (31, 'Kurfürstendamm', 'Green', 'property', 300, 26, 200, 200, 150),
      (32, 'Unter den Linden', 'Green', 'property', 300, 26, 200, 200, 150),
      (33, 'Gemeinschaftsfeld', null, 'special', 0, 0, 0, 0, 0),
      (34, 'Friedrichstraße', 'Green', 'property', 320, 28, 200, 200, 160),
      (35, 'Flughafen Tegel', 'White', 'station', 200, 25, 0, 0, 100),
      (36, 'Chance', null, 'special', 0, 0, 0, 0, 0),
      (37, 'KaDeWe', 'Dark Blue', 'property', 350, 35, 200, 200, 175),
      (38, 'Luxussteuer', null, 'special', 0, 0, 0, 0, 0),
      (39, 'Schlossstraße', 'Dark Blue', 'property', 400, 50, 200, 200, 200)
  ) as b(position, name, group_name, type, price, rent_base, house_price, hotel_price, mortgage_value);
end;
$$;

create or replace function public.seed_berlin_board(game_id_input uuid)
returns void
language sql
security definer
as $$
  select berlin_v2.seed_berlin_board(game_id_input);
$$;

create or replace function berlin_v2.accept_trade_atomic(trade_id_input uuid)
returns table(success boolean, message text)
language plpgsql
security definer
as $$
declare
  trade_row berlin_v2.trades%rowtype;
  offered_property uuid;
  requested_property uuid;
begin
  select * into trade_row
  from berlin_v2.trades
  where id = trade_id_input
  for update;

  if not found then
    return query select false, 'Trade not found';
    return;
  end if;

  if trade_row.status <> 'pending' then
    return query select false, 'Trade is not pending';
    return;
  end if;

  update berlin_v2.trades
  set status = 'accepted'
  where id = trade_row.id;

  if array_length(trade_row.offered_properties, 1) is not null then
    foreach offered_property in array trade_row.offered_properties loop
      update berlin_v2.properties
      set owner_id = trade_row.to_player
      where id = offered_property
        and game_id = trade_row.game_id;
    end loop;
  end if;

  if array_length(trade_row.requested_properties, 1) is not null then
    foreach requested_property in array trade_row.requested_properties loop
      update berlin_v2.properties
      set owner_id = trade_row.from_player
      where id = requested_property
        and game_id = trade_row.game_id;
    end loop;
  end if;

  return query select true, 'Trade accepted';
end;
$$;

create or replace function public.accept_trade_atomic(trade_id_input uuid)
returns table(success boolean, message text)
language sql
security definer
as $$
  select * from berlin_v2.accept_trade_atomic(trade_id_input);
$$;

alter publication supabase_realtime add table berlin_v2.properties;
alter publication supabase_realtime add table berlin_v2.player_properties;
alter publication supabase_realtime add table berlin_v2.trades;
