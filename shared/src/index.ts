// Shared types for Lucksino

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  outfitColor: string;
  coins: number;
  isMoving: boolean;
  direction: "up" | "down" | "left" | "right";
  animFrame: number;
}

export interface MachineZone {
  id: string;
  name: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
}

export const CASINO_CONFIG = {
  WORLD_WIDTH: 1200,
  WORLD_HEIGHT: 900,
  PLAYER_SPEED: 3,
  STARTING_COINS: 1000,
  SPAWN_X: 600,
  SPAWN_Y: 700,
} as const;

export const MACHINE_ZONES: MachineZone[] = [
  {
    id: "slots",
    name: "Slots",
    label: "🎰 SLOTS",
    x: 150,
    y: 180,
    width: 220,
    height: 160,
    color: 0xff6b6b,
  },
  {
    id: "plinko",
    name: "Plinko",
    label: "⚡ PLINKO",
    x: 490,
    y: 180,
    width: 220,
    height: 160,
    color: 0x4ecdc4,
  },
  {
    id: "crash",
    name: "Crash",
    label: "🚀 CRASH",
    x: 830,
    y: 180,
    width: 220,
    height: 160,
    color: 0xffe66d,
  },
];

export const OUTFIT_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#9b59b6",
  "#f39c12",
  "#1abc9c",
  "#e91e63",
  "#00bcd4",
];

// Slot machine symbols
export const SLOT_SYMBOLS = ["🍒", "🍋", "🍊", "⭐", "💎", "7️⃣"] as const;
export type SlotSymbol = typeof SLOT_SYMBOLS[number];

// Slot payouts
export function calculateSlotPayout(reels: SlotSymbol[], bet: number): number {
  const [a, b, c] = reels;
  if (a === "7️⃣" && b === "7️⃣" && c === "7️⃣") return bet * 500;
  if (a === "💎" && b === "💎" && c === "💎") return bet * 100;
  if (a === "⭐" && b === "⭐" && c === "⭐") return bet * 50;
  if (a === b && b === c) return bet * 10; // Three matching fruit
  if (a === b || b === c || a === c) return bet * 2; // Two matching
  return 0; // No match
}

// Plinko multipliers (13 slots for 8 rows)
export const PLINKO_MULTIPLIERS = [0.2, 0.5, 1, 1.5, 2, 5, 10, 5, 2, 1.5, 1, 0.5, 0.2];

// Bet options
export const BET_OPTIONS = [10, 25, 50, 100] as const;

// Crash game config
export const CRASH_CONFIG = {
  MIN_CRASH: 1.0,
  MAX_CRASH: 100.0,
  TICK_INTERVAL_MS: 50,
  GROWTH_RATE: 0.0015,
} as const;

// Messages
export interface SlotSpinRequest {
  bet: number;
}

export interface SlotSpinResult {
  reels: SlotSymbol[];
  payout: number;
  newBalance: number;
}

export interface PlinkoDropRequest {
  bet: number;
}

export interface PlinkoDropResult {
  slotIndex: number;
  multiplier: number;
  payout: number;
  newBalance: number;
  path: number[]; // array of left/right decisions for animation
}

export interface CrashBetRequest {
  bet: number;
  autoCashout?: number;
}

export interface CrashCashoutRequest {
  // no additional data needed
}

export interface CrashState {
  phase: "waiting" | "running" | "crashed";
  multiplier: number;
  crashPoint?: number;
  players: CrashPlayerState[];
  history: number[];
}

export interface CrashPlayerState {
  name: string;
  bet: number;
  cashedOut: boolean;
  cashoutMultiplier?: number;
}
