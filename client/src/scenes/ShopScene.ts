import Phaser from "phaser";
import { colyseusClient } from "../network/ColyseusClient";
import { soundManager } from "../audio/SoundManager";

const COLORS = {
  DEEP_PURPLE: 0x2d1b69,
  DARKER_PURPLE: 0x1a0a2e,
  WARM_GOLD: 0xffd700,
  GOLD_DIM: 0xb8860b,
  WHITE: 0xffffff,
  BLACK: 0x000000,
  SUCCESS_GREEN: 0x2ecc71,
  ERROR_RED: 0xff4757,
};

const RARITY_COLORS: Record<string, number> = {
  common: 0x95a5a6,
  rare: 0x3498db,
  epic: 0x9b59b6,
  legendary: 0xf39c12,
};

interface ShopItem {
  id: string;
  name: string;
  category: string;
  value: string;
  price: number;
  rarity: string;
  description: string;
}

export class ShopScene extends Phaser.Scene {
  private items: ShopItem[] = [];
  private ownedItems: string[] = [];
  private selectedCategory: string = "outfit";
  private scrollY: number = 0;
  private itemContainer!: Phaser.GameObjects.Container;
  private coinText!: Phaser.GameObjects.Text;
  private categoryButtons: Phaser.GameObjects.Container[] = [];
  private catalogHandler: ((data: any) => void) | null = null;
  private purchaseHandler: ((data: any) => void) | null = null;

  constructor() {
    super({ key: "ShopScene" });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Reset state on each open (Bug 5 fix)
    this.items = [];
    this.ownedItems = [];
    this.selectedCategory = "outfit";
    this.scrollY = 0;
    this.categoryButtons = [];

    // Dark overlay background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.92);
    bg.fillRect(0, 0, width, height);

    // Shop panel
    const panelX = 50;
    const panelY = 40;
    const panelW = width - 100;
    const panelH = height - 80;

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.DEEP_PURPLE, 0.98);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
    panel.lineStyle(3, COLORS.WARM_GOLD, 1);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);

    // Golden storefront header
    const headerBg = this.add.graphics();
    headerBg.fillStyle(COLORS.WARM_GOLD, 0.15);
    headerBg.fillRoundedRect(panelX, panelY, panelW, 70, { tl: 20, tr: 20, bl: 0, br: 0 });

    this.add.text(width / 2, panelY + 35, "✨ COSMETICS BOUTIQUE ✨", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "28px",
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
    closeBtn.on("pointerdown", () => this.closeShop());
    closeBtn.on("pointerover", () => closeBtn.setColor("#ff9999"));
    closeBtn.on("pointerout", () => closeBtn.setColor("#ff6b6b"));

    // Coin display
    this.coinText = this.add.text(panelX + 20, panelY + 80, "🪙 ---", {
      fontFamily: "Fredoka One, cursive",
      fontSize: "20px",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 2,
    });

    // Category tabs
    const categories = [
      { id: "outfit", label: "👕 Outfits" },
      { id: "hair", label: "💇 Hair" },
      { id: "skin", label: "🎨 Skin" },
      { id: "accessory", label: "👓 Accessories" },
      { id: "hat", label: "🎩 Hats" },
    ];

    const tabY = panelY + 115;
    const tabStartX = panelX + 20;
    const tabWidth = (panelW - 60) / categories.length;

    categories.forEach((cat, i) => {
      const tabX = tabStartX + i * tabWidth;
      const container = this.add.container(tabX + tabWidth / 2, tabY);

      const tabBg = this.add.graphics();
      const isSelected = cat.id === this.selectedCategory;
      tabBg.fillStyle(isSelected ? COLORS.WARM_GOLD : 0x44318d, isSelected ? 0.3 : 0.6);
      tabBg.fillRoundedRect(-tabWidth / 2 + 4, -15, tabWidth - 8, 30, 8);
      if (isSelected) {
        tabBg.lineStyle(2, COLORS.WARM_GOLD, 0.8);
        tabBg.strokeRoundedRect(-tabWidth / 2 + 4, -15, tabWidth - 8, 30, 8);
      }

      const label = this.add.text(0, 0, cat.label, {
        fontFamily: "Nunito, sans-serif",
        fontSize: "13px",
        color: isSelected ? "#ffd700" : "#c4b5fd",
        fontStyle: "bold",
      }).setOrigin(0.5);

      container.add([tabBg, label]);
      container.setInteractive(
        new Phaser.Geom.Rectangle(-tabWidth / 2, -15, tabWidth, 30),
        Phaser.Geom.Rectangle.Contains
      );
      container.on("pointerdown", () => {
        this.selectedCategory = cat.id;
        this.scrollY = 0;
        this.refreshDisplay();
      });

      this.categoryButtons.push(container);
    });

    // Scrollable item container
    this.itemContainer = this.add.container(0, 0);

    // Mask for scrolling
    const maskShape = this.make.graphics({});
    maskShape.fillRect(panelX + 10, panelY + 150, panelW - 20, panelH - 170);
    const mask = maskShape.createGeometryMask();
    this.itemContainer.setMask(mask);

    // Mouse wheel scroll
    this.input.on("wheel", (_pointer: any, _go: any, _gox: any, deltaY: number) => {
      this.scrollY = Math.max(0, this.scrollY + deltaY * 0.5);
      this.refreshItems();
    });

    // Request catalog from server — fresh on every open
    const room = colyseusClient.getRoom();
    if (room) {
      // Remove any previous handlers to prevent duplication
      if (this.catalogHandler) {
        room.onMessage("shop_catalog", this.catalogHandler);
      }
      if (this.purchaseHandler) {
        room.onMessage("shop_purchased", this.purchaseHandler);
      }

      this.catalogHandler = (data: { items: ShopItem[]; owned: string[] }) => {
        this.items = data.items;
        this.ownedItems = data.owned;
        // Persist owned items to registry so AvatarScene can read them
        this.registry.set("ownedCosmeticIds", [...this.ownedItems]);
        this.registry.set("shopItems", [...this.items]);
        this.refreshDisplay();
      };

      this.purchaseHandler = (data: { itemId: string; newBalance: number }) => {
        if (!this.ownedItems.includes(data.itemId)) {
          this.ownedItems.push(data.itemId);
        }
        this.coinText.setText(`🪙 ${data.newBalance}`);
        // Update registry
        this.registry.set("ownedCosmeticIds", [...this.ownedItems]);
        this.showToast("Purchase successful! 🎉", COLORS.SUCCESS_GREEN);
        soundManager.playWin();
        this.refreshItems();
      };

      room.onMessage("shop_catalog", this.catalogHandler);
      room.onMessage("shop_purchased", this.purchaseHandler);

      // Always request catalog fresh
      room.send("shop_catalog");

      // Update coin display
      const myPlayer = room.state.players.get(room.sessionId);
      if (myPlayer) {
        this.coinText.setText(`🪙 ${myPlayer.coins}`);
      }
    }

    // ESC to close
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      this.closeShop();
    });
  }

  private refreshDisplay(): void {
    // Rebuild category tabs visual
    const categories = ["outfit", "hair", "skin", "accessory", "hat"];
    this.categoryButtons.forEach((btn, i) => {
      const isSelected = categories[i] === this.selectedCategory;
      const tabBg = btn.getAt(0) as Phaser.GameObjects.Graphics;
      const label = btn.getAt(1) as Phaser.GameObjects.Text;
      const tabWidth = (this.cameras.main.width - 160) / 5;

      tabBg.clear();
      tabBg.fillStyle(isSelected ? COLORS.WARM_GOLD : 0x44318d, isSelected ? 0.3 : 0.6);
      tabBg.fillRoundedRect(-tabWidth / 2 + 4, -15, tabWidth - 8, 30, 8);
      if (isSelected) {
        tabBg.lineStyle(2, COLORS.WARM_GOLD, 0.8);
        tabBg.strokeRoundedRect(-tabWidth / 2 + 4, -15, tabWidth - 8, 30, 8);
      }
      label.setColor(isSelected ? "#ffd700" : "#c4b5fd");
    });

    this.refreshItems();
  }

  private refreshItems(): void {
    this.itemContainer.removeAll(true);

    const filtered = this.items.filter((item) => item.category === this.selectedCategory);
    const panelX = 50;
    const panelY = 40;
    const panelW = this.cameras.main.width - 100;
    const startY = panelY + 160 - this.scrollY;
    const cardW = (panelW - 80) / 3;
    const cardH = 120;
    const gap = 12;

    filtered.forEach((item, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      const x = panelX + 25 + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      const isOwned = this.ownedItems.includes(item.id);
      const rarityColor = RARITY_COLORS[item.rarity] || COLORS.WHITE;

      // Card background
      const card = this.add.graphics();
      card.fillStyle(0x1a0a2e, 0.9);
      card.fillRoundedRect(x, y, cardW, cardH, 10);
      card.lineStyle(2, isOwned ? COLORS.SUCCESS_GREEN : rarityColor, 0.8);
      card.strokeRoundedRect(x, y, cardW, cardH, 10);

      this.itemContainer.add(card);

      // Color preview swatch (for color-based items)
      if (item.category === "hair" || item.category === "outfit" || item.category === "skin") {
        const swatchColor = Phaser.Display.Color.HexStringToColor(item.value).color;
        const swatch = this.add.graphics();
        swatch.fillStyle(swatchColor);
        swatch.fillCircle(x + 30, y + 35, 16);
        swatch.lineStyle(2, COLORS.WHITE, 0.5);
        swatch.strokeCircle(x + 30, y + 35, 16);
        this.itemContainer.add(swatch);
      } else {
        // Icon text for accessories/hats
        const icon = item.category === "hat" ? "🎩" : "👓";
        const iconText = this.add.text(x + 30, y + 35, icon, {
          fontSize: "24px",
        }).setOrigin(0.5);
        this.itemContainer.add(iconText);
      }

      // Item name
      const nameText = this.add.text(x + 60, y + 15, item.name, {
        fontFamily: "Nunito, sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold",
      });
      this.itemContainer.add(nameText);

      // Rarity badge
      const rarityText = this.add.text(x + 60, y + 35, item.rarity.toUpperCase(), {
        fontFamily: "Nunito, sans-serif",
        fontSize: "10px",
        color: Phaser.Display.Color.IntegerToColor(rarityColor).rgba,
        fontStyle: "bold",
      });
      this.itemContainer.add(rarityText);

      // Description
      const descText = this.add.text(x + 60, y + 52, item.description, {
        fontFamily: "Nunito, sans-serif",
        fontSize: "11px",
        color: "#a0a0a0",
        wordWrap: { width: cardW - 75 },
      });
      this.itemContainer.add(descText);

      // Price / Owned / Buy button
      if (isOwned) {
        const ownedBadge = this.add.text(x + cardW - 15, y + cardH - 20, "✓ OWNED", {
          fontFamily: "Nunito, sans-serif",
          fontSize: "11px",
          color: "#2ecc71",
          fontStyle: "bold",
        }).setOrigin(1, 0.5);
        this.itemContainer.add(ownedBadge);
      } else if (item.price === 0) {
        const freeBadge = this.add.text(x + cardW - 15, y + cardH - 20, "FREE", {
          fontFamily: "Nunito, sans-serif",
          fontSize: "11px",
          color: "#2ecc71",
          fontStyle: "bold",
        }).setOrigin(1, 0.5);
        this.itemContainer.add(freeBadge);
      } else {
        // Buy button
        const btnW = 75;
        const btnH = 26;
        const btnX = x + cardW - btnW - 10;
        const btnY = y + cardH - btnH - 10;

        const buyBg = this.add.graphics();
        buyBg.fillStyle(COLORS.WARM_GOLD, 0.2);
        buyBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
        buyBg.lineStyle(1, COLORS.WARM_GOLD, 0.6);
        buyBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
        this.itemContainer.add(buyBg);

        const buyText = this.add.text(btnX + btnW / 2, btnY + btnH / 2, `🪙 ${item.price}`, {
          fontFamily: "Nunito, sans-serif",
          fontSize: "12px",
          color: "#ffd700",
          fontStyle: "bold",
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        buyText.on("pointerdown", () => {
          this.purchaseItem(item.id);
        });
        buyText.on("pointerover", () => buyText.setScale(1.1));
        buyText.on("pointerout", () => buyText.setScale(1.0));

        this.itemContainer.add(buyText);
      }
    });
  }

  private purchaseItem(itemId: string): void {
    const room = colyseusClient.getRoom();
    if (!room) return;
    soundManager.playClick();
    room.send("shop_buy", { itemId });
  }

  private showToast(message: string, color: number): void {
    const { width } = this.cameras.main;
    const toast = this.add.text(width / 2, 30, message, {
      fontFamily: "Nunito, sans-serif",
      fontSize: "16px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      backgroundColor: "#000000dd",
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(3000);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: 10,
      duration: 2000,
      delay: 1500,
      onComplete: () => toast.destroy(),
    });
  }

  private closeShop(): void {
    this.scene.stop();
    this.scene.resume("CasinoScene");
  }
}
