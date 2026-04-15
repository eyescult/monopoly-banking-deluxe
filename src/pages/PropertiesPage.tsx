import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";
import { useGameStore } from "../store/gameStore";
import { usePropertyStore, getGroupColor, getPropertyIcon } from "../store/propertyStore";
import { calculateRent, isUtility } from "../services/rentEngine";
import type { Property } from "../types/berlin";

// Extend the authStore user type to include current_game_id
type AuthUser = {
  id: string;
  name?: string;
  current_game_id?: string | null;
};

const COLOR_ORDER: Record<string, number> = {
  "Brown": 1,
  "Light Blue": 2,
  "Pink": 3,
  "Orange": 4,
  "Red": 5,
  "Yellow": 6,
  "Green": 7,
  "Dark Blue": 8,
  "Trainstations/Airfields": 9,
  "station": 9,
  "airport": 9,
  "Mediacenters": 10,
  "utility": 10,
  "White": 11
};

/** Small visual indicator for houses / hotel on a property card. */
function BuildingIndicator({ houses, isHotel }: { houses: number; isHotel: boolean }) {
  if (isHotel) {
    return (
      <div className="building-indicator">
        <span className="building-hotel" title="Hotel">🏨</span>
      </div>
    );
  }
  if (houses === 0) return null;
  return (
    <div className="building-indicator">
      {Array.from({ length: houses }).map((_, i) => (
        <span key={i} className="building-house" title={`House ${i + 1}`}>🏠</span>
      ))}
    </div>
  );
}

/** Color band at the top of a property card. */
function ColorBand({ groupName, type }: { groupName: string | null; type: string }) {
  if (type === "special") return null;
  const color = getGroupColor(groupName);
  return (
    <div
      className="property-color-band"
      style={{ backgroundColor: color }}
      title={groupName ?? type}
    />
  );
}

function PropertyCard({
  property,
  allProperties,
  playerId,
  ownsFull,
  busy,
  onBuyHouse,
  onSellHouse,
  onToggleMortgage,
}: {
  property: Property;
  allProperties: Property[];
  playerId: string;
  ownsFull: boolean;
  busy: boolean;
  onBuyHouse: () => void;
  onSellHouse: () => void;
  onToggleMortgage: () => void;
}) {
  const { t } = useTranslation();
  const isColorProperty = property.type === "property";
  const hasBuildings = property.houses > 0 || property.is_hotel;
  const fmt = (n: number) => n.toLocaleString();
  const actualRent = calculateRent(property, allProperties);

  return (
    <div className="game-card property-card">
      <ColorBand groupName={property.group_name} type={property.type} />
      <div className="game-card-header">
        <strong>{property.name}</strong>
        <span className="property-type-badge">{property.group_name ?? property.type}</span>
      </div>

      <div className="game-card-body">
        <div className="property-stats-row">
          <div className="game-stat">
            <span className="game-stat-label">{t("prop_price")}:</span>
            <span>${fmt(property.price)}</span>
          </div>
          <div className="game-stat">
            <span className="game-stat-label">{t("prop_rent")}:</span>
            <span>{isUtility(property) ? "Dice Multiplier" : `$${fmt(actualRent)}`}</span>
          </div>
          {isColorProperty && (
            <>
              <div className="game-stat">
                <span className="game-stat-label">{t("prop_house_cost")}:</span>
                <span>${fmt(property.house_price)}</span>
              </div>
            </>
          )}
        </div>

        {isUtility(property) && (
          <div className="property-hint" style={{ marginTop: 8, textAlign: "left" }}>
            If you own one media center, the rent is four times the number rolled on two dice multiplied by 10,000.<br/>
            If you own both media centers, the rent is ten times the number rolled on two dice multiplied by 10,000.
          </div>
        )}

        {property.is_mortgaged && (
          <div className="property-status-badge mortgaged">{t("prop_mortgaged")}</div>
        )}

        <BuildingIndicator houses={property.houses} isHotel={property.is_hotel} />

        {!ownsFull && isColorProperty && (
          <div className="property-hint">
            {t("prop_build_hint", { group: property.group_name })}
          </div>
        )}

        <div className="property-actions">
          {isColorProperty && (
            <>
              <button
                className="btn btn-outline btn-small"
                disabled={busy || !ownsFull || property.is_mortgaged || property.is_hotel}
                onClick={onBuyHouse}
                title={!ownsFull ? t("prop_own_full_hint") : t("prop_buy_house")}
              >
                + {t("prop_house")}
              </button>
              <button
                className="btn btn-outline btn-small"
                disabled={busy || !hasBuildings}
                onClick={onSellHouse}
                title={t("prop_sell_house")}
              >
                – {t("prop_house")}
              </button>
            </>
          )}
          <button
            className="btn btn-outline btn-small"
            disabled={busy || hasBuildings}
            onClick={onToggleMortgage}
          >
            {property.is_mortgaged ? t("prop_unmortgage") : t("prop_mortgage")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PropertiesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuthStore() as { user: AuthUser | null };
  const { currentGame } = useGameStore();
  const {
    properties,
    loading,
    initForLegacyGame,
    buyProperty,
    buyHouse,
    sellHouse,
    toggleMortgage,
    ownsFullColorGroup,
  } = usePropertyStore();
  const [busyProperty, setBusyProperty] = useState<string | null>(null);

  // Use currentGame.id if available, fall back to the game code stored in
  // the user profile (handles page refresh while on /properties)
  const gameCode = currentGame?.id ?? (user as any)?.current_game_id ?? null;

  useEffect(() => {
    if (!user?.id || !gameCode) return;
    initForLegacyGame(gameCode, user.id, user.name || "Guest");
  }, [gameCode, initForLegacyGame, user?.id, user?.name]);

  const mine = useMemo(
    () => properties.filter((p) => p.owner_id === user?.id),
    [properties, user?.id]
  );

  // Group my properties by color group for display
  const groupedMine = useMemo(() => {
    const groups: Record<string, Property[]> = {};
    for (const p of mine) {
      const key = p.group_name ?? p.type;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    
    // Sort keys by traditional monopoly order
    const sortedGroups: Record<string, Property[]> = {};
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const orderA = COLOR_ORDER[a] ?? 99;
      const orderB = COLOR_ORDER[b] ?? 99;
      return orderA - orderB;
    });
    
    for (const key of sortedKeys) {
      sortedGroups[key] = groups[key];
      // Sort properties inside group by position
      sortedGroups[key].sort((a, b) => a.position - b.position);
    }
    
    return sortedGroups;
  }, [mine]);

  // Group ALL properties by color group for display
  const groupedAll = useMemo(() => {
    const groups: Record<string, Property[]> = {};
    const validProps = properties.filter((p) => p.type !== "special");
    for (const p of validProps) {
      const key = p.group_name ?? p.type;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    
    // Sort keys by traditional monopoly order
    const sortedGroups: Record<string, Property[]> = {};
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const orderA = COLOR_ORDER[a] ?? 99;
      const orderB = COLOR_ORDER[b] ?? 99;
      return orderA - orderB;
    });
    
    for (const key of sortedKeys) {
      sortedGroups[key] = groups[key];
      // Sort properties inside group by position
      sortedGroups[key].sort((a, b) => a.position - b.position);
    }
    
    return sortedGroups;
  }, [properties]);

  if (!user) {
    navigate("/login");
    return null;
  }

  const runAction = async (
    propertyId: string,
    action: () => Promise<{ success: boolean; error?: string }>
  ) => {
    setBusyProperty(propertyId);
    const result = await action();
    setBusyProperty(null);
    if (!result.success) {
      toast.error(result.error || t("error"));
    } else {
      toast.success(t("transaction_success"));
    }
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
            <h2>{t("my_properties")}</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <Link to="/trades" className="btn btn-outline btn-small">
                {t("trades")}
              </Link>
              <Link
                to={currentGame ? `/game/${currentGame.id}` : "/app"}
                className="btn btn-primary btn-small"
              >
                ← {t("return_home")}
              </Link>
            </div>
          </div>

          {loading && <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>{t("loading_properties")}</p>}

          {/* ------ OWNED PROPERTIES –– grouped by colour ------ */}
          {Object.keys(groupedMine).length === 0 && !loading && (
            <p style={{ marginTop: 20, color: "var(--text-secondary)" }}>
              {t("no_properties_owned")}
            </p>
          )}

          {Object.entries(groupedMine).map(([groupKey, props]) => {
            const sampleColor = getGroupColor(props[0].group_name);
            return (
              <div key={groupKey} style={{ marginTop: 24 }}>
                <div
                  className="group-heading"
                  style={{ borderLeft: `4px solid ${sampleColor}`, paddingLeft: 10, marginBottom: 10 }}
                >
                  <h3 style={{ margin: 0 }}>{groupKey}</h3>
                </div>
                <div className="games-list">
                  {props.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      allProperties={properties}
                      playerId={user.id}
                      ownsFull={
                        property.type === "property"
                          ? ownsFullColorGroup(user.id, property.group_name!)
                          : true
                      }
                      busy={busyProperty === property.id}
                      onBuyHouse={() =>
                        runAction(property.id, () => buyHouse(property.id, user.id))
                      }
                      onSellHouse={() =>
                        runAction(property.id, () => sellHouse(property.id, user.id))
                      }
                      onToggleMortgage={() =>
                        runAction(property.id, () => toggleMortgage(property.id, user.id))
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* ------ ALL BOARD PROPERTIES (unowned / for reference) ------ */}
          <div style={{ marginTop: 32 }}>
            <h3>{t("board_overview")}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 12 }}>
              {t("board_overview_desc")}
            </p>
            <div className="games-list">
              {Object.entries(groupedAll).map(([groupKey, props]) => {
                const sampleColor = getGroupColor(props[0].group_name);
                return (
                  <div key={`all-${groupKey}`} style={{ marginTop: 24 }}>
                    <div
                      className="group-heading"
                      style={{ borderLeft: `4px solid ${sampleColor}`, paddingLeft: 10, marginBottom: 10 }}
                    >
                      <h3 style={{ margin: 0 }}>{groupKey}</h3>
                    </div>
                    <div>
                      {props.map((property) => {
                        const isOwned = !!property.owner_id;
                        const isMineProp = property.owner_id === user.id;
                        const ownerLabel = isMineProp ? t("prop_owner_you") : isOwned ? t("prop_owner_other") : t("prop_owner_free");
                        const bandColor = getGroupColor(property.group_name);

                        return (
                          <div key={property.id} className="game-card property-card" style={{ marginBottom: 16 }}>
                            <ColorBand groupName={property.group_name} type={property.type} />
                            <div className="game-card-header">
                              <span>
                                <strong>#{property.position}</strong>{" "}
                                {getPropertyIcon(property.type)}{" "}
                                {property.name}
                              </span>
                              <span
                                className={`owner-badge ${isMineProp ? "owner-you" : isOwned ? "owner-other" : "owner-free"}`}
                              >
                                {ownerLabel}
                              </span>
                            </div>
                            <div className="game-card-body">
                              <div className="property-stats-row">
                                <div className="game-stat">
                                  <span className="game-stat-label">{t("prop_price")}:</span>
                                  <span>${property.price.toLocaleString()}</span>
                                </div>
                                <div className="game-stat">
                                  <span className="game-stat-label">{t("prop_rent")}:</span>
                                  <span>{isUtility(property) ? "Dice Multiplier" : `$${calculateRent(property, properties).toLocaleString()}`}</span>
                                </div>
                              </div>

                              {isUtility(property) && (
                                <div className="property-hint" style={{ marginTop: 8, fontSize: '0.8rem', textAlign: 'left' }}>
                                  If you own one media center, the rent is four times the number rolled on two dice multiplied by 10,000.<br/>
                                  If you own both media centers, the rent is ten times the number rolled on two dice multiplied by 10,000.
                                </div>
                              )}
                              {/* Show buildings on board overview too */}
                              <BuildingIndicator houses={property.houses} isHotel={property.is_hotel} />
                              <div
                                className="property-group-dot"
                                style={{
                                  display: "inline-block",
                                  width: 12,
                                  height: 12,
                                  borderRadius: "50%",
                                  backgroundColor: bandColor,
                                  marginTop: 6,
                                  marginRight: 4,
                                }}
                              />
                              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                                {property.group_name ?? property.type}
                              </span>

                              {!isOwned && (
                                <div style={{ marginTop: 10 }}>
                                  <button
                                    className="btn btn-primary btn-small"
                                    disabled={busyProperty === property.id}
                                    onClick={() =>
                                      runAction(property.id, () => buyProperty(property.id, user.id))
                                    }
                                  >
                                    {t("prop_buy_for", { price: property.price.toLocaleString() })}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
