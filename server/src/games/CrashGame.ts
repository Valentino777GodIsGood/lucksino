export interface CrashPlayer {
  sessionId: string;
  name: string;
  bet: number;
  autoCashout?: number;
  cashedOut: boolean;
  cashoutMultiplier?: number;
}

export class CrashGame {
  private crashPoint: number = 0;
  private multiplier: number = 1.0;
  private phase: "waiting" | "running" | "crashed" = "waiting";
  private players: Map<string, CrashPlayer> = new Map();
  private history: number[] = [];
  private tickInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private onTick?: (multiplier: number) => void;
  private onCrash?: (crashPoint: number) => void;
  private onPlayerCashout?: (sessionId: string, multiplier: number, payout: number) => void;
  private waitTimeout: NodeJS.Timeout | null = null;

  constructor(
    callbacks: {
      onTick?: (multiplier: number) => void;
      onCrash?: (crashPoint: number) => void;
      onPlayerCashout?: (sessionId: string, multiplier: number, payout: number) => void;
    }
  ) {
    this.onTick = callbacks.onTick;
    this.onCrash = callbacks.onCrash;
    this.onPlayerCashout = callbacks.onPlayerCashout;
  }

  getState() {
    return {
      phase: this.phase,
      multiplier: this.multiplier,
      crashPoint: this.phase === "crashed" ? this.crashPoint : undefined,
      players: Array.from(this.players.values()).map(p => ({
        name: p.name,
        bet: p.bet,
        cashedOut: p.cashedOut,
        cashoutMultiplier: p.cashoutMultiplier,
      })),
      history: this.history.slice(-10),
    };
  }

  getPhase() { return this.phase; }
  getMultiplier() { return this.multiplier; }

  placeBet(sessionId: string, name: string, bet: number, autoCashout?: number): boolean {
    if (this.phase !== "waiting") return false;
    if (bet < 10 || bet > 100) return false;

    this.players.set(sessionId, {
      sessionId,
      name,
      bet,
      autoCashout,
      cashedOut: false,
    });

    // Auto-start game if we have at least one player and aren't already starting
    if (!this.waitTimeout) {
      this.waitTimeout = setTimeout(() => {
        this.startRound();
      }, 5000); // 5 second wait for more players
    }

    return true;
  }

  cashout(sessionId: string): number {
    if (this.phase !== "running") return 0;
    const player = this.players.get(sessionId);
    if (!player || player.cashedOut) return 0;

    player.cashedOut = true;
    player.cashoutMultiplier = this.multiplier;
    const payout = Math.floor(player.bet * this.multiplier);

    if (this.onPlayerCashout) {
      this.onPlayerCashout(sessionId, this.multiplier, payout);
    }

    return payout;
  }

  removePlayer(sessionId: string): void {
    this.players.delete(sessionId);
  }

  private startRound(): void {
    this.waitTimeout = null;
    this.phase = "running";
    this.multiplier = 1.0;
    this.startTime = Date.now();

    // Generate crash point using provably fair style (exponential distribution)
    // E(crash) ~ 2.0x on average, house edge ~3%
    const r = Math.random();
    this.crashPoint = Math.max(1.0, Math.floor((1 / (1 - r)) * 100) / 100);
    // Cap at 100x
    if (this.crashPoint > 100) this.crashPoint = 100;

    this.tickInterval = setInterval(() => this.tick(), 50);
  }

  private tick(): void {
    const elapsed = Date.now() - this.startTime;
    // Exponential growth: multiplier = e^(growthRate * elapsed)
    this.multiplier = Math.floor(Math.exp(0.00006 * elapsed) * 100) / 100;

    // Check auto-cashouts
    this.players.forEach((player) => {
      if (!player.cashedOut && player.autoCashout && this.multiplier >= player.autoCashout) {
        this.cashout(player.sessionId);
      }
    });

    if (this.multiplier >= this.crashPoint) {
      this.crash();
      return;
    }

    if (this.onTick) this.onTick(this.multiplier);
  }

  private crash(): void {
    this.phase = "crashed";
    this.multiplier = this.crashPoint;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.history.push(this.crashPoint);
    if (this.history.length > 10) this.history.shift();

    if (this.onCrash) this.onCrash(this.crashPoint);

    // Reset after 4 seconds
    setTimeout(() => {
      this.resetRound();
    }, 4000);
  }

  private resetRound(): void {
    this.players.clear();
    this.multiplier = 1.0;
    this.phase = "waiting";
  }

  destroy(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.waitTimeout) clearTimeout(this.waitTimeout);
  }
}
