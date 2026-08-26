import { PLINKO_MULTIPLIERS, BET_OPTIONS } from "./shared-types";

const PLINKO_ROWS = 8;

export class PlinkoGame {
  static drop(bet: number): { slotIndex: number; multiplier: number; payout: number; path: number[] } {
    if (!BET_OPTIONS.includes(bet as any)) {
      throw new Error("Invalid bet amount");
    }

    // Generate path: at each row, ball goes left (0) or right (1)
    const path: number[] = [];
    let position = 0;

    for (let row = 0; row < PLINKO_ROWS; row++) {
      const direction = Math.random() < 0.5 ? 0 : 1;
      path.push(direction);
      position += direction;
    }

    // position now is 0..PLINKO_ROWS, mapping to multiplier slots
    // With 8 rows, position ranges from 0 to 8 (9 possible values)
    // But we have 13 multiplier slots, so we need to map differently
    // Actually with 8 rows of pegs, there are 9 landing slots at bottom
    // Let's use 9 slots to match the physics
    // Re-map: position 0..8 maps to slot indices
    const slotIndex = position; // 0 to 8
    
    // Use a 9-slot multiplier array derived from the 13
    const multipliers9 = [0.2, 0.5, 1, 2, 5, 2, 1, 0.5, 0.2];
    const multiplier = multipliers9[slotIndex];
    const payout = Math.floor(bet * multiplier);

    return { slotIndex, multiplier, payout, path };
  }
}
