import type { Property } from "../types/berlin";

const RENT_TABLE: Record<string, number[]> = {
  "Checkpoint Charlie": [100000, 300000, 900000, 1600000, 2500000],
  "Siegessäule": [200000, 600000, 1800000, 3200000, 4500000],
  "Die Hackeschen Höfe": [400000, 1000000, 3000000, 4500000, 6000000],
  "Simon-Dach-Straße": [300000, 900000, 2700000, 4000000, 5500000],
  "Oranienburger Straße": [300000, 900000, 2700000, 4000000, 5500000],
  "Strandbad Wannsee": [600000, 1800000, 5000000, 7000000, 9000000],
  "Olympiastadion": [500000, 1500000, 4500000, 6250000, 7500000],
  "Tiergarten": [500000, 1500000, 4500000, 6250000, 7500000],
  "Brandenburger Tor": [700000, 2000000, 5500000, 7500000, 9500000],
  "Gedächtniskirche": [700000, 2000000, 5500000, 7500000, 9500000],
  "Reichstag": [800000, 2200000, 6000000, 8000000, 10000000],
  "Tränenpalast": [900000, 2500000, 7000000, 8750000, 10500000],
  "Museumsinsel": [900000, 2500000, 7000000, 8750000, 10500000],
  "Berliner Philharmonie": [1000000, 3000000, 7500000, 9250000, 11000000],
  "Pariser Platz": [1200000, 3600000, 8500000, 10250000, 12000000],
  "Gendarmenmarkt": [1100000, 3300000, 8000000, 9750000, 11500000],
  "Kollwitzplatz": [1100000, 3300000, 8000000, 9750000, 11500000],
  "Unter den Linden": [1300000, 3900000, 9000000, 11000000, 12750000],
  "Kurfürstendamm": [1300000, 3900000, 9000000, 11000000, 12750000],
  "Friedrichstraße": [1500000, 4500000, 10000000, 12000000, 14000000],
  "KaDeWe": [1750000, 5000000, 11000000, 13000000, 15000000],
  "Schlossstraße": [2000000, 6000000, 14000000, 17000000, 20000000]
};

function isTransport(p: Property) {
  return p.type === "station" || p.type === "airport" || p.name.includes("Bahnhof") || p.name.includes("Flughafen");
}

function isUtility(p: Property) {
  return p.type === "utility" || p.name === "Sony Center" || p.name === "Fernsehturm";
}

export function calculateRent(
  property: Property,
  allProperties: Property[],
  diceValue = 0
): number {
  if (property.is_mortgaged || property.type === "special") return 0;

  if (isTransport(property)) {
    const ownedStations = allProperties.filter(
      (p) => isTransport(p) && p.owner_id && p.owner_id === property.owner_id
    ).length;
    if (ownedStations <= 1) return 250000;
    if (ownedStations === 2) return 500000;
    if (ownedStations === 3) return 1000000;
    if (ownedStations >= 4) return 2000000;
  }

  if (isUtility(property)) {
    const ownedUtilities = allProperties.filter(
      (p) => isUtility(p) && p.owner_id && p.owner_id === property.owner_id
    ).length;
    const multiplier = ownedUtilities >= 2 ? 10 : 4;
    return Math.max(0, (diceValue || 1) * multiplier * 10000);
  }

  if (property.type === "property" && !isTransport(property) && !isUtility(property)) {
    if (property.houses === 0 && !property.is_hotel) {
      if (property.group_name) {
        const ownsFull = allProperties.filter(
          p => p.group_name === property.group_name && p.type === "property"
        ).every(p => p.owner_id === property.owner_id && p.owner_id !== null);
        
        if (ownsFull) {
          return property.rent_base * 2;
        }
      }
      return property.rent_base;
    }
    const table = RENT_TABLE[property.name];
    if (table) {
      const idx = property.is_hotel ? 4 : property.houses - 1;
      return table[idx];
    }
    const houseMultiplier = property.is_hotel ? 5 : 1 + property.houses;
    return Math.max(0, property.rent_base * houseMultiplier);
  }

  return 0;
}

export function estimatePropertyWorth(property: Property): number {
  const structureValue =
    property.houses * property.house_price + (property.is_hotel ? property.hotel_price : 0);
  const mortgageComponent = property.is_mortgaged ? property.mortgage_value : 0;
  return property.price + Math.floor(structureValue * 0.5) + mortgageComponent;
}
