import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { CasinoRoom } from "./rooms/CasinoRoom";
import { supabase } from "./auth/supabase";
import { stripeService, COIN_PACKAGES } from "./payments/stripe";

const app = express();
const port = Number(process.env.PORT) || 2567;

app.use(cors());

// We need raw body for Stripe webhook verification
// So we parse JSON conditionally (skip for webhook route)
app.use((req, res, next) => {
  if (req.path === "/webhooks/stripe") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    supabase: supabase.isEnabled() ? "connected" : "local-mode",
    stripe: stripeService.isEnabled() ? "connected" : "disabled",
  });
});

// ─── Auth Endpoints ───────────────────────────────────────────────────────────
app.post("/auth/verify", async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: "Token required" });
  }

  const user = await supabase.verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  res.json({ user });
});

// ─── Coin Packages (public) ──────────────────────────────────────────────────
app.get("/store/packages", (_req, res) => {
  res.json({
    enabled: stripeService.isEnabled(),
    packages: COIN_PACKAGES,
  });
});

// ─── Create Stripe Checkout Session ──────────────────────────────────────────
app.post("/store/checkout", async (req, res) => {
  const { packageId, userId, email } = req.body;

  if (!packageId || !userId) {
    return res.status(400).json({ error: "packageId and userId required" });
  }

  if (!stripeService.isEnabled()) {
    return res.status(503).json({ error: "Payments not available" });
  }

  const result = await stripeService.createCheckoutSession(packageId, userId, email);

  if (result.url) {
    res.json({ url: result.url });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// ─── Stripe Webhook ──────────────────────────────────────────────────────────
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
      return res.status(400).json({ error: "Missing signature" });
    }

    const { valid, event, error } = await stripeService.verifyWebhookEvent(
      req.body,
      signature
    );

    if (!valid) {
      console.error("Webhook verification failed:", error);
      return res.status(400).json({ error });
    }

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const packageId = session.metadata?.package_id;
      const coins = parseInt(session.metadata?.coins || "0", 10);

      if (userId && coins > 0) {
        console.log(`💰 Payment received! Crediting ${coins} coins to user ${userId} (package: ${packageId})`);

        // Credit coins via Supabase
        if (supabase.isEnabled()) {
          const profile = await supabase.getProfile(userId);
          if (profile) {
            const newBalance = profile.coins + coins;
            await supabase.updateCoins(userId, newBalance);

            // Log the transaction
            await supabase.logTransaction(userId, {
              type: "purchase",
              packageId: packageId || "unknown",
              coins,
              amountUsd: session.amount_total || 0,
              stripeSessionId: session.id,
            });
          }
        }

        // Also broadcast to the game room so connected player sees update immediately
        // (handled via CasinoRoom coin_credit message)
      }
    }

    res.json({ received: true });
  }
);

// ─── User Profile (for persistence) ──────────────────────────────────────────
app.get("/profile/:userId", async (req, res) => {
  if (!supabase.isEnabled()) {
    return res.status(503).json({ error: "Persistence not available" });
  }

  const profile = await supabase.getProfile(req.params.userId);
  if (!profile) {
    return res.status(404).json({ error: "Profile not found" });
  }

  res.json({ profile });
});

// ─── Game Server Setup ────────────────────────────────────────────────────────
const httpServer = createServer(app);

const gameServer = new Server({
  server: httpServer,
});

// Register room
gameServer.define("casino", CasinoRoom);

httpServer.listen(port, () => {
  console.log(`\n🎰 ═══════════════════════════════════════`);
  console.log(`   LUCKSINO Server running on port ${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   Colyseus: ws://localhost:${port}`);
  console.log(`   Supabase: ${supabase.isEnabled() ? "✅ Connected" : "⚠️  Local mode"}`);
  console.log(`   Stripe:   ${stripeService.isEnabled() ? "✅ Connected" : "⚠️  Disabled"}`);
  console.log(`🎰 ═══════════════════════════════════════\n`);
});
