// Re-export shared types for server use
export const SLOT_SYMBOLS = ["🍒", "🍋", "🍊", "⭐", "💎", "7️⃣"] as const;
export type SlotSymbol = typeof SLOT_SYMBOLS[number];

export function calculateSlotPayout(reels: SlotSymbol[], bet: number): number {
  const [a, b, c] = reels;
  if (a === "7️⃣" && b === "7️⃣" && c === "7️⃣") return bet * 500;
  if (a === "💎" && b === "💎" && c === "💎") return bet * 100;
  if (a === "⭐" && b === "⭐" && c === "⭐") return bet * 50;
  if (a === b && b === c) return bet * 10;
  if (a === b || b === c || a === c) return bet * 2;
  return 0;
}

export const PLINKO_MULTIPLIERS = [0.2, 0.5, 1, 1.5, 2, 5, 10, 5, 2, 1.5, 1, 0.5, 0.2];
export const BET_OPTIONS = [10, 25, 50, 100] as const;
