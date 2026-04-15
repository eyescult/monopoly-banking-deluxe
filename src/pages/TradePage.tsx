import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useGameStore } from "../store/gameStore";
import { usePropertyStore, getGroupColor } from "../store/propertyStore";
import { useTradeStore } from "../store/tradeStore";
import type { Property, Trade } from "../types/berlin";

type LegacyPlayer = {
  user_id: string;
  name: string;
};

/** Returns true if ALL properties in a color group are included in the given set of IDs */
function isFullGroupInSet(
  groupName: string | null,
  propertyIds: string[],
  allProperties: Property[]
): boolean {
  if (!groupName) return true;
  const group = allProperties.filter(
    (p) => p.group_name === groupName && p.type === "property"
  );
  return group.length > 0 && group.every((p) => propertyIds.includes(p.id));
}

/** Shows a single property pill with name + building info + color dot */
function PropertyPill({
  property,
  selected,
  onClick,
  warn,
}: {
  property: Property;
  selected: boolean;
  onClick: () => void;
  warn?: boolean;
}) {
  const color = getGroupColor(property.group_name);
  const hasBuildings = property.houses > 0 || property.is_hotel;
  const buildingText = property.is_hotel
    ? "🏨"
    : property.houses > 0
    ? "🏠".repeat(property.houses)
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`property-pill btn btn-small ${selected ? "btn-primary" : "btn-outline"} ${
        warn ? "property-pill-warn" : ""
      }`}
    >
      <span
        className="pill-dot"
        style={{ backgroundColor: color }}
      />
      <span className="pill-name">{property.name}</span>
      {hasBuildings && (
        <span className="pill-buildings" title={`Has buildings: ${buildingText}`}>
          {buildingText}
        </span>
      )}
    </button>
  );
}

/** Warning label shown when a traded property group won't be traded completely */
function BuildingWarn({ show, groupName }: { show: boolean; groupName: string | null }) {
  if (!show) return null;
  return (
    <div className="trade-building-warn">
      ⚠️ <strong>{groupName}</strong> group has buildings — they will be sold at half price
      automatically (Monopoly rules require selling buildings before trading a partial color group).
    </div>
  );
}

/** Summarise a list of property IDs for the trade inbox */
function TradePropertyList({
  ids,
  properties,
}: {
  ids: string[];
  properties: Property[];
}) {
  if (ids.length === 0) return <span style={{ color: "var(--text-secondary)" }}>None</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
      {ids.map((id) => {
        const p = properties.find((prop) => prop.id === id);
        if (!p) return <span key={id} className="btn btn-small btn-outline">{id.slice(0, 8)}…</span>;
        const color = getGroupColor(p.group_name);
        return (
          <span key={id} className="btn btn-small btn-outline" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, display: "inline-block" }} />
            {p.name}
            {p.is_hotel ? " 🏨" : p.houses > 0 ? ` 🏠×${p.houses}` : ""}
          </span>
        );
      })}
    </div>
  );
}

/** Player name lookup helper */
function playerName(playerId: string, players: LegacyPlayer[]): string {
  return players.find((p) => p.user_id === playerId)?.name ?? playerId.slice(0, 8) + "…";
}

export default function TradePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore() as { user: any | null };
  const { currentGame } = useGameStore();
  const { v2GameId, properties, initForLegacyGame } = usePropertyStore();
  const { trades, initialize, createTrade, rejectTrade, acceptTrade } = useTradeStore();

  const [toPlayer, setToPlayer] = useState("");
  const [offeredMoney, setOfferedMoney] = useState(0);
  const [requestedMoney, setRequestedMoney] = useState(0);
  const [offeredProperties, setOfferedProperties] = useState<string[]>([]);
  const [requestedProperties, setRequestedProperties] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Use currentGame.id if available, fall back to the game code stored in
  // the user profile (handles page refresh while on /trades)
  const gameCode = currentGame?.id ?? user?.current_game_id ?? null;

  useEffect(() => {
    if (!user?.id || !gameCode) return;
    initForLegacyGame(gameCode, user.id, user.name || "Guest");
  }, [gameCode, initForLegacyGame, user?.id, user?.name]);

  useEffect(() => {
    if (!v2GameId || !user?.id) return;
    initialize(v2GameId, user.id, user.name || "Guest");
  }, [initialize, user?.id, user?.name, v2GameId]);

  const players = useMemo<LegacyPlayer[]>(
    () => (currentGame?.players ?? []) as LegacyPlayer[],
    [currentGame?.players]
  );
  const myProperties = useMemo(
    () => properties.filter((p) => p.owner_id === user?.id),
    [properties, user?.id]
  );
  const theirProperties = useMemo(
    () => properties.filter((p) => p.owner_id === toPlayer),
    [properties, toPlayer]
  );

  if (!user) {
    navigate("/login");
    return null;
  }

  const toggle = (value: string, list: string[], setter: (next: string[]) => void) => {
    if (list.includes(value)) setter(list.filter((item) => item !== value));
    else setter([...list, value]);
  };

  // Determine which offered/requested properties have building warnings
  // (buildings exist on the property AND not all properties of that group are in the trade)
  const offeredWarnings = useMemo(() => {
    return offeredProperties.filter((id) => {
      const p = properties.find((prop) => prop.id === id);
      if (!p || (!p.houses && !p.is_hotel)) return false;
      return !isFullGroupInSet(p.group_name, offeredProperties, properties);
    });
  }, [offeredProperties, properties]);

  const requestedWarnings = useMemo(() => {
    return requestedProperties.filter((id) => {
      const p = properties.find((prop) => prop.id === id);
      if (!p || (!p.houses && !p.is_hotel)) return false;
      return !isFullGroupInSet(p.group_name, requestedProperties, properties);
    });
  }, [requestedProperties, properties]);

  // Unique group names that have warnings
  const offeredWarnGroups = useMemo(() => {
    return [
      ...new Set(
        offeredWarnings.map((id) => properties.find((p) => p.id === id)?.group_name ?? null)
      ),
    ];
  }, [offeredWarnings, properties]);

  const requestedWarnGroups = useMemo(() => {
    return [
      ...new Set(
        requestedWarnings.map((id) => properties.find((p) => p.id === id)?.group_name ?? null)
      ),
    ];
  }, [requestedWarnings, properties]);

  const submitTrade = async () => {
    if (!v2GameId) return toast.error("V2 game not initialized");
    if (!toPlayer) return toast.error("Select a target player");
    if (offeredProperties.length === 0 && requestedProperties.length === 0 && offeredMoney === 0 && requestedMoney === 0) {
      return toast.error("A trade must include at least something");
    }
    setBusy(true);
    const result = await createTrade({
      gameId: v2GameId,
      fromUserId: user.id,
      toUserId: toPlayer,
      offeredMoney,
      requestedMoney,
      offeredProperties,
      requestedProperties,
    });
    setBusy(false);
    if (!result.success) toast.error(result.error);
    else {
      toast.success("Trade offer sent!");
      setOfferedProperties([]);
      setRequestedProperties([]);
      setOfferedMoney(0);
      setRequestedMoney(0);
      setToPlayer("");
    }
  };

  const handleAccept = async (trade: Trade) => {
    setBusy(true);
    const result = await acceptTrade(trade.id, user.id);
    setBusy(false);
    if (!result.success) toast.error(result.error);
    else toast.success("Trade accepted!");
  };

  const handleReject = async (trade: Trade) => {
    setBusy(true);
    const result = await rejectTrade(trade.id, user.id);
    setBusy(false);
    if (!result.success) toast.error(result.error);
    else toast.success("Trade rejected");
  };

  return (
    <div className="home-page">
      <div className="container">
        <div className="home-content fade-in">
          {/* Header */}
          <div
            className="section-header"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <h2>Trades</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <Link to="/properties" className="btn btn-outline btn-small">
                Properties
              </Link>
              <Link
                to={currentGame ? `/game/${currentGame.id}` : "/app"}
                className="btn btn-primary btn-small"
              >
                ← Back
              </Link>
            </div>
          </div>

          {/* ===== CREATE TRADE FORM ===== */}
          <div className="game-card" style={{ marginTop: 20 }}>
            <div className="game-card-header">
              <strong>Create Trade Offer</strong>
            </div>
            <div className="game-card-body">
              {/* Target player */}
              <div className="form-group">
                <label>Trade with</label>
                <select
                  className="form-input"
                  value={toPlayer}
                  onChange={(e) => {
                    setToPlayer(e.target.value);
                    setRequestedProperties([]);
                  }}
                >
                  <option value="">Select player…</option>
                  {players
                    .filter((p) => p.user_id !== user.id)
                    .map((p) => (
                      <option key={p.user_id} value={p.user_id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Money */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label>You offer ($)</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    value={offeredMoney}
                    onChange={(e) => setOfferedMoney(Math.max(0, Number(e.target.value)))}
                  />
                </div>
                <div className="form-group">
                  <label>You request ($)</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    value={requestedMoney}
                    onChange={(e) => setRequestedMoney(Math.max(0, Number(e.target.value)))}
                  />
                </div>
              </div>

              {/* Offered properties */}
              <div className="form-group">
                <label>Your properties to offer</label>
                {myProperties.length === 0 && (
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    You don't own any properties.
                  </p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {myProperties.map((p) => {
                    const hasWarn =
                      (p.houses > 0 || p.is_hotel) &&
                      !isFullGroupInSet(p.group_name, offeredProperties, properties);
                    return (
                      <PropertyPill
                        key={p.id}
                        property={p}
                        selected={offeredProperties.includes(p.id)}
                        warn={hasWarn && offeredProperties.includes(p.id)}
                        onClick={() => toggle(p.id, offeredProperties, setOfferedProperties)}
                      />
                    );
                  })}
                </div>
                {offeredWarnGroups.map((g) => (
                  <BuildingWarn key={g} show groupName={g} />
                ))}
              </div>

              {/* Requested properties */}
              {toPlayer && (
                <div className="form-group">
                  <label>
                    Properties to request from {playerName(toPlayer, players)}
                  </label>
                  {theirProperties.length === 0 && (
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                      This player doesn't own any properties.
                    </p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {theirProperties.map((p) => {
                      const hasWarn =
                        (p.houses > 0 || p.is_hotel) &&
                        !isFullGroupInSet(p.group_name, requestedProperties, properties);
                      return (
                        <PropertyPill
                          key={p.id}
                          property={p}
                          selected={requestedProperties.includes(p.id)}
                          warn={hasWarn && requestedProperties.includes(p.id)}
                          onClick={() =>
                            toggle(p.id, requestedProperties, setRequestedProperties)
                          }
                        />
                      );
                    })}
                  </div>
                  {requestedWarnGroups.map((g) => (
                    <BuildingWarn key={g} show groupName={g} />
                  ))}
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 8 }}
                disabled={busy || !toPlayer}
                onClick={submitTrade}
              >
                {busy ? "Sending…" : "Send Trade Offer"}
              </button>
            </div>
          </div>

          {/* ===== TRADE INBOX ===== */}
          <div style={{ marginTop: 32 }}>
            <h3>Trade Inbox</h3>
            {trades.length === 0 && (
              <p style={{ color: "var(--text-secondary)" }}>No trades yet.</p>
            )}
            <div className="games-list">
              {trades.map((trade) => {
                const isIncoming = trade.to_user_id === user.id;
                const isOutgoing = trade.from_user_id === user.id;
                const fromName = playerName(trade.from_user_id, players);
                const toName = playerName(trade.to_user_id, players);

                // Check if incoming acceptance will trigger building auto-sells
                const incomingOfferedBuildingWarn = trade.offered_properties.some((id) => {
                  const p = properties.find((pr) => pr.id === id);
                  return (
                    p &&
                    (p.houses > 0 || p.is_hotel) &&
                    !isFullGroupInSet(p.group_name, trade.offered_properties, properties)
                  );
                });
                const incomingRequestedBuildingWarn = trade.requested_properties.some((id) => {
                  const p = properties.find((pr) => pr.id === id);
                  return (
                    p &&
                    (p.houses > 0 || p.is_hotel) &&
                    !isFullGroupInSet(p.group_name, trade.requested_properties, properties)
                  );
                });

                return (
                  <div key={trade.id} className={`game-card trade-card trade-${trade.status}`}>
                    <div className="game-card-header">
                      <span>
                        <strong>{fromName}</strong> → <strong>{toName}</strong>
                      </span>
                      <span className={`trade-status-badge trade-status-${trade.status}`}>
                        {trade.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="game-card-body">
                      <div className="trade-summary-grid">
                        <div className="trade-side">
                          <div className="trade-side-label">
                            {fromName} offers:
                          </div>
                          {trade.offered_money > 0 && (
                            <div className="trade-money">💰 ${trade.offered_money.toLocaleString()}</div>
                          )}
                          <TradePropertyList
                            ids={trade.offered_properties}
                            properties={properties}
                          />
                        </div>
                        <div className="trade-arrow">⇄</div>
                        <div className="trade-side">
                          <div className="trade-side-label">
                            {toName} offers:
                          </div>
                          {trade.requested_money > 0 && (
                            <div className="trade-money">💰 ${trade.requested_money.toLocaleString()}</div>
                          )}
                          <TradePropertyList
                            ids={trade.requested_properties}
                            properties={properties}
                          />
                        </div>
                      </div>

                      {/* Building warnings in inbox */}
                      {incomingOfferedBuildingWarn && (
                        <div className="trade-building-warn" style={{ marginTop: 8 }}>
                          ⚠️ Accepting this trade will auto-sell buildings on offered properties
                          (partial color group). Refund will be paid to the seller.
                        </div>
                      )}
                      {incomingRequestedBuildingWarn && (
                        <div className="trade-building-warn" style={{ marginTop: 4 }}>
                          ⚠️ Accepting this trade will auto-sell buildings on requested properties
                          (partial color group). Refund will be paid to you.
                        </div>
                      )}

                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 8 }}>
                        {new Date(trade.created_at).toLocaleString()}
                      </div>

                      {trade.status === "pending" && (isIncoming || isOutgoing) && (
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          {isIncoming && (
                            <button
                              className="btn btn-primary btn-small"
                              disabled={busy}
                              onClick={() => handleAccept(trade)}
                            >
                              Accept
                            </button>
                          )}
                          <button
                            className="btn btn-danger btn-small"
                            disabled={busy}
                            onClick={() => handleReject(trade)}
                          >
                            {isOutgoing && !isIncoming ? "Cancel" : "Reject"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
