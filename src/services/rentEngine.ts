import type { Property } from "../types/berlin";

export function calculateRent(
  property: Property,
  allProperties: Property[],
  diceValue = 0
): number {
  if (property.is_mortgaged || property.type === "special") return 0;

  if (property.type === "property") {
    const houseMultiplier = property.is_hotel ? 5 : 1 + property.houses;
    return Math.max(0, property.rent_base * houseMultiplier);
  }

  if (property.type === "station") {
    const ownedStations = allProperties.filter(
      (p) => p.type === "station" && p.owner_id && p.owner_id === property.owner_id
    ).length;
    return property.rent_base * Math.max(1, ownedStations);
  }

  if (property.type === "utility") {
    const ownedUtilities = allProperties.filter(
      (p) => p.type === "utility" && p.owner_id && p.owner_id === property.owner_id
    ).length;
    const multiplier = ownedUtilities >= 2 ? 10 : 4;
    return Math.max(0, (diceValue || 1) * multiplier);
  }

  return 0;
}

export function estimatePropertyWorth(property: Property): number {
  const structureValue =
    property.houses * property.house_price + (property.is_hotel ? property.hotel_price : 0);
  const mortgageComponent = property.is_mortgaged ? property.mortgage_value : 0;
  return property.price + Math.floor(structureValue * 0.5) + mortgageComponent;
}
