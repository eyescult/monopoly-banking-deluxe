import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Handler = (payload: unknown) => void;

const channels = new Map<string, RealtimeChannel>();

function safeKey(schema: string, table: string, filter: string): string {
  return `${schema}:${table}:${filter}`;
}

export function subscribeTable(
  schema: string,
  table: string,
  filter: string,
  handler: Handler
): RealtimeChannel {
  const key = safeKey(schema, table, filter);
  const existing = channels.get(key);
  if (existing) return existing;

  const channel = supabase
    .channel(`rt:${key}`)
    .on(
      "postgres_changes",
      { event: "*", schema, table, filter },
      (payload) => {
        if (!payload || typeof payload !== "object") return;
        handler(payload);
      }
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`[Realtime] ${key} => ${status}`);
      }
    });

  channels.set(key, channel);
  return channel;
}

export async function unsubscribeTable(schema: string, table: string, filter: string): Promise<void> {
  const key = safeKey(schema, table, filter);
  const channel = channels.get(key);
  if (!channel) return;
  await supabase.removeChannel(channel);
  channels.delete(key);
}

export async function unsubscribeAllRealtime(): Promise<void> {
  for (const [key, channel] of channels) {
    await supabase.removeChannel(channel);
    channels.delete(key);
  }
}
