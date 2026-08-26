# 🎰 Lucksino — Social Casino

A free-to-play multiplayer social casino built with Phaser 3, Colyseus, and TypeScript. Players explore a virtual casino floor, play mini-games (Slots, Plinko, Crash), customize their avatars, and compete on leaderboards.

![Status](https://img.shields.io/badge/Sprint-4-gold)
![Stack](https://img.shields.io/badge/Stack-Phaser%20%2B%20Colyseus%20%2B%20Vite-blueviolet)

---

## ✨ Features

### 🎮 Games
- **Slots** — Classic 3-reel slot machine with paylines and free spin multipliers
- **Plinko** — Drop chips through a peg board for variable payouts
- **Crash** — Multiplier rises until it crashes; cash out in time!

### 🎭 Social
- **Multiplayer lobby** — Walk around a virtual casino floor with other players in real-time
- **Avatar customization** — Outfits, hair, skin tones, accessories, hats
- **Cosmetics shop** — Spend coins on vanity items

### 💰 Economy
- **Coin store** — Purchase coin packages via Stripe Checkout
- **Daily bonus** — Free coins every 24 hours
- **Win/loss tracking** — Transaction log and coin balance persistence

### 🔐 Auth & Persistence
- **Supabase Auth** — Email/password sign-up and sign-in
- **Cloud saves** — Coins, inventory, and avatar persist across devices
- **Guest mode** — Play immediately without an account

### 📱 PWA
- **Installable** — Add to home screen on mobile and desktop
- **Offline shell** — App loads from cache when offline
- **Responsive** — Scales to fit any screen size

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Client | Phaser 3, TypeScript, Vite |
| Server | Node.js, Express, Colyseus |
| Auth/DB | Supabase (PostgreSQL + GoTrue) |
| Payments | Stripe Checkout |
| Deploy | Docker, Nginx |

---

## 🚀 Quick Start

```bash
# Clone and install
git clone <repo-url> && cd lucksino
npm install
cd shared && npm install && cd ..
cd server && npm install && cd ..
cd client && npm install && cd ..

# Configure
cp .env.example .env
# Edit .env with your Supabase and Stripe keys

# Run (two terminals)
cd server && npm run dev    # Game server on :2567
cd client && npm run dev    # Vite dev server on :3000
```

Open http://localhost:3000 and play!

---

## 📁 Project Structure

```
lucksino/
├── client/           # Phaser game client (Vite)
│   ├── src/
│   │   ├── scenes/   # Game scenes (Casino, Slots, Plinko, Crash, Shop, Avatar)
│   │   ├── ui/       # UI overlays (CoinStore, OnboardingFlow)
│   │   ├── auth/     # Client-side Supabase auth
│   │   └── network/  # Colyseus client connection
│   └── public/       # Static assets, PWA manifest, service worker
├── server/           # Game server (Colyseus + Express)
│   └── src/
│       ├── rooms/    # Colyseus room definitions
│       ├── games/    # Game logic (slots, plinko, crash, cosmetics)
│       ├── auth/     # Supabase token verification
│       └── payments/ # Stripe checkout + webhooks
├── shared/           # Shared TypeScript types
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
├── deploy.md         # Full deployment guide
└── .env.example
```

---

## 🐳 Production

```bash
docker compose up --build -d
curl http://localhost:2567/health
```

See [deploy.md](./deploy.md) for full deployment instructions including Supabase SQL setup, Stripe webhook configuration, and hosting options.

---

## 🗺️ Roadmap

- [x] Sprint 1: Core game loop (Slots, movement, basic UI)
- [x] Sprint 2: Multiplayer + more games (Plinko, Crash, leaderboard)
- [x] Sprint 3: Cosmetics, avatar system, daily bonuses
- [x] Sprint 4: Stripe payments, Supabase persistence, PWA, deployment
- [ ] Sprint 5: Chat system, friends list, tournaments
- [ ] Sprint 6: More games (Blackjack, Roulette), VIP tiers
- [ ] Sprint 7: Analytics, A/B testing, push notifications

---

## 📄 License

MIT
