/**
 * Client-side Supabase Auth
 * Sprint 4: Full sign-up/sign-in/sign-out flow
 *
 * Uses the Supabase GoTrue REST API directly (no SDK dependency)
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

interface AuthResult {
  success: boolean;
  error?: string;
}

interface Session {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
  };
}

class SupabaseAuth {
  private session: Session | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
    // Try to restore session from localStorage
    this.restoreSession();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isLoggedIn(): boolean {
    return !!this.session;
  }

  getUserId(): string | null {
    return this.session?.user?.id || null;
  }

  getToken(): string | null {
    return this.session?.access_token || null;
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    if (!this.enabled) return { success: false, error: "Auth not configured" };

    try {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await resp.json();

      if (data.error) {
        return { success: false, error: data.error.message || data.error };
      }

      if (data.access_token) {
        this.session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: { id: data.user.id, email: data.user.email },
        };
        this.saveSession();
        return { success: true };
      }

      // Email confirmation required
      if (data.id && !data.access_token) {
        return { success: true }; // User created, needs email confirmation
      }

      return { success: false, error: "Unexpected response" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!this.enabled) return { success: false, error: "Auth not configured" };

    try {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await resp.json();

      if (data.error) {
        return { success: false, error: data.error_description || data.error };
      }

      if (data.access_token) {
        this.session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: { id: data.user.id, email: data.user.email },
        };
        this.saveSession();
        return { success: true };
      }

      return { success: false, error: "Invalid credentials" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  signOut(): void {
    this.session = null;
    localStorage.removeItem("lucksino_session");
    localStorage.removeItem("lucksino_player_name");
  }

  private saveSession(): void {
    if (this.session) {
      localStorage.setItem("lucksino_session", JSON.stringify(this.session));
    }
  }

  private restoreSession(): void {
    try {
      const stored = localStorage.getItem("lucksino_session");
      if (stored) {
        this.session = JSON.parse(stored);
      }
    } catch {
      this.session = null;
    }
  }
}

// Singleton
export const auth = new SupabaseAuth();
