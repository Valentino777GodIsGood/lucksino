import Phaser from "phaser";
import { colyseusClient } from "../../network/ColyseusClient";
import { soundManager } from "../../audio/SoundManager";

const BET_OPTIONS = [10, 25, 50, 100];

const COLORS = {
  BG: 0x1a0a2e,
  PANEL: 0x2d1b69,
  GOLD: 0xffd700,
  GREEN: 0x2ed573,
  RED: 0xff4757,
  GRAPH_BG: 0x0d0520,
  LINE: 0x2ed573,
};

export class CrashScene extends Phaser.Scene {
  private selectedBet: number = 10;
  private autoCashout: number = 0;
  private betButtons: Phaser.GameObjects.Container[] = [];
  private hasBet: boolean = false;
  private cashedOut: boolean = false;
  private multiplierText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private balanceText!: Phaser.GameObjects.Text;
  private resultLabel!: Phaser.GameObjects.Text;
  private graphGraphics!: Phaser.GameObjects.Graphics;
  private rocketEmoji!: Phaser.GameObjects.Text;
  private cashoutBtn!: Phaser.GameObjects.Container;
  private betBtn!: Phaser.GameObjects.Container;
  private historyText!: Phaser.GameObjects.Text;
  private playersText!: Phaser.GameObjects.Text;
  private graphX: number = 0;
  private graphY: number = 0;
  private graphW: number = 0;
  private graphH: number = 0;
  private points: { x: number; y: number }[] = [];
  private currentPhase: string = "waiting";
  private currentMultiplier: number = 1.0;
  private lastTickSound: number = 0;
  private autoCashoutInput!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "CrashScene" });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const cx = width / 2;
    const cy = height / 2;

    // Dark overlay
    this.add.rectangle(cx, cy, width, height, 0x000000, 0.85);

    // Main panel
    const panelW = Math.min(580, width - 30);
    const panelH = Math.min(680, height - 20);
    const panelX = cx - panelW / 2;
    const panelY = cy - panelH / 2;

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.PANEL, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
    panel.lineStyle(3, COLORS.GOLD, 1);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);

    // Title
    this.add.text(cx, panelY + 35, "🚀 CRASH 🚀", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "26px",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Close button
    const closeBtn = this.add.text(panelX + panelW - 25, panelY + 15, "✕", {
      fontSize: "24px",
      color: "#ff6b6b",
      fontStyle: "bold",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeGame());

    // Graph area
    this.graphX = panelX + 30;
    this.graphY = panelY + 60;
    this.graphW = panelW - 60;
    this.graphH = 220;

    const graphBg = this.add.graphics();
    graphBg.fillStyle(COLORS.GRAPH_BG, 1);
    graphBg.fillRoundedRect(this.graphX, this.graphY, this.graphW, this.graphH, 12);
    graphBg.lineStyle(2, COLORS.GOLD, 0.4);
    graphBg.strokeRoundedRect(this.graphX, this.graphY, this.graphW, this.graphH, 12);

    // Graph grid lines
    const gridG = this.add.graphics();
    gridG.lineStyle(1, 0xffffff, 0.05);
    for (let i = 1; i < 5; i++) {
      const gy = this.graphY + (this.graphH / 5) * i;
      gridG.moveTo(this.graphX + 10, gy);
      gridG.lineTo(this.graphX + this.graphW - 10, gy);
    }
    gridG.strokePath();

    // Graph drawing layer
    this.graphGraphics = this.add.graphics();

    // Rocket emoji
    this.rocketEmoji = this.add.text(this.graphX + 30, this.graphY + this.graphH - 30, "🚀", {
      fontSize: "28px",
    });

    // Multiplier display (big)
    this.multiplierText = this.add.text(this.graphX + this.graphW / 2, this.graphY + this.graphH / 2, "1.00x", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "42px",
      color: "#2ed573",
      stroke: "#000",
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Status text
    this.statusText = this.add.text(cx, this.graphY + this.graphH + 20, "Waiting for bets...", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "16px",
      color: "#c4b5fd",
      fontStyle: "bold",
    }).setOrigin(0.5);

    // History
    this.historyText = this.add.text(cx, this.graphY + this.graphH + 42, "", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "12px",
      color: "#8b7faa",
    }).setOrigin(0.5);

    // Players in round
    this.playersText = this.add.text(panelX + panelW - 20, this.graphY + this.graphH + 20, "", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "11px",
      color: "#a78bfa",
      align: "right",
    }).setOrigin(1, 0);

    // Controls
    const ctrlY = this.graphY + this.graphH + 65;

    // Bet selector
    this.add.text(panelX + 40, ctrlY, "BET:", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "13px",
      color: "#a78bfa",
      fontStyle: "bold",
    });

    const betBtnW = 55;
    BET_OPTIONS.forEach((bet, i) => {
      const bx = panelX + 90 + i * (betBtnW + 8);
      const container = this.add.container(bx, ctrlY + 10);
      const bg = this.add.graphics();
      const isSelected = bet === this.selectedBet;
      bg.fillStyle(isSelected ? COLORS.GOLD : 0x44318d, 1);
      bg.fillRoundedRect(-betBtnW / 2 + 5, -14, betBtnW - 5, 28, 6);
      const label = this.add.text(2, 0, `${bet}`, {
        fontFamily: "Nunito, sans-serif",
        fontSize: "14px",
        color: isSelected ? "#1a0a2e" : "#ffffff",
        fontStyle: "bold",
      }).setOrigin(0.5);
      container.add([bg, label]);
      container.setSize(betBtnW, 28);
      container.setInteractive({ useHandCursor: true });
      container.on("pointerdown", () => {
        if (this.hasBet) return;
        this.selectedBet = bet;
        soundManager.playClick();
        this.updateBetButtons();
      });
      this.betButtons.push(container);
    });

    // Auto-cashout
    const autoY = ctrlY + 40;
    this.add.text(panelX + 40, autoY, "AUTO CASHOUT:", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "12px",
      color: "#a78bfa",
    });

    const autoOptions = [0, 2, 5, 10]; // 0 = off
    autoOptions.forEach((val, i) => {
      const ax = panelX + 170 + i * 55;
      const text = this.add.text(ax, autoY + 2, val === 0 ? "OFF" : `${val}x`, {
        fontFamily: "Nunito, sans-serif",
        fontSize: "13px",
        color: this.autoCashout === val ? "#ffd700" : "#8b7faa",
        fontStyle: "bold",
      }).setInteractive({ useHandCursor: true });
      text.on("pointerdown", () => {
        this.autoCashout = val;
        soundManager.playClick();
        // Update colors
        autoOptions.forEach((v, j) => {
          const t = text.scene.children.list.find(
            (c: any) => c === text.scene.children.list[text.scene.children.list.indexOf(text) - i + j]
          );
        });
      });
    });

    // Place Bet button
    const betBtnY = autoY + 40;
    this.betBtn = this.add.container(cx - 60, betBtnY);
    const betBg = this.add.graphics();
    betBg.fillStyle(COLORS.GREEN, 1);
    betBg.fillRoundedRect(-60, -18, 120, 36, 10);
    const betLabel = this.add.text(0, 0, "💰 Place Bet", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.betBtn.add([betBg, betLabel]);
    this.betBtn.setSize(120, 36);
    this.betBtn.setInteractive({ useHandCursor: true });
    this.betBtn.on("pointerdown", () => this.placeBet());

    // Cash Out button
    this.cashoutBtn = this.add.container(cx + 70, betBtnY);
    const coBg = this.add.graphics();
    coBg.fillStyle(COLORS.RED, 1);
    coBg.fillRoundedRect(-60, -18, 120, 36, 10);
    const coLabel = this.add.text(0, 0, "💸 Cash Out", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.cashoutBtn.add([coBg, coLabel]);
    this.cashoutBtn.setSize(120, 36);
    this.cashoutBtn.setInteractive({ useHandCursor: true });
    this.cashoutBtn.on("pointerdown", () => this.doCashout());
    this.cashoutBtn.setAlpha(0.4);

    // Result
    this.resultLabel = this.add.text(cx, betBtnY + 35, "", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "17px",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Balance
    const room = colyseusClient.getRoom();
    const myPlayer = room?.state.players.get(room!.sessionId);
    this.balanceText = this.add.text(cx, panelY + panelH - 25, `Balance: 🪙 ${myPlayer?.coins || 0}`, {
      fontFamily: "Nunito, sans-serif",
      fontSize: "16px",
      color: "#ffd700",
      fontStyle: "bold",
    }).setOrigin(0.5);

    // Network listeners
    this.setupListeners();
  }

  private setupListeners(): void {
    const room = colyseusClient.getRoom();
    if (!room) return;

    room.onMessage("crash_bet_accepted", (data: { bet: number; newBalance: number }) => {
      this.hasBet = true;
      this.balanceText.setText(`Balance: 🪙 ${data.newBalance}`);
      this.statusText.setText("Bet placed! Waiting for round...");
      this.betBtn.setAlpha(0.4);
      this.cashoutBtn.setAlpha(1);
    });

    room.onMessage("crash_cashout_result", (data: { multiplier: number; payout: number; newBalance: number }) => {
      this.cashedOut = true;
      this.cashoutBtn.setAlpha(0.4);
      this.balanceText.setText(`Balance: 🪙 ${data.newBalance}`);
      this.resultLabel.setText(`✅ Cashed out at ${data.multiplier.toFixed(2)}x! +${data.payout}`).setColor("#2ed573");
      soundManager.playWin();
    });

    room.onMessage("crash_crashed", (data: { crashPoint: number }) => {
      this.currentPhase = "crashed";
      this.multiplierText.setColor("#ff4757");
      this.multiplierText.setText(`💥 ${data.crashPoint.toFixed(2)}x`);
      this.statusText.setText("CRASHED!");
      soundManager.playCrashExplosion();
      this.cameras.main.shake(300, 0.01);

      if (this.hasBet && !this.cashedOut) {
        this.resultLabel.setText(`💥 Crashed! You lost your bet.`).setColor("#ff4757");
        soundManager.playLose();
      }
    });

    room.onMessage("crash_reset", () => {
      this.currentPhase = "waiting";
      this.hasBet = false;
      this.cashedOut = false;
      this.currentMultiplier = 1.0;
      this.points = [];
      this.graphGraphics.clear();
      this.multiplierText.setText("1.00x").setColor("#2ed573");
      this.statusText.setText("Waiting for bets...");
      this.resultLabel.setText("");
      this.betBtn.setAlpha(1);
      this.cashoutBtn.setAlpha(0.4);
      this.rocketEmoji.setPosition(this.graphX + 30, this.graphY + this.graphH - 30);
    });

    room.onMessage("crash_player_joined", (data: { name: string; bet: number }) => {
      this.updatePlayersDisplay();
    });

    room.onMessage("crash_player_cashout", (data: { name: string; multiplier: number }) => {
      this.updatePlayersDisplay();
    });

    room.onMessage("crash_state", (data: any) => {
      // Initial state sync
      if (data.history && data.history.length > 0) {
        this.updateHistory(data.history);
      }
    });

    // Monitor crash state changes via schema
    room.state.crash.onChange(() => {
      const crash = room.state.crash;
      if (crash.phase === "running" && this.currentPhase !== "running") {
        this.currentPhase = "running";
        this.statusText.setText("🚀 Flying...");
      }

      if (crash.phase === "running") {
        this.currentMultiplier = crash.multiplier;
        this.multiplierText.setText(`${crash.multiplier.toFixed(2)}x`);

        // Color based on multiplier
        if (crash.multiplier >= 5) {
          this.multiplierText.setColor("#ff6348");
        } else if (crash.multiplier >= 2) {
          this.multiplierText.setColor("#ffd700");
        } else {
          this.multiplierText.setColor("#2ed573");
        }

        // Update graph
        this.updateGraph(crash.multiplier);

        // Periodic tick sound
        const now = Date.now();
        if (now - this.lastTickSound > 500) {
          soundManager.playCrashTick(crash.multiplier);
          this.lastTickSound = now;
        }
      }

      // Update history display
      if (crash.history && crash.history.length > 0) {
        this.updateHistory(Array.from(crash.history));
      }
    });
  }

  private updateGraph(multiplier: number): void {
    // Map multiplier to graph position
    const maxDisplayMult = 10;
    const normalizedMult = Math.min(multiplier, maxDisplayMult);
    const progress = this.points.length / 200; // Horizontal progress

    const x = this.graphX + 20 + progress * (this.graphW - 40);
    const y = this.graphY + this.graphH - 20 - ((normalizedMult - 1) / (maxDisplayMult - 1)) * (this.graphH - 40);

    this.points.push({ x, y });

    // Redraw line
    this.graphGraphics.clear();
    this.graphGraphics.lineStyle(3, COLORS.LINE, 1);
    this.graphGraphics.beginPath();

    if (this.points.length > 1) {
      this.graphGraphics.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) {
        this.graphGraphics.lineTo(this.points[i].x, this.points[i].y);
      }
      this.graphGraphics.strokePath();
    }

    // Move rocket
    const lastPoint = this.points[this.points.length - 1];
    this.rocketEmoji.setPosition(lastPoint.x - 14, lastPoint.y - 14);
  }

  private updateHistory(history: number[]): void {
    const historyStr = history.map(h => {
      const color = h >= 2 ? "🟢" : "🔴";
      return `${color}${h.toFixed(2)}x`;
    }).join("  ");
    this.historyText.setText(`History: ${historyStr}`);
  }

  private updatePlayersDisplay(): void {
    const room = colyseusClient.getRoom();
    if (!room) return;
    const crashState = room.state.crash;
    const players = crashState.players;
    if (players.length === 0) {
      this.playersText.setText("");
      return;
    }
    const lines = [];
    for (let i = 0; i < Math.min(players.length, 5); i++) {
      const p = players[i];
      const status = p.cashedOut ? `✅ ${p.cashoutMultiplier.toFixed(2)}x` : "🎲";
      lines.push(`${p.name}: ${p.bet}🪙 ${status}`);
    }
    this.playersText.setText(lines.join("\n"));
  }

  private updateBetButtons(): void {
    this.betButtons.forEach((container, i) => {
      const bet = BET_OPTIONS[i];
      const isSelected = bet === this.selectedBet;
      const bg = container.getAt(0) as Phaser.GameObjects.Graphics;
      const label = container.getAt(1) as Phaser.GameObjects.Text;
      bg.clear();
      bg.fillStyle(isSelected ? COLORS.GOLD : 0x44318d, 1);
      bg.fillRoundedRect(-25, -14, 50, 28, 6);
      label.setColor(isSelected ? "#1a0a2e" : "#ffffff");
    });
  }

  private placeBet(): void {
    if (this.hasBet) return;

    const room = colyseusClient.getRoom();
    const myPlayer = room?.state.players.get(room!.sessionId);
    if (!myPlayer || myPlayer.coins < this.selectedBet) {
      this.resultLabel.setText("Not enough coins!").setColor("#ff4757");
      return;
    }

    soundManager.playClick();
    room?.send("crash_bet", {
      bet: this.selectedBet,
      autoCashout: this.autoCashout > 0 ? this.autoCashout : undefined,
    });
  }

  private doCashout(): void {
    if (!this.hasBet || this.cashedOut) return;
    if (this.currentPhase !== "running") return;

    soundManager.playClick();
    const room = colyseusClient.getRoom();
    room?.send("crash_cashout", {});
  }

  private closeGame(): void {
    soundManager.playClick();
    this.scene.stop();
    this.scene.resume("CasinoScene");
  }
}
