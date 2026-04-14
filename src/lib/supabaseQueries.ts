import { supabase } from "./supabase";
import type { Property, Result, Trade, V2Game } from "../types/berlin";

/**
 * Finds or creates a berlin_games row for the given legacy game code.
 * Uses the ensure_berlin_game() RPC so seeding happens server-side.
 */
export async function ensureV2GameByCode(code: string): Promise<Result<V2Game>> {
  const { data, error } = await supabase.rpc("ensure_berlin_game", {
    game_code: code,
  });
  if (error || !data || data.length === 0) {
    return { success: false, error: error?.message ?? "Game lookup failed" };
  }
  const row = data[0] as { game_id: string; is_new: boolean };

  // Fetch the full game row so callers get the same shape as before
  const { data: game, error: fetchErr } = await supabase
    .from("berlin_games")
    .select("*")
    .eq("id", row.game_id)
    .single();

  if (fetchErr || !game) return { success: false, error: fetchErr?.message ?? "Game fetch failed" };
  return { success: true, data: game as V2Game };
}

/**
 * No-op in the public-schema version: players are identified directly by
 * public.users.id, so no separate profile record is needed.
 */
export async function ensureV2Profile(
  _userId: string,
  _username: string
): Promise<Result<{ user_id: string }>> {
  return { success: true, data: { user_id: _userId } };
}

/** Fetch all properties for a game, ordered by board position. */
export async function fetchProperties(gameId: string): Promise<Result<Property[]>> {
  const { data, error } = await supabase
    .from("berlin_properties")
    .select("*")
    .eq("game_id", gameId)
    .order("position", { ascending: true });

  if (error || !data) return { success: false, error: error?.message ?? "Properties fetch failed" };
  return { success: true, data: data as Property[] };
}

/** Fetch all trades visible to the current user for a given game. */
export async function fetchTrades(gameId: string): Promise<Result<Trade[]>> {
  const { data, error } = await supabase
    .from("berlin_trades")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });

  if (error || !data) return { success: false, error: error?.message ?? "Trades fetch failed" };
  return { success: true, data: data as Trade[] };
}
