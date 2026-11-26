/* ============================================================
   Reflex Rift — a 45-second sky-arena aim trainer.
   Pure vanilla JS + canvas. No external assets, no libraries.
   All artwork is drawn procedurally (orbs, clouds, particles).
   ============================================================ */
"use strict";

/* ---------------- Config ---------------- */
const ROUND_SECONDS   = 45;
const MAX_TARGETS     = 5;      // simultaneous orbs cap
const COMBO_STEP      = 4;      // hits per multiplier step
const COMBO_MAX       = 8;      // max multiplier
const BASE_POINTS     = 100;    // per normal orb (before multiplier)
const GOLD_POINTS     = 300;    // golden core (before multiplier)
const GOLD_CHANCE     = 0.08;   // spawn probability of a golden core
const STORAGE_KEY     = "reflex-rift-best";

/* Rank tiers by final score (ascending). */
const RANKS = [
  { min: 0,     name: "Bronze",     icon: "🥉", color: "#d08a4e" },
  { min: 2500,  name: "Silver",     icon: "🥈", color: "#cfd8e3" },
  { min: 5000,  name: "Gold",       icon: "🥇", color: "#ffd34d" },
  { min: 8000,  name: "Platinum",   icon: "💠", color: "#7fe7d2" },
  { min: 12000, name: "Diamond",    icon: "💎", color: "#5ee7ff" },
  { min: 17000, name: "Pro Reflex", icon: "⚡", color: "#ff5d73" }
];

/* ---------------- DOM ---------------- */
const canvas   = document.getElementById("game");
const ctx      = canvas.getContext("2d");
const stage    = document.getElementById("stage");
const elScore  = document.getElementById("score");
const elCombo  = document.getElementById("combo");
const elBest   = document.getElementById("best");
const bestBox  = document.getElementById("best-box");
const elTimer  = document.getElementById("timer-bar");
const comboBox = document.getElementById("combo-box");
const elPlayHint = document.getElementById("play-hint");
const scrStart = document.getElementById("screen-start");
const scrRes   = document.getElementById("screen-results");
const scrPause = document.getElementById("screen-paused");

/* ---------------- State ---------------- */
let W = 0, H = 0, DPR = 1;
let state = "idle";            // idle | playing | paused | done
let targets = [];
let particles = [];
let floaters = [];             // floating score text
let clouds = [];
let score = 0, hits = 0, shots = 0, streak = 0, bestStreak = 0;
let timeLeft = ROUND_SECONDS;
let lastTs = 0, spawnTimer = 0;
let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
let muted = false;
let audioCtx = null;
let hintTimer = null;

elBest.textContent = best.toLocaleString();

/* ---------------- Canvas sizing ---------------- */
function resize() {
  const r = stage.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(200, Math.floor(r.width));
  H = Math.max(200, Math.floor(r.height));
  canvas.width  = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  seedClouds();
}
window.addEventListener("resize", resize);

function seedClouds() {
  clouds = [];
  for (let i = 0; i < 7; i++) {
    clouds.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.75,
      s: 0.5 + Math.random() * 1.1,
      v: 4 + Math.random() * 10
    });
  }
}

/* ---------------- Audio (synthesized, no files) ---------------- */
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

function beep(freq, dur, type, gain) {
  if (muted || !audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain || 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function sndHit(mult)   { beep(520 + mult * 60, 0.09, "triangle", 0.14); }
function sndGold()      { beep(880, 0.08, "square", 0.08); setTimeout(() => beep(1320, 0.12, "square", 0.08), 60); }
function sndMiss()      { beep(160, 0.12, "sawtooth", 0.06); }
function sndExpire()    { beep(220, 0.1, "sine", 0.05); }
function sndEnd()       { [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.16, "triangle", 0.12), i * 110)); }

/* ---------------- Game flow ---------------- */
function startRun() {
  ensureAudio();
  best = Number(localStorage.getItem(STORAGE_KEY) || 0);  // fresh read each run
  score = 0; hits = 0; shots = 0; streak = 0; bestStreak = 0;
  timeLeft = ROUND_SECONDS;
  targets = []; particles = []; floaters = [];
  spawnTimer = 0;
  state = "playing";
  scrStart.classList.add("hidden");
  scrRes.classList.add("hidden");
  scrPause.classList.add("hidden");
  elTimer.style.width = "100%";
  elTimer.classList.remove("low");
  showPlayHint();
  updateHUD();
}

function showPlayHint() {
  clearTimeout(hintTimer);
  elPlayHint.classList.remove("gone");
  hintTimer = setTimeout(hidePlayHint, 4000);
}

function hidePlayHint() {
  clearTimeout(hintTimer);
  elPlayHint.classList.add("gone");
}

function endRun() {
  state = "done";
  targets = [];
  sndEnd();
  const isBest = score > best;
  if (isBest) {
    best = score;
    localStorage.setItem(STORAGE_KEY, String(best));
    elBest.textContent = best.toLocaleString();
  }
  bestBox.classList.remove("beaten");
  const rank = rankFor(score);
  document.getElementById("rank-icon").textContent = rank.icon;
  const rn = document.getElementById("rank-name");
  rn.textContent = rank.name;
  rn.style.color = rank.color;
  document.getElementById("res-score").textContent = score.toLocaleString();
  document.getElementById("res-hits").textContent = String(hits);
  document.getElementById("res-acc").textContent =
    (shots ? Math.round((hits / shots) * 100) : 0) + "%";
  document.getElementById("res-combo").textContent = "×" + multiplierFor(bestStreak);
  document.getElementById("new-best").classList.toggle("hidden", !isBest);
  scrRes.classList.remove("hidden");
}

function rankFor(s) {
  let r = RANKS[0];
  for (const tier of RANKS) if (s >= tier.min) r = tier;
  return r;
}

function multiplierFor(st) {
  return Math.min(COMBO_MAX, 1 + Math.floor(st / COMBO_STEP));
}

function updateHUD() {
  elScore.textContent = score.toLocaleString();
  const m = multiplierFor(streak);
  elCombo.textContent = "×" + m;
  comboBox.classList.toggle("hot", m >= 3 && m < COMBO_MAX);
  comboBox.classList.toggle("maxed", m >= COMBO_MAX);
  // BEST shows the stored record from run start; once the live score passes
  // it, the display follows the score and lights up gold (saved at endRun).
  elBest.textContent = Math.max(best, score).toLocaleString();
  bestBox.classList.toggle("beaten", best > 0 && score > best);
}

/* ---------------- Targets ---------------- */
function spawnTarget() {
  const elapsed = ROUND_SECONDS - timeLeft;
  const ramp = Math.min(1, elapsed / ROUND_SECONDS);          // 0 → 1 over the round
  const baseR = Math.min(W, H) * 0.055;
  const r = baseR * (0.8 + Math.random() * 0.5) * (1 - ramp * 0.25);
  const margin = r + 8;
  const gold = Math.random() < GOLD_CHANCE;
  targets.push({
    x: margin + Math.random() * Math.max(10, W - margin * 2),
    y: margin + Math.random() * Math.max(10, H - margin * 2),
    r: gold ? r * 0.8 : r,
    born: 0,
    life: (1.6 - ramp * 0.7) * (0.85 + Math.random() * 0.4),  // seconds
    gold: gold,
    wobble: Math.random() * Math.PI * 2
  });
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 160;
    particles.push({
      x: x, y: y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
      life: 0.45 + Math.random() * 0.3, age: 0,
      r: 2 + Math.random() * 3, color: color
    });
  }
}

function addFloater(x, y, text, color) {
  floaters.push({ x: x, y: y, text: text, color: color, age: 0, life: 0.8 });
}

/* ---------------- Input ---------------- */
function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  const src = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
  return { x: src.clientX - r.left, y: src.clientY - r.top };
}

function onTap(e) {
  if (state !== "playing") return;
  e.preventDefault();
  ensureAudio();
  const p = pointerPos(e);
  shots++;

  // Hit test topmost (last drawn) first.
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    const dx = p.x - t.x, dy = p.y - t.y;
    if (dx * dx + dy * dy <= t.r * t.r) {
      targets.splice(i, 1);
      hits++;
      hidePlayHint();   // first hit: the hint has done its job
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      const m = multiplierFor(streak);
      const pts = (t.gold ? GOLD_POINTS : BASE_POINTS) * m;
      score += pts;
      burst(t.x, t.y, t.gold ? "#ffd34d" : "#5ee7ff", t.gold ? 22 : 14);
      addFloater(t.x, t.y - t.r - 6, "+" + pts, t.gold ? "#ffd34d" : "#bff3ff");
      if (t.gold) sndGold(); else sndHit(m);
      updateHUD();
      return;
    }
  }

  // Miss: combo resets.
  if (streak > 0) addFloater(p.x, p.y - 10, "COMBO LOST", "#ff5d73");
  streak = 0;
  burst(p.x, p.y, "rgba(255,93,115,0.9)", 6);
  sndMiss();
  updateHUD();
}

canvas.addEventListener("mousedown", onTap);
canvas.addEventListener("touchstart", onTap, { passive: false });

/* ---------------- Pause handling ---------------- */
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing") {
    state = "paused";
    scrPause.classList.remove("hidden");
  }
});

document.getElementById("resume-btn").addEventListener("click", () => {
  if (state === "paused") {
    state = "playing";
    scrPause.classList.add("hidden");
    lastTs = performance.now();   // avoid a giant dt jump
  }
});

document.getElementById("start-btn").addEventListener("click", startRun);
document.getElementById("again-btn").addEventListener("click", startRun);
document.getElementById("mute-btn").addEventListener("click", (e) => {
  muted = !muted;
  e.currentTarget.textContent = muted ? "🔇" : "🔊";
});

/* ---------------- Update ---------------- */
function update(dt) {
  // Clouds always drift (also behind menus, for life).
  for (const c of clouds) {
    c.x += c.v * dt;
    if (c.x - 90 * c.s > W) { c.x = -90 * c.s; c.y = Math.random() * H * 0.75; }
  }

  // Particles & floaters always animate.
  particles = particles.filter(p => (p.age += dt) < p.life);
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; }
  floaters = floaters.filter(f => (f.age += dt) < f.life);
  for (const f of floaters) f.y -= 42 * dt;

  if (state !== "playing") return;

  timeLeft -= dt;
  const pct = Math.max(0, timeLeft / ROUND_SECONDS) * 100;
  elTimer.style.width = pct + "%";
  elTimer.classList.toggle("low", timeLeft <= 10);
  if (timeLeft <= 0) { timeLeft = 0; endRun(); return; }

  // Spawning with difficulty ramp.
  const elapsed = ROUND_SECONDS - timeLeft;
  const ramp = Math.min(1, elapsed / ROUND_SECONDS);
  spawnTimer -= dt;
  if (spawnTimer <= 0 && targets.length < MAX_TARGETS) {
    spawnTarget();
    spawnTimer = 0.85 - ramp * 0.5;   // 0.85s → 0.35s between spawns
  }

  // Age targets; expired ones break the combo.
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    t.born += dt;
    if (t.born >= t.life) {
      targets.splice(i, 1);
      if (streak > 0) {
        streak = 0;
        addFloater(t.x, t.y, "MISSED", "#ff5d73");
        updateHUD();
      }
      burst(t.x, t.y, "rgba(157,180,216,0.7)", 5);
      sndExpire();
    }
  }
}

/* ---------------- Render ---------------- */
function drawCloud(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(c.s, c.s);
  ctx.fillStyle = "rgba(255,255,255,0.20)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 15, 0, 0, Math.PI * 2);
  ctx.ellipse(-26, 4, 30, 11, 0, 0, Math.PI * 2);
  ctx.ellipse(28, 5, 32, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTarget(t, now) {
  const frac = t.born / t.life;                    // 0 fresh → 1 expired
  const pop = Math.min(1, t.born / 0.12);          // spawn pop-in
  const ease = 1 - Math.pow(1 - pop, 3);
  const shrink = 1 - frac * 0.45;                  // orbs shrink as they fade
  const r = t.r * ease * shrink;
  const alpha = frac > 0.75 ? 1 - (frac - 0.75) / 0.25 : 1;
  const pulse = 1 + Math.sin(now / 160 + t.wobble) * 0.05;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(t.x, t.y);
  ctx.scale(pulse, pulse);

  // Outer rift ring (rotating dashes).
  ctx.rotate(now / 900 + t.wobble);
  ctx.strokeStyle = t.gold ? "rgba(255,211,77,0.85)" : "rgba(94,231,255,0.75)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, r + 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.rotate(-(now / 900 + t.wobble));

  // Orb body.
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  if (t.gold) {
    g.addColorStop(0, "#fff3c4");
    g.addColorStop(0.55, "#ffd34d");
    g.addColorStop(1, "#e08a00");
  } else {
    g.addColorStop(0, "#e8fbff");
    g.addColorStop(0.5, "#5ee7ff");
    g.addColorStop(1, "#1f7fd1");
  }
  ctx.fillStyle = g;
  ctx.shadowColor = t.gold ? "rgba(255,211,77,0.8)" : "rgba(94,231,255,0.8)";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Core dot.
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, r * 0.22), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  for (const c of clouds) drawCloud(c);
  for (const t of targets) drawTarget(t, now);

  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.font = "800 16px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const f of floaters) {
    ctx.globalAlpha = 1 - f.age / f.life;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

/* ---------------- Main loop ---------------- */
function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  update(dt);
  draw(ts);
  requestAnimationFrame(frame);
}

resize();
updateHUD();
requestAnimationFrame(frame);
