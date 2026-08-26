/**
 * Onboarding Flow — Multi-step first-time user experience
 * Sprint 4: Sign up/sign in + tutorial overlay
 *
 * Steps:
 * 1. Welcome + username selection
 * 2. Optional email/password auth (Supabase)
 * 3. Quick tutorial (what games are available, how coins work)
 * 4. Start playing
 */

import { auth } from "../auth/supabase";

export interface OnboardingResult {
  playerName: string;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
}

export class OnboardingFlow {
  private overlay: HTMLDivElement | null = null;
  private currentStep: number = 0;
  private playerName: string = "";
  private resolve: ((result: OnboardingResult) => void) | null = null;

  /**
   * Show the onboarding flow and return a promise that resolves when complete
   */
  show(): Promise<OnboardingResult> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.currentStep = 0;
      this.render();
    });
  }

  private render(): void {
    if (this.overlay) this.overlay.remove();

    this.overlay = document.createElement("div");
    this.overlay.id = "onboarding-overlay";

    switch (this.currentStep) {
      case 0:
        this.renderWelcome();
        break;
      case 1:
        this.renderAuth();
        break;
      case 2:
        this.renderTutorial();
        break;
    }

    document.body.appendChild(this.overlay);
  }

  private renderWelcome(): void {
    if (!this.overlay) return;
    this.overlay.innerHTML = `
      <style>${this.getBaseStyles()}</style>
      <div class="ob-card">
        <div class="ob-logo">LUCKSINO</div>
        <div class="ob-subtitle">✨ Social Casino — Play Together ✨</div>
        <div class="ob-step-indicator">
          <span class="step active"></span>
          <span class="step"></span>
          <span class="step"></span>
        </div>
        <div class="ob-form">
          <input type="text" id="ob-name-input" placeholder="Choose a display name..." maxlength="16" autocomplete="off" />
          <button class="ob-btn primary" id="ob-next-1">Continue →</button>
        </div>
        <div class="ob-hint">This is how other players will see you</div>
      </div>
    `;

    const nameInput = this.overlay.querySelector("#ob-name-input") as HTMLInputElement;
    const nextBtn = this.overlay.querySelector("#ob-next-1") as HTMLButtonElement;

    nameInput.focus();
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") nextBtn.click();
      nameInput.style.borderColor = "rgba(255, 215, 0, 0.3)";
    });

    nextBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.style.borderColor = "#ef4444";
        nameInput.focus();
        return;
      }
      this.playerName = name;
      this.currentStep = 1;
      this.render();
    });
  }

  private renderAuth(): void {
    if (!this.overlay) return;
    const isEnabled = auth.isEnabled();

    this.overlay.innerHTML = `
      <style>${this.getBaseStyles()}</style>
      <div class="ob-card">
        <div class="ob-title">Save Your Progress</div>
        <div class="ob-subtitle-sm">Create an account to keep your coins across sessions</div>
        <div class="ob-step-indicator">
          <span class="step done"></span>
          <span class="step active"></span>
          <span class="step"></span>
        </div>
        ${isEnabled ? `
          <div class="ob-form">
            <div class="ob-tabs">
              <button class="ob-tab active" data-tab="signin">Sign In</button>
              <button class="ob-tab" data-tab="signup">Sign Up</button>
            </div>
            <input type="email" id="ob-email" placeholder="Email address" autocomplete="email" />
            <input type="password" id="ob-password" placeholder="Password" autocomplete="current-password" />
            <div class="ob-error" id="ob-auth-error"></div>
            <button class="ob-btn primary" id="ob-auth-submit">Sign In</button>
          </div>
        ` : ""}
        <button class="ob-btn secondary" id="ob-skip-auth">
          ${isEnabled ? "Skip — play as guest" : "Continue without account"}
        </button>
        <div class="ob-hint">${isEnabled ? "You can always sign up later" : "Account system coming soon!"}</div>
      </div>
    `;

    // Tab switching
    const tabs = this.overlay.querySelectorAll(".ob-tab");
    const submitBtn = this.overlay.querySelector("#ob-auth-submit") as HTMLButtonElement;
    let mode: "signin" | "signup" = "signin";

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        mode = tab.getAttribute("data-tab") as "signin" | "signup";
        if (submitBtn) submitBtn.textContent = mode === "signin" ? "Sign In" : "Create Account";
      });
    });

    // Auth submission
    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        const email = (this.overlay?.querySelector("#ob-email") as HTMLInputElement)?.value.trim();
        const password = (this.overlay?.querySelector("#ob-password") as HTMLInputElement)?.value;
        const errorEl = this.overlay?.querySelector("#ob-auth-error") as HTMLDivElement;

        if (!email || !password) {
          errorEl.textContent = "Email and password required";
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Loading...";

        const result = mode === "signin"
          ? await auth.signIn(email, password)
          : await auth.signUp(email, password);

        if (result.success) {
          this.currentStep = 2;
          this.render();
        } else {
          errorEl.textContent = result.error || "Authentication failed";
          submitBtn.disabled = false;
          submitBtn.textContent = mode === "signin" ? "Sign In" : "Create Account";
        }
      });
    }

    // Skip auth
    this.overlay.querySelector("#ob-skip-auth")?.addEventListener("click", () => {
      this.currentStep = 2;
      this.render();
    });
  }

  private renderTutorial(): void {
    if (!this.overlay) return;
    this.overlay.innerHTML = `
      <style>${this.getBaseStyles()}</style>
      <div class="ob-card wide">
        <div class="ob-title">How to Play</div>
        <div class="ob-step-indicator">
          <span class="step done"></span>
          <span class="step done"></span>
          <span class="step active"></span>
        </div>
        <div class="ob-tutorial">
          <div class="tutorial-item">
            <div class="tutorial-icon">🚶</div>
            <div class="tutorial-text">
              <strong>Move around</strong>
              <span>Use arrow keys or WASD to walk through the casino</span>
            </div>
          </div>
          <div class="tutorial-item">
            <div class="tutorial-icon">🎰</div>
            <div class="tutorial-text">
              <strong>Play games</strong>
              <span>Walk to a machine and press E or Space to play</span>
            </div>
          </div>
          <div class="tutorial-item">
            <div class="tutorial-icon">🪙</div>
            <div class="tutorial-text">
              <strong>Earn coins</strong>
              <span>Win at games, claim daily bonuses, or visit the coin store</span>
            </div>
          </div>
          <div class="tutorial-item">
            <div class="tutorial-icon">👕</div>
            <div class="tutorial-text">
              <strong>Customize</strong>
              <span>Spend coins in the shop to personalize your avatar</span>
            </div>
          </div>
        </div>
        <button class="ob-btn primary large" id="ob-start-playing">🎰 Start Playing!</button>
        <div class="ob-bonus-note">🎁 You start with 1,000 free coins!</div>
      </div>
    `;

    this.overlay.querySelector("#ob-start-playing")?.addEventListener("click", () => {
      this.complete();
    });
  }

  private complete(): void {
    if (this.overlay) {
      this.overlay.style.animation = "fadeOut 0.3s ease forwards";
      setTimeout(() => {
        this.overlay?.remove();
        this.overlay = null;
      }, 300);
    }

    if (this.resolve) {
      this.resolve({
        playerName: this.playerName,
        isAuthenticated: auth.isLoggedIn(),
        userId: auth.getUserId(),
        email: null, // privacy: don't pass email around unnecessarily
      });
    }
  }

  private getBaseStyles(): string {
    return `
      #onboarding-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: linear-gradient(135deg, #1a0a2e 0%, #2d1b69 30%, #44318d 60%, #1a0a2e 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-family: 'Nunito', sans-serif;
        animation: fadeIn 0.3s ease;
        overflow-y: auto;
        padding: 1rem;
      }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
      .ob-card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 215, 0, 0.2);
        border-radius: 24px;
        padding: 2.5rem;
        max-width: 420px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
      .ob-card.wide { max-width: 500px; }
      .ob-logo {
        font-family: 'Fredoka One', cursive;
        font-size: clamp(2.5rem, 6vw, 3.5rem);
        background: linear-gradient(135deg, #ffd700, #ffaa00, #ffd700);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(0 4px 8px rgba(255, 215, 0, 0.3));
        margin-bottom: 0.3rem;
      }
      .ob-title {
        font-family: 'Fredoka One', cursive;
        font-size: 1.6rem;
        color: #ffd700;
        margin-bottom: 0.3rem;
      }
      .ob-subtitle {
        color: #c4b5fd;
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 1rem;
      }
      .ob-subtitle-sm {
        color: #a78bfa;
        font-size: 0.9rem;
        margin-bottom: 1rem;
      }
      .ob-step-indicator {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-bottom: 1.5rem;
      }
      .ob-step-indicator .step {
        width: 32px;
        height: 4px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.15);
        transition: background 0.3s;
      }
      .ob-step-indicator .step.active { background: #ffd700; }
      .ob-step-indicator .step.done { background: #4ecdc4; }
      .ob-form {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        margin-bottom: 1rem;
      }
      .ob-form input {
        width: 100%;
        padding: 0.9rem 1.2rem;
        border: 2px solid rgba(255, 215, 0, 0.3);
        border-radius: 12px;
        background: rgba(26, 10, 46, 0.8);
        color: #fff;
        font-size: 1rem;
        font-family: 'Nunito', sans-serif;
        font-weight: 600;
        outline: none;
        transition: border-color 0.3s, box-shadow 0.3s;
      }
      .ob-form input:focus {
        border-color: #ffd700;
        box-shadow: 0 0 15px rgba(255, 215, 0, 0.15);
      }
      .ob-form input::placeholder { color: #8b7faa; }
      .ob-tabs {
        display: flex;
        gap: 4px;
        background: rgba(0,0,0,0.3);
        border-radius: 10px;
        padding: 4px;
      }
      .ob-tab {
        flex: 1;
        padding: 0.5rem;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: #a78bfa;
        font-family: 'Nunito', sans-serif;
        font-weight: 700;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      .ob-tab.active {
        background: rgba(255, 215, 0, 0.15);
        color: #ffd700;
      }
      .ob-error {
        color: #ef4444;
        font-size: 0.85rem;
        min-height: 1.2rem;
      }
      .ob-btn {
        width: 100%;
        padding: 0.9rem 1.5rem;
        border: none;
        border-radius: 12px;
        font-family: 'Fredoka One', cursive;
        font-size: 1.1rem;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .ob-btn.primary {
        background: linear-gradient(135deg, #ffd700, #f59e0b);
        color: #1a0a2e;
        box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);
      }
      .ob-btn.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(255, 215, 0, 0.5);
      }
      .ob-btn.primary.large { font-size: 1.3rem; padding: 1.1rem; }
      .ob-btn.secondary {
        background: rgba(255, 255, 255, 0.08);
        color: #c4b5fd;
        border: 1px solid rgba(255, 255, 255, 0.1);
        margin-top: 0.5rem;
        font-size: 0.95rem;
      }
      .ob-btn.secondary:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .ob-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      .ob-hint {
        color: #6b5b8a;
        font-size: 0.8rem;
        margin-top: 0.8rem;
      }
      .ob-tutorial {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        margin: 1.2rem 0;
        text-align: left;
      }
      .tutorial-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: rgba(255,255,255,0.04);
        border-radius: 12px;
        padding: 0.8rem 1rem;
      }
      .tutorial-icon { font-size: 1.6rem; }
      .tutorial-text strong { display: block; color: #ffd700; font-size: 0.95rem; }
      .tutorial-text span { color: #a78bfa; font-size: 0.82rem; }
      .ob-bonus-note {
        color: #4ecdc4;
        font-weight: 700;
        font-size: 0.9rem;
        margin-top: 1rem;
      }
    `;
  }
}
