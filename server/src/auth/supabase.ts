/**
 * Supabase integration for Lucksino server
 * Handles user auth verification, coin persistence, and transaction logging
 *
 * NOTE: Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 * When these are not set, the server runs in "local mode" (no persistence)
 */

interface SupabaseUser {
  id: string;
  email: string;
}

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  coins: number;
  inventory: string[];
  avatar: {
    outfitColor: string;
    hairColor: string;
    skinTone: string;
    accessory: string;
    hat: string;
  };
  last_daily_bonus: string;
  created_at: string;
}

interface TransactionLog {
  type: "purchase" | "bonus" | "game_win" | "game_loss";
  packageId?: string;
  coins: number;
  amountUsd?: number;
  stripeSessionId?: string;
  gameType?: string;
}

class SupabaseService {
  private url: string;
  private serviceKey: string;
  private enabled: boolean;

  constructor() {
    this.url = process.env.SUPABASE_URL || "";
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    this.enabled = !!(this.url && this.serviceKey);

    if (!this.enabled) {
      console.log("⚠️  Supabase not configured — running in local mode (no persistence)");
    } else {
      console.log("✅ Supabase connected for auth & persistence");
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Verify a JWT token and return the user
   */
  async verifyToken(token: string): Promise<SupabaseUser | null> {
    if (!this.enabled) return null;

    try {
      const response = await fetch(`${this.url}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: this.serviceKey,
        },
      });

      if (!response.ok) return null;
      const user: any = await response.json();
      return { id: user.id, email: user.email };
    } catch {
      return null;
    }
  }

  /**
   * Get a user profile by ID
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (!this.enabled) return null;

    try {
      const resp = await fetch(
        `${this.url}/rest/v1/profiles?id=eq.${userId}&select=*`,
        {
          headers: {
            apikey: this.serviceKey,
            Authorization: `Bearer ${this.serviceKey}`,
          },
        }
      );

      const profiles: any = await resp.json();
      if (profiles && profiles.length > 0) {
        return profiles[0] as UserProfile;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get or create a user profile with coins
   */
  async getOrCreateProfile(
    userId: string,
    email: string,
    displayName: string
  ): Promise<UserProfile | null> {
    if (!this.enabled) return null;

    try {
      // Try to get existing profile
      const existing = await this.getProfile(userId);
      if (existing) return existing;

      // Create new profile with welcome coins
      const createResp = await fetch(`${this.url}/rest/v1/profiles`, {
        method: "POST",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          id: userId,
          email,
          display_name: displayName,
          coins: 1000,
          inventory: [],
          avatar: {
            outfitColor: "#e74c3c",
            hairColor: "#4a3728",
            skinTone: "#ffdbac",
            accessory: "none",
            hat: "none",
          },
          last_daily_bonus: "",
        }),
      });

      const created: any = await createResp.json();
      return Array.isArray(created) ? created[0] : created;
    } catch (err) {
      console.error("Supabase profile error:", err);
      return null;
    }
  }

  /**
   * Update user's coin balance
   */
  async updateCoins(userId: string, coins: number): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const resp = await fetch(
        `${this.url}/rest/v1/profiles?id=eq.${userId}`,
        {
          method: "PATCH",
          headers: {
            apikey: this.serviceKey,
            Authorization: `Bearer ${this.serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ coins }),
        }
      );

      return resp.ok;
    } catch {
      return false;
    }
  }

  /**
   * Save full profile state (avatar, inventory, coins, daily bonus)
   */
  async saveProfile(
    userId: string,
    data: Partial<Pick<UserProfile, "coins" | "inventory" | "avatar" | "last_daily_bonus">>
  ): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const resp = await fetch(
        `${this.url}/rest/v1/profiles?id=eq.${userId}`,
        {
          method: "PATCH",
          headers: {
            apikey: this.serviceKey,
            Authorization: `Bearer ${this.serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      return resp.ok;
    } catch {
      return false;
    }
  }

  /**
   * Log a coin transaction for audit trail
   */
  async logTransaction(userId: string, tx: TransactionLog): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const resp = await fetch(`${this.url}/rest/v1/transactions`, {
        method: "POST",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          type: tx.type,
          package_id: tx.packageId || null,
          coins: tx.coins,
          amount_usd: tx.amountUsd || null,
          stripe_session_id: tx.stripeSessionId || null,
          game_type: tx.gameType || null,
          created_at: new Date().toISOString(),
        }),
      });

      return resp.ok;
    } catch {
      return false;
    }
  }
}

// Singleton
export const supabase = new SupabaseService();
