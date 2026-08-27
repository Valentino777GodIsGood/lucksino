import Phaser from "phaser";
import { colyseusClient } from "../network/ColyseusClient";
import { soundManager } from "../audio/SoundManager";
import { CoinStore } from "../ui/CoinStore";

// Color scheme constants
const COLORS = {
  DEEP_PURPLE: 0x2d1b69,
  DARKER_PURPLE: 0x1a0a2e,
  PURPLE_WALL: 0x44318d,
  WARM_GOLD: 0xffd700,
  GOLD_DIM: 0xb8860b,
  WHITE: 0xffffff,
  BLACK: 0x000000,
  TILE_LIGHT: 0x3d2b79,
  TILE_DARK: 0x2d1b69,
  CARPET_PURPLE: 0x3d2176,
  SLOT_RED: 0xff4757,
  PLINKO_TEAL: 0x2ed573,
  CRASH_ORANGE: 0xff6348,
  SHOP_GOLD: 0xffc107,
};

interface PlayerSprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  lastX: number;
  lastY: number;
  targetX: number;
  targetY: number;
}

export class CasinoScene extends Phaser.Scene {
  private players: Map<string, PlayerSprite> = new Map();
  private mySessionId: string = "";
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private coinText!: Phaser.GameObjects.Text;
  private playerCountText!: Phaser.GameObjects.Text;
  private lowBalanceWarning!: Phaser.GameObjects.Container;
  private interactPrompt!: Phaser.GameObjects.Container;
  private dailyBonusBanner!: Phaser.GameObjects.Container;
  private nearbyMachine: string | null = null;
  private playerX: number = 600;
  private playerY: number = 700;
  private isMoving: boolean = false;
  private direction: string = "down";
  private animFrame: number = 0;
  private animTimer: number = 0;
  private moveTimer: number = 0;
  private lowBalanceShown: boolean = false;
  private dailyBonusAvailable: boolean = false;

  constructor() {
    super({ key: "CasinoScene" });
  }

  create(): void {
    // Initialize sound
    soundManager.init();
    soundManager.startAmbient();

    // Draw the casino floor
    this.drawCasinoFloor();

    // Draw machine zones
    this.drawMachineZones();

    // Draw shop zone (Sprint 3)
    this.drawShopZone();

    // Setup camera
    this.cameras.main.setBounds(0, 0, 1200, 900);
    this.cameras.main.setBackgroundColor(COLORS.DARKER_PURPLE);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Interaction key
    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.on("down", () => this.tryInteract());

    // Avatar customization key (C)
    const avatarKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    avatarKey.on("down", () => this.openAvatarCustomization());

    // Mobile touch interaction
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.nearbyMachine && pointer.y < this.cameras.main.height * 0.7) {
        this.tryInteract();
      }
    });

    // UI - Coin display
    this.coinText = this.add.text(16, 16, "🪙 1000", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "24px",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(1000);

    // Player count (Sprint 3 — polished)
    this.playerCountText = this.add.text(16, 50, "👥 1 online", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "16px",
      color: "#c4b5fd",
      stroke: "#000",
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(1000);

    // Avatar button (Sprint 3)
    const avatarBtn = this.add.text(16, 78, "🪞 [C] Customize", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "13px",
      color: "#a78bfa",
      stroke: "#000",
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
    avatarBtn.on("pointerdown", () => this.openAvatarCustomization());

    // Coin Store button (Sprint 4)
    const storeBtn = this.add.text(16, 100, "🛒 Coin Store", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "13px",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
    storeBtn.on("pointerdown", () => this.openCoinStore());

    // Sound toggle button
    const soundBtn = this.add.text(this.cameras.main.width - 50, 16, "🔊", {
      fontSize: "28px",
    }).setScrollFactor(0).setDepth(1000).setInteractive();
    let muted = false;
    soundBtn.on("pointerdown", () => {
      muted = !muted;
      soundManager.setMuted(muted);
      soundBtn.setText(muted ? "🔇" : "🔊");
    });

    // Low Balance Warning (Sprint 3 — hidden by default)
    this.createLowBalanceWarning();

    // Daily Bonus Banner (Sprint 3)
    this.createDailyBonusBanner();

    // Interact prompt (hidden by default)
    this.createInteractPrompt();

    // Setup network listeners
    this.setupNetworkListeners();

    // Set initial position
    const room = colyseusClient.getRoom();
    if (room) {
      this.mySessionId = room.sessionId;
    }
  }

  private drawCasinoFloor(): void {
    const g = this.add.graphics();
    const WORLD_W = 1200;
    const WORLD_H = 900;

    // Base floor — deep purple
    g.fillStyle(COLORS.DARKER_PURPLE);
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Checkered tile pattern — clean purple tones (Bug 8 fix)
    const TILE_SIZE = 40;
    for (let row = 0; row < Math.ceil(WORLD_H / TILE_SIZE); row++) {
      for (let col = 0; col < Math.ceil(WORLD_W / TILE_SIZE); col++) {
        const isLight = (row + col) % 2 === 0;
        g.fillStyle(isLight ? COLORS.TILE_LIGHT : COLORS.TILE_DARK, 0.5);
        g.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // Main carpet area — purple runner down the middle
    g.fillStyle(COLORS.CARPET_PURPLE, 0.6);
    g.fillRoundedRect(100, 100, WORLD_W - 200, WORLD_H - 200, 20);

    // Gold border around carpet
    g.lineStyle(3, COLORS.WARM_GOLD, 0.8);
    g.strokeRoundedRect(100, 100, WORLD_W - 200, WORLD_H - 200, 20);

    // Inner gold trim
    g.lineStyle(1, COLORS.WARM_GOLD, 0.4);
    g.strokeRoundedRect(110, 110, WORLD_W - 220, WORLD_H - 220, 16);

    // Wall borders (top)
    g.fillStyle(COLORS.PURPLE_WALL, 0.9);
    g.fillRect(0, 0, WORLD_W, 80);
    g.lineStyle(4, COLORS.WARM_GOLD, 1);
    g.strokeRect(0, 0, WORLD_W, 80);

    // Decorative gold dots on wall
    for (let x = 50; x < WORLD_W; x += 100) {
      g.fillStyle(COLORS.WARM_GOLD, 0.6);
      g.fillCircle(x, 40, 5);
    }

    // Side walls
    g.fillStyle(COLORS.PURPLE_WALL, 0.7);
    g.fillRect(0, 0, 60, WORLD_H);
    g.fillRect(WORLD_W - 60, 0, 60, WORLD_H);
    g.lineStyle(3, COLORS.WARM_GOLD, 0.8);
    g.strokeRect(0, 0, 60, WORLD_H);
    g.strokeRect(WORLD_W - 60, 0, 60, WORLD_H);

    // Floor sparkle points
    for (let i = 0; i < 20; i++) {
      const sx = 150 + Math.random() * (WORLD_W - 300);
      const sy = 400 + Math.random() * 400;
      g.fillStyle(COLORS.WARM_GOLD, 0.2 + Math.random() * 0.3);
      g.fillCircle(sx, sy, 1 + Math.random() * 2);
    }

    // Title banner at top
    const titleBg = this.add.graphics();
    titleBg.fillStyle(COLORS.DEEP_PURPLE, 0.9);
    titleBg.fillRoundedRect(WORLD_W / 2 - 150, 10, 300, 55, 12);
    titleBg.lineStyle(2, COLORS.WARM_GOLD, 1);
    titleBg.strokeRoundedRect(WORLD_W / 2 - 150, 10, 300, 55, 12);

    this.add.text(WORLD_W / 2, 37, "✨ LUCKSINO ✨", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "28px",
      color: "#ffd700",
      stroke: "#1a0a2e",
      strokeThickness: 3,
    }).setOrigin(0.5);
  }

  private drawMachineZones(): void {
    const machines = [
      { id: "slots", label: "🎰 SLOTS", x: 150, y: 120, w: 220, h: 160, color: COLORS.SLOT_RED },
      { id: "plinko", label: "⚡ PLINKO", x: 490, y: 120, w: 220, h: 160, color: COLORS.PLINKO_TEAL },
      { id: "crash", label: "🚀 CRASH", x: 830, y: 120, w: 220, h: 160, color: COLORS.CRASH_ORANGE },
    ];

    machines.forEach((m) => {
      const g = this.add.graphics();

      // Machine platform with gold border
      g.fillStyle(COLORS.DEEP_PURPLE, 0.95);
      g.fillRoundedRect(m.x, m.y, m.w, m.h, 16);

      // Inner glow
      g.fillStyle(m.color, 0.15);
      g.fillRoundedRect(m.x + 4, m.y + 4, m.w - 8, m.h - 8, 14);

      // Gold border
      g.lineStyle(3, COLORS.WARM_GOLD, 1);
      g.strokeRoundedRect(m.x, m.y, m.w, m.h, 16);

      // Inner white trim
      g.lineStyle(1, COLORS.WHITE, 0.3);
      g.strokeRoundedRect(m.x + 6, m.y + 6, m.w - 12, m.h - 12, 12);

      // Machine icon/label
      this.add.text(m.x + m.w / 2, m.y + m.h / 2 - 10, m.label, {
        fontFamily: "Fredoka One, cursive",
        fontSize: "26px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 3,
      }).setOrigin(0.5);

      // "Press SPACE" hint
      this.add.text(m.x + m.w / 2, m.y + m.h - 30, "Walk here to play!", {
        fontFamily: "Nunito, sans-serif",
        fontSize: "12px",
        color: "#c4b5fd",
      }).setOrigin(0.5);

      // Corner decorations
      const corners = [
        { x: m.x + 12, y: m.y + 12 },
        { x: m.x + m.w - 12, y: m.y + 12 },
        { x: m.x + 12, y: m.y + m.h - 12 },
        { x: m.x + m.w - 12, y: m.y + m.h - 12 },
      ];
      corners.forEach((c) => {
        g.fillStyle(COLORS.WARM_GOLD, 0.8);
        g.fillCircle(c.x, c.y, 4);
      });
    });
  }

  /** Sprint 3 — Golden Cosmetics Shop Zone */
  private drawShopZone(): void {
    const shopX = 150;
    const shopY = 700;
    const shopW = 260;
    const shopH = 140;

    const g = this.add.graphics();

    // Shop platform — golden theme
    g.fillStyle(0x1a0a2e, 0.95);
    g.fillRoundedRect(shopX, shopY, shopW, shopH, 16);

    // Golden inner glow
    g.fillStyle(COLORS.SHOP_GOLD, 0.12);
    g.fillRoundedRect(shopX + 4, shopY + 4, shopW - 8, shopH - 8, 14);

    // Gold border (thicker for the shop)
    g.lineStyle(4, COLORS.WARM_GOLD, 1);
    g.strokeRoundedRect(shopX, shopY, shopW, shopH, 16);

    // Inner sparkle border
    g.lineStyle(1, COLORS.WHITE, 0.4);
    g.strokeRoundedRect(shopX + 8, shopY + 8, shopW - 16, shopH - 16, 12);

    // Storefront awning effect (top stripe)
    g.fillStyle(COLORS.WARM_GOLD, 0.4);
    g.fillRoundedRect(shopX, shopY, shopW, 25, { tl: 16, tr: 16, bl: 0, br: 0 });

    // Shop label
    this.add.text(shopX + shopW / 2, shopY + 50, "🛍️ BOUTIQUE", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "24px",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(shopX + shopW / 2, shopY + 80, "Cosmetics & Outfits", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "13px",
      color: "#f5deb3",
    }).setOrigin(0.5);

    this.add.text(shopX + shopW / 2, shopY + shopH - 20, "Walk here to browse!", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "11px",
      color: "#c4b5fd",
    }).setOrigin(0.5);

    // Sparkle decorations
    const sparkles = [
      { x: shopX + 20, y: shopY + 30 },
      { x: shopX + shopW - 20, y: shopY + 30 },
      { x: shopX + 30, y: shopY + shopH - 30 },
      { x: shopX + shopW - 30, y: shopY + shopH - 30 },
    ];
    sparkles.forEach((s) => {
      g.fillStyle(COLORS.WARM_GOLD, 0.9);
      g.fillCircle(s.x, s.y, 4);
      g.fillStyle(COLORS.WHITE, 0.5);
      g.fillCircle(s.x, s.y, 2);
    });
  }

  private createInteractPrompt(): void {
    this.interactPrompt = this.add.container(0, 0).setVisible(false).setDepth(999);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRoundedRect(-80, -20, 160, 40, 10);
    bg.lineStyle(2, COLORS.WARM_GOLD, 1);
    bg.strokeRoundedRect(-80, -20, 160, 40, 10);

    const text = this.add.text(0, 0, "⏎ SPACE to Play", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#ffd700",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.interactPrompt.add([bg, text]);
  }

  /** Sprint 3 — Low Balance Warning (<50 coins) */
  private createLowBalanceWarning(): void {
    this.lowBalanceWarning = this.add.container(this.cameras.main.width / 2, this.cameras.main.height - 35)
      .setScrollFactor(0)
      .setDepth(1500)
      .setVisible(false);

    const warnBg = this.add.graphics();
    warnBg.fillStyle(0xff4757, 0.85);
    warnBg.fillRoundedRect(-140, -14, 280, 28, 8);
    warnBg.lineStyle(1, 0xffffff, 0.4);
    warnBg.strokeRoundedRect(-140, -14, 280, 28, 8);

    const warnText = this.add.text(0, 0, "⚠️ Low balance! Visit the Shop for free skins", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "12px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.lowBalanceWarning.add([warnBg, warnText]);
  }

  /** Sprint 3 — Daily Login Bonus Banner */
  private createDailyBonusBanner(): void {
    this.dailyBonusBanner = this.add.container(this.cameras.main.width / 2, 120)
      .setScrollFactor(0)
      .setDepth(2000)
      .setVisible(false);

    const bannerBg = this.add.graphics();
    bannerBg.fillStyle(0x2d1b69, 0.95);
    bannerBg.fillRoundedRect(-160, -35, 320, 70, 14);
    bannerBg.lineStyle(3, COLORS.WARM_GOLD, 1);
    bannerBg.strokeRoundedRect(-160, -35, 320, 70, 14);

    const bannerTitle = this.add.text(0, -15, "🎁 Daily Login Bonus!", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "18px",
      color: "#ffd700",
    }).setOrigin(0.5);

    const bannerText = this.add.text(0, 10, "Tap to claim +100 coins", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#c4b5fd",
    }).setOrigin(0.5);

    this.dailyBonusBanner.add([bannerBg, bannerTitle, bannerText]);
    this.dailyBonusBanner.setInteractive(
      new Phaser.Geom.Rectangle(-160, -35, 320, 70),
      Phaser.Geom.Rectangle.Contains
    );
    this.dailyBonusBanner.on("pointerdown", () => this.claimDailyBonus());
  }

  private setupNetworkListeners(): void {
    const room = colyseusClient.getRoom();
    if (!room) return;

    this.mySessionId = room.sessionId;

    // Player join
    room.state.players.onAdd((player: any, sessionId: string) => {
      this.addPlayerSprite(sessionId, player);

      player.onChange(() => {
        this.updatePlayerSprite(sessionId, player);
      });
    });

    // Player leave
    room.state.players.onRemove((_player: any, sessionId: string) => {
      this.removePlayerSprite(sessionId);
    });

    // Machine opened -> launch game scene
    room.onMessage("machine_opened", (data: { machineId: string }) => {
      this.openGame(data.machineId);
    });

    // Error messages
    room.onMessage("error", (data: { message: string }) => {
      this.showToast(data.message, "#ff4757");
    });

    // Sprint 3 — Daily bonus available notification
    room.onMessage("daily_bonus_available", () => {
      this.dailyBonusAvailable = true;
      this.dailyBonusBanner.setVisible(true);
      // Bounce animation
      this.tweens.add({
        targets: this.dailyBonusBanner,
        scaleX: 1.05,
        scaleY: 1.05,
        yoyo: true,
        repeat: 2,
        duration: 300,
      });
    });

    // Sprint 3 — Daily bonus claimed
    room.onMessage("daily_bonus_claimed", (data: { amount: number; newBalance: number }) => {
      this.dailyBonusAvailable = false;
      this.dailyBonusBanner.setVisible(false);
      this.coinText.setText(`🪙 ${data.newBalance}`);
      this.showToast(`+${data.amount} coins claimed! 🎉`, "#2ecc71");
      soundManager.playWin();
    });
  }

  private addPlayerSprite(sessionId: string, player: any): void {
    const container = this.add.container(player.x, player.y).setDepth(500);

    // Chibi body
    const body = this.add.graphics();
    this.drawChibiCharacter(body, player.outfitColor, player.hairColor || "#4a3728", player.skinTone || "#ffdbac", player.hat || "none", player.direction, player.accessory || "none");

    // Name tag
    const nameText = this.add.text(0, -35, player.name, {
      fontFamily: "Nunito, sans-serif",
      fontSize: "12px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 2,
      fontStyle: "bold",
    }).setOrigin(0.5);

    container.add([body, nameText]);

    // Add "YOU" indicator for local player
    if (sessionId === this.mySessionId) {
      const youIndicator = this.add.text(0, -48, "⬇", {
        fontSize: "14px",
        color: "#ffd700",
      }).setOrigin(0.5);
      container.add(youIndicator);
      this.cameras.main.startFollow(container, true, 0.08, 0.08);
    }

    this.players.set(sessionId, {
      container,
      body,
      nameText,
      lastX: player.x,
      lastY: player.y,
      targetX: player.x,
      targetY: player.y,
    });
  }

  private drawChibiCharacter(g: Phaser.GameObjects.Graphics, outfitColor: string, hairColor: string, skinTone: string, hat: string, direction: string, accessory: string = "none"): void {
    const outfitHex = Phaser.Display.Color.HexStringToColor(outfitColor).color;
    const hairHex = Phaser.Display.Color.HexStringToColor(hairColor).color;
    const skinHex = Phaser.Display.Color.HexStringToColor(skinTone).color;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(0, 18, 24, 8);

    // Body (outfit color)
    g.fillStyle(outfitHex);
    g.fillRoundedRect(-10, -5, 20, 22, 6);

    // Head (skin tone) — face circle
    g.fillStyle(skinHex);
    g.fillCircle(0, -14, 12);

    // Hair (hair color) — only the top portion of the head
    g.fillStyle(hairHex);
    g.fillRoundedRect(-10, -26, 20, 12, 6);

    // Eyes — positioned on the face, below the hair line (Bug 4 fix)
    const eyeOffsetX = direction === "left" ? -4 : direction === "right" ? 4 : 0;
    g.fillStyle(0x000000);
    g.fillCircle(-4 + eyeOffsetX, -10, 2);
    g.fillCircle(4 + eyeOffsetX, -10, 2);

    // Outfit trim (gold belt)
    g.fillStyle(COLORS.WARM_GOLD);
    g.fillRect(-10, 5, 20, 3);

    // Hat — drawn as graphics on top of head
    if (hat && hat !== "none") {
      if (hat === "crown") {
        g.fillStyle(COLORS.WARM_GOLD);
        // Base band
        g.fillRect(-7, -29, 14, 4);
        // 3 pointed spikes
        g.fillTriangle(-6, -29, -4, -35, -2, -29);
        g.fillTriangle(-2, -29, 0, -37, 2, -29);
        g.fillTriangle(2, -29, 4, -35, 6, -29);
      } else if (hat === "tophat") {
        g.fillStyle(0x1a1a1a);
        // Tall cylinder
        g.fillRect(-6, -40, 12, 14);
        // Wide brim
        g.fillRect(-9, -26, 18, 3);
      } else if (hat === "bunny") {
        g.fillStyle(0xffc0cb);
        // Two tall pink oval ears
        g.fillEllipse(-5, -36, 5, 12);
        g.fillEllipse(5, -36, 5, 12);
        // Inner ear (lighter pink)
        g.fillStyle(0xffe4e9);
        g.fillEllipse(-5, -36, 3, 8);
        g.fillEllipse(5, -36, 3, 8);
      }
    }

    // Accessory — drawn as graphics on face area
    if (accessory && accessory !== "none") {
      if (accessory === "sunglasses" || accessory === "glasses") {
        g.lineStyle(1, 0x000000, 1);
        // Left lens
        g.strokeCircle(-4 + eyeOffsetX, -10, 3);
        // Right lens
        g.strokeCircle(4 + eyeOffsetX, -10, 3);
        // Bridge connecting lenses
        g.lineBetween(-1 + eyeOffsetX, -10, 1 + eyeOffsetX, -10);
        // Side arms (small lines)
        g.lineBetween(-7 + eyeOffsetX, -10, -7 + eyeOffsetX, -9);
        g.lineBetween(7 + eyeOffsetX, -10, 7 + eyeOffsetX, -9);
      } else if (accessory === "monocle") {
        g.lineStyle(1, 0x8b7355, 1);
        // Single circle over right eye
        g.strokeCircle(4 + eyeOffsetX, -10, 3.5);
        // Chain/line dropping down
        g.lineBetween(4 + eyeOffsetX, -6.5, 4 + eyeOffsetX, 0);
      }
    }
  }

  private updatePlayerSprite(sessionId: string, player: any): void {
    const sprite = this.players.get(sessionId);
    if (!sprite) return;

    // Store target for smooth lerp in update loop
    sprite.targetX = player.x;
    sprite.targetY = player.y;

    // Update coin display if this is our player
    if (sessionId === this.mySessionId) {
      this.coinText.setText(`🪙 ${player.coins}`);
      this.playerX = player.x;
      this.playerY = player.y;

      // Sprint 3 — Low balance warning
      if (player.coins < 50 && !this.lowBalanceShown) {
        this.lowBalanceWarning.setVisible(true);
        this.lowBalanceShown = true;
      } else if (player.coins >= 50 && this.lowBalanceShown) {
        this.lowBalanceWarning.setVisible(false);
        this.lowBalanceShown = false;
      }
    }

    // Update direction graphics
    if (sprite.lastX !== player.x || sprite.lastY !== player.y) {
      sprite.body.clear();
      this.drawChibiCharacter(
        sprite.body,
        player.outfitColor,
        player.hairColor || "#4a3728",
        player.skinTone || "#ffdbac",
        player.hat || "none",
        player.direction,
        player.accessory || "none"
      );
      sprite.lastX = player.x;
      sprite.lastY = player.y;
    }
  }

  private removePlayerSprite(sessionId: string): void {
    const sprite = this.players.get(sessionId);
    if (sprite) {
      sprite.container.destroy();
      this.players.delete(sessionId);
    }
  }

  private tryInteract(): void {
    if (this.nearbyMachine) {
      soundManager.playClick();
      if (this.nearbyMachine === "shop") {
        this.openShop();
      } else {
        const room = colyseusClient.getRoom();
        room?.send("interact", { machineId: this.nearbyMachine });
      }
    }
  }

  private openGame(machineId: string): void {
    // Launch the appropriate game scene as overlay
    switch (machineId) {
      case "slots":
        this.scene.launch("SlotScene");
        this.scene.pause();
        break;
      case "plinko":
        this.scene.launch("PlinkoScene");
        this.scene.pause();
        break;
      case "crash":
        this.scene.launch("CrashScene");
        this.scene.pause();
        break;
    }
  }

  private openShop(): void {
    this.scene.launch("ShopScene");
    this.scene.pause();
  }

  private openAvatarCustomization(): void {
    this.scene.launch("AvatarScene");
    this.scene.pause();
  }

  private openCoinStore(): void {
    const userId = this.registry.get("userId") || "guest";
    const store = new CoinStore(userId, "", "");
    store.show(() => {
      // Store closed, resume game
    });
  }

  private claimDailyBonus(): void {
    const room = colyseusClient.getRoom();
    if (!room) return;
    room.send("claim_daily_bonus");
  }

  private showToast(message: string, color: string = "#ffffff"): void {
    const toast = this.add.text(
      this.cameras.main.width / 2, 80, message,
      {
        fontFamily: "Nunito, sans-serif",
        fontSize: "16px",
        color,
        backgroundColor: "#000000cc",
        padding: { x: 16, y: 8 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: 60,
      duration: 2000,
      delay: 1500,
      onComplete: () => toast.destroy(),
    });
  }

  private checkMachineProximity(): void {
    const machines = [
      { id: "slots", x: 150, y: 120, w: 220, h: 160 },
      { id: "plinko", x: 490, y: 120, w: 220, h: 160 },
      { id: "crash", x: 830, y: 120, w: 220, h: 160 },
      { id: "shop", x: 150, y: 700, w: 260, h: 140 }, // Sprint 3 — Shop zone
    ];

    let found: string | null = null;
    for (const m of machines) {
      const cx = m.x + m.w / 2;
      const cy = m.y + m.h / 2;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, cx, cy);
      if (dist < 130) {
        found = m.id;
        break;
      }
    }

    if (found !== this.nearbyMachine) {
      this.nearbyMachine = found;
      if (found) {
        const promptText = found === "shop" ? "⏎ SPACE to Shop" : "⏎ SPACE to Play";
        // Update prompt text
        const textObj = this.interactPrompt.getAt(1) as Phaser.GameObjects.Text;
        textObj.setText(promptText);
        this.interactPrompt.setPosition(this.playerX, this.playerY - 60);
        this.interactPrompt.setVisible(true);
      } else {
        this.interactPrompt.setVisible(false);
      }
    }

    if (found) {
      this.interactPrompt.setPosition(this.playerX, this.playerY - 60);
    }
  }

  update(time: number, delta: number): void {
    const room = colyseusClient.getRoom();
    if (!room) return;

    const player = room.state.players.get(this.mySessionId);
    if (!player) return;

    // Handle input
    let dx = 0;
    let dy = 0;
    const speed = 3;

    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= speed;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += speed;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= speed;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += speed;

    const moving = dx !== 0 || dy !== 0;

    if (moving) {
      this.playerX = Math.max(80, Math.min(1120, this.playerX + dx));
      this.playerY = Math.max(100, Math.min(860, this.playerY + dy));

      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = dx > 0 ? "right" : "left";
      } else {
        this.direction = dy > 0 ? "down" : "up";
      }

      this.animTimer += delta;
      if (this.animTimer > 150) {
        this.animFrame = (this.animFrame + 1) % 4;
        this.animTimer = 0;
      }
    }

    this.isMoving = moving;

    // Send position updates (throttled)
    this.moveTimer += delta;
    if (this.moveTimer > 50) {
      this.moveTimer = 0;
      room.send("move", {
        x: this.playerX,
        y: this.playerY,
        isMoving: this.isMoving,
        direction: this.direction,
        animFrame: this.animFrame,
      });
    }

    // Smooth interpolation for all player sprites (Bug 9 fix)
    const lerpFactor = 1 - Math.pow(0.001, delta / 1000); // Frame-rate independent lerp
    this.players.forEach((sprite, sessionId) => {
      if (sessionId === this.mySessionId) {
        // Local player: snap directly
        sprite.container.x = this.playerX;
        sprite.container.y = this.playerY;
      } else {
        // Remote players: smooth lerp toward target
        sprite.container.x += (sprite.targetX - sprite.container.x) * lerpFactor;
        sprite.container.y += (sprite.targetY - sprite.container.y) * lerpFactor;
      }
    });

    // Check machine proximity
    this.checkMachineProximity();

    // Update player count
    this.playerCountText.setText(`👥 ${this.players.size} online`);
  }
}
