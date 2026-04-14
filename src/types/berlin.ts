export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type PropertyType = "property" | "station" | "airport" | "utility" | "special";
export type TradeStatus = "pending" | "accepted" | "rejected";

export interface V2Game {
  id: string;
  code: string;
  created_at: string;
  updated_at: string;
}

export interface V2Profile {
  id: string;       // same UUID as public.users.id
  username: string;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  game_id: string;
  position: number;
  name: string;
  group_name: string | null;
  type: PropertyType;
  price: number;
  rent_base: number;
  house_price: number;
  hotel_price: number;
  mortgage_value: number;
  owner_id: string | null;   // user_id of the owning player, or null
  houses: number;
  is_hotel: boolean;
  is_mortgaged: boolean;
  created_at: string;
  updated_at: string;
}

/** Ownership link — user_id matches public.users.id */
export interface PlayerProperty {
  user_id: string;
  property_id: string;
  created_at: string;
}

export interface Trade {
  id: string;
  game_id: string;
  from_user_id: string;      // renamed from from_player → matches user_id convention
  to_user_id: string;        // renamed from to_player   → matches user_id convention
  offered_money: number;
  requested_money: number;
  offered_properties: string[];
  requested_properties: string[];
  status: TradeStatus;
  created_at: string;
  updated_at: string;
}

export interface PropertySubscriptionPayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Property | null;
  old: Property | null;
}
