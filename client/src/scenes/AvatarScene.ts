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

// All hat/accessory options that can appear in customization
const ALL_HATS = [
  { id: "hat_crown", value: "crown", label: "👑 Crown" },
  { id: "hat_tophat", value: "tophat", label: "🎩 Top Hat" },
  { id: "hat_bunny", value: "bunny", label: "🐰 Bunny Ears" },
];

const ALL_ACCESSORIES = [
  { id: "acc_sunglasses", value: "sunglasses", label: "😎 Sunglasses" },
  { id: "acc_monocle", value: "monocle", label: "🧐 Monocle" },
];

export class AvatarScene extends Phaser.Scene {
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private currentOutfit: string = "#e74c3c";
  private currentHair: string = "#4a3728";
  private currentSkin: string = "#ffdbac";
  private currentAccessory: string = "none";
  private currentHat: string = "none";
  private ownedItemIds: string[] = [];
  private isRestarting: boolean = false;

  constructor() {
    super({ key: "AvatarScene" });
  }

  init(data?: { local?: boolean }): void {
    // If restarting with local state, skip overwriting from room state
    if (data && data.local) {
      this.isRestarting = true;
    } else {
      this.isRestarting = false;
    }
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Only load from room state on fresh open, not on local UI restarts
    if (!this.isRestarting) {
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
    }

    // Load owned items from registry (populated by ShopScene)
    this.ownedItemIds = this.registry.get("ownedCosmeticIds") || [];

    // Dark overlay
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRect(0, 0, width, height);

    // Panel
    const panelW = 500;
    const panelH = 620;
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
    closeBtn.on("pointerup", () => this.closeAvatar());

    // Preview area
    this.previewGraphics = this.add.graphics();
    this.drawPreview(width / 2, panelY + 120);

    // === Skin Tone Section ===
    this.add.text(panelX + 30, panelY + 195, "Skin Tone", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#c4b5fd",
      fontStyle: "bold",
    });

    SKIN_TONES.forEach((skin, i) => {
      const sx = panelX + 30 + i * 50;
      const sy = panelY + 220;
      const color = Phaser.Display.Color.HexStringToColor(skin.value).color;

      const swatch = this.add.graphics();
      swatch.fillStyle(color);
      swatch.fillCircle(sx + 18, sy + 18, 16);
      if (this.currentSkin === skin.value) {
        swatch.lineStyle(3, COLORS.WARM_GOLD, 1);
        swatch.strokeCircle(sx + 18, sy + 18, 18);
      }

      const hitArea = this.add.zone(sx + 18, sy + 18, 36, 36).setInteractive({ useHandCursor: true });
      hitArea.on("pointerup", () => {
        this.currentSkin = skin.value;
        this.applyChanges();
        this.scene.restart({ local: true });
      });
    });

    // === Hair Color Section ===
    this.add.text(panelX + 30, panelY + 265, "Hair Color", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#c4b5fd",
      fontStyle: "bold",
    });

    const allHairOptions = [...DEFAULT_HAIR_COLORS];
    // Add purchased hair colors from shop items
    const shopItems: any[] = this.registry.get("shopItems") || [];
    shopItems.forEach((item: any) => {
      if (item.category === "hair" && this.ownedItemIds.includes(item.id)) {
        if (!allHairOptions.find(h => h.value === item.value)) {
          allHairOptions.push({ id: item.id, value: item.value, label: item.name });
        }
      }
    });

    allHairOptions.forEach((hair, i) => {
      const sx = panelX + 30 + i * 50;
      const sy = panelY + 290;
      const color = Phaser.Display.Color.HexStringToColor(hair.value).color;

      const swatch = this.add.graphics();
      swatch.fillStyle(color);
      swatch.fillCircle(sx + 18, sy + 18, 16);
      if (this.currentHair === hair.value) {
        swatch.lineStyle(3, COLORS.WARM_GOLD, 1);
        swatch.strokeCircle(sx + 18, sy + 18, 18);
      }

      const hitArea = this.add.zone(sx + 18, sy + 18, 36, 36).setInteractive({ useHandCursor: true });
      hitArea.on("pointerup", () => {
        this.currentHair = hair.value;
        this.applyChanges();
        this.scene.restart({ local: true });
      });
    });

    if (allHairOptions.length <= DEFAULT_HAIR_COLORS.length) {
      this.add.text(panelX + 30 + allHairOptions.length * 50 + 10, panelY + 302, "More in Shop →", {
        fontFamily: "Nunito, sans-serif",
        fontSize: "12px",
        color: "#ffd700",
        fontStyle: "italic",
      });
    }

    // === Outfit Color Section ===
    this.add.text(panelX + 30, panelY + 340, "Outfit Color", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#c4b5fd",
      fontStyle: "bold",
    });

    const defaultOutfitColors = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f39c12", "#1abc9c"];
    defaultOutfitColors.forEach((color, i) => {
      const sx = panelX + 30 + i * 50;
      const sy = panelY + 365;
      const hex = Phaser.Display.Color.HexStringToColor(color).color;

      const swatch = this.add.graphics();
      swatch.fillStyle(hex);
      swatch.fillCircle(sx + 18, sy + 18, 16);
      if (this.currentOutfit === color) {
        swatch.lineStyle(3, COLORS.WARM_GOLD, 1);
        swatch.strokeCircle(sx + 18, sy + 18, 18);
      }

      const hitArea = this.add.zone(sx + 18, sy + 18, 36, 36).setInteractive({ useHandCursor: true });
      hitArea.on("pointerup", () => {
        this.currentOutfit = color;
        this.applyChanges();
        this.scene.restart({ local: true });
      });
    });

    // === Hat Section ===
    this.add.text(panelX + 30, panelY + 420, "Hat", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#c4b5fd",
      fontStyle: "bold",
    });

    // "None" option for hat
    const noneHatX = panelX + 30;
    const hatY = panelY + 445;
    const noneHatBg = this.add.graphics();
    const hatNoneSelected = this.currentHat === "none";
    noneHatBg.fillStyle(0x44318d, 0.8);
    noneHatBg.fillRoundedRect(noneHatX, hatY, 50, 32, 6);
    if (hatNoneSelected) {
      noneHatBg.lineStyle(2, COLORS.WARM_GOLD, 1);
      noneHatBg.strokeRoundedRect(noneHatX, hatY, 50, 32, 6);
    }
    const noneHatText = this.add.text(noneHatX + 25, hatY + 16, "None", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "11px",
      color: hatNoneSelected ? "#ffd700" : "#c4b5fd",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    noneHatText.on("pointerup", () => {
      this.currentHat = "none";
      this.applyChanges();
      this.scene.restart({ local: true });
    });

    ALL_HATS.forEach((hat, i) => {
      const hx = panelX + 90 + i * 65;
      const isOwned = this.isItemOwned("hat", hat.value);
      const isActive = this.currentHat === hat.value;

      const hatBg = this.add.graphics();
      hatBg.fillStyle(isOwned ? 0x44318d : 0x222222, 0.8);
      hatBg.fillRoundedRect(hx, hatY, 58, 32, 6);
      if (isActive) {
        hatBg.lineStyle(2, COLORS.WARM_GOLD, 1);
        hatBg.strokeRoundedRect(hx, hatY, 58, 32, 6);
      }

      const labelText = isOwned ? hat.label.split(" ")[0] : `🔒 ${hat.label.split(" ")[0]}`;
      const hatText = this.add.text(hx + 29, hatY + 16, labelText, {
        fontFamily: "Nunito, sans-serif",
        fontSize: "11px",
        color: isOwned ? (isActive ? "#ffd700" : "#c4b5fd") : "#666666",
      }).setOrigin(0.5);

      if (isOwned) {
        hatText.setInteractive({ useHandCursor: true });
        hatText.on("pointerup", () => {
          this.currentHat = hat.value;
          this.applyChanges();
          this.scene.restart({ local: true });
        });
      }
    });

    // === Accessory Section ===
    this.add.text(panelX + 30, panelY + 490, "Accessory", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "14px",
      color: "#c4b5fd",
      fontStyle: "bold",
    });

    const accY = panelY + 515;
    // "None" option for accessory
    const noneAccBg = this.add.graphics();
    const accNoneSelected = this.currentAccessory === "none";
    noneAccBg.fillStyle(0x44318d, 0.8);
    noneAccBg.fillRoundedRect(panelX + 30, accY, 50, 32, 6);
    if (accNoneSelected) {
      noneAccBg.lineStyle(2, COLORS.WARM_GOLD, 1);
      noneAccBg.strokeRoundedRect(panelX + 30, accY, 50, 32, 6);
    }
    const noneAccText = this.add.text(panelX + 55, accY + 16, "None", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "11px",
      color: accNoneSelected ? "#ffd700" : "#c4b5fd",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    noneAccText.on("pointerup", () => {
      this.currentAccessory = "none";
      this.applyChanges();
      this.scene.restart({ local: true });
    });

    ALL_ACCESSORIES.forEach((acc, i) => {
      const ax = panelX + 90 + i * 80;
      const isOwned = this.isItemOwned("accessory", acc.value);
      const isActive = this.currentAccessory === acc.value;

      const accBg = this.add.graphics();
      accBg.fillStyle(isOwned ? 0x44318d : 0x222222, 0.8);
      accBg.fillRoundedRect(ax, accY, 72, 32, 6);
      if (isActive) {
        accBg.lineStyle(2, COLORS.WARM_GOLD, 1);
        accBg.strokeRoundedRect(ax, accY, 72, 32, 6);
      }

      const labelText = isOwned ? acc.label.split(" ")[0] : `🔒 ${acc.label.split(" ")[0]}`;
      const accText = this.add.text(ax + 36, accY + 16, labelText, {
        fontFamily: "Nunito, sans-serif",
        fontSize: "11px",
        color: isOwned ? (isActive ? "#ffd700" : "#c4b5fd") : "#666666",
      }).setOrigin(0.5);

      if (isOwned) {
        accText.setInteractive({ useHandCursor: true });
        accText.on("pointerup", () => {
          this.currentAccessory = acc.value;
          this.applyChanges();
          this.scene.restart({ local: true });
        });
      }
    });

    // Tip text
    this.add.text(panelX + 30, panelY + 560, "💡 Buy hats & accessories from the Cosmetics Boutique!", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "12px",
      color: "#a78bfa",
      fontStyle: "italic",
    });

    // Save button
    const saveBtnX = width / 2 - 60;
    const saveBtnY = panelY + panelH - 45;
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
    saveText.on("pointerup", () => {
      this.applyChanges();
      this.closeAvatar();
    });

    // ESC to close
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      this.closeAvatar();
    });
  }

  private isItemOwned(category: string, value: string): boolean {
    const shopItems: any[] = this.registry.get("shopItems") || [];
    // Check if any owned item matches this category and value
    for (const item of shopItems) {
      if (item.category === category && item.value === value && this.ownedItemIds.includes(item.id)) {
        return true;
      }
    }
    return false;
  }

  private drawPreview(cx: number, cy: number): void {
    const g = this.previewGraphics;
    g.clear();

    const skinColor = Phaser.Display.Color.HexStringToColor(this.currentSkin).color;
    const hairColor = Phaser.Display.Color.HexStringToColor(this.currentHair).color;
    const outfitColor = Phaser.Display.Color.HexStringToColor(this.currentOutfit).color;

    // Scale up for preview (2.5x)
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

    // Hair — just the top part
    g.fillStyle(hairColor);
    g.fillRoundedRect(cx - 10 * s, cy - 26 * s, 20 * s, 12 * s, 6 * s);

    // Eyes — on the face (below hair), matching Bug 4 fix
    g.fillStyle(0x000000);
    g.fillCircle(cx - 4 * s, cy - 10 * s, 2 * s);
    g.fillCircle(cx + 4 * s, cy - 10 * s, 2 * s);

    // Gold belt
    g.fillStyle(COLORS.WARM_GOLD);
    g.fillRect(cx - 10 * s, cy + 5 * s, 20 * s, 3 * s);

    // Hat — drawn as graphics on top of head
    if (this.currentHat !== "none") {
      if (this.currentHat === "crown") {
        g.fillStyle(COLORS.WARM_GOLD);
        // Base band
        g.fillRect(cx - 7 * s, cy - 29 * s, 14 * s, 4 * s);
        // 3 pointed spikes
        g.fillTriangle(
          cx - 6 * s, cy - 29 * s,
          cx - 4 * s, cy - 35 * s,
          cx - 2 * s, cy - 29 * s
        );
        g.fillTriangle(
          cx - 2 * s, cy - 29 * s,
          cx, cy - 37 * s,
          cx + 2 * s, cy - 29 * s
        );
        g.fillTriangle(
          cx + 2 * s, cy - 29 * s,
          cx + 4 * s, cy - 35 * s,
          cx + 6 * s, cy - 29 * s
        );
      } else if (this.currentHat === "tophat") {
        g.fillStyle(0x1a1a1a);
        // Tall cylinder
        g.fillRect(cx - 6 * s, cy - 40 * s, 12 * s, 14 * s);
        // Wide brim
        g.fillRect(cx - 9 * s, cy - 26 * s, 18 * s, 3 * s);
      } else if (this.currentHat === "bunny") {
        g.fillStyle(0xffc0cb);
        // Two tall pink oval ears
        g.fillEllipse(cx - 5 * s, cy - 36 * s, 5 * s, 12 * s);
        g.fillEllipse(cx + 5 * s, cy - 36 * s, 5 * s, 12 * s);
        // Inner ear (lighter pink)
        g.fillStyle(0xffe4e9);
        g.fillEllipse(cx - 5 * s, cy - 36 * s, 3 * s, 8 * s);
        g.fillEllipse(cx + 5 * s, cy - 36 * s, 3 * s, 8 * s);
      }
    }

    // Accessory — drawn as graphics on the face area
    if (this.currentAccessory !== "none") {
      if (this.currentAccessory === "sunglasses" || this.currentAccessory === "glasses") {
        g.lineStyle(1.5 * s, 0x000000, 1);
        // Left lens
        g.strokeCircle(cx - 4 * s, cy - 10 * s, 3 * s);
        // Right lens
        g.strokeCircle(cx + 4 * s, cy - 10 * s, 3 * s);
        // Bridge
        g.lineBetween(cx - 1 * s, cy - 10 * s, cx + 1 * s, cy - 10 * s);
        // Side arms
        g.lineBetween(cx - 7 * s, cy - 10 * s, cx - 7 * s, cy - 9 * s);
        g.lineBetween(cx + 7 * s, cy - 10 * s, cx + 7 * s, cy - 9 * s);
      } else if (this.currentAccessory === "monocle") {
        g.lineStyle(1.5 * s, 0x8b7355, 1);
        // Single circle over right eye
        g.strokeCircle(cx + 4 * s, cy - 10 * s, 3.5 * s);
        // Chain dropping down
        g.lineBetween(cx + 4 * s, cy - 6.5 * s, cx + 4 * s, cy);
      }
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
