import Phaser from "phaser";
import { colyseusClient } from "../../network/ColyseusClient";
import { soundManager } from "../../audio/SoundManager";

const SYMBOLS = ["🍒", "🍋", "🍊", "⭐", "💎", "7️⃣"];
const BET_OPTIONS = [10, 25, 50, 100];

const COLORS = {
  BG: 0x1a0a2e,
  PANEL: 0x2d1b69,
  GOLD: 0xffd700,
  REEL_BG: 0x0d0520,
  WHITE: 0xffffff,
  RED: 0xff4757,
  GREEN: 0x2ed573,
};

export class SlotScene extends Phaser.Scene {
  private selectedBet: number = 10;
  private betButtons: Phaser.GameObjects.Container[] = [];
  private reelTexts: Phaser.GameObjects.Text[] = [];
  private spinning: boolean = false;
  private resultLabel!: Phaser.GameObjects.Text;
  private balanceText!: Phaser.GameObjects.Text;
  private spinBtn!: Phaser.GameObjects.Container;
  private reelContainers: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: "SlotScene" });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const cx = width / 2;
    const cy = height / 2;

    // Fullscreen dark overlay
    this.add.rectangle(cx, cy, width, height, 0x000000, 0.85).setDepth(0);

    // Main panel
    const panelW = Math.min(520, width - 40);
    const panelH = Math.min(620, height - 40);
    const panelX = cx - panelW / 2;
    const panelY = cy - panelH / 2;

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.PANEL, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
    panel.lineStyle(3, COLORS.GOLD, 1);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);
    panel.lineStyle(1, COLORS.GOLD, 0.4);
    panel.strokeRoundedRect(panelX + 6, panelY + 6, panelW - 12, panelH - 12, 16);

    // Title
    this.add.text(cx, panelY + 40, "🎰 SLOT MACHINE 🎰", {
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

    // Reel area — increased cell height to prevent clipping
    const reelAreaY = panelY + 80;
    const reelW = 100;
    const reelH = 140; // Increased from 120 to give more vertical room
    const reelGap = 20;
    const totalReelW = reelW * 3 + reelGap * 2;
    const reelStartX = cx - totalReelW / 2;

    // Reel background — taller to accommodate
    const reelBg = this.add.graphics();
    reelBg.fillStyle(COLORS.REEL_BG, 1);
    reelBg.fillRoundedRect(reelStartX - 15, reelAreaY, totalReelW + 30, reelH + 20, 12);
    reelBg.lineStyle(2, COLORS.GOLD, 0.6);
    reelBg.strokeRoundedRect(reelStartX - 15, reelAreaY, totalReelW + 30, reelH + 20, 12);

    // Individual reel slots
    for (let i = 0; i < 3; i++) {
      const rx = reelStartX + i * (reelW + reelGap);
      const ry = reelAreaY + 10;

      const reelSlot = this.add.graphics();
      reelSlot.fillStyle(0x150830, 1);
      reelSlot.fillRoundedRect(rx, ry, reelW, reelH, 8);
      reelSlot.lineStyle(1, COLORS.GOLD, 0.4);
      reelSlot.strokeRoundedRect(rx, ry, reelW, reelH, 8);

      // Center the container within the taller reel cell
      const container = this.add.container(rx + reelW / 2, ry + reelH / 2);
      this.reelContainers.push(container);

      const symbolText = this.add.text(0, 0, "🎰", {
        fontSize: "48px",
        padding: { top: 8, bottom: 8 },
      }).setOrigin(0.5);
      container.add(symbolText);
      this.reelTexts.push(symbolText);
    }

    // Payout table
    const payY = reelAreaY + reelH + 40;
    const payouts = [
      "7️⃣7️⃣7️⃣ = 500x  |  💎💎💎 = 100x",
      "⭐⭐⭐ = 50x  |  3 Fruit = 10x",
      "2 Match = 2x  |  No match = 0x",
    ];
    payouts.forEach((line, i) => {
      this.add.text(cx, payY + i * 22, line, {
        fontFamily: "Nunito, sans-serif",
        fontSize: "13px",
        color: "#c4b5fd",
      }).setOrigin(0.5);
    });

    // Bet selector
    const betY = payY + 85;
    this.add.text(cx, betY - 20, "BET AMOUNT", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#a78bfa",
      fontStyle: "bold",
    }).setOrigin(0.5);

    const betBtnW = 65;
    const betTotalW = BET_OPTIONS.length * betBtnW + (BET_OPTIONS.length - 1) * 10;
    const betStartX = cx - betTotalW / 2;

    BET_OPTIONS.forEach((bet, i) => {
      const bx = betStartX + i * (betBtnW + 10) + betBtnW / 2;
      const container = this.add.container(bx, betY + 15);

      const bg = this.add.graphics();
      const isSelected = bet === this.selectedBet;
      bg.fillStyle(isSelected ? COLORS.GOLD : 0x44318d, 1);
      bg.fillRoundedRect(-betBtnW / 2, -18, betBtnW, 36, 8);
      if (isSelected) {
        bg.lineStyle(2, 0xffffff, 0.8);
        bg.strokeRoundedRect(-betBtnW / 2, -18, betBtnW, 36, 8);
      }

      const label = this.add.text(0, 0, `${bet}`, {
        fontFamily: "Nunito, sans-serif",
        fontSize: "16px",
        color: isSelected ? "#1a0a2e" : "#ffffff",
        fontStyle: "bold",
      }).setOrigin(0.5);

      container.add([bg, label]);
      container.setSize(betBtnW, 36);
      container.setInteractive({ useHandCursor: true });
      container.on("pointerdown", () => {
        if (this.spinning) return;
        this.selectedBet = bet;
        soundManager.playClick();
        this.updateBetButtons();
      });

      this.betButtons.push(container);
    });

    // Spin button
    const spinY = betY + 70;
    this.spinBtn = this.add.container(cx, spinY);
    const spinBg = this.add.graphics();
    spinBg.fillStyle(COLORS.GOLD, 1);
    spinBg.fillRoundedRect(-90, -25, 180, 50, 14);
    const spinLabel = this.add.text(0, 0, "🎰 SPIN!", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "22px",
      color: "#1a0a2e",
    }).setOrigin(0.5);
    this.spinBtn.add([spinBg, spinLabel]);
    this.spinBtn.setSize(180, 50);
    this.spinBtn.setInteractive({ useHandCursor: true });
    this.spinBtn.on("pointerdown", () => this.doSpin());

    // Result label
    this.resultLabel = this.add.text(cx, spinY + 50, "", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "20px",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Balance display
    const room = colyseusClient.getRoom();
    const myPlayer = room?.state.players.get(room!.sessionId);
    const coins = myPlayer?.coins || 0;
    this.balanceText = this.add.text(cx, panelY + panelH - 30, `Balance: 🪙 ${coins}`, {
      fontFamily: "Nunito, sans-serif",
      fontSize: "18px",
      color: "#ffd700",
      fontStyle: "bold",
    }).setOrigin(0.5);

    // Listen for slot results
    room?.onMessage("slot_result", (data: { reels: string[]; payout: number; newBalance: number }) => {
      this.handleResult(data);
    });
  }

  private updateBetButtons(): void {
    this.betButtons.forEach((container, i) => {
      const bet = BET_OPTIONS[i];
      const isSelected = bet === this.selectedBet;
      const bg = container.getAt(0) as Phaser.GameObjects.Graphics;
      const label = container.getAt(1) as Phaser.GameObjects.Text;

      bg.clear();
      bg.fillStyle(isSelected ? COLORS.GOLD : 0x44318d, 1);
      bg.fillRoundedRect(-32, -18, 65, 36, 8);
      if (isSelected) {
        bg.lineStyle(2, 0xffffff, 0.8);
        bg.strokeRoundedRect(-32, -18, 65, 36, 8);
      }
      label.setColor(isSelected ? "#1a0a2e" : "#ffffff");
    });
  }

  private doSpin(): void {
    if (this.spinning) return;

    const room = colyseusClient.getRoom();
    const myPlayer = room?.state.players.get(room!.sessionId);
    if (!myPlayer || myPlayer.coins < this.selectedBet) {
      this.resultLabel.setText("Not enough coins!").setColor("#ff4757");
      return;
    }

    this.spinning = true;
    this.resultLabel.setText("");
    soundManager.playSlotSpin();

    // Spinning animation
    let spinCount = 0;
    const spinInterval = this.time.addEvent({
      delay: 80,
      callback: () => {
        this.reelTexts.forEach((text, i) => {
          if (spinCount < 10 + i * 5) {
            text.setText(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
          }
        });
        spinCount++;
        if (spinCount >= 25) {
          spinInterval.destroy();
        }
      },
      loop: true,
    });

    // Send to server
    room?.send("slot_spin", { bet: this.selectedBet });
  }

  private handleResult(data: { reels: string[]; payout: number; newBalance: number }): void {
    // Stop reels one by one with delay
    data.reels.forEach((symbol, i) => {
      this.time.delayedCall(200 + i * 400, () => {
        this.reelTexts[i].setText(symbol);
        soundManager.playSlotStop();

        // Scale bounce effect
        this.tweens.add({
          targets: this.reelContainers[i],
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 100,
          yoyo: true,
        });
      });
    });

    // Show result after all reels stop
    this.time.delayedCall(200 + 3 * 400, () => {
      this.spinning = false;
      this.balanceText.setText(`Balance: 🪙 ${data.newBalance}`);

      if (data.payout > 0) {
        this.resultLabel.setText(`🎉 WIN! +${data.payout} coins!`).setColor("#2ed573");
        if (data.payout >= this.selectedBet * 50) {
          soundManager.playBigWin();
          this.showCoinShower();
        } else {
          soundManager.playWin();
        }
        // Flash effect
        this.cameras.main.flash(300, 255, 215, 0, false);
      } else {
        this.resultLabel.setText("No luck this time...").setColor("#ff6b6b");
        soundManager.playLose();
        // Subtle shake
        this.cameras.main.shake(200, 0.005);
      }
    });
  }

  private showCoinShower(): void {
    const { width, height } = this.cameras.main;
    for (let i = 0; i < 20; i++) {
      const coin = this.add.text(
        Phaser.Math.Between(100, width - 100),
        -30,
        "🪙",
        { fontSize: "24px" }
      ).setDepth(2000);

      this.tweens.add({
        targets: coin,
        y: height + 30,
        x: coin.x + Phaser.Math.Between(-50, 50),
        rotation: Phaser.Math.Between(-3, 3),
        duration: Phaser.Math.Between(1000, 2000),
        delay: i * 80,
        onComplete: () => coin.destroy(),
      });
    }
  }

  private closeGame(): void {
    soundManager.playClick();
    this.scene.stop();
    this.scene.resume("CasinoScene");
  }
}
