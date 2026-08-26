import { SLOT_SYMBOLS, SlotSymbol, calculateSlotPayout, BET_OPTIONS } from "./shared-types";

export class SlotMachine {
  static spin(bet: number): { reels: SlotSymbol[]; payout: number } {
    if (!BET_OPTIONS.includes(bet as any)) {
      throw new Error("Invalid bet amount");
    }

    // Generate 3 random symbols
    const reels: SlotSymbol[] = [
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    ];

    const payout = calculateSlotPayout(reels, bet);
    return { reels, payout };
  }
}
