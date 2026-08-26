import { Room, Client } from "colyseus";
import { CasinoState, Player, CrashPlayerSchema } from "./CasinoState";
import { SlotMachine } from "../games/SlotMachine";
import { PlinkoGame } from "../games/PlinkoGame";
import { CrashGame } from "../games/CrashGame";
import { CosmeticsShop, COSMETIC_CATALOG } from "../games/CosmeticsShop";

const OUTFIT_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#9b59b6",
  "#f39c12", "#1abc9c", "#e91e63", "#00bcd4",
];

const STARTING_COINS = 1000;
const DAILY_BONUS = 100;
const SPAWN_X = 600;
const SPAWN_Y = 700;
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 900;
const PLAYER_RADIUS = 20;
const BET_OPTIONS = [10, 25, 50, 100];

interface JoinOptions {
  name: string;
  token?: string; // Supabase JWT token (optional for now)
}

interface MoveMessage {
  x: number;
  y: number;
  isMoving: boolean;
  direction: string;
  animFrame: number;
}

interface AvatarUpdateMessage {
  outfitColor?: string;
  hairColor?: string;
  skinTone?: string;
  accessory?: string;
  hat?: string;
}

export class CasinoRoom extends Room<CasinoState> {
  private colorIndex = 0;
  private crashGame!: CrashGame;

  onCreate(): void {
    this.setState(new CasinoState());
    this.maxClients = 50;

    // Initialize crash game
    this.crashGame = new CrashGame({
      onTick: (multiplier: number) => {
        this.state.crash.multiplier = Math.floor(multiplier * 100) / 100;
      },
      onCrash: (crashPoint: number) => {
        this.state.crash.phase = "crashed";
        this.state.crash.crashPoint = crashPoint;
        this.state.crash.multiplier = crashPoint;

        // Add to history
        this.state.crash.history.push(crashPoint);
        if (this.state.crash.history.length > 10) {
          this.state.crash.history.shift();
        }

        // Notify all clients
        this.broadcast("crash_crashed", { crashPoint });

        // Reset after delay
        setTimeout(() => {
          this.state.crash.phase = "waiting";
          this.state.crash.multiplier = 1.0;
          this.state.crash.crashPoint = 0;
          this.state.crash.players.splice(0, this.state.crash.players.length);
          this.broadcast("crash_reset", {});
        }, 4000);
      },
      onPlayerCashout: (sessionId: string, multiplier: number, payout: number) => {
        const player = this.state.players.get(sessionId);
        if (player) {
          player.coins += payout;
          this.clients.find(c => c.sessionId === sessionId)?.send("crash_cashout_result", {
            multiplier,
            payout,
            newBalance: player.coins,
          });
        }

        // Update crash state players
        const crashPlayers = this.state.crash.players;
        for (let i = 0; i < crashPlayers.length; i++) {
          if (crashPlayers[i]?.name === player?.name) {
            crashPlayers[i]!.cashedOut = true;
            crashPlayers[i]!.cashoutMultiplier = multiplier;
            break;
          }
        }

        this.broadcast("crash_player_cashout", {
          name: player?.name,
          multiplier,
        });
      },
    });

    // Movement handler
    this.onMessage("move", (client: Client, data: MoveMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      player.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, data.x));
      player.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, data.y));
      player.isMoving = data.isMoving;
      player.direction = data.direction;
      player.animFrame = data.animFrame;
    });

    // Interaction handler (opens game modal)
    this.onMessage("interact", (client: Client, data: { machineId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      client.send("machine_opened", { machineId: data.machineId });
    });

    // === AVATAR CUSTOMIZATION (Sprint 3) ===
    this.onMessage("avatar_update", (client: Client, data: AvatarUpdateMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const ownedItems: string[] = JSON.parse(player.inventory || "[]");

      // Validate that player owns the cosmetic they're trying to equip
      if (data.outfitColor) {
        const outfitItem = COSMETIC_CATALOG.find(
          (i) => i.category === "outfit" && i.value === data.outfitColor
        );
        // Allow free default colors + owned items
        if (!outfitItem || outfitItem.price === 0 || ownedItems.includes(outfitItem.id)) {
          player.outfitColor = data.outfitColor;
        }
      }
      if (data.hairColor) {
        const hairItem = COSMETIC_CATALOG.find(
          (i) => i.category === "hair" && i.value === data.hairColor
        );
        if (!hairItem || hairItem.price === 0 || ownedItems.includes(hairItem.id)) {
          player.hairColor = data.hairColor;
        }
      }
      if (data.skinTone) {
        const skinItem = COSMETIC_CATALOG.find(
          (i) => i.category === "skin" && i.value === data.skinTone
        );
        if (!skinItem || skinItem.price === 0 || ownedItems.includes(skinItem.id)) {
          player.skinTone = data.skinTone;
        }
      }
      if (data.accessory !== undefined) {
        if (data.accessory === "none") {
          player.accessory = "none";
        } else {
          const accItem = COSMETIC_CATALOG.find(
            (i) => i.category === "accessory" && i.value === data.accessory
          );
          if (accItem && ownedItems.includes(accItem.id)) {
            player.accessory = data.accessory;
          }
        }
      }
      if (data.hat !== undefined) {
        if (data.hat === "none") {
          player.hat = "none";
        } else {
          const hatItem = COSMETIC_CATALOG.find(
            (i) => i.category === "hat" && i.value === data.hat
          );
          if (hatItem && ownedItems.includes(hatItem.id)) {
            player.hat = data.hat;
          }
        }
      }

      client.send("avatar_updated", {
        outfitColor: player.outfitColor,
        hairColor: player.hairColor,
        skinTone: player.skinTone,
        accessory: player.accessory,
        hat: player.hat,
      });
    });

    // === COSMETICS SHOP (Sprint 3) ===
    this.onMessage("shop_buy", (client: Client, data: { itemId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const ownedItems: string[] = JSON.parse(player.inventory || "[]");
      const result = CosmeticsShop.purchase(player.coins, data.itemId, ownedItems);

      if (result.success) {
        player.coins = result.newBalance;
        ownedItems.push(data.itemId);
        player.inventory = JSON.stringify(ownedItems);

        const item = CosmeticsShop.getItem(data.itemId);
        client.send("shop_purchased", {
          itemId: data.itemId,
          newBalance: player.coins,
          item,
        });
      } else {
        client.send("error", { message: result.error || "Purchase failed" });
      }
    });

    this.onMessage("shop_catalog", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const ownedItems: string[] = JSON.parse(player.inventory || "[]");
      client.send("shop_catalog", {
        items: COSMETIC_CATALOG,
        owned: ownedItems,
      });
    });

    // === DAILY BONUS (Sprint 3) ===
    this.onMessage("claim_daily_bonus", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      if (player.lastDailyBonus === today) {
        client.send("error", { message: "Daily bonus already claimed today!" });
        return;
      }

      player.lastDailyBonus = today;
      player.coins += DAILY_BONUS;

      client.send("daily_bonus_claimed", {
        amount: DAILY_BONUS,
        newBalance: player.coins,
      });
    });

    // === SLOTS ===
    this.onMessage("slot_spin", (client: Client, data: { bet: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const bet = data.bet;
      if (!BET_OPTIONS.includes(bet)) {
        client.send("error", { message: "Invalid bet amount" });
        return;
      }
      if (player.coins < bet) {
        client.send("error", { message: "Not enough coins" });
        return;
      }

      // Deduct bet
      player.coins -= bet;

      // Spin
      const result = SlotMachine.spin(bet);

      // Add payout
      player.coins += result.payout;

      client.send("slot_result", {
        reels: result.reels,
        payout: result.payout,
        newBalance: player.coins,
      });
    });

    // === PLINKO ===
    this.onMessage("plinko_drop", (client: Client, data: { bet: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const bet = data.bet;
      if (!BET_OPTIONS.includes(bet)) {
        client.send("error", { message: "Invalid bet amount" });
        return;
      }
      if (player.coins < bet) {
        client.send("error", { message: "Not enough coins" });
        return;
      }

      // Deduct bet
      player.coins -= bet;

      // Drop
      const result = PlinkoGame.drop(bet);

      // Add payout
      player.coins += result.payout;

      client.send("plinko_result", {
        slotIndex: result.slotIndex,
        multiplier: result.multiplier,
        payout: result.payout,
        newBalance: player.coins,
        path: result.path,
      });
    });

    // === CRASH ===
    this.onMessage("crash_bet", (client: Client, data: { bet: number; autoCashout?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const bet = data.bet;
      if (!BET_OPTIONS.includes(bet)) {
        client.send("error", { message: "Invalid bet amount" });
        return;
      }
      if (player.coins < bet) {
        client.send("error", { message: "Not enough coins" });
        return;
      }

      const success = this.crashGame.placeBet(
        client.sessionId,
        player.name,
        bet,
        data.autoCashout
      );

      if (success) {
        player.coins -= bet;

        // Add to schema state
        const cp = new CrashPlayerSchema();
        cp.name = player.name;
        cp.bet = bet;
        cp.cashedOut = false;
        cp.cashoutMultiplier = 0;
        this.state.crash.players.push(cp);

        // Update phase
        this.state.crash.phase = this.crashGame.getPhase();

        client.send("crash_bet_accepted", { bet, newBalance: player.coins });
        this.broadcast("crash_player_joined", { name: player.name, bet });
      } else {
        client.send("error", { message: "Cannot place bet now" });
      }
    });

    this.onMessage("crash_cashout", (client: Client) => {
      const payout = this.crashGame.cashout(client.sessionId);
      if (payout === 0) {
        client.send("error", { message: "Cannot cash out now" });
      }
    });

    // Update crash phase periodically
    this.setSimulationInterval(() => {
      const phase = this.crashGame.getPhase();
      if (this.state.crash.phase !== phase) {
        this.state.crash.phase = phase;
      }
      if (phase === "running") {
        this.state.crash.multiplier = this.crashGame.getMultiplier();
      }
    }, 50);

    console.log("🎰 CasinoRoom created with games + cosmetics shop!");
  }

  onJoin(client: Client, options: JoinOptions): void {
    const player = new Player();
    player.id = client.sessionId;
    player.name = options.name || `Player${Math.floor(Math.random() * 999)}`;
    player.x = SPAWN_X + (Math.random() - 0.5) * 100;
    player.y = SPAWN_Y + (Math.random() - 0.5) * 60;
    player.outfitColor = OUTFIT_COLORS[this.colorIndex % OUTFIT_COLORS.length];
    player.hairColor = "#4a3728";
    player.skinTone = "#ffdbac";
    player.accessory = "none";
    player.hat = "none";
    player.coins = STARTING_COINS;
    player.direction = "down";
    player.isMoving = false;
    player.animFrame = 0;
    player.inventory = "[]";
    player.lastDailyBonus = "";

    this.colorIndex++;
    this.state.players.set(client.sessionId, player);

    // Send crash state to new player
    client.send("crash_state", this.crashGame.getState());

    // Check if player qualifies for daily bonus
    const today = new Date().toISOString().split("T")[0];
    if (player.lastDailyBonus !== today) {
      client.send("daily_bonus_available", { amount: DAILY_BONUS });
    }

    console.log(`🎲 ${player.name} joined the casino! (${this.state.players.size} players)`);
  }

  onLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      console.log(`👋 ${player.name} left the casino.`);
    }
    this.crashGame.removePlayer(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  onDispose(): void {
    this.crashGame.destroy();
    console.log("🏚️ CasinoRoom disposed.");
  }
}
