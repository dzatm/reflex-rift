# Reflex Rift

**A 45-second sky-arena aim trainer.** Rift orbs materialize across the sky — pop as many as you can before the clock runs out, chain your hits into a combo multiplier, and climb from **Bronze** to **Pro Reflex**.

Built for the **Cloud9 x JetBrains: Sky's The Limit Hackathon 2026** (Category 3: Event Mini Game). Fast, replayable, and designed to be understood in three seconds — perfect for a booth screen or a phone in line.

## How to play

1. Press **START RUN**.
2. **Click or tap** the glowing rift orbs before they shrink and fade away.
3. Every 4 consecutive hits raises your **combo multiplier** by 1 (up to ×8). A missed click or an expired orb resets it.
4. **Golden cores** (rare, smaller) are worth triple points.
5. When the 45 seconds end, you get your score, accuracy, best combo, and a **rank tier**:

   | Rank | Score needed |
   |---|---|
   | 🥉 Bronze | 0+ |
   | 🥈 Silver | 2,500+ |
   | 🥇 Gold | 5,000+ |
   | 💠 Platinum | 8,000+ |
   | 💎 Diamond | 12,000+ |
   | ⚡ Pro Reflex | 17,000+ |

Your personal best is saved in the browser (`localStorage`), so every run is a chance to beat yourself. Difficulty ramps up during the round: orbs spawn faster and live shorter as the clock ticks down.

## How to run

No build step, no dependencies, no network calls. Either:

- **Just open it:** double-click `index.html` in any modern browser, or
- **Serve it locally** (recommended for consistent behavior):

  ```bash
  cd reflex-rift
  python3 -m http.server 8000
  # then visit http://localhost:8000
  ```

Works with mouse, trackpad, and touch. Fully responsive — the arena resizes to the screen, and rendering is devicePixelRatio-aware for crisp visuals on retina displays.

## Tech

- **Vanilla HTML / CSS / JavaScript** — a single `<canvas>` game loop (`requestAnimationFrame`), zero libraries, zero external assets.
- **Procedural artwork:** orbs, rotating rift rings, drifting clouds, particles, and floating score text are all drawn in code. Sound effects are synthesized with the WebAudio API (mutable via the 🔊 button).
- **JetBrains tooling:** developed as a WebStorm project (see the `.idea/` directory and `reflex-rift.iml` module file in this repo).

## Project structure

```
reflex-rift/
├── index.html          # page structure + screens (start / results / paused)
├── style.css           # sky theme, HUD, responsive layout
├── game.js             # game loop, spawning, scoring, ranks, audio
├── .idea/              # WebStorm project configuration
├── reflex-rift.iml     # WebStorm module file
├── README.md
└── LICENSE             # MIT
```

## Originality note

Reflex Rift is an original work. The name, artwork, sounds, and game design were created for this project; it contains **no third-party assets, logos, or intellectual property** (no Riot Games / VALORANT / League of Legends material of any kind).

## License

MIT — see [LICENSE](LICENSE).
