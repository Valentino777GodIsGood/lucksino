/**
 * Stripe Payment Integration for Lucksino
 * Sprint 4: Coin package purchases via Stripe Checkout
 *
 * Flow:
 * 1. Client requests a checkout session for a coin package
 * 2. Server creates a Stripe Checkout Session
 * 3. Client redirects to Stripe's hosted checkout page
 * 4. On success, Stripe fires a webhook -> we credit coins
 */

interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  bonusCoins: number;
  priceUsd: number; // in cents
  stripePriceLabel: string;
  popular?: boolean;
}

export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: "starter",
    name: "Starter Pack",
    coins: 5000,
    bonusCoins: 0,
    priceUsd: 199, // $1.99
    stripePriceLabel: "$1.99",
  },
  {
    id: "popular",
    name: "Popular Pack",
    coins: 15000,
    bonusCoins: 2000,
    priceUsd: 499, // $4.99
    stripePriceLabel: "$4.99",
    popular: true,
  },
  {
    id: "mega",
    name: "Mega Pack",
    coins: 50000,
    bonusCoins: 10000,
    priceUsd: 999, // $9.99
    stripePriceLabel: "$9.99",
  },
  {
    id: "whale",
    name: "Whale Pack",
    coins: 150000,
    bonusCoins: 50000,
    priceUsd: 1999, // $19.99
    stripePriceLabel: "$19.99",
  },
];

export class StripeService {
  private secretKey: string;
  private webhookSecret: string;
  private enabled: boolean;
  private baseUrl: string;

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY || "";
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
    this.baseUrl = process.env.APP_URL || "http://localhost:3000";
    this.enabled = !!(this.secretKey && this.webhookSecret);

    if (!this.enabled) {
      console.log("⚠️  Stripe not configured — coin purchases disabled");
    } else {
      console.log("✅ Stripe connected for coin purchases");
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getPackages(): CoinPackage[] {
    return COIN_PACKAGES;
  }

  getPackage(packageId: string): CoinPackage | undefined {
    return COIN_PACKAGES.find((p) => p.id === packageId);
  }

  /**
   * Create a Stripe Checkout Session for a coin package
   */
  async createCheckoutSession(
    packageId: string,
    userId: string,
    userEmail?: string
  ): Promise<{ url: string | null; error?: string }> {
    if (!this.enabled) {
      return { url: null, error: "Payments not configured" };
    }

    const pkg = this.getPackage(packageId);
    if (!pkg) {
      return { url: null, error: "Invalid package" };
    }

    try {
      const params = new URLSearchParams();
      params.append("mode", "payment");
      params.append("success_url", `${this.baseUrl}?purchase=success&package=${packageId}`);
      params.append("cancel_url", `${this.baseUrl}?purchase=cancelled`);
      params.append("line_items[0][price_data][currency]", "usd");
      params.append("line_items[0][price_data][unit_amount]", pkg.priceUsd.toString());
      params.append("line_items[0][price_data][product_data][name]", `${pkg.name} — ${pkg.coins.toLocaleString()} Coins`);
      params.append("line_items[0][price_data][product_data][description]",
        pkg.bonusCoins > 0
          ? `+ ${pkg.bonusCoins.toLocaleString()} bonus coins!`
          : "Virtual coins for Lucksino"
      );
      params.append("line_items[0][quantity]", "1");
      params.append("metadata[user_id]", userId);
      params.append("metadata[package_id]", packageId);
      params.append("metadata[coins]", (pkg.coins + pkg.bonusCoins).toString());
      if (userEmail) {
        params.append("customer_email", userEmail);
      }

      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data: any = await response.json();

      if (data.error) {
        console.error("Stripe error:", data.error.message);
        return { url: null, error: data.error.message };
      }

      return { url: data.url };
    } catch (err: any) {
      console.error("Stripe checkout error:", err);
      return { url: null, error: err.message };
    }
  }

  /**
   * Verify and parse a Stripe webhook event
   * Uses the raw body + signature header for verification
   */
  async verifyWebhookEvent(
    rawBody: Buffer,
    signature: string
  ): Promise<{ valid: boolean; event?: any; error?: string }> {
    if (!this.enabled) {
      return { valid: false, error: "Stripe not configured" };
    }

    try {
      const crypto = await import("crypto");
      const elements = signature.split(",");
      const timestampStr = elements.find((e) => e.startsWith("t="))?.slice(2);
      const v1Signature = elements.find((e) => e.startsWith("v1="))?.slice(3);

      if (!timestampStr || !v1Signature) {
        return { valid: false, error: "Invalid signature format" };
      }

      const payload = `${timestampStr}.${rawBody.toString()}`;
      const expectedSig = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(payload)
        .digest("hex");

      if (expectedSig !== v1Signature) {
        return { valid: false, error: "Signature mismatch" };
      }

      // Check timestamp (prevent replay attacks, allow 5min tolerance)
      const timestamp = parseInt(timestampStr, 10);
      const tolerance = 300;
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > tolerance) {
        return { valid: false, error: "Webhook timestamp too old" };
      }

      const event = JSON.parse(rawBody.toString());
      return { valid: true, event };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }
}

// Singleton
export const stripeService = new StripeService();
