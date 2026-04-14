import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { ensureV2Profile, fetchTrades } from "../lib/supabaseQueries";
import { subscribeTable, unsubscribeTable } from "./realtimeSubscriptions";
import { useGameStore } from "./gameStore";
import { usePropertyStore } from "./propertyStore";
import type { Result, Trade } from "../types/berlin";

type CreateTradePayload = {
  gameId: string;
  fromUserId: string;
  toUserId: string;
  offeredMoney: number;
  requestedMoney: number;
  offeredProperties: string[];
  requestedProperties: string[];
};

/** Result from the server-side accept_trade_atomic RPC */
type AtomicResult = {
  success: boolean;
  message: string;
  buildings_sold_refund?: number;
  buildings_sold_to_player?: string;
};

type TradeState = {
  gameId: string | null;
  trades: Trade[];
  loading: boolean;
  error: string | null;
  initialize: (gameId: string, userId: string, username: string) => Promise<Result<Trade[]>>;
  refresh: () => Promise<Result<Trade[]>>;
  createTrade: (payload: CreateTradePayload) => Promise<Result<Trade>>;
  rejectTrade: (tradeId: string, actorId: string) => Promise<Result<Trade>>;
  acceptTrade: (tradeId: string, actorId: string) => Promise<Result<Trade>>;
  disposeRealtime: () => Promise<void>;
};

function fail<T>(error: string): Result<T> {
  return { success: false, error };
}

function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export const useTradeStore = create<TradeState>((set, get) => ({
  gameId: null,
  trades: [],
  loading: false,
  error: null,

  initialize: async (gameId, userId, username) => {
    set({ gameId, loading: true, error: null });
    const ensured = await ensureV2Profile(userId, username);
    if (!ensured.success) {
      set({ loading: false, error: ensured.error });
      return fail(ensured.error);
    }

    const refreshResult = await get().refresh();
    if (!refreshResult.success) {
      set({ loading: false, error: refreshResult.error });
      return fail(refreshResult.error);
    }

    subscribeTable("public", "berlin_trades", `game_id=eq.${gameId}`, () => {
      get().refresh();
    });

    set({ loading: false });
    return refreshResult;
  },

  refresh: async () => {
    const gameId = get().gameId;
    if (!gameId) return fail("Trade store is not initialized");
    const result = await fetchTrades(gameId);
    if (!result.success) {
      set({ error: result.error });
      return fail(result.error);
    }
    set({ trades: result.data, error: null });
    return ok(result.data);
  },

  createTrade: async (payload) => {
    if (payload.fromUserId === payload.toUserId) return fail("Cannot trade with yourself");
    if (payload.offeredMoney < 0 || payload.requestedMoney < 0) return fail("Money cannot be negative");

    const { data, error } = await supabase
      .from("berlin_trades")
      .insert({
        game_id: payload.gameId,
        from_user_id: payload.fromUserId,
        to_user_id: payload.toUserId,
        offered_money: payload.offeredMoney,
        requested_money: payload.requestedMoney,
        offered_properties: payload.offeredProperties,
        requested_properties: payload.requestedProperties,
        status: "pending",
      })
      .select("*")
      .single();

    if (error || !data) return fail(error?.message ?? "Trade creation failed");
    await get().refresh();
    return ok(data as Trade);
  },

  rejectTrade: async (tradeId, actorId) => {
    const existing = get().trades.find((trade) => trade.id === tradeId);
    if (!existing) return fail("Trade not found");
    if (existing.from_user_id !== actorId && existing.to_user_id !== actorId) {
      return fail("Only trade participants can reject");
    }

    const { data, error } = await supabase
      .from("berlin_trades")
      .update({ status: "rejected" })
      .eq("id", tradeId)
      .select("*")
      .single();
    if (error || !data) return fail(error?.message ?? "Reject failed");
    await get().refresh();
    return ok(data as Trade);
  },

  acceptTrade: async (tradeId, actorId) => {
    const trade = get().trades.find((item) => item.id === tradeId);
    if (!trade) return fail("Trade not found");
    if (trade.to_user_id !== actorId) return fail("Only recipient can accept");
    if (trade.status !== "pending") return fail("Trade is not pending");

    // The server-side function handles:
    // 1. Marking the trade as accepted
    // 2. Transferring property ownership
    // 3. Auto-selling buildings on partial color-group trades (returning refund info)
    const { data, error } = await supabase.rpc("accept_trade_atomic", {
      trade_id_input: tradeId,
    });
    if (error) return fail(error.message);

    const settlement: AtomicResult = Array.isArray(data) ? data[0] : data;
    if (!settlement?.success) {
      return fail(settlement?.message ?? "Trade settlement failed");
    }

    const legacyGame = useGameStore.getState().currentGame;
    if (legacyGame) {
      // Pay offered money from sender to recipient
      if (trade.offered_money > 0) {
        await useGameStore.getState().makeTransaction({
          gameId: legacyGame.id,
          type: "toPlayer",
          amount: trade.offered_money,
          fromUserId: trade.from_user_id,
          toUserId: trade.to_user_id,
        });
      }
      // Pay requested money from recipient to sender
      if (trade.requested_money > 0) {
        await useGameStore.getState().makeTransaction({
          gameId: legacyGame.id,
          type: "toPlayer",
          amount: trade.requested_money,
          fromUserId: trade.to_user_id,
          toUserId: trade.from_user_id,
        });
      }

      // If the server auto-sold buildings, pay the building refund back to the
      // original owner of each property. The server returns:
      //   buildings_sold_refund  – total refund amount
      //   buildings_sold_to_player – the player who gets the refund (the original owner)
      // Note: this may be split between from_player and to_player if both sides had buildings.
      // The SQL function returns a single aggregated refund with the player who receives it.
      if (settlement.buildings_sold_refund && settlement.buildings_sold_refund > 0
          && settlement.buildings_sold_to_player) {
        await useGameStore.getState().makeTransaction({
          gameId: legacyGame.id,
          type: "fromBank",
          amount: settlement.buildings_sold_refund,
          toUserId: settlement.buildings_sold_to_player,
        });
      }
    }

    // Refresh local property state to reflect new ownership
    await usePropertyStore.getState().refresh();

    await get().refresh();
    const accepted = get().trades.find((item) => item.id === tradeId);
    if (!accepted) return fail("Accepted trade missing after refresh");
    return ok(accepted);
  },

  disposeRealtime: async () => {
    const gameId = get().gameId;
    if (!gameId) return;
    await unsubscribeTable("public", "berlin_trades", `game_id=eq.${gameId}`);
  },
}));
