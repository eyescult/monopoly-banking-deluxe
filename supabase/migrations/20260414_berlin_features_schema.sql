-- =============================================================================
-- BERLIN FEATURES – Public Schema Migration
-- All tables live in the PUBLIC schema with a "berlin_" prefix so they are
-- automatically accessible via Supabase REST/Realtime without any dashboard
-- configuration changes.
--
-- Replaces: 20260413_berlin_property_trading_system.sql
--           20260413_berlin_v2_feature_schema.sql
--           20260414_berlin_features_schema.sql (berlin_v2 schema version)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Enum types (idempotent) ----------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'berlin_property_type') THEN
    CREATE TYPE public.berlin_property_type AS ENUM
      ('property', 'station', 'airport', 'utility', 'special');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'berlin_trade_status') THEN
    CREATE TYPE public.berlin_trade_status AS ENUM
      ('pending', 'accepted', 'rejected');
  END IF;
END;
$$;

-- 2. Tables ---------------------------------------------------------------

-- 2a. berlin_games: links to public.games via its TEXT id (game code)
CREATE TABLE IF NOT EXISTS public.berlin_games (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT        UNIQUE NOT NULL,   -- matches public.games.id (TEXT)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2b. berlin_properties: one row per board square per game
CREATE TABLE IF NOT EXISTS public.berlin_properties (
  id             UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID                        NOT NULL REFERENCES public.berlin_games(id) ON DELETE CASCADE,
  position       INT                         NOT NULL CHECK (position BETWEEN 0 AND 39),
  name           TEXT                        NOT NULL,
  group_name     TEXT,
  type           public.berlin_property_type NOT NULL,
  price          INT                         NOT NULL DEFAULT 0 CHECK (price          >= 0),
  rent_base      INT                         NOT NULL DEFAULT 0 CHECK (rent_base      >= 0),
  house_price    INT                         NOT NULL DEFAULT 0 CHECK (house_price    >= 0),
  hotel_price    INT                         NOT NULL DEFAULT 0 CHECK (hotel_price    >= 0),
  mortgage_value INT                         NOT NULL DEFAULT 0 CHECK (mortgage_value >= 0),
  owner_id       UUID                        REFERENCES public.users(id) ON DELETE SET NULL,
  houses         INT                         NOT NULL DEFAULT 0 CHECK (houses BETWEEN 0 AND 4),
  is_hotel       BOOLEAN                     NOT NULL DEFAULT FALSE,
  is_mortgaged   BOOLEAN                     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ                 NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ                 NOT NULL DEFAULT now(),
  UNIQUE (game_id, position)
);

-- 2c. berlin_player_properties: denormalised ownership for realtime subscriptions
CREATE TABLE IF NOT EXISTS public.berlin_player_properties (
  user_id     UUID NOT NULL REFERENCES public.users(id)               ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.berlin_properties(id)   ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);

-- 2d. berlin_trades: trade offers between players
CREATE TABLE IF NOT EXISTS public.berlin_trades (
  id                   UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id              UUID                       NOT NULL REFERENCES public.berlin_games(id) ON DELETE CASCADE,
  from_user_id         UUID                       NOT NULL REFERENCES public.users(id)        ON DELETE CASCADE,
  to_user_id           UUID                       NOT NULL REFERENCES public.users(id)        ON DELETE CASCADE,
  offered_money        INT                        NOT NULL DEFAULT 0 CHECK (offered_money   >= 0),
  requested_money      INT                        NOT NULL DEFAULT 0 CHECK (requested_money >= 0),
  offered_properties   UUID[]                     NOT NULL DEFAULT '{}',
  requested_properties UUID[]                     NOT NULL DEFAULT '{}',
  status               public.berlin_trade_status NOT NULL DEFAULT 'pending',
  created_at           TIMESTAMPTZ                NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ                NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);

-- 3. Indexes --------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_berlin_games_code                       ON public.berlin_games(code);
CREATE INDEX IF NOT EXISTS idx_berlin_properties_game_id               ON public.berlin_properties(game_id);
CREATE INDEX IF NOT EXISTS idx_berlin_properties_owner_id              ON public.berlin_properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_berlin_player_properties_user_id        ON public.berlin_player_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_berlin_player_properties_property_id    ON public.berlin_player_properties(property_id);
CREATE INDEX IF NOT EXISTS idx_berlin_trades_game_id                   ON public.berlin_trades(game_id);
CREATE INDEX IF NOT EXISTS idx_berlin_trades_from_user_id              ON public.berlin_trades(from_user_id);
CREATE INDEX IF NOT EXISTS idx_berlin_trades_to_user_id                ON public.berlin_trades(to_user_id);
CREATE INDEX IF NOT EXISTS idx_berlin_trades_status                    ON public.berlin_trades(status);

-- 4. Triggers -------------------------------------------------------------

-- 4a. updated_at (matches supabase-schema.sql pattern exactly)
-- Reuse the existing public.update_updated_at_column() function.
DROP TRIGGER IF EXISTS update_berlin_games_updated_at      ON public.berlin_games;
DROP TRIGGER IF EXISTS update_berlin_properties_updated_at ON public.berlin_properties;
DROP TRIGGER IF EXISTS update_berlin_trades_updated_at     ON public.berlin_trades;

CREATE TRIGGER update_berlin_games_updated_at
  BEFORE UPDATE ON public.berlin_games
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_berlin_properties_updated_at
  BEFORE UPDATE ON public.berlin_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_berlin_trades_updated_at
  BEFORE UPDATE ON public.berlin_trades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4b. Sync berlin_player_properties when owner_id changes on berlin_properties
CREATE OR REPLACE FUNCTION public.berlin_sync_owner()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.berlin_player_properties WHERE property_id = NEW.id;
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.berlin_player_properties (user_id, property_id)
    VALUES (NEW.owner_id, NEW.id)
    ON CONFLICT (user_id, property_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_berlin_sync_owner ON public.berlin_properties;
CREATE TRIGGER trg_berlin_sync_owner
AFTER INSERT OR UPDATE OF owner_id ON public.berlin_properties
FOR EACH ROW EXECUTE FUNCTION public.berlin_sync_owner();

-- 5. Row Level Security ---------------------------------------------------

ALTER TABLE public.berlin_games             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.berlin_properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.berlin_player_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.berlin_trades            ENABLE ROW LEVEL SECURITY;

-- berlin_games: any authenticated user can read/create
DROP POLICY IF EXISTS "berlin_games_select" ON public.berlin_games;
DROP POLICY IF EXISTS "berlin_games_insert" ON public.berlin_games;
CREATE POLICY "berlin_games_select" ON public.berlin_games FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "berlin_games_insert" ON public.berlin_games FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- berlin_properties: all players can read; only owner can update (buy/build handled by RPC)
DROP POLICY IF EXISTS "berlin_properties_select" ON public.berlin_properties;
DROP POLICY IF EXISTS "berlin_properties_insert" ON public.berlin_properties;
DROP POLICY IF EXISTS "berlin_properties_update" ON public.berlin_properties;
CREATE POLICY "berlin_properties_select" ON public.berlin_properties FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "berlin_properties_insert" ON public.berlin_properties FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "berlin_properties_update" ON public.berlin_properties FOR UPDATE
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- berlin_player_properties: all players can read (needed for board overview)
DROP POLICY IF EXISTS "berlin_pp_select" ON public.berlin_player_properties;
DROP POLICY IF EXISTS "berlin_pp_all"    ON public.berlin_player_properties;
CREATE POLICY "berlin_pp_select" ON public.berlin_player_properties FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "berlin_pp_all"    ON public.berlin_player_properties FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- berlin_trades: only visible to participants
DROP POLICY IF EXISTS "berlin_trades_select" ON public.berlin_trades;
DROP POLICY IF EXISTS "berlin_trades_insert" ON public.berlin_trades;
DROP POLICY IF EXISTS "berlin_trades_update" ON public.berlin_trades;
CREATE POLICY "berlin_trades_select" ON public.berlin_trades FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "berlin_trades_insert" ON public.berlin_trades FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "berlin_trades_update" ON public.berlin_trades FOR UPDATE
  USING  (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- 6. Realtime -------------------------------------------------------------

ALTER TABLE public.berlin_properties        REPLICA IDENTITY FULL;
ALTER TABLE public.berlin_player_properties REPLICA IDENTITY FULL;
ALTER TABLE public.berlin_trades            REPLICA IDENTITY FULL;
ALTER TABLE public.berlin_games             REPLICA IDENTITY FULL;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.berlin_properties;
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.berlin_player_properties;
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.berlin_trades;
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.berlin_games;
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- 7. Function: seed_berlin_board ------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_berlin_board(game_id_input UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.berlin_properties WHERE game_id = game_id_input) THEN RETURN; END IF;

  INSERT INTO public.berlin_properties
    (game_id, position, name, group_name, type, price, rent_base, house_price, hotel_price, mortgage_value)
  SELECT game_id_input, b.pos, b.nm, b.grp, b.tp::public.berlin_property_type,
         b.pr, b.rb, b.hp, b.htp, b.mv
  FROM (VALUES
    -- Specials
    ( 0,'Start',                NULL,         'special',          0,       0,       0,       0,       0),
    ( 2,'Gemeinschaftsfeld',    NULL,         'special',          0,       0,       0,       0,       0),
    ( 4,'Steuer',               NULL,         'special',          0,       0,       0,       0,       0),
    ( 7,'Chance',               NULL,         'special',          0,       0,       0,       0,       0),
    (10,'Jail',                 NULL,         'special',          0,       0,       0,       0,       0),
    (17,'Gemeinschaftsfeld',    NULL,         'special',          0,       0,       0,       0,       0),
    (20,'Frei Parken',          NULL,         'special',          0,       0,       0,       0,       0),
    (22,'Chance',               NULL,         'special',          0,       0,       0,       0,       0),
    (30,'Gehe ins Gefängnis',   NULL,         'special',          0,       0,       0,       0,       0),
    (33,'Gemeinschaftsfeld',    NULL,         'special',          0,       0,       0,       0,       0),
    (36,'Chance',               NULL,         'special',          0,       0,       0,       0,       0),
    (38,'Luxussteuer',          NULL,         'special',          0,       0,       0,       0,       0),
    -- Brown (Braun) – 600K
    ( 1,'Checkpoint Charlie',   'Brown',      'property',    600000,   20000,  500000,  500000,  300000),
    ( 3,'Siegessäule',          'Brown',      'property',    600000,   40000,  500000,  500000,  300000),
    -- Light Blue (Hellblau) – 1.0–1.2 Mio.
    ( 6,'Oranienburger Straße', 'Light Blue', 'property',   1000000,   60000,  500000,  500000,  500000),
    ( 8,'Simon-Dach-Straße',    'Light Blue', 'property',   1000000,   60000,  500000,  500000,  500000),
    ( 9,'Die Hackeschen Höfe',  'Light Blue', 'property',   1200000,   80000,  500000,  500000,  600000),
    -- Pink (Rosa) – 1.4–1.6 Mio.
    (11,'Tiergarten',           'Pink',       'property',   1400000,  100000, 1000000, 1000000,  700000),
    (13,'Olympiastadion',       'Pink',       'property',   1400000,  100000, 1000000, 1000000,  700000),
    (14,'Strandbad Wannsee',    'Pink',       'property',   1600000,  120000, 1000000, 1000000,  800000),
    -- Orange – 1.8–2.0 Mio.
    (16,'Brandenburger Tor',    'Orange',     'property',   1800000,  140000, 1000000, 1000000,  900000),
    (18,'Gedächtniskirche',     'Orange',     'property',   1800000,  140000, 1000000, 1000000,  900000),
    (19,'Reichstag',            'Orange',     'property',   2000000,  160000, 1000000, 1000000, 1000000),
    -- Red (Rot) – 2.2–2.4 Mio.
    (21,'Tränenpalast',         'Red',        'property',   2200000,  180000, 1500000, 1500000, 1100000),
    (23,'Museumsinsel',         'Red',        'property',   2200000,  180000, 1500000, 1500000, 1100000),
    (24,'Philharmonie',         'Red',        'property',   2400000,  200000, 1500000, 1500000, 1200000),
    -- Yellow (Gelb) – 2.6–2.8 Mio.
    (26,'Kollwitzplatz',        'Yellow',     'property',   2600000,  220000, 1500000, 1500000, 1300000),
    (27,'Gendarmenmarkt',       'Yellow',     'property',   2600000,  220000, 1500000, 1500000, 1300000),
    (29,'Pariser Platz',        'Yellow',     'property',   2800000,  240000, 1500000, 1500000, 1400000),
    -- Green (Grün) – 3.0–3.2 Mio.
    (31,'Kurfürstendamm',       'Green',      'property',   3000000,  260000, 2000000, 2000000, 1500000),
    (32,'Unter den Linden',     'Green',      'property',   3000000,  260000, 2000000, 2000000, 1500000),
    (34,'Friedrichstraße',      'Green',      'property',   3200000,  280000, 2000000, 2000000, 1600000),
    -- Dark Blue (Dunkelblau) – 3.5 / 4.0 Mio.
    (37,'KaDeWe',               'Dark Blue',  'property',   3500000,  350000, 2000000, 2000000, 1750000),
    (39,'Schlossstraße',        'Dark Blue',  'property',   4000000,  500000, 2000000, 2000000, 2000000),
    -- Railway stations 🚂 – 2.0 Mio.
    ( 5,'Bahnhof Zoo',          'White',      'station',    2000000,  250000,       0,       0, 1000000),
    (25,'Lehrter Bahnhof',      'White',      'station',    2000000,  250000,       0,       0, 1000000),
    -- Airports ✈️ – 2.0 Mio.
    (15,'Flughafen Schönefeld', 'White',      'airport',    2000000,  250000,       0,       0, 1000000),
    (35,'Flughafen Tegel',      'White',      'airport',    2000000,  250000,       0,       0, 1000000),
    -- Utilities ⚡ (Medienzentrum) – 1.5 Mio.
    (12,'Sony Center',          'White',      'utility',    1500000,  100000,       0,       0,  750000),
    (28,'Fernsehturm',          'White',      'utility',    1500000,  100000,       0,       0,  750000)
  ) AS b(pos,nm,grp,tp,pr,rb,hp,htp,mv);
END; $$;

-- 8. Function: buy_property_atomic ----------------------------------------

CREATE OR REPLACE FUNCTION public.buy_property_atomic(
  property_id_input UUID,
  buyer_user_id     UUID
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner_id UUID;
  v_type     TEXT;
BEGIN
  SELECT owner_id, type::TEXT INTO v_owner_id, v_type
  FROM   public.berlin_properties WHERE id = property_id_input FOR UPDATE;

  IF NOT FOUND           THEN RETURN QUERY SELECT FALSE::BOOLEAN, 'Property not found'::TEXT;  RETURN; END IF;
  IF v_owner_id IS NOT NULL THEN RETURN QUERY SELECT FALSE::BOOLEAN, 'Already owned'::TEXT;    RETURN; END IF;
  IF v_type = 'special'  THEN RETURN QUERY SELECT FALSE::BOOLEAN, 'Not purchasable'::TEXT;     RETURN; END IF;

  UPDATE public.berlin_properties SET owner_id = buyer_user_id WHERE id = property_id_input;
  RETURN QUERY SELECT TRUE::BOOLEAN, 'Property purchased'::TEXT;
END; $$;

-- 9. Function: accept_trade_atomic ----------------------------------------

CREATE OR REPLACE FUNCTION public.accept_trade_atomic(trade_id_input UUID)
RETURNS TABLE (
  success                  BOOLEAN,
  message                  TEXT,
  buildings_sold_refund    INT,
  buildings_sold_to_user   UUID
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trade_id        UUID;
  v_game_id         UUID;
  v_from_user_id    UUID;
  v_to_user_id      UUID;
  v_status          public.berlin_trade_status;
  v_offered_props   UUID[];
  v_requested_props UUID[];

  v_prop_id         UUID;
  v_owner_id        UUID;
  v_group_name      TEXT;
  v_prop_type       public.berlin_property_type;
  v_houses          INT;
  v_is_hotel        BOOLEAN;
  v_house_price     INT;
  v_hotel_price     INT;

  v_from_refund     INT := 0;
  v_to_refund       INT := 0;
  v_all_group_ids   UUID[];
  v_trading_ids     UUID[];
  v_full_group      BOOLEAN;
  v_bld_refund      INT;
BEGIN
  SELECT id, game_id, from_user_id, to_user_id, status,
         offered_properties, requested_properties
  INTO   v_trade_id, v_game_id, v_from_user_id, v_to_user_id, v_status,
         v_offered_props, v_requested_props
  FROM   public.berlin_trades WHERE id = trade_id_input FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE::BOOLEAN,'Trade not found'::TEXT, 0::INT, NULL::UUID; RETURN;
  END IF;
  IF v_status <> 'pending' THEN
    RETURN QUERY SELECT FALSE::BOOLEAN,'Trade is not pending'::TEXT, 0::INT, NULL::UUID; RETURN;
  END IF;

  UPDATE public.berlin_trades SET status = 'accepted' WHERE id = v_trade_id;

  -- from_user_id → to_user_id
  IF array_length(v_offered_props, 1) IS NOT NULL THEN
    FOREACH v_prop_id IN ARRAY v_offered_props LOOP
      SELECT owner_id, group_name, type, houses, is_hotel, house_price, hotel_price
      INTO   v_owner_id, v_group_name, v_prop_type, v_houses, v_is_hotel, v_house_price, v_hotel_price
      FROM   public.berlin_properties WHERE id = v_prop_id AND game_id = v_game_id FOR UPDATE;
      IF NOT FOUND THEN CONTINUE; END IF;

      IF (v_houses > 0 OR v_is_hotel) AND v_group_name IS NOT NULL THEN
        SELECT array_agg(id) INTO v_all_group_ids FROM public.berlin_properties
          WHERE game_id = v_game_id AND group_name = v_group_name
            AND type = 'property' AND owner_id = v_from_user_id;
        SELECT array_agg(p.id) INTO v_trading_ids FROM public.berlin_properties p
          WHERE p.id = ANY(v_offered_props) AND p.group_name = v_group_name AND p.type = 'property';
        v_full_group := (v_all_group_ids IS NOT NULL AND v_trading_ids IS NOT NULL AND
          (SELECT bool_and(gid = ANY(v_trading_ids)) FROM unnest(v_all_group_ids) AS gid));
        IF NOT v_full_group THEN
          v_bld_refund := v_houses*(v_house_price/2) + CASE WHEN v_is_hotel THEN v_hotel_price/2 ELSE 0 END;
          v_from_refund := v_from_refund + v_bld_refund;
          UPDATE public.berlin_properties SET houses=0, is_hotel=FALSE WHERE id=v_prop_id;
        END IF;
      END IF;
      UPDATE public.berlin_properties SET owner_id=v_to_user_id WHERE id=v_prop_id AND game_id=v_game_id;
    END LOOP;
  END IF;

  -- to_user_id → from_user_id
  IF array_length(v_requested_props, 1) IS NOT NULL THEN
    FOREACH v_prop_id IN ARRAY v_requested_props LOOP
      SELECT owner_id, group_name, type, houses, is_hotel, house_price, hotel_price
      INTO   v_owner_id, v_group_name, v_prop_type, v_houses, v_is_hotel, v_house_price, v_hotel_price
      FROM   public.berlin_properties WHERE id=v_prop_id AND game_id=v_game_id FOR UPDATE;
      IF NOT FOUND THEN CONTINUE; END IF;

      IF (v_houses > 0 OR v_is_hotel) AND v_group_name IS NOT NULL THEN
        SELECT array_agg(id) INTO v_all_group_ids FROM public.berlin_properties
          WHERE game_id=v_game_id AND group_name=v_group_name AND type='property' AND owner_id=v_to_user_id;
        SELECT array_agg(p.id) INTO v_trading_ids FROM public.berlin_properties p
          WHERE p.id=ANY(v_requested_props) AND p.group_name=v_group_name AND p.type='property';
        v_full_group := (v_all_group_ids IS NOT NULL AND v_trading_ids IS NOT NULL AND
          (SELECT bool_and(gid=ANY(v_trading_ids)) FROM unnest(v_all_group_ids) AS gid));
        IF NOT v_full_group THEN
          v_bld_refund := v_houses*(v_house_price/2) + CASE WHEN v_is_hotel THEN v_hotel_price/2 ELSE 0 END;
          v_to_refund := v_to_refund + v_bld_refund;
          UPDATE public.berlin_properties SET houses=0, is_hotel=FALSE WHERE id=v_prop_id;
        END IF;
      END IF;
      UPDATE public.berlin_properties SET owner_id=v_from_user_id WHERE id=v_prop_id AND game_id=v_game_id;
    END LOOP;
  END IF;

  IF v_from_refund > 0 THEN
    RETURN QUERY SELECT TRUE::BOOLEAN,'Trade accepted'::TEXT, v_from_refund, v_from_user_id;
  ELSIF v_to_refund > 0 THEN
    RETURN QUERY SELECT TRUE::BOOLEAN,'Trade accepted'::TEXT, v_to_refund, v_to_user_id;
  ELSE
    RETURN QUERY SELECT TRUE::BOOLEAN,'Trade accepted'::TEXT, 0::INT, NULL::UUID;
  END IF;
END; $$;

-- 10. ensure_berlin_game --------------------------------------------------
-- Called by the frontend instead of manually managing berlin_games rows.

CREATE OR REPLACE FUNCTION public.ensure_berlin_game(game_code TEXT)
RETURNS TABLE (game_id UUID, is_new BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_code TEXT := upper(trim(game_code));
  v_id   UUID;
  v_new  BOOLEAN := FALSE;
BEGIN
  SELECT id INTO v_id FROM public.berlin_games WHERE code = v_code;
  IF NOT FOUND THEN
    INSERT INTO public.berlin_games (code) VALUES (v_code)
    RETURNING id INTO v_id;
    PERFORM public.seed_berlin_board(v_id);
    v_new := TRUE;
  END IF;
  RETURN QUERY SELECT v_id, v_new;
END; $$;
