/**
 * Cosmetics Shop — item catalog and purchase logic
 * Sprint 3: Avatar customization + cosmetics economy
 */

export interface CosmeticItem {
  id: string;
  name: string;
  category: "hair" | "skin" | "outfit" | "accessory" | "hat";
  value: string; // color hex or style identifier
  price: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;
}

// Full catalog of purchasable items
export const COSMETIC_CATALOG: CosmeticItem[] = [
  // Hair Colors
  { id: "hair_blonde", name: "Blonde", category: "hair", value: "#f4d03f", price: 50, rarity: "common", description: "Classic golden blonde" },
  { id: "hair_midnight", name: "Midnight Blue", category: "hair", value: "#1a237e", price: 100, rarity: "rare", description: "Deep midnight blue" },
  { id: "hair_fire", name: "Fire Red", category: "hair", value: "#d32f2f", price: 100, rarity: "rare", description: "Blazing red locks" },
  { id: "hair_mint", name: "Mint Green", category: "hair", value: "#80cbc4", price: 150, rarity: "rare", description: "Cool mint vibes" },
  { id: "hair_galaxy", name: "Galaxy Purple", category: "hair", value: "#7b1fa2", price: 250, rarity: "epic", description: "Cosmic purple shimmer" },
  { id: "hair_rainbow", name: "Rainbow", category: "hair", value: "#ff69b4", price: 500, rarity: "legendary", description: "A prismatic masterpiece" },

  // Skin Tones
  { id: "skin_pale", name: "Porcelain", category: "skin", value: "#fce4ec", price: 0, rarity: "common", description: "Light porcelain" },
  { id: "skin_fair", name: "Fair", category: "skin", value: "#ffdbac", price: 0, rarity: "common", description: "Fair complexion" },
  { id: "skin_tan", name: "Tan", category: "skin", value: "#c68642", price: 0, rarity: "common", description: "Sun-kissed tan" },
  { id: "skin_brown", name: "Brown", category: "skin", value: "#8d5524", price: 0, rarity: "common", description: "Rich brown" },
  { id: "skin_dark", name: "Dark", category: "skin", value: "#4e342e", price: 0, rarity: "common", description: "Deep dark" },

  // Outfit Colors
  { id: "outfit_crimson", name: "Crimson Suit", category: "outfit", value: "#e74c3c", price: 0, rarity: "common", description: "Classic casino red" },
  { id: "outfit_ocean", name: "Ocean Blue", category: "outfit", value: "#3498db", price: 75, rarity: "common", description: "Cool ocean blue" },
  { id: "outfit_emerald", name: "Emerald", category: "outfit", value: "#2ecc71", price: 75, rarity: "common", description: "Lucky emerald green" },
  { id: "outfit_royal", name: "Royal Purple", category: "outfit", value: "#9b59b6", price: 100, rarity: "rare", description: "Fit for royalty" },
  { id: "outfit_gold", name: "Golden Luxe", category: "outfit", value: "#f39c12", price: 200, rarity: "epic", description: "Dripping in gold" },
  { id: "outfit_vip", name: "VIP Black", category: "outfit", value: "#1a1a1a", price: 400, rarity: "epic", description: "Exclusive VIP attire" },
  { id: "outfit_diamond", name: "Diamond White", category: "outfit", value: "#ecf0f1", price: 750, rarity: "legendary", description: "Sparkling diamond white" },

  // Accessories
  { id: "acc_sunglasses", name: "Sunglasses", category: "accessory", value: "sunglasses", price: 100, rarity: "common", description: "Cool shades" },
  { id: "acc_monocle", name: "Monocle", category: "accessory", value: "monocle", price: 200, rarity: "rare", description: "Distinguished monocle" },
  { id: "acc_star_eyes", name: "Star Eyes", category: "accessory", value: "star_eyes", price: 150, rarity: "rare", description: "Sparkling star eyes" },

  // Hats
  { id: "hat_tophat", name: "Top Hat", category: "hat", value: "tophat", price: 300, rarity: "epic", description: "Classy top hat" },
  { id: "hat_crown", name: "Crown", category: "hat", value: "crown", price: 1000, rarity: "legendary", description: "Rule the casino" },
  { id: "hat_bunny", name: "Bunny Ears", category: "hat", value: "bunny", price: 200, rarity: "rare", description: "Cute bunny ears" },
];

export class CosmeticsShop {
  static getItem(itemId: string): CosmeticItem | undefined {
    return COSMETIC_CATALOG.find((item) => item.id === itemId);
  }

  static getCategory(category: string): CosmeticItem[] {
    return COSMETIC_CATALOG.filter((item) => item.category === category);
  }

  static canAfford(playerCoins: number, itemId: string): boolean {
    const item = this.getItem(itemId);
    if (!item) return false;
    return playerCoins >= item.price;
  }

  static purchase(playerCoins: number, itemId: string, ownedItems: string[]): { success: boolean; newBalance: number; error?: string } {
    const item = this.getItem(itemId);
    if (!item) return { success: false, newBalance: playerCoins, error: "Item not found" };
    if (ownedItems.includes(itemId)) return { success: false, newBalance: playerCoins, error: "Already owned" };
    if (playerCoins < item.price) return { success: false, newBalance: playerCoins, error: "Not enough coins" };

    return { success: true, newBalance: playerCoins - item.price };
  }

  static getCatalog(): CosmeticItem[] {
    return COSMETIC_CATALOG;
  }
}
