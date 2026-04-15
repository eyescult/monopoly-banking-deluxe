import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { ensureV2GameByCode, ensureV2Profile, fetchProperties } from "../lib/supabaseQueries";
import { subscribeTable, unsubscribeTable } from "./realtimeSubscriptions";
import { estimatePropertyWorth } from "../services/rentEngine";
import type { Property, Result } from "../types/berlin";
import { useGameStore } from "./gameStore";
import { useAuthStore } from "./authStore";

type PlayerLike = {
  user_id: string;
  balance: number;
  bankrupt_timestamp?: string | null;
};

type PropertyState = {
  v2GameId: string | null;
  properties: Property[];
  loading: boolean;
  error: string | null;
  bankruptPlayers: Record<string, boolean>;
  initForLegacyGame: (legacyCode: string, userId: string, username: string) => Promise<Result<string>>;
  refresh: () => Promise<Result<Property[]>>;
  buyProperty: (propertyId: string, buyerId: string) => Promise<Result<Property>>;
  sellProperty: (propertyId: string, sellerId: string) => Promise<Result<Property>>;
  buyHouse: (propertyId: string, playerId: string) => Promise<Result<Property>>;
  sellHouse: (propertyId: string, playerId: string) => Promise<Result<Property>>;
  toggleMortgage: (propertyId: string, playerId: string) => Promise<Result<Property>>;
  sendToPot: (playerId: string, amount: number) => Promise<Result<null>>;
  collectPotIfLanding: (playerId: string) => Promise<Result<number>>;
  checkBankruptcy: (playerId: string) => Result<{ bankrupt: boolean; netWorth: number }>;
  ownsFullColorGroup: (playerId: string, groupName: string) => boolean;
  disposeRealtime: () => Promise<void>;
};

function fail<T>(error: string): Result<T> {
  return { success: false, error };
}

function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

async function updateProperty(propertyId: string, patch: Partial<Property>): Promise<Result<Property>> {
  const { data, error } = await supabase
    .from("berlin_properties")
    .update(patch)
    .eq("id", propertyId)
    .select("*")
    .single();

  if (error || !data) return fail(error?.message ?? "Property update failed");
  return ok(data as Property);
}

function getLegacyPlayer(playerId: string): PlayerLike | null {
  const game = useGameStore.getState().currentGame;
  if (!game?.players) return null;
  return game.players.find((p: PlayerLike) => p.user_id === playerId) ?? null;
}

/** Returns the hex color for a Monopoly color group name. */
export function getGroupColor(groupName: string | null): string {
  if (!groupName) return "#888888";
  const map: Record<string, string> = {
    Brown: "#8B4513",
    "Light Blue": "#87CEEB",
    Pink: "#FF69B4",
    Orange: "#FFA500",
    Red: "#CC0000",
    Yellow: "#FFD700",
    Green: "#006400",
    "Dark Blue": "#00008B",
    White: "#AAAAAA", // stations, airports & utilities
    "Trainstations/Airfields": "#AAAAAA",
    "Mediacenters": "#AAAAAA",
  };
  return map[groupName] ?? "#888888";
}

/** Returns the display emoji/symbol for a property type. */
export function getPropertyIcon(type: string): string {
  switch (type) {
    case "station": return "🚂";
    case "airport": return "✈️";
    case "utility":  return "⚡";
    default:         return "";
  }
}

export const usePropertyStore = create<PropertyState>((set, get) => ({
  v2GameId: null,
  properties: [],
  loading: false,
  error: null,
  bankruptPlayers: {},

  initForLegacyGame: async (legacyCode, userId, username) => {
    set({ loading: true, error: null });
    const profile = await ensureV2Profile(userId, username);
    if (!profile.success) {
      set({ loading: false, error: profile.error });
      return fail(profile.error);
    }

    const gameResult = await ensureV2GameByCode(legacyCode);
    if (!gameResult.success) {
      set({ loading: false, error: gameResult.error });
      return fail(gameResult.error);
    }

    set({ v2GameId: gameResult.data.id });
    const refreshResult = await get().refresh();
    if (!refreshResult.success) {
      set({ loading: false, error: refreshResult.error });
      return fail(refreshResult.error);
    }

    const filter = `game_id=eq.${gameResult.data.id}`;
    subscribeTable("public", "berlin_properties", filter, () => {
      get().refresh();
    });
    subscribeTable("public", "berlin_player_properties", "user_id=eq." + userId, () => {
      get().refresh();
    });

    set({ loading: false });
    return ok(gameResult.data.id);
  },

  refresh: async () => {
    const gameId = get().v2GameId;
    if (!gameId) return fail("v2 game is not initialized");
    const result = await fetchProperties(gameId);
    if (!result.success) {
      set({ error: result.error });
      return fail(result.error);
    }
    set({ properties: result.data, error: null });
    return ok(result.data);
  },

  ownsFullColorGroup: (playerId, groupName) => {
    if (!groupName) return false;
    const { properties } = get();
    const groupProps = properties.filter(
      (p) => p.group_name === groupName && p.type === "property"
    );
    if (groupProps.length === 0) return false;
    return groupProps.every((p) => p.owner_id === playerId);
  },

  buyProperty: async (propertyId, buyerId) => {
    const property = get().properties.find((item) => item.id === propertyId);
    if (!property) return fail("Property not found");
    if (property.owner_id) return fail("Property already owned");
    if (property.type === "special") return fail("This field is not purchasable");

    const buyer = getLegacyPlayer(buyerId);
    if (!buyer) return fail("Player not found");
    if (buyer.balance < property.price) return fail("Insufficient balance");

    // Use server-side RPC to bypass RLS (unowned properties have owner_id=null,
    // which means no user satisfies the UPDATE policy `auth.uid() = owner_id`)
    const { data, error } = await supabase.rpc("buy_property_atomic", {
      property_id_input: propertyId,
      buyer_user_id: buyerId,
    });

    if (error) return fail(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) return fail(result?.message ?? "Buy property failed");

    const txResult = await useGameStore.getState().makeTransaction({
      gameId: useGameStore.getState().currentGame?.id,
      type: "toBank",
      amount: property.price,
      fromUserId: buyerId,
    });
    if (!txResult.success) return fail(txResult.error ?? "Bank transfer failed");

    await get().refresh();
    // Return the updated property from local state
    const updated = get().properties.find((p) => p.id === propertyId);
    return ok(updated ?? property);
  },

  sellProperty: async (propertyId, sellerId) => {
    const property = get().properties.find((item) => item.id === propertyId);
    if (!property) return fail("Property not found");
    if (property.owner_id !== sellerId) return fail("Only owner can sell this property");
    if (property.is_mortgaged) return fail("Unmortgage the property before selling");

    // Calculate full refund: half of property price + half of all building values
    const buildingRefund =
      property.houses * Math.floor(property.house_price / 2) +
      (property.is_hotel ? Math.floor(property.hotel_price / 2) : 0);
    const propertyRefund = Math.floor(property.price / 2);
    const totalRefund = propertyRefund + buildingRefund;

    const propertyResult = await updateProperty(propertyId, {
      owner_id: null,
      houses: 0,
      is_hotel: false,
      is_mortgaged: false,
    });
    if (!propertyResult.success) return propertyResult;

    const txResult = await useGameStore.getState().makeTransaction({
      gameId: useGameStore.getState().currentGame?.id,
      type: "fromBank",
      amount: totalRefund,
      toUserId: sellerId,
    });
    if (!txResult.success) return fail(txResult.error ?? "Bank payout failed");

    await get().refresh();
    return propertyResult;
  },

  buyHouse: async (propertyId, playerId) => {
    const { properties } = get();
    const property = properties.find((item) => item.id === propertyId);
    if (!property) return fail("Property not found");
    if (property.owner_id !== playerId) return fail("Only owner can buy houses");
    if (property.type !== "property") return fail("Houses can only be built on street properties");
    if (property.is_mortgaged) return fail("Cannot build on a mortgaged property");
    if (property.is_hotel) return fail("Property already has a hotel");
    if (!property.group_name) return fail("Property has no color group");

    // Rule 1: Must own the full color group before building
    if (!get().ownsFullColorGroup(playerId, property.group_name)) {
      return fail("You must own the entire color group before building houses");
    }

    const groupProps = properties.filter(
      (p) => p.group_name === property.group_name && p.type === "property"
    );

    // Rule 1b: Cannot build if any property in the color group is mortgaged
    if (groupProps.some((p) => p.is_mortgaged)) {
      return fail("Cannot build houses while any property in the color group is mortgaged");
    }

    // Rule 2: Even-building rule – cannot build if another property in the group
    // already has more houses than this one (would create a gap > 1)
    const minHouses = Math.min(
      ...groupProps.filter((p) => !p.is_hotel).map((p) => p.houses)
    );
    if (property.houses > minHouses) {
      return fail(
        "Even building rule: you must build evenly across the color group. Build on a property with fewer houses first."
      );
    }

    const owner = getLegacyPlayer(playerId);
    if (!owner) return fail("Player not found");
    if (owner.balance < property.house_price) return fail("Insufficient balance");

    const nextHouses = property.houses + 1;
    const patch = nextHouses >= 5 ? { houses: 4, is_hotel: true } : { houses: nextHouses };
    const propertyResult = await updateProperty(propertyId, patch);
    if (!propertyResult.success) return propertyResult;

    const txResult = await useGameStore.getState().makeTransaction({
      gameId: useGameStore.getState().currentGame?.id,
      type: "toBank",
      amount: property.house_price,
      fromUserId: playerId,
    });
    if (!txResult.success) return fail(txResult.error ?? "House payment failed");

    await get().refresh();
    return propertyResult;
  },

  sellHouse: async (propertyId, playerId) => {
    const { properties } = get();
    const property = properties.find((item) => item.id === propertyId);
    if (!property) return fail("Property not found");
    if (property.owner_id !== playerId) return fail("Only owner can sell houses");
    if (!property.is_hotel && property.houses === 0) return fail("No house/hotel to sell");

    // Even-building rule for selling: cannot sell if another property in the group
    // has fewer (or equal) houses (would create a gap > 1 in the other direction)
    if (!property.is_hotel && property.group_name) {
      const groupProps = properties.filter(
        (p) => p.group_name === property.group_name && p.type === "property" && p.id !== property.id
      );
      const maxOtherHouses = Math.max(...groupProps.map((p) => (p.is_hotel ? 5 : p.houses)));
      const effectiveHouses = property.houses;
      // After selling 1 house this property would have (effectiveHouses - 1)
      // The gap to the highest other property would be (maxOtherHouses - (effectiveHouses - 1))
      if (maxOtherHouses - (effectiveHouses - 1) > 1) {
        return fail(
          "Even building rule: you must sell evenly across the color group. Sell a house from the property with the most houses first."
        );
      }
    }

    // Selling a hotel downgrades to 4 houses (standard Monopoly rules)
    const patch = property.is_hotel
      ? { is_hotel: false, houses: 4 }
      : { houses: Math.max(0, property.houses - 1) };
    const propertyResult = await updateProperty(propertyId, patch);
    if (!propertyResult.success) return propertyResult;

    const txResult = await useGameStore.getState().makeTransaction({
      gameId: useGameStore.getState().currentGame?.id,
      type: "fromBank",
      amount: Math.floor(property.house_price / 2),
      toUserId: playerId,
    });
    if (!txResult.success) return fail(txResult.error ?? "House sale payout failed");

    await get().refresh();
    return propertyResult;
  },

  toggleMortgage: async (propertyId, playerId) => {
    const property = get().properties.find((item) => item.id === propertyId);
    if (!property) return fail("Property not found");
    if (property.owner_id !== playerId) return fail("Only owner can mortgage");
    if (property.houses > 0 || property.is_hotel) return fail("Sell all houses before mortgaging");

    const nextIsMortgaged = !property.is_mortgaged;
    const propertyResult = await updateProperty(propertyId, { is_mortgaged: nextIsMortgaged });
    if (!propertyResult.success) return propertyResult;

    const txResult = await useGameStore.getState().makeTransaction({
      gameId: useGameStore.getState().currentGame?.id,
      type: nextIsMortgaged ? "fromBank" : "toBank",
      amount: property.mortgage_value,
      fromUserId: nextIsMortgaged ? null : playerId,
      toUserId: nextIsMortgaged ? playerId : null,
    });
    if (!txResult.success) return fail(txResult.error ?? "Mortgage bank operation failed");

    await get().refresh();
    return propertyResult;
  },

  sendToPot: async (playerId, amount) => {
    if (amount <= 0) return fail("Amount must be greater than 0");
    const player = getLegacyPlayer(playerId);
    if (!player || player.balance < amount) return fail("Insufficient balance for pot transfer");

    const txResult = await useGameStore.getState().makeTransaction({
      gameId: useGameStore.getState().currentGame?.id,
      type: "toFreeParking",
      amount,
      fromUserId: playerId,
    });
    if (!txResult.success) return fail(txResult.error ?? "Pot transfer failed");
    return ok(null);
  },

  collectPotIfLanding: async (playerId) => {
    const game = useGameStore.getState().currentGame;
    const pot = game?.free_parking_money ?? 0;
    if (pot <= 0) return ok(0);
    const txResult = await useGameStore.getState().makeTransaction({
      gameId: game?.id,
      type: "fromFreeParking",
      amount: pot,
      toUserId: playerId,
    });
    if (!txResult.success) return fail(txResult.error ?? "Collect pot failed");
    return ok(pot);
  },

  checkBankruptcy: (playerId) => {
    const player = getLegacyPlayer(playerId);
    if (!player) return fail("Player not found");
    const owned = get().properties.filter((property) => property.owner_id === playerId);
    const worthFromAssets = owned.reduce((sum, property) => {
      const structureValue = property.houses * property.house_price;
      const mortgaged = property.is_mortgaged ? property.mortgage_value : 0;
      return sum + structureValue * 0.5 + mortgaged + estimatePropertyWorth(property) * 0.2;
    }, 0);
    const netWorth = player.balance + worthFromAssets;
    const bankrupt = netWorth <= 0 || !!player.bankrupt_timestamp;
    if (bankrupt) {
      set((state) => ({
        bankruptPlayers: { ...state.bankruptPlayers, [playerId]: true },
      }));
    }
    return ok({ bankrupt, netWorth });
  },

  disposeRealtime: async () => {
    const gameId = get().v2GameId;
    if (!gameId) return;
    await unsubscribeTable("public", "berlin_properties", `game_id=eq.${gameId}`);
    const authUserId = useAuthStore.getState().user?.id;
    if (authUserId) {
      await unsubscribeTable("public", "berlin_player_properties", "user_id=eq." + authUserId);
    }
  },
}));
