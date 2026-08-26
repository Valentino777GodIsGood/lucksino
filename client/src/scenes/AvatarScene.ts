import Phaser from "phaser";
import { colyseusClient } from "../network/ColyseusClient";
import { soundManager } from "../audio/SoundManager";

const COLORS = {
  DEEP_PURPLE: 0x2d1b69,
  DARKER_PURPLE: 0x1a0a2e,
  WARM_GOLD: 0xffd700,
  WHITE: 0xffffff,
  BLACK: 0x000000,
};

// Default/free options available to all players
const SKIN_TONES = [
  { id: "skin_pale", value: "#fce4ec", label: "Porcelain" },
  { id: "skin_fair", value: "#ffdbac", label: "Fair" },
  { id: "skin_tan", value: "#c68642", label: "Tan" },
  { id: "skin_brown", value: "#8d5524", label: "Brown" },
  { id: "skin_dark", value: "#4e342e", label: "Dark" },
];

const DEFAULT_HAIR_COLORS = [
  { id: "default_black", value: "#1a1a1a", label: "Black" },
  { id: "default_brown", value: "#4a3728", label: "Brown" },
  { id: "default_auburn", value: "#8b4513", label: "Auburn" },
];

const DEFAULT_OUTFITS = [
  { id: "outfit_crimson", value: "#e74c3c", label: "Crimson" },
];

export class AvatarScene extends Phaser.Scene {
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private currentOutfit: string = "#e74c3c";
  private currentHair: string = "#4a3728";
  private currentSkin: string = "#ffdbac";
  private currentAccessory: string = "none";
  private currentHat: string = "none";

  constructor() {
    super({ key: "AvatarScene" });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Load current avatar from room state
    const room = colyseusClient.getRoom();
    if (room) {
      const myPlayer = room.state.players.get(room.sessionId);
      if (myPlayer) {
        this.currentOutfit = myPlayer.outfitColor;
        this.currentHair = myPlayer.hairColor;
        this.currentSkin = myPlayer.skinTone;
        this.currentAccessory = myPlayer.accessory || "none";
        this.currentHat = myPlayer.hat || "none";
      }
    }

    // Dark overlay
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRect(0, 0, width, height);

    // Panel
    const panelW = 500;
    const panelH = 600;
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.DEEP_PURPLE, 0.98);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
    panel.lineStyle(3, COLORS.WARM_GOLD, 1);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);

    // Header
    this.add.text(width / 2, panelY + 30, "🪞 AVATAR CUSTOMIZATION", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "22px",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Close button
    const closeBtn = this.add.text(panelX + panelW - 30, panelY + 15, "✕", {
      fontSize: "24px",
      color: "#ff6b6b",
      fontStyle: "bold",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeAvatar());

    // Preview area
    this.previewGraphics = this.add.graphics();
    this.drawPreview(width / 2, panelY + 130);

    // === Skin Tone Section ===
    this.add.text(panelX + 30, panelY + 210, "Skin Tone", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#c4b5fd",
      fontStyle: "bold",
    });

    SKIN_TONES.forEach((skin, i) => {
      const sx = panelX + 30 + i * 50;
      const sy = panelY + 240;
      const color = Phaser.Display.Color.HexStringToColor(skin.value).color;

      const swatch = this.add.graphics();
      swatch.fillStyle(color);
      swatch.fillCircle(sx + 18, sy + 18, 16);
      if (this.currentSkin === skin.value) {
        swatch.lineStyle(3, COLORS.WARM_GOLD, 1);
        swatch.strokeCircle(sx + 18, sy + 18, 18);
      }

      const hitArea = this.add.zone(sx + 18, sy + 18, 36, 36).setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => {
        this.currentSkin = skin.value;
        this.applyChanges();
        this.scene.restart();
      });
    });

    // === Hair Color Section ===
    this.add.text(panelX + 30, panelY + 290, "Hair Color", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#c4b5fd",
      fontStyle: "bold",
    });

    const allHairOptions = [...DEFAULT_HAIR_COLORS];
    // We'll show what they have; advanced colors come from the shop
    allHairOptions.forEach((hair, i) => {
      const sx = panelX + 30 + i * 50;
      const sy = panelY + 320;
      const color = Phaser.Display.Color.HexStringToColor(hair.value).color;

      const swatch = this.add.graphics();
      swatch.fillStyle(color);
      swatch.fillCircle(sx + 18, sy + 18, 16);
      if (this.currentHair === hair.value) {
        swatch.lineStyle(3, COLORS.WARM_GOLD, 1);
        swatch.strokeCircle(sx + 18, sy + 18, 18);
      }

      const hitArea = this.add.zone(sx + 18, sy + 18, 36, 36).setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => {
        this.currentHair = hair.value;
        this.applyChanges();
        this.scene.restart();
      });
    });

    this.add.text(panelX + 30 + DEFAULT_HAIR_COLORS.length * 50 + 10, panelY + 332, "More in Shop →", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "12px",
      color: "#ffd700",
      fontStyle: "italic",
    });

    // === Outfit Color Section ===
    this.add.text(panelX + 30, panelY + 375, "Outfit Color", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#c4b5fd",
      fontStyle: "bold",
    });

    const defaultOutfitColors = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f39c12", "#1abc9c"];
    defaultOutfitColors.forEach((color, i) => {
      const sx = panelX + 30 + i * 50;
      const sy = panelY + 405;
      const hex = Phaser.Display.Color.HexStringToColor(color).color;

      const swatch = this.add.graphics();
      swatch.fillStyle(hex);
      swatch.fillCircle(sx + 18, sy + 18, 16);
      if (this.currentOutfit === color) {
        swatch.lineStyle(3, COLORS.WARM_GOLD, 1);
        swatch.strokeCircle(sx + 18, sy + 18, 18);
      }

      const hitArea = this.add.zone(sx + 18, sy + 18, 36, 36).setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => {
        this.currentOutfit = color;
        this.applyChanges();
        this.scene.restart();
      });
    });

    // === Accessories info ===
    this.add.text(panelX + 30, panelY + 465, "Accessory: " + (this.currentAccessory === "none" ? "None" : this.currentAccessory), {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#c4b5fd",
    });

    this.add.text(panelX + 30, panelY + 490, "Hat: " + (this.currentHat === "none" ? "None" : this.currentHat), {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#c4b5fd",
    });

    this.add.text(panelX + 30, panelY + 520, "💡 Buy more styles from the Cosmetics Boutique!", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "12px",
      color: "#a78bfa",
      fontStyle: "italic",
    });

    // Save button
    const saveBtnX = width / 2 - 60;
    const saveBtnY = panelY + panelH - 50;
    const saveBtn = this.add.graphics();
    saveBtn.fillStyle(COLORS.WARM_GOLD, 0.3);
    saveBtn.fillRoundedRect(saveBtnX, saveBtnY, 120, 36, 8);
    saveBtn.lineStyle(2, COLORS.WARM_GOLD, 0.8);
    saveBtn.strokeRoundedRect(saveBtnX, saveBtnY, 120, 36, 8);

    const saveText = this.add.text(width / 2, saveBtnY + 18, "✓ SAVE & CLOSE", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "13px",
      color: "#ffd700",
      fontStyle: "bold",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    saveText.on("pointerdown", () => {
      this.applyChanges();
      this.closeAvatar();
    });

    // ESC to close
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      this.closeAvatar();
    });
  }

  private drawPreview(cx: number, cy: number): void {
    const g = this.previewGraphics;
    g.clear();

    const skinColor = Phaser.Display.Color.HexStringToColor(this.currentSkin).color;
    const hairColor = Phaser.Display.Color.HexStringToColor(this.currentHair).color;
    const outfitColor = Phaser.Display.Color.HexStringToColor(this.currentOutfit).color;

    // Scale up for preview (2x)
    const s = 2.5;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(cx, cy + 18 * s, 24 * s, 8 * s);

    // Body (outfit)
    g.fillStyle(outfitColor);
    g.fillRoundedRect(cx - 10 * s, cy - 5 * s, 20 * s, 22 * s, 6 * s);

    // Head (skin)
    g.fillStyle(skinColor);
    g.fillCircle(cx, cy - 14 * s, 12 * s);

    // Hair
    g.fillStyle(hairColor);
    g.fillRoundedRect(cx - 10 * s, cy - 26 * s, 20 * s, 14 * s, 6 * s);

    // Eyes
    g.fillStyle(0x000000);
    g.fillCircle(cx - 4 * s, cy - 14 * s, 2 * s);
    g.fillCircle(cx + 4 * s, cy - 14 * s, 2 * s);

    // Gold belt
    g.fillStyle(COLORS.WARM_GOLD);
    g.fillRect(cx - 10 * s, cy + 5 * s, 20 * s, 3 * s);

    // Hat indicator
    if (this.currentHat !== "none") {
      const hatEmoji = this.currentHat === "crown" ? "👑" : this.currentHat === "tophat" ? "🎩" : "🐰";
      this.add.text(cx, cy - 35 * s, hatEmoji, { fontSize: "28px" }).setOrigin(0.5);
    }

    // Accessory indicator
    if (this.currentAccessory !== "none") {
      const accEmoji = this.currentAccessory === "sunglasses" ? "😎" : this.currentAccessory === "monocle" ? "🧐" : "⭐";
      this.add.text(cx + 20 * s, cy - 14 * s, accEmoji, { fontSize: "16px" }).setOrigin(0.5);
    }
  }

  private applyChanges(): void {
    const room = colyseusClient.getRoom();
    if (!room) return;

    soundManager.playClick();
    room.send("avatar_update", {
      outfitColor: this.currentOutfit,
      hairColor: this.currentHair,
      skinTone: this.currentSkin,
      accessory: this.currentAccessory,
      hat: this.currentHat,
    });
  }

  private closeAvatar(): void {
    this.scene.stop();
    this.scene.resume("CasinoScene");
  }
}
