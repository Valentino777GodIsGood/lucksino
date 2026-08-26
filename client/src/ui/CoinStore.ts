/**
 * Coin Store UI — Allows players to purchase coin packages via Stripe
 * Sprint 4: Monetization layer
 */

interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  bonusCoins: number;
  priceUsd: number;
  stripePriceLabel: string;
  popular?: boolean;
}

export class CoinStore {
  private overlay: HTMLDivElement | null = null;
  private packages: CoinPackage[] = [];
  private userId: string;
  private userEmail: string;
  private serverUrl: string;
  private onClose: (() => void) | null = null;

  constructor(userId: string, userEmail: string, serverUrl: string = "") {
    this.userId = userId;
    this.userEmail = userEmail;
    this.serverUrl = serverUrl || `${window.location.protocol}//${window.location.hostname}:2567`;
  }

  async fetchPackages(): Promise<void> {
    try {
      const resp = await fetch(`${this.serverUrl}/store/packages`);
      const data = await resp.json();
      if (data.enabled) {
        this.packages = data.packages;
      }
    } catch (err) {
      console.warn("Could not fetch store packages:", err);
    }
  }

  async show(onClose?: () => void): Promise<void> {
    this.onClose = onClose || null;
    await this.fetchPackages();

    // Create overlay
    this.overlay = document.createElement("div");
    this.overlay.id = "coin-store-overlay";
    this.overlay.innerHTML = this.renderHTML();
    document.body.appendChild(this.overlay);

    // Bind events
    this.overlay.querySelector(".store-close-btn")?.addEventListener("click", () => this.hide());
    this.overlay.querySelectorAll(".package-buy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const pkgId = (e.target as HTMLElement).dataset.packageId;
        if (pkgId) this.purchasePackage(pkgId);
      });
    });
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.onClose) this.onClose();
  }

  private async purchasePackage(packageId: string): Promise<void> {
    try {
      const resp = await fetch(`${this.serverUrl}/store/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          userId: this.userId,
          email: this.userEmail,
        }),
      });

      const data = await resp.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Purchase failed. Please try again.");
      }
    } catch (err) {
      alert("Connection error. Please try again.");
    }
  }

  private renderHTML(): string {
    const packagesHTML = this.packages
      .map(
        (pkg) => `
        <div class="store-package ${pkg.popular ? "popular" : ""}">
          ${pkg.popular ? '<div class="popular-badge">⭐ BEST VALUE</div>' : ""}
          <div class="package-name">${pkg.name}</div>
          <div class="package-coins">🪙 ${pkg.coins.toLocaleString()}</div>
          ${pkg.bonusCoins > 0 ? `<div class="package-bonus">+ ${pkg.bonusCoins.toLocaleString()} bonus!</div>` : ""}
          <button class="package-buy-btn" data-package-id="${pkg.id}">
            ${pkg.stripePriceLabel}
          </button>
        </div>
      `
      )
      .join("");

    return `
      <style>
        #coin-store-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          font-family: 'Nunito', sans-serif;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .store-modal {
          background: linear-gradient(145deg, #2d1b69, #1a0a2e);
          border: 2px solid rgba(255, 215, 0, 0.3);
          border-radius: 24px;
          padding: 2rem;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
        }
        .store-title {
          font-family: 'Fredoka One', cursive;
          font-size: 1.8rem;
          color: #ffd700;
          text-align: center;
          margin-bottom: 0.5rem;
        }
        .store-subtitle {
          color: #c4b5fd;
          text-align: center;
          margin-bottom: 1.5rem;
          font-size: 0.95rem;
        }
        .store-close-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 1.2rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .store-close-btn:hover { background: rgba(255,255,255,0.2); }
        .store-packages {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }
        .store-package {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,215,0,0.15);
          border-radius: 16px;
          padding: 1.5rem 1rem;
          text-align: center;
          position: relative;
          transition: transform 0.2s, border-color 0.2s;
        }
        .store-package:hover {
          transform: translateY(-3px);
          border-color: rgba(255,215,0,0.4);
        }
        .store-package.popular {
          border-color: #ffd700;
          box-shadow: 0 0 20px rgba(255,215,0,0.15);
        }
        .popular-badge {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: #ffd700;
          color: #1a0a2e;
          font-weight: 800;
          font-size: 0.7rem;
          padding: 2px 10px;
          border-radius: 10px;
        }
        .package-name {
          color: white;
          font-weight: 700;
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }
        .package-coins {
          color: #ffd700;
          font-size: 1.4rem;
          font-weight: 800;
          margin-bottom: 0.3rem;
        }
        .package-bonus {
          color: #4ecdc4;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 0.8rem;
        }
        .package-buy-btn {
          background: linear-gradient(135deg, #ffd700, #f59e0b);
          border: none;
          border-radius: 12px;
          color: #1a0a2e;
          font-family: 'Fredoka One', cursive;
          font-size: 1.1rem;
          padding: 0.6rem 1.5rem;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          width: 100%;
        }
        .package-buy-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 15px rgba(255,215,0,0.4);
        }
        .store-footer {
          text-align: center;
          color: #8b7faa;
          font-size: 0.75rem;
          margin-top: 1.5rem;
        }
        ${this.packages.length === 0 ? `
        .store-disabled {
          color: #c4b5fd;
          text-align: center;
          padding: 2rem;
          font-size: 1.1rem;
        }` : ""}
      </style>
      <div class="store-modal">
        <button class="store-close-btn">✕</button>
        <div class="store-title">🪙 Coin Store</div>
        <div class="store-subtitle">Get more coins to keep playing!</div>
        ${
          this.packages.length > 0
            ? `<div class="store-packages">${packagesHTML}</div>
               <div class="store-footer">
                 Secure payments powered by Stripe. Coins are virtual currency for entertainment only.
               </div>`
            : `<div class="store-disabled">
                 The coin store is currently unavailable.<br/>
                 Check back later!
               </div>`
        }
      </div>
    `;
  }
}
