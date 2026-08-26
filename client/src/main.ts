import Phaser from "phaser";
import { CasinoScene } from "./scenes/CasinoScene";
import { SlotScene } from "./scenes/games/SlotScene";
import { PlinkoScene } from "./scenes/games/PlinkoScene";
import { CrashScene } from "./scenes/games/CrashScene";
import { ShopScene } from "./scenes/ShopScene";
import { AvatarScene } from "./scenes/AvatarScene";
import { colyseusClient } from "./network/ColyseusClient";
import { OnboardingFlow, OnboardingResult } from "./ui/OnboardingFlow";
import { auth } from "./auth/supabase";

let game: Phaser.Game | null = null;

async function startGame(result: OnboardingResult): Promise<void> {
  const container = document.getElementById("game-container")!;
  container.style.display = "block";

  // Connect to multiplayer server
  try {
    await colyseusClient.joinCasino(result.playerName);
  } catch (err) {
    console.warn("Could not connect to server, starting in offline mode:", err);
  }

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "game-container",
    width: 1200,
    height: 900,
    backgroundColor: "#1a0a2e",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [CasinoScene, SlotScene, PlinkoScene, CrashScene, ShopScene, AvatarScene],
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
  };

  game = new Phaser.Game(config);
  game.registry.set("playerName", result.playerName);
  game.registry.set("userId", result.userId || `guest_${Date.now()}`);
  game.registry.set("isAuthenticated", result.isAuthenticated);
}

// ─── Check for returning user with saved session ──────────────────────────────
async function init(): Promise<void> {
  // Check for purchase callback params
  const params = new URLSearchParams(window.location.search);
  const purchaseStatus = params.get("purchase");
  if (purchaseStatus) {
    // Clean the URL
    window.history.replaceState({}, "", window.location.pathname);
    if (purchaseStatus === "success") {
      // Show a quick toast after game loads
      setTimeout(() => showPurchaseToast("success"), 1500);
    }
  }

  // If user has saved session, skip to game directly
  if (auth.isLoggedIn()) {
    const savedName = localStorage.getItem("lucksino_player_name");
    if (savedName) {
      document.getElementById("welcome-screen")!.style.display = "none";
      startGame({
        playerName: savedName,
        isAuthenticated: true,
        userId: auth.getUserId(),
        email: null,
      });
      return;
    }
  }

  // Show onboarding flow (replaces old welcome screen)
  document.getElementById("welcome-screen")!.style.display = "none";
  const onboarding = new OnboardingFlow();
  const result = await onboarding.show();

  // Save player name for next visit
  localStorage.setItem("lucksino_player_name", result.playerName);

  startGame(result);
}

function showPurchaseToast(status: "success" | "cancelled"): void {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 1rem 2rem;
    border-radius: 12px;
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    font-size: 1rem;
    z-index: 99999;
    animation: slideDown 0.3s ease;
    ${status === "success"
      ? "background: #065f46; color: #6ee7b7; border: 1px solid #34d399;"
      : "background: #7f1d1d; color: #fca5a5; border: 1px solid #f87171;"
    }
  `;
  toast.textContent = status === "success"
    ? "🎉 Purchase successful! Coins added to your balance."
    : "Purchase cancelled.";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Register the service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.log("SW registration failed:", err);
    });
  });
}

// Start the app
init();
