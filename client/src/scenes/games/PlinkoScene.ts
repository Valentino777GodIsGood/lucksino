import Phaser from "phaser";
import { colyseusClient } from "../../network/ColyseusClient";
import { soundManager } from "../../audio/SoundManager";

const BET_OPTIONS = [10, 25, 50, 100];
const MULTIPLIERS_9 = [0.2, 0.5, 1, 2, 5, 2, 1, 0.5, 0.2];
const PLINKO_ROWS = 8;

const COLORS = {
  BG: 0x1a0a2e,
  PANEL: 0x2d1b69,
  GOLD: 0xffd700,
  PEG: 0xffd700,
  BALL: 0xff6348,
  BUCKET_HIGH: 0x2ed573,
  BUCKET_MID: 0xffa502,
  BUCKET_LOW: 0xff4757,
};

export class PlinkoScene extends Phaser.Scene {
  private selectedBet: number = 10;
  private betButtons: Phaser.GameObjects.Container[] = [];
  private dropping: boolean = false;
  private resultLabel!: Phaser.GameObjects.Text;
  private balanceText!: Phaser.GameObjects.Text;
  private ball!: Phaser.GameObjects.Arc;
  private pegs: Phaser.GameObjects.Arc[] = [];
  private bucketTexts: Phaser.GameObjects.Text[] = [];
  private pegStartX: number = 0;
  private pegStartY: number = 0;
  private pegSpacingX: number = 0;
  private pegSpacingY: number = 0;

  constructor() {
    super({ key: "PlinkoScene" });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const cx = width / 2;
    const cy = height / 2;

    // Dark overlay
    this.add.rectangle(cx, cy, width, height, 0x000000, 0.85);

    // Main panel
    const panelW = Math.min(520, width - 40);
    const panelH = Math.min(650, height - 30);
    const panelX = cx - panelW / 2;
    const panelY = cy - panelH / 2;

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.PANEL, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
    panel.lineStyle(3, COLORS.GOLD, 1);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);

    // Title
    this.add.text(cx, panelY + 35, "⚡ PLINKO ⚡", {
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

    // Plinko board area
    const boardY = panelY + 65;
    const boardH = panelH - 220;
    const boardW = panelW - 80;
    const boardX = cx - boardW / 2;

    // Draw board background
    const boardBg = this.add.graphics();
    boardBg.fillStyle(0x0d0520, 1);
    boardBg.fillRoundedRect(boardX, boardY, boardW, boardH, 12);
    boardBg.lineStyle(2, COLORS.GOLD, 0.5);
    boardBg.strokeRoundedRect(boardX, boardY, boardW, boardH, 12);

    // Calculate peg positions
    this.pegSpacingX = boardW / (PLINKO_ROWS + 2);
    this.pegSpacingY = (boardH - 60) / (PLINKO_ROWS + 1);
    this.pegStartX = boardX + this.pegSpacingX;
    this.pegStartY = boardY + 40;

    // Draw pegs
    for (let row = 0; row < PLINKO_ROWS; row++) {
      const pegsInRow = row + 2;
      const rowWidth = (pegsInRow - 1) * this.pegSpacingX;
      const startX = cx - rowWidth / 2;

      for (let col = 0; col < pegsInRow; col++) {
        const px = startX + col * this.pegSpacingX;
        const py = this.pegStartY + row * this.pegSpacingY;
        const peg = this.add.circle(px, py, 5, COLORS.PEG, 0.8);
        this.pegs.push(peg);
      }
    }

    // Draw multiplier buckets at bottom
    const bucketY = boardY + boardH - 30;
    const numBuckets = PLINKO_ROWS + 1; // 9 buckets
    const bucketW = boardW / numBuckets;

    for (let i = 0; i < numBuckets; i++) {
      const bx = boardX + i * bucketW + bucketW / 2;
      const mult = MULTIPLIERS_9[i];
      const color = mult >= 5 ? "#2ed573" : mult >= 2 ? "#ffa502" : mult >= 1 ? "#ffffff" : "#ff6b6b";

      const bg = this.add.graphics();
      bg.fillStyle(mult >= 5 ? COLORS.BUCKET_HIGH : mult >= 2 ? COLORS.BUCKET_MID : COLORS.BUCKET_LOW, 0.3);
      bg.fillRoundedRect(bx - bucketW / 2 + 2, bucketY - 12, bucketW - 4, 24, 4);

      const text = this.add.text(bx, bucketY, `${mult}x`, {
        fontFamily: "Nunito, sans-serif",
        fontSize: "11px",
        color,
        fontStyle: "bold",
      }).setOrigin(0.5);
      this.bucketTexts.push(text);
    }

    // Ball (hidden initially)
    this.ball = this.add.circle(cx, boardY + 10, 8, COLORS.BALL, 1).setVisible(false);

    // Controls area
    const ctrlY = panelY + panelH - 140;

    // Bet selector
    this.add.text(cx, ctrlY, "BET AMOUNT", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#a78bfa",
      fontStyle: "bold",
    }).setOrigin(0.5);

    const betBtnW = 60;
    const betTotalW = BET_OPTIONS.length * betBtnW + (BET_OPTIONS.length - 1) * 10;
    const betStartX = cx - betTotalW / 2;

    BET_OPTIONS.forEach((bet, i) => {
      const bx = betStartX + i * (betBtnW + 10) + betBtnW / 2;
      const container = this.add.container(bx, ctrlY + 30);

      const bg = this.add.graphics();
      const isSelected = bet === this.selectedBet;
      bg.fillStyle(isSelected ? COLORS.GOLD : 0x44318d, 1);
      bg.fillRoundedRect(-betBtnW / 2, -16, betBtnW, 32, 8);

      const label = this.add.text(0, 0, `${bet}`, {
        fontFamily: "Nunito, sans-serif",
        fontSize: "15px",
        color: isSelected ? "#1a0a2e" : "#ffffff",
        fontStyle: "bold",
      }).setOrigin(0.5);

      container.add([bg, label]);
      container.setSize(betBtnW, 32);
      container.setInteractive({ useHandCursor: true });
      container.on("pointerdown", () => {
        if (this.dropping) return;
        this.selectedBet = bet;
        soundManager.playClick();
        this.updateBetButtons();
      });
      this.betButtons.push(container);
    });

    // Drop button
    const dropBtn = this.add.container(cx, ctrlY + 78);
    const dropBg = this.add.graphics();
    dropBg.fillStyle(COLORS.GOLD, 1);
    dropBg.fillRoundedRect(-80, -22, 160, 44, 12);
    const dropLabel = this.add.text(0, 0, "⚡ DROP!", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "20px",
      color: "#1a0a2e",
    }).setOrigin(0.5);
    dropBtn.add([dropBg, dropLabel]);
    dropBtn.setSize(160, 44);
    dropBtn.setInteractive({ useHandCursor: true });
    dropBtn.on("pointerdown", () => this.doDrop());

    // Result
    this.resultLabel = this.add.text(cx, ctrlY + 115, "", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "18px",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Balance
    const room = colyseusClient.getRoom();
    const myPlayer = room?.state.players.get(room!.sessionId);
    this.balanceText = this.add.text(cx, panelY + panelH - 20, `Balance: 🪙 ${myPlayer?.coins || 0}`, {
      fontFamily: "Nunito, sans-serif",
      fontSize: "16px",
      color: "#ffd700",
      fontStyle: "bold",
    }).setOrigin(0.5);

    // Listen for results
    room?.onMessage("plinko_result", (data: any) => {
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
      bg.fillRoundedRect(-30, -16, 60, 32, 8);
      label.setColor(isSelected ? "#1a0a2e" : "#ffffff");
    });
  }

  private doDrop(): void {
    if (this.dropping) return;

    const room = colyseusClient.getRoom();
    const myPlayer = room?.state.players.get(room!.sessionId);
    if (!myPlayer || myPlayer.coins < this.selectedBet) {
      this.resultLabel.setText("Not enough coins!").setColor("#ff4757");
      return;
    }

    this.dropping = true;
    this.resultLabel.setText("");
    room?.send("plinko_drop", { bet: this.selectedBet });
  }

  private handleResult(data: { slotIndex: number; multiplier: number; payout: number; newBalance: number; path: number[] }): void {
    const { width } = this.cameras.main;
    const cx = width / 2;

    // Animate ball falling with smooth physics-like motion
    this.ball.setPosition(cx, this.pegStartY - 20).setVisible(true);

    let currentRow = 0;
    let positionOffset = 0;

    const animateStep = () => {
      if (currentRow >= data.path.length) {
        this.time.delayedCall(300, () => {
          this.showResult(data);
        });
        return;
      }

      const direction = data.path[currentRow];
      positionOffset += direction === 1 ? 1 : 0;

      // Calculate target position
      const pegsInRow = currentRow + 2;
      const rowWidth = (pegsInRow - 1) * this.pegSpacingX;
      const rowStartX = cx - rowWidth / 2;

      // Ball position between pegs — smooth lateral offset
      const lateralNudge = direction === 1 ? this.pegSpacingX * 0.3 : -this.pegSpacingX * 0.3;
      const targetX = rowStartX + positionOffset * this.pegSpacingX + lateralNudge;
      const targetY = this.pegStartY + currentRow * this.pegSpacingY + this.pegSpacingY * 0.5;

      // Use Cubic ease for smooth, natural-feeling ball physics
      this.tweens.add({
        targets: this.ball,
        x: targetX,
        y: targetY,
        duration: 150,
        ease: "Cubic.easeIn",
        onComplete: () => {
          soundManager.playPlinkoBounce();
          currentRow++;
          animateStep();
        },
      });
    };

    animateStep();
  }

  private showResult(data: { slotIndex: number; multiplier: number; payout: number; newBalance: number }): void {
    this.dropping = false;
    this.ball.setVisible(false);
    this.balanceText.setText(`Balance: 🪙 ${data.newBalance}`);

    // Highlight winning bucket
    if (data.slotIndex < this.bucketTexts.length) {
      const bucketText = this.bucketTexts[data.slotIndex];
      this.tweens.add({
        targets: bucketText,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 200,
        yoyo: true,
        repeat: 2,
      });
    }

    if (data.payout > 0) {
      const netGain = data.payout - this.selectedBet;
      if (netGain > 0) {
        this.resultLabel.setText(`🎉 ${data.multiplier}x! +${netGain} coins!`).setColor("#2ed573");
        soundManager.playWin();
        if (data.multiplier >= 5) {
          soundManager.playBigWin();
          this.cameras.main.flash(300, 255, 215, 0, false);
        }
      } else {
        this.resultLabel.setText(`${data.multiplier}x — ${data.payout} back`).setColor("#ffa502");
        soundManager.playLose();
      }
    } else {
      this.resultLabel.setText("0x — Better luck next time!").setColor("#ff6b6b");
      soundManager.playLose();
    }
  }

  private closeGame(): void {
    soundManager.playClick();
    this.scene.stop();
    this.scene.resume("CasinoScene");
  }
}
