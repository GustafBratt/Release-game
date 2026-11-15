'use strict';

// ---------- Rules and content ----------

const MODULES = {
  auth: { name: 'auth', color: '#b57bff' },
  kassa: { name: 'kassa', color: '#ff7b1c' },
  sok: { name: 'sök', color: '#1fd8f5' },
  app: { name: 'app', color: '#a6e22e' },
};

const TYPES = {
  bug: { icon: '🐛', size: 1, points: 100 },
  sec: { icon: '🔒', size: 1, points: 250 },
  db: { icon: '🗄️', size: 2, points: 150 },
  api: { icon: '🔌', size: 1, points: 120 },
  story: { icon: '✨', size: 1, points: 200 }, // only from PI planning
};

const TITLES = {
  bug: ['Krasch vid utloggning', 'Fel moms i kassan', 'Sök hittar ingenting', 'Avatar laddas inte',
    'Dubbla notiser', 'Datum fel i Safari', 'Knappen gör inget', 'Minnesläcka', 'Fel valuta på kvitto',
    'Vit text på vitt', 'Timeout vid inloggning', 'Off-by-one i listan', 'Fel tidszon', 'Emoji kraschar appen'],
  sec: ['XSS i kommentarer', 'SQL-injektion', 'Läckt API-nyckel', 'CVE i beroende', 'Öppen redirect',
    'Svag lösenordshash', 'CSRF i formulär', 'Admin utan inloggning'],
  story: ['Mörkt läge', 'Önskelista', 'Push-notiser', 'Spara sökningar', 'Betyg på varor', 'Dela varukorg',
    'Inloggning med passkey', 'Snabbköp', 'Ny startsida', 'Presentkort', 'Orderhistorik', 'Rekommendationer'],
  db: ['Nytt index', 'Ny kolumn', 'Byt kolumntyp', 'Ny tabell', 'Datamigrering', 'Dela upp tabell', 'Ta bort kolumn'],
};
const ENDPOINTS = ['/orders', '/users', '/search', '/cart', '/login', '/items', '/payments'];
const PAIR_LETTERS = 'ABCDEFGH';

const CAPACITY = 4;          // planned slots per release (slipped changes can overfill it)
const LANES = 3;             // releases on screen at once
const CONFLICT_TAPS = 4;     // taps to resolve a git conflict
const DEPLOY_TIME = 4;       // seconds a deploy takes; the pipeline runs one at a time
const SEC_DUE = 30;          // a security fix must be in prod this many seconds after it appears
const DUE_BONUS = 150;       // customer deadline kept
const FORCE_SLOTS = 8;       // a release this overfull gets deployed by someone else
const CARD_H = 62;
// PI planning: after every third sprint the game stops for a little platform level, then calm planning.
const PI_EVERY = 3;
const PI_CANDIES = 8;        // candies in the level; each one collected becomes a story
const PI_SPEED0 = 260;       // the avatar runs by itself, px/s, at the start of the level …
const PI_SPEED1 = 400;       // … and speeds up to this by the finish
const PI_GRAV = 2600;        // px/s²
const PI_JUMP = 760;         // jump speed, px/s (about 110 px high, 0.6 s in the air; a double jump nearly doubles it)
const CANDY = ['🍬', '🍭', '🍫', '🍩', '🧁', '🍪'];
const NOTE_COLORS = ['#fde68a', '#f9a8d4', '#93c5fd', '#86efac'];
const TOP = 22;              // space for the inbox label

// ---------- Helpers ----------

const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Integers shown to the player get Swedish thousands separators: 12 345 (a non-breaking space).
const fmt = (n) => Math.round(n).toLocaleString('sv-SE');

function storageGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode etc. */ }
}

// ---------- Sound ----------
// Everything is synthesized with Web Audio: no sound files.
// soundMode: 'all' (music + effects), 'sfx' (effects only), 'off'.

let AC = null, master = null, musicBus = null, noiseBuf = null;
let soundMode = storageGet('rm-sound', 'all');

function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = 0.9;
    master.connect(AC.destination);
    musicBus = AC.createGain();
    musicBus.gain.value = 0.6;
    musicBus.connect(master);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.6, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { AC = null; }
}

function tone(freq, dur, type = 'sine', vol = 0.05, o = {}) {
  if (!AC || soundMode === 'off') return;
  try {
    const t0 = o.at ?? AC.currentTime + (o.delay || 0);
    const osc = AC.createOscillator();
    const g = AC.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(o.bus || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

function noise(dur, vol, o = {}) {
  if (!AC || soundMode === 'off') return;
  try {
    const t0 = o.at ?? AC.currentTime + (o.delay || 0);
    const src = AC.createBufferSource();
    src.buffer = noiseBuf;
    const f = AC.createBiquadFilter();
    f.type = o.filter || 'highpass';
    f.frequency.setValueAtTime(o.freq || 6000, t0);
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
    f.Q.value = o.q || 1;
    const g = AC.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(o.bus || master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

// ---- Instruments: mallets, FM bells, a woodblock, a filtered pad and soft drums ----

function mallet(freq, dur, vol, o = {}) {
  tone(freq, dur, 'sine', vol, o);
  tone(freq * 4, dur * 0.25, 'sine', vol * 0.35, o); // the bright "knock" of a marimba bar
}

function bell(freq, dur, vol, o = {}) {
  if (!AC || soundMode === 'off') return;
  try {
    const t0 = o.at ?? AC.currentTime + (o.delay || 0);
    const car = AC.createOscillator();
    const mod = AC.createOscillator();
    const modGain = AC.createGain();
    const g = AC.createGain();
    car.frequency.value = freq;
    mod.frequency.value = freq * 3.5;
    modGain.gain.setValueAtTime(freq * 2.2, t0);
    modGain.gain.exponentialRampToValueAtTime(1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    mod.connect(modGain).connect(car.frequency);
    car.connect(g).connect(o.bus || master);
    car.start(t0); mod.start(t0);
    car.stop(t0 + dur + 0.02); mod.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

function wood(freq = 1800, vol = 0.07, o = {}) {
  noise(0.05, vol, { ...o, filter: 'bandpass', freq, q: 9 });
  tone(freq / 2, 0.05, 'sine', vol * 0.6, o);
}

function pad(freqs, dur, vol, cutoff, o = {}) {
  if (!AC || soundMode === 'off') return;
  try {
    const t0 = o.at ?? AC.currentTime;
    const f = AC.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    f.Q.value = 0.7;
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    f.connect(g).connect(o.bus || master);
    for (const fr of freqs) {
      for (const det of [-6, 6]) {
        const osc = AC.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = fr;
        osc.detune.value = det;
        osc.connect(f);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      }
    }
  } catch { /* ignore */ }
}

function thud(vol = 0.2, o = {}) {
  tone(95, 0.45, 'sine', vol, { ...o, slideTo: 45 });
  noise(0.3, vol * 0.3, { ...o, filter: 'lowpass', freq: 500 });
}

// ---- Chip instruments for the PI level: pulse waves, a triangle bass and noise drums ----

const pulseWaves = {};
function pulseWave(duty) {
  if (!pulseWaves[duty]) {
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    pulseWaves[duty] = AC.createPeriodicWave(re, im);
  }
  return pulseWaves[duty];
}

// A flat, 8-bit style note: full volume, then a quick release.
function chip(freq, dur, vol, o = {}) {
  if (!AC || soundMode === 'off') return;
  try {
    const t0 = o.at ?? AC.currentTime + (o.delay || 0);
    const osc = AC.createOscillator();
    if (o.wave === 'triangle') osc.type = 'triangle';
    else osc.setPeriodicWave(pulseWave(o.duty || 0.5));
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
    const g = AC.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.setValueAtTime(vol, t0 + dur * 0.75);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(o.bus || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function seq(freqs, step, fn) { freqs.forEach((f, i) => fn(f, i * step)); }

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // C major pentatonic

const sfx = {
  spawn: () => mallet(pick(PENTA) * 1.5, 0.35, 0.035),
  pickup: () => wood(2200, 0.05),
  place: () => { mallet(392, 0.3, 0.07); wood(1500, 0.04); },
  alarm: () => { bell(1318.5, 0.7, 0.05); bell(1396.9, 0.7, 0.04); bell(1318.5, 0.7, 0.05, { delay: 0.3 }); bell(1396.9, 0.7, 0.04, { delay: 0.3 }); },
  danger: () => { wood(2600, 0.05); wood(2600, 0.05, { delay: 0.09 }); },
  tick: (urgent) => wood(urgent ? 3000 : 2200, 0.06),
  conflict: () => { mallet(185, 0.6, 0.09); mallet(196, 0.6, 0.08); },
  tap: (p) => wood(1200 + p * 300, 0.07),
  resolved: () => seq([783.99, 987.77, 1174.66], 0.08, (f, d) => bell(f, 0.6, 0.045, { delay: d })),
  deploy: () => { noise(3.6, 0.04, { filter: 'bandpass', freq: 200, sweepTo: 2600, q: 1.5 }); pad([261.63, 329.63, 392], 3.8, 0.02, 1400); },
  ship: () => { seq([523.25, 659.25, 783.99, 987.77, 1318.5], 0.09, (f, d) => bell(f, 1.0, 0.045, { delay: d })); tone(130.81, 0.8, 'sine', 0.08); },
  fail: () => thud(0.22),
  rollback: () => { seq([659.25, 523.25, 440, 329.63], 0.12, (f, d) => mallet(f, 0.4, 0.07, { delay: d })); thud(0.18, { delay: 0.45 }); },
  deny: () => wood(700, 0.08),
  deadline: () => { bell(1046.5, 0.8, 0.05); bell(1318.5, 0.8, 0.045, { delay: 0.15 }); },
  sprint: () => seq([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.07, (f, d) => mallet(f, 0.4, 0.06, { delay: d })),
  gameOver: () => { pad([220, 261.63, 329.63], 3, 0.03, 900); seq([659.25, 587.33, 523.25, 440, 329.63], 0.35, (f, d) => bell(f, 1.2, 0.045, { delay: d })); },
  click: () => wood(1900, 0.045),
  slip: () => { tone(620, 0.2, 'sine', 0.07, { slideTo: 240 }); wood(900, 0.04, { delay: 0.12 }); },
  // 8-bit effects for the PI level.
  chipJump: (double) => chip(double ? 520 : 330, 0.12, 0.05, { duty: 0.25, slideTo: double ? 1300 : 900 }),
  chipCandy: (n) => seq([0, 4, 7, 12].map((i) => midi(76 + ((n - 1) % 5) * 2 + i)), 0.04, (f, d) => chip(f, 0.06, 0.045, { duty: 0.125, delay: d })),
  chipFall: () => chip(700, 0.5, 0.06, { duty: 0.5, slideTo: 90 }),
};

// Background music: lo-fi chords, soft drums and a wandering mallet melody.
// It speeds up and opens its filter with every sprint, and gets nervous when cards near the bottom or prod is low.
const music = { step: 0, next: 0, bar: 0 };
const CHORDS = [
  [220, 261.63, 329.63, 392],      // Am7
  [174.61, 220, 261.63, 329.63],   // Fmaj7
  [130.81, 196, 246.94, 329.63],   // Cmaj7
  [196, 246.94, 293.66, 329.63],   // G6
];
const MELODY = [440, 523.25, 587.33, 659.25, 783.99, 880]; // A minor pentatonic

function playStep(s, t, sd) {
  const chord = CHORDS[music.bar % CHORDS.length];
  const bus = musicBus;
  if (s === 0) pad(chord, sd * 16, 0.022, Math.min(2400, 700 + G.sprint * 250), { at: t, bus });
  // Drums: a lazy kick, a rim click on 2 and 4, soft hats that get busier each sprint.
  if (s === 0 || s === 7 || s === 10) tone(110, 0.25, 'sine', 0.2, { at: t, slideTo: 42, bus });
  if (s === 4 || s === 12) noise(0.09, 0.06, { at: t, filter: 'bandpass', freq: 1700, q: 2, bus });
  if (s % 2 === 0 || G.sprint >= 3) noise(0.03, s % 2 ? 0.012 : 0.022, { at: t, freq: 8000, bus });
  // Bass on the root.
  if (s === 0 || s === 3 || s === 8) tone(chord[0] / 2, sd * 2.5, 'sine', 0.1, { at: t, bus, attack: 0.02 });
  // Melody: more notes the further into the game.
  if (s % 2 === 0 && Math.random() < 0.12 + G.sprint * 0.04) mallet(pick(MELODY) * (Math.random() < 0.3 ? 2 : 1), 0.4, 0.035, { at: t, bus });
  // Tension: a radar ping when cards are near the bottom, a low pulse when prod is in trouble.
  if (G.danger && (s === 0 || s === 8)) bell(1760, 0.4, 0.025, { at: t, bus });
  if (G.urgent && s % 4 === 0) tone(chord[0] / 2, 0.2, 'triangle', 0.06, { at: t, bus });
}

// Chiptune for the PI level: an original 4-bar loop over C–Am–F–G, at 16th notes.
const CHIP_LEAD = [
  [72, 0, 76, 0, 79, 0, 76, 0, 84, 0, 79, 0, 76, 0, 79, 81],
  [81, 0, 79, 0, 76, 0, 72, 0, 76, 0, 0, 0, 74, 0, 72, 0],
  [77, 0, 81, 0, 84, 0, 81, 0, 77, 0, 79, 0, 81, 0, 84, 0],
  [83, 0, 0, 0, 79, 0, 74, 0, 79, 0, 83, 0, 86, 0, 0, 0],
];
const CHIP_CHORDS = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];

function playChipStep(s, t, sd) {
  const bar = music.bar % 4;
  const bus = musicBus;
  const chord = CHIP_CHORDS[bar];
  const n = CHIP_LEAD[bar][s];
  if (n) chip(midi(n), sd * 1.8, 0.028, { at: t, duty: 0.25, bus });
  // Fast arpeggio an octave up, quiet, every 16th.
  chip(midi(chord[s % 3] + 24), sd * 0.9, 0.012, { at: t, duty: 0.125, bus });
  // Triangle bass: root and octave on the 8ths.
  if (s % 2 === 0) chip(midi(chord[0] - 12 + (s % 4 === 2 ? 12 : 0)), sd * 1.6, 0.11, { at: t, wave: 'triangle', bus });
  // Drums: kick on 1 and 3, noise snare on 2 and 4, a hat on the off-beats.
  if (s === 0 || s === 8 || s === 10) chip(160, 0.09, 0.2, { at: t, wave: 'triangle', slideTo: 45, bus });
  if (s === 4 || s === 12) noise(0.1, 0.07, { at: t, filter: 'highpass', freq: 1800, bus });
  if (s % 2 === 1) noise(0.025, 0.025, { at: t, freq: 9000, bus });
}

function musicTick() {
  if (!AC || soundMode !== 'all' || !G || !G.running || G.paused) return;
  if (G.pi && G.pi.phase === 'hunt') {
    // Speeds up with the level, like the run itself.
    const f = G.pi.av.x / G.pi.level.end;
    const sd = 60 / (150 + 30 * Math.max(0, Math.min(1, f))) / 4;
    if (music.next < AC.currentTime) music.next = AC.currentTime + 0.05;
    while (music.next < AC.currentTime + 0.15) {
      playChipStep(music.step, music.next, sd);
      music.next += sd;
      music.step = (music.step + 1) % 16;
      if (music.step === 0) music.bar++;
    }
    return;
  }
  const bpm = Math.min(124, 78 + (G.sprint - 1) * 7 + (G.urgent ? 8 : 0));
  const sd = 60 / bpm / 2;
  if (music.next < AC.currentTime) music.next = AC.currentTime + 0.05;
  while (music.next < AC.currentTime + 0.15) {
    playStep(music.step, music.next, sd);
    music.next += sd;
    music.step = (music.step + 1) % 16;
    if (music.step === 0) music.bar++;
  }
}

// ---------- DOM ----------

const inboxEl = $('#inbox');
const releasesEl = $('#releases');
const toastsEl = $('#toasts');
const inboxLabel = $('.inbox-label');
const bannerEl = $('#banner');
const laneEls = [];
for (let i = 0; i < LANES; i++) {
  const el = document.createElement('div');
  el.className = 'release';
  el.dataset.release = i;
  releasesEl.appendChild(el);
  laneEls.push(el);
}

const L = { inboxW: 300, inboxH: 400, cw: 96, pad: 6 };
function measure() {
  L.inboxW = inboxEl.clientWidth;
  L.inboxH = inboxEl.clientHeight;
  L.cw = Math.floor((L.inboxW - L.pad * (LANES + 1)) / LANES);
  inboxEl.style.setProperty('--cw', L.cw + 'px');
  inboxEl.style.setProperty('--ch', CARD_H + 'px');
}
// The inbox height also changes when the lanes below it get content, so watch the element itself.
window.addEventListener('resize', measure);
if (window.ResizeObserver) new ResizeObserver(measure).observe(inboxEl);

// ---------- Game state ----------

let G = null;

function newGame() {
  return {
    t: 0, score: 0, running: true, paused: false,
    cards: new Map(), releases: [], pairs: new Map(), scheduled: [],
    nextId: 1, nextRid: 1, nextVersion: 1, nextPair: 0, nextDbv: 41, pendingDbv: new Set(),
    spawnIn: 0.8, conflictIn: 8, sprint: 1,
    shipped: 0, broken: 0, changes: 0, selected: null, seenTips: new Set(), lastTip: -Infinity,
    dbProd: 40, // schema version in prod: the highest migration shipped (they ship in order)
    dbShown: false, // the top bar shows dbProd from the first migration shipped
    leadSum: 0, leadCount: 0, // lead time from radar to prod, over every change shipped
    pi: null, // PI planning in progress: { phase: 'hunt' | 'plan', spawned, caught, next, candies }
  };
}

// Sprint 1 is a warm-up: it eases from a calm pace down to the normal curve at 60 s.
const SPRINT_LEN = 45;       // seconds per sprint
// New kinds of changes arrive one sprint at a time, each with an info card the first time it shows up.
const UNLOCK = { db: 2, sec: 3, dbOrder: 3, api: 4, deadline: 5, spont: 6, apiBig: 7 };
function unlocked(key) { return G.sprint >= UNLOCK[key]; }
// Info cards come at least TIP_GAP seconds apart: a new mechanic shows up for the first time only once that
// much game time has passed since the last card (and after the card it builds on). Until then it waits.
const TIP_GAP = 20;
const TIP_AFTER = { dbOrder: 'db', apiBig: 'api' };
function ready(key) {
  if (!unlocked(key)) return false;
  if (G.seenTips.has(key)) return true;
  if (TIP_AFTER[key] && !G.seenTips.has(TIP_AFTER[key])) return false;
  // PI planning has its own card and can't be moved, so don't introduce anything just before it either.
  const nextPI = Math.ceil((G.t + 0.001) / (PI_EVERY * SPRINT_LEN)) * PI_EVERY * SPRINT_LEN;
  return G.t - G.lastTip >= TIP_GAP && nextPI - G.t >= TIP_GAP;
}
const WARMUP = SPRINT_LEN;
function warm(calm, normal) {
  const k = Math.min(1, G.t / WARMUP);
  return calm + (normal - calm) * k;
}
// After the warm-up the pace tightens slowly: the floors are reached only after 7–10 minutes.
// Sprint 7 brings bigger API changes right after a PI planning, so the pace holds still for that sprint
// (at the level sprint 6 ended on) and picks up again from sprint 8.
const PACE_HOLD_FROM = (UNLOCK.apiBig - 1) * SPRINT_LEN;
function paceT() { return G.t < PACE_HOLD_FROM ? G.t : Math.max(PACE_HOLD_FROM, G.t - SPRINT_LEN); }
function fallTime() {
  const normal = Math.max(10, 26 - Math.max(0, paceT() - WARMUP) * 0.03);
  return G.t < WARMUP ? warm(34, normal) : normal;
}
function spawnInterval() {
  const normal = Math.max(1.3, 4.2 - Math.max(0, paceT() - WARMUP) * 0.008);
  return G.t < WARMUP ? warm(7, normal) : normal;
}

function usedSlots(r) { return r.cards.reduce((s, id) => s + TYPES[G.cards.get(id).type].size, 0); }
function releaseById(id) { return G.releases.find((r) => r && r.id === id); }
function speedFactor(c) { return Math.max(0.2, Math.min(2, 2 - (G.t - c.born) / 30)); }
function pipelineBusy() { return G.releases.some((r) => r.state === 'deploying'); }

function minDue(r) {
  const ds = r.cards.map((id) => G.cards.get(id).dueLeft).filter((d) => d !== null);
  return ds.length ? Math.min(...ds) : null;
}
function unresolved(r) { return r.conflicts.filter((k) => k.progress < CONFLICT_TAPS); }

// ---------- Spawning ----------

// Cards on the radar never overlap. Each column is a queue: one card's height plus a small gap apart.
function cardGap() { return (CARD_H + 6) / Math.max(1, L.inboxH - CARD_H - TOP - 6); }

// A card enters at the top of the column with the most room. If every column is full at the top,
// it waits just above the radar (negative progress) and slides in as soon as there's room.
function enterInbox(c) {
  const top = Array(LANES).fill(Infinity);
  for (const o of G.cards.values()) {
    if (o !== c && o.where === 'inbox') top[o.col] = Math.min(top[o.col], o.progress);
  }
  const best = Math.max(...top);
  c.col = pick(top.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0));
  c.progress = Math.min(0, best - cardGap());
}

function spawnCard(type, opts = {}) {
  const c = {
    id: G.nextId++, type,
    module: opts.module || pick(type === 'db' ? ['auth', 'kassa', 'sok'] : Object.keys(MODULES)),
    title: opts.title || pick(TITLES[type]),
    where: 'inbox', releaseId: null, col: 0, progress: 0,
    fallTime: type === 'sec' ? fallTime() * 0.55 : fallTime(),
    pairId: opts.pairId ?? null, role: opts.role || null,
    unplanned: false, dueLeft: null, el: null, born: G.t,
    dbv: type === 'db' ? opts.dbv ?? nextMigration() : null, // migrations must ship in this order
  };
  enterInbox(c);
  if (c.dbv !== null) G.pendingDbv.delete(c.dbv);
  // Deadlines belong to issues, not releases: security fixes always, and sometimes a customer is waiting.
  if (type === 'sec') c.dueLeft = SEC_DUE;
  else if ((type === 'bug' || type === 'db') && ready('deadline') && Math.random() < 0.22) c.dueLeft = Math.round(rand(40, 60));
  G.cards.set(c.id, c);
  G.changes++;
  createCardEl(c);
  if (type === 'db') tip('db');
  if (type === 'sec') { sfx.alarm(); toast('🔒 Säkerhetsfix inkommen – ut i prod inom 30 s!', 'warn'); tip('sec'); }
  else if (c.dueLeft !== null) { sfx.deadline(); toast(`⏰ Kund väntar: ${c.title}`, 'warn'); tip('deadline'); }
  else if (!opts.quiet) sfx.spawn();
  return c;
}

// An API change touches 2–4 services: one card per service, sharing a letter.
// The first is the server (the API itself); the others are clients that must ship with it.
function groupSize() {
  const r = Math.random();
  if (!ready('apiBig')) return 2;
  if (G.sprint === UNLOCK.apiBig) return r < 0.6 ? 2 : 3; // 4 services only from the sprint after
  return r < 0.55 ? 2 : r < 0.87 ? 3 : 4;
}

// Migration numbers are handed out in order, but sometimes the next one shows up before the
// previous one: the skipped number is held back (G.pendingDbv) and arrives a few seconds later.
function nextMigration() {
  if (ready('dbOrder') && Math.random() < 0.35) {
    const held = G.nextDbv;
    G.nextDbv += 2;
    G.pendingDbv.add(held);
    G.scheduled.push({ at: rand(2, 5), fn: () => spawnCard('db', { dbv: held }) });
    tip('dbOrder');
    return held + 1;
  }
  return G.nextDbv++;
}

function spawnApiGroup() {
  const pid = G.nextPair++;
  const letter = PAIR_LETTERS[pid % PAIR_LETTERS.length];
  const title = `${pick(ENDPOINTS)} v${2 + Math.floor(Math.random() * 4)}`;
  const group = { letter, members: [], size: groupSize() };
  G.pairs.set(pid, group);
  tip('api');
  if (group.size > 2) tip('apiBig');
  const server = pick(['auth', 'kassa', 'sok']);
  const clients = Object.keys(MODULES).filter((m) => m !== server).sort(() => Math.random() - 0.5).slice(0, group.size - 1);
  const a = spawnCard('api', { pairId: pid, role: 'server', module: server, title });
  group.members.push(a.id);
  let at = 0;
  for (const m of clients) {
    at += rand(1, 3);
    G.scheduled.push({
      at, pid,
      fn: () => {
        const b = spawnCard('api', { pairId: pid, role: 'klient', module: m, title });
        group.members.push(b.id);
      },
    });
  }
}

function spawnRandom() {
  const w = [
    ['bug', 45],
    ['db', ready('db') ? 14 : 0],
    ['sec', ready('sec') ? 11 : 0],
    ['api', ready('api') ? 13 : 0],
  ];
  let x = Math.random() * w.reduce((s, [, n]) => s + n, 0);
  for (const [type, n] of w) {
    x -= n;
    if (x < 0) { type === 'api' ? spawnApiGroup() : spawnCard(type); return; }
  }
  spawnCard('bug');
}

// Releases have no date: they go out when the player presses Släpp (or when one gets absurdly overfull).
function newRelease(lane) {
  G.releases[lane] = {
    id: G.nextRid++, version: `4.${G.nextVersion++}`, lane, state: 'open',
    cards: [], conflicts: [], deployLeft: 0, lastDueSec: null,
  };
  renderLane(G.releases[lane]);
}

// A shipped release leaves its lane: the ones to its right slide left, and a new release enters on the right,
// so the lanes are always in version order.
function rotateReleases(done) {
  G.releases = G.releases.filter((r) => r !== done);
  G.releases.forEach((r, i) => {
    const moved = r.lane !== i;
    r.lane = i;
    renderLane(r);
    if (moved) animateLane(i, 'shift');
  });
  newRelease(G.releases.length);
  animateLane(G.releases.length - 1, 'enter');
  const next = G.releases[0];
  if (next.queued) {
    next.queued = false;
    if (next.cards.length && !unresolved(next).length) startDeploy(next);
    else toast(`v${next.version} väntar: olöst konflikt`, 'bad');
  }
}

function animateLane(i, cls) {
  const el = laneEls[i];
  el.classList.remove('shift', 'enter');
  void el.offsetWidth;
  el.classList.add(cls);
  // Drop the class afterwards, or it would block the shake animation (children's animations bubble too).
  const done = (e) => {
    if (e.target !== el) return;
    el.classList.remove(cls);
    el.removeEventListener('animationend', done);
  };
  el.addEventListener('animationend', done);
}

// ---------- Rules ----------

// The other cards of c's API change that exist right now (not shipped, not still to come).
function groupOf(c) {
  if (c.pairId === null) return [];
  const g = G.pairs.get(c.pairId);
  return g ? g.members.map((id) => G.cards.get(id)).filter((m) => m && m !== c) : [];
}

function conflictCount(r, key) { return r.cards.filter((id) => G.cards.get(id).module === key).length; }
function conflictName(key) { return MODULES[key].name; }

// ---- Database migrations must reach prod in version order ----

// Migrations older than those in r that are neither in prod nor in r itself.
function missingMigrations(r) {
  const vs = r.cards.map((id) => G.cards.get(id)).filter((c) => c.type === 'db').map((c) => c.dbv);
  if (!vs.length) return [];
  const top = Math.max(...vs);
  // Held-back migrations that haven't appeared yet count as missing too.
  const notYet = [...G.pendingDbv].filter((v) => v < top).map((v) => ({ dbv: v, where: 'pending' }));
  return [...G.cards.values()]
    .filter((c) => c.type === 'db' && c.dbv < top && c.releaseId !== r.id)
    .concat(notYet)
    .sort((a, b) => a.dbv - b.dbv);
}
// API changes in r that don't have all their cards in r (some still on the radar, or not arrived yet).
function incompleteApi(r) {
  const out = [];
  for (const pid of new Set(r.cards.map((id) => G.cards.get(id)).filter((c) => c.type === 'api').map((c) => c.pairId))) {
    const g = G.pairs.get(pid);
    const here = r.cards.filter((id) => G.cards.get(id).pairId === pid).length;
    if (here < g.size) out.push({ letter: g.letter, missing: g.size - here });
  }
  return out;
}

// The missing ones that won't have shipped before r leaves either (not in a release to its left).
function blockingMigrations(r) {
  return missingMigrations(r).filter((c) => {
    const at = c.where === 'release' ? releaseById(c.releaseId) : null;
    return !at || at.lane > r.lane;
  });
}

// Changes planned into the same release are merged together and can't be separated.
// (An API change alone in a release can still move, since its cards move as one.)
function isLocked(c) {
  // PI planning is for replanning: while planning, anything in an open release can be moved.
  if (c.where !== 'release' || (G.pi && G.pi.phase === 'plan')) return false;
  const r = releaseById(c.releaseId);
  const mine = new Set([c.id, ...groupOf(c).map((m) => m.id)]);
  return !!r && r.cards.some((id) => !mine.has(id));
}

function canPlace(c, r) {
  if (!r || r.state !== 'open') return { ok: false, reason: 'Releasen deployas redan' };
  if (c.releaseId === r.id) return { ok: false, same: true };
  if (isLocked(c)) return { ok: false, reason: `Ihopmergad med andra ändringar i v${releaseById(c.releaseId).version}` };
  // An API change is never split: members already in another release move along.
  const along = groupOf(c).filter((m) => m.where === 'release' && m.releaseId !== r.id);
  const need = TYPES[c.type].size + along.length;
  if (usedSlots(r) + need > CAPACITY) {
    return { ok: false, reason: along.length ? `Ingen plats för alla ${along.length + 1} API-korten` : 'Releasen är full' };
  }
  if (c.type === 'db') {
    // Releases leave left to right, so planned migrations must be in version order left to right.
    for (const o of G.releases) {
      if (o === r) continue;
      for (const id of o.cards) {
        const d = G.cards.get(id);
        if (d.type !== 'db' || d === c) continue;
        if (d.dbv < c.dbv && o.lane > r.lane) return { ok: false, reason: `V${d.dbv} går ut senare – V${c.dbv} måste efter` };
        if (d.dbv > c.dbv && o.lane < r.lane) return { ok: false, reason: `V${d.dbv} går ut tidigare – V${c.dbv} måste före` };
      }
    }
  }
  return { ok: true, along };
}

function tryPlace(id, r) {
  const c = G.cards.get(id);
  if (!c) return false;
  const res = canPlace(c, r);
  if (!res.ok) {
    if (res.same) { select(null); return false; }
    laneEls[r.lane].classList.remove('shake');
    void laneEls[r.lane].offsetWidth;
    laneEls[r.lane].classList.add('shake');
    sfx.deny();
    toast(res.reason, 'bad');
    return false;
  }
  select(null);
  placeInto(c, r);
  for (const m of res.along) placeInto(m, r);
  sfx.place();
  return true;
}

// Moves a card into a release without checking the planning rules (slipped changes ignore them).
function placeInto(c, r) {
  if (c.where === 'release') removeFromRelease(c);
  else removeCardEl(c);
  c.where = 'release';
  c.releaseId = r.id;
  r.cards.push(c.id);
  for (const key of [c.module]) {
    if (conflictCount(r, key) < 2) continue;
    const k = r.conflicts.find((x) => x.module === key);
    if (!k) r.conflicts.push({ module: key, progress: 0, spont: false });
    else k.progress = 0;
    sfx.conflict();
    toast(`⚔️ Git-konflikt i ${conflictName(key)} (v${r.version})`, 'bad');
    tip('conflict');
  }
  renderLane(r);
}

function removeFromRelease(c) {
  const r = releaseById(c.releaseId);
  c.where = null;
  c.releaseId = null;
  if (!r) return;
  r.cards = r.cards.filter((id) => id !== c.id);
  r.conflicts = r.conflicts.filter((k) => conflictCount(r, k.module) >= (k.spont ? 1 : 2));
  renderLane(r);
}

function deleteCard(c) {
  if (G.selected === c.id) select(null);
  if (drag && drag.id === c.id) cancelDrag();
  if (c.where === 'release') removeFromRelease(c);
  removeCardEl(c);
  G.cards.delete(c.id);
}

// A change that reaches the bottom doesn't vanish: it tags along in the next release, planned or not.
// An API card follows the rest of its change if part of it is already in a release.
function slip(c) {
  const placed = groupOf(c).find((m) => m.where === 'release');
  const r = placed ? releaseById(placed.releaseId) : G.releases.find((x) => x.state === 'open');
  if (!r || r.state !== 'open') { c.progress = 1; return; } // nothing to slip into right now: wait at the line
  if (G.selected === c.id) select(null);
  if (drag && drag.id === c.id) cancelDrag();
  c.unplanned = true;
  placeInto(c, r);
  sfx.slip();
  toast(`⚠️ ${c.type === 'api' ? 'API ' + c.role : c.title} följde med i v${r.version}`, 'warn');
}

function missDeadline(c) {
  c.dueLeft = null;
  if (c.type === 'sec') gameOver('🔒 Säkerhetshålet utnyttjades', `${c.title} kom inte ut i prod i tid.`);
  else gameOver('⏰ Kundlöftet bröts', `”${c.title}” var utlovad till en kund, men kom inte ut i tid.`);
}

function spontaneousConflict() {
  const cands = G.releases.filter((r) => r && r.state === 'open' && r.cards.length >= 1);
  if (!cands.length) return;
  const r = pick(cands);
  const mods = [...new Set(r.cards.map((id) => G.cards.get(id).module))]
    .filter((m) => !r.conflicts.some((k) => k.module === m && k.progress < CONFLICT_TAPS));
  if (!mods.length) return;
  const m = pick(mods);
  const existing = r.conflicts.find((k) => k.module === m);
  if (existing) { existing.progress = 0; existing.spont = true; } else r.conflicts.push({ module: m, progress: 0, spont: true });
  sfx.conflict();
  toast(`🔀 main har gått vidare: rebase ${conflictName(m)} i v${r.version}`, 'bad');
  tip('spont');
  renderLane(r);
}

function tapConflict(lane, idx) {
  const r = G.releases[lane];
  const k = r && r.conflicts[idx];
  if (!k || k.progress >= CONFLICT_TAPS || r.state !== 'open') return;
  k.progress++;
  if (k.progress >= CONFLICT_TAPS) { sfx.resolved(); toast(`✅ Konflikten i ${conflictName(k.module)} löst`, 'good'); }
  else sfx.tap(k.progress);
  renderLane(r);
}

// While the leftmost release deploys, the next one can be queued (like a pre-move in chess):
// it starts deploying by itself as soon as the pipeline is free.
function canQueue(r) {
  return r && r.lane === 1 && r.state === 'open' && G.releases[0].state === 'deploying' && r.cards.length > 0;
}

function shipEarly(lane) {
  const r = G.releases[lane];
  if (canQueue(r)) {
    r.queued = !r.queued;
    sfx.click();
    if (r.queued) toast(`⏭ v${r.version} går ut direkt efter v${G.releases[0].version}`, '');
    return;
  }
  // Releases go out in version order: only the leftmost one can be released.
  if (G.pi) return;
  if (!r || r.lane !== 0 || r.state !== 'open' || !r.cards.length || unresolved(r).length || pipelineBusy()) return;
  startDeploy(r);
}

function startDeploy(r) {
  r.state = 'deploying';
  r.deployLeft = DEPLOY_TIME;
  sfx.deploy();
  if (G.selected && G.cards.get(G.selected)?.releaseId === r.id) select(null);
  if (drag && G.cards.get(drag.id)?.releaseId === r.id) cancelDrag();
  renderLane(r);
}

function finishDeploy(r) {
  const cards = r.cards.map((id) => G.cards.get(id));
  const missing = missingMigrations(r);
  if (missing.length) {
    const top = Math.max(...cards.filter((c) => c.type === 'db').map((c) => c.dbv));
    gameOver('🗄️ Migreringar i fel ordning', `v${r.version} innehöll V${top}, men V${missing[0].dbv} var inte i prod. Databasen är trasig.`);
    return;
  }
  const partial = incompleteApi(r);
  if (partial.length) {
    gameOver('🔌 Ofullständig API-ändring', `v${r.version} släpptes med API-ändring ${partial[0].letter}, men ${partial[0].missing} av dess kort saknades. Klienterna går sönder.`);
    return;
  }
  const broken = unresolved(r).length > 0;

  if (broken) {
    G.broken++;
    // Rollback: everything goes back into the inbox.
    for (const c of cards) {
      c.where = 'inbox'; c.releaseId = null;
      c.fallTime = fallTime() * 0.8;
      enterInbox(c);
      createCardEl(c);
    }
    r.cards = [];
    sfx.rollback();
    toast(`💥 v${r.version}: olöst konflikt, rollback`, 'bad');
  } else if (cards.length) {
    // Points reward lead time: the sooner a change reaches prod after it appeared, the more it's worth.
    let pts = 0, slipped = 0, kept = 0, lead = 0;
    for (const c of cards) {
      lead += G.t - c.born;
      G.leadSum += G.t - c.born;
      G.leadCount++;
      const f = speedFactor(c);
      if (c.unplanned) { slipped++; pts += Math.round(TYPES[c.type].points * f * 0.5); continue; }
      pts += Math.round(TYPES[c.type].points * f);
      const grp = groupOf(c);
      if (c.role === 'server' && grp.length && grp.every((m) => !m.unplanned)) pts += 100 * grp.length;
      if (c.dueLeft !== null && c.type !== 'sec') { pts += DUE_BONUS; kept++; }
    }
    const avg = Math.round(lead / cards.length);
    const dbs = cards.filter((c) => c.type === 'db').map((c) => c.dbv);
    if (dbs.length) {
      G.dbProd = Math.max(G.dbProd, ...dbs);
      G.dbShown = true;
      const el = $('#dbprod');
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
    for (const c of cards) G.cards.delete(c.id);
    r.cards = [];
    G.score += pts;
    G.shipped++;
    sfx.ship();
    toast(`🚀 v${r.version} i prod! +${fmt(pts)} · ledtid ${avg} s`, 'good');
    if (kept) toast(`⏰ Kundlöfte hållet${kept > 1 ? ` ×${kept}` : ''}!`, 'good');
    if (slipped) toast(`⚠️ ${slipped} oplanerad${slipped > 1 ? 'e' : ''} ändring${slipped > 1 ? 'ar' : ''}: halva poängen`, 'warn');
  } else {
    toast(`v${r.version} gick ut tom`, '');
  }
  rotateReleases(r);
}

// ---------- Rendering ----------

// Letter plus how many cards the API change has, e.g. "A×3".
function pairBadge(c) {
  if (c.pairId === null) return '';
  const g = G.pairs.get(c.pairId);
  return `<span class="pair">${g.letter}×${g.size}</span>`;
}

function dueTag(c) {
  return c.dueLeft !== null ? `<span class="tag${c.type === 'sec' ? ' sec' : ''}">⏰ ${Math.ceil(c.dueLeft)}s</span>` : '';
}

function cardInner(c) {
  const T = TYPES[c.type];
  const m = MODULES[c.module];
  const pair = pairBadge(c);
  const title = c.type === 'api' ? `${c.title} ${c.role}` : c.title;
  const dbv = c.dbv !== null ? `<span class="dbv">V${c.dbv}</span>` : '';
  return `<div class="c-top"><span class="ic">${T.icon}</span><span class="mod">${m.name}</span>${dbv}${c.unplanned ? '<span>⚠️</span>' : ''}${pair}</div>
    <div class="c-title">${title}</div>${dueTag(c)}`;
}

function createCardEl(c) {
  const el = document.createElement('div');
  el.className = `card type-${c.type}`;
  el.dataset.card = c.id;
  el.style.setProperty('--mod', MODULES[c.module].color);
  inboxEl.appendChild(el);
  c.el = el;
  c.danger = false;
  refreshCard(c);
  positionCard(c);
}

function refreshCard(c) {
  if (c.where === 'inbox' && c.el) {
    c.el.innerHTML = cardInner(c);
    c.dueEl = c.el.querySelector('.tag');
    c.dueText = null;
  } else if (c.where === 'release') {
    renderLane(releaseById(c.releaseId));
  }
}

function removeCardEl(c) {
  if (c.el) c.el.remove();
  c.el = null;
}

function positionCard(c) {
  const y = TOP + c.progress * (L.inboxH - CARD_H - TOP - 6);
  const x = L.pad + c.col * (L.cw + L.pad);
  c.el.style.transform = `translate(${x}px, ${y}px)`;
  const danger = c.progress > 0.72;
  if (danger !== c.danger) {
    c.danger = danger;
    c.el.classList.toggle('danger', danger);
    if (danger && G.running) sfx.danger();
  }
  if (c.dueEl && c.dueLeft !== null) {
    const t = `⏰ ${Math.ceil(c.dueLeft)}s`;
    if (t !== c.dueText) { c.dueText = t; c.dueEl.textContent = t; }
  }
}

function slotHTML(c) {
  const T = TYPES[c.type];
  const pair = pairBadge(c);
  const title = c.type === 'api' ? c.role : c.title;
  const big = T.size > 1;
  const cls = `slot${big ? ' big' : ''}${c.unplanned ? ' unplanned' : ''}${G.selected === c.id ? ' selected' : ''}`;
  return `<div class="${cls}" data-card="${c.id}" style="--mod:${MODULES[c.module].color}">
    <span>${c.unplanned ? '⚠️' : T.icon}${c.dbv !== null ? ` <b class="dbv">V${c.dbv}</b>` : ''}${big ? ' ' + MODULES[c.module].name : ''}</span><span class="st">${title}</span>${pair}${c.dueLeft !== null ? `<span class="due${c.type === 'sec' ? ' sec' : ''}" data-due="${c.id}"></span>` : ''}</div>`;
}

const SLOTS_H = 4 * 32 + 3 * 3; // height of the slot column at normal size

function renderLane(r) {
  if (!r) return;
  const el = laneEls[r.lane];
  el.classList.toggle('deploying', r.state === 'deploying');
  const used = usedSlots(r);
  let slots = '';
  for (const id of r.cards) slots += slotHTML(G.cards.get(id));
  for (let i = used; i < CAPACITY; i++) slots += '<div class="slot empty"></div>';
  // An overfull release squeezes its slots so the lane keeps its height.
  const sh = used > CAPACITY ? `style="--sh:${((SLOTS_H - 3 * (used - 1)) / used).toFixed(1)}px"` : '';
  const conf = r.state === 'open'
    ? r.conflicts.map((k, i) => (k.progress < CONFLICT_TAPS
      ? `<button class="conflict${k.spont ? ' spont' : ''}" data-conflict="${r.lane}:${i}">${k.spont ? '🔀' : '⚔️'} ${conflictName(k.module)} ${k.progress}/${CONFLICT_TAPS}</button>` : '')).join('')
    : '';
  el.innerHTML = `
    <div class="rel-head"><span>v${r.version}</span><span class="rel-time"></span></div>
    <div class="rel-label" data-label></div>
    <div class="slots" ${sh}>${slots}<div class="conflicts">${conf}</div>${r.state === 'deploying' ? `<div class="deploy" style="--dt:${DEPLOY_TIME}s">🚀 Deployar…<i></i></div>` : ''}</div>
    <button class="ship" data-ship="${r.lane}">🚀 Släpp</button>`;
  el._time = el.querySelector('.rel-time');
  el._ship = el.querySelector('.ship');
  el._dues = [...el.querySelectorAll('[data-due]')].map((p) => [p, G.cards.get(+p.dataset.due)]);
  el._timeText = null;
  el._label = el.querySelector('[data-label]');
  el._labelText = null;
  el._used = used;
  applyDropClasses();
}

function applyDropClasses() {
  const c = G.selected ? G.cards.get(G.selected) : null;
  for (const r of G.releases) {
    if (!r) continue;
    const el = laneEls[r.lane];
    const res = c ? canPlace(c, r) : null;
    el.classList.toggle('can-drop', !!(res && res.ok));
    el.classList.toggle('no-drop', !!(res && !res.ok && !res.same));
  }
}

function select(id) {
  const prev = G.selected;
  G.selected = id;
  for (const cid of [prev, id]) {
    const c = cid && G.cards.get(cid);
    if (!c) continue;
    if (c.where === 'inbox' && c.el) c.el.classList.toggle('selected', G.selected === cid);
    else if (c.where === 'release') renderLane(releaseById(c.releaseId));
  }
  applyDropClasses();
}

function render() {
  G.danger = false;
  G.urgent = [...G.cards.values()].some((c) => c.dueLeft !== null && c.dueLeft < 8);
  for (const c of G.cards.values()) {
    if (c.where !== 'inbox' || !c.el) continue;
    positionCard(c);
    if (c.danger) G.danger = true;
  }
  for (const r of G.releases) {
    if (!r) continue;
    const el = laneEls[r.lane];
    const due = r.state === 'open' ? minDue(r) : null;
    const txt = due !== null ? `⏰ ${Math.ceil(due)}s` : '';
    if (txt !== el._timeText) {
      el._timeText = txt;
      el._time.textContent = txt;
      el._time.classList.toggle('urgent', due !== null && due < 8);
    }
    const block = r.state === 'open' ? blockingMigrations(r) : [];
    const partial = r.state === 'open' ? incompleteApi(r) : [];
    const label = block.length ? `⛔ V${block[0].dbv} saknas`
      : partial.length ? `⛔ API ${partial[0].letter}: ${partial[0].missing} kort saknas`
      : el._used > CAPACITY ? `📦 Överfull ${el._used}/${CAPACITY}` : '';
    if (label !== el._labelText) { el._labelText = label; el._label.textContent = label; }
    const queueable = canQueue(r);
    const waiting = r.state === 'open' && r.lane > 0 && !queueable;
    const busy = r.state === 'open' && !waiting && !queueable && pipelineBusy();
    const dis = !!G.pi || r.state !== 'open' || waiting || busy || !r.cards.length || unresolved(r).length > 0;
    if (!queueable && r.queued && r.lane !== 0) r.queued = false;
    el._ship.classList.toggle('queued', !!r.queued);
    el._ship.classList.toggle('danger', !dis && (block.length > 0 || partial.length > 0));
    if (el._ship.disabled !== dis) el._ship.disabled = dis;
    const shipText = queueable ? (r.queued ? '⏳ I kö' : '⏭ Släpp sen')
      : waiting ? `Efter v${G.releases[r.lane - 1].version}` : busy ? '⏳ Pipeline' : '🚀 Släpp';
    if (el._ship.textContent !== shipText) el._ship.textContent = shipText;
    for (const [p, c] of el._dues) p.textContent = c && c.dueLeft !== null ? Math.ceil(c.dueLeft) + 's' : '';
  }
  // Cards waiting above a full radar (mostly out of sight) are counted in the radar's label.
  const hidden = [...G.cards.values()].filter((c) => c.where === 'inbox' && c.progress < -cardGap() / 2).length;
  const label = hidden ? `Inkommande ändringar · ${fmt(hidden)} till på väg in` : 'Inkommande ändringar';
  if (inboxLabel.textContent !== label) { inboxLabel.textContent = label; inboxLabel.classList.toggle('queued', hidden > 0); }
  $('#score').textContent = fmt(G.score);
  $('#sprint').textContent = G.pi ? 'PI planning' : `Sprint ${G.sprint}`;
  const dbEl = $('#dbprod');
  dbEl.classList.toggle('hidden', !G.dbShown);
  const dbText = `🗄️ V${G.dbProd} i prod`;
  if (dbEl.textContent !== dbText) dbEl.textContent = dbText;
}

function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = msg;
  toastsEl.appendChild(el);
  while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
  setTimeout(() => el.remove(), 2400);
}

function banner(title, sub) {
  bannerEl.innerHTML = `${title}<small>${sub}</small>`;
  bannerEl.classList.remove('show');
  void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
}

// ---------- Loop ----------

function update(dt) {
  G.t += dt;
  const sp = Math.floor(G.t / SPRINT_LEN) + 1;
  if (sp > G.sprint) {
    G.sprint = sp;
    if ((sp - 1) % PI_EVERY === 0) { startPI(); return; }
    banner(`Sprint ${sp}`, 'Tempot ökar');
    sfx.sprint();
  }

  G.spawnIn -= dt;
  if (G.spawnIn <= 0) { spawnRandom(); G.spawnIn = spawnInterval() * rand(0.7, 1.3); }

  for (const s of [...G.scheduled]) {
    s.at -= dt;
    if (s.at <= 0) { G.scheduled.splice(G.scheduled.indexOf(s), 1); s.fn(); }
  }

  if (unlocked('spont')) {
    G.conflictIn -= dt;
    if (G.conflictIn <= 0) {
      if (ready('spont')) { G.conflictIn = rand(14, 26); spontaneousConflict(); } else G.conflictIn = 2;
    }
  }

  // Cards fall in their columns and queue: a faster card stops behind a slower one instead of sliding over it.
  const gap = cardGap();
  const cols = Array.from({ length: LANES }, () => []);
  for (const c of G.cards.values()) if (c.where === 'inbox') cols[c.col].push(c);
  for (const col of cols) {
    col.sort((a, b) => b.progress - a.progress);
    let limit = Infinity;
    for (const c of col) {
      c.progress = Math.max(c.progress, Math.min(c.progress + dt / c.fallTime, limit));
      limit = c.progress - gap;
    }
  }

  for (const c of [...G.cards.values()]) {
    if (c.where === 'inbox' && c.progress >= 1) slip(c);
    // Deadlines tick wherever the change is, except once it's on its way out.
    if (c.dueLeft !== null && !(c.where === 'release' && releaseById(c.releaseId)?.state === 'deploying')) {
      c.dueLeft -= dt;
      if (c.dueLeft <= 0) { missDeadline(c); return; }
    }
  }

  for (const r of [...G.releases]) {
    if (r.state === 'open') {
      // Ticks for the last seconds of a deadline inside the release.
      const d = minDue(r);
      const sec = d === null ? null : Math.ceil(d);
      if (sec !== r.lastDueSec && sec !== null && sec <= 5) sfx.tick(sec <= 3);
      r.lastDueSec = sec;
      if (r.lane === 0 && usedSlots(r) >= FORCE_SLOTS && !pipelineBusy()) {
        toast(`😤 Chefen tröttnade och deployade v${r.version} själv`, 'bad');
        startDeploy(r);
      }
    } else if (r.state === 'deploying') {
      r.deployLeft -= dt;
      if (r.deployLeft <= 0) { finishDeploy(r); if (!G.running) return; }
    }
  }

}

// ---------- PI planning ----------
// Everything else stands still: no spawns, no falling, no deadlines. G.t doesn't move either, so the stories'
// lead time only starts counting when the sprint does. Deploys do run to the end (a queued release too),
// so the planning starts with lanes to fill.

const piEl = $('#pi');
const piCanvas = $('#pi-canvas');
const pctx = piCanvas.getContext('2d');

function startPI() {
  music.step = 0;
  music.bar = 0;
  cancelDrag();
  select(null);
  measure();
  const H = L.inboxH;
  G.pi = {
    phase: 'hunt', caught: 0, time: 0, H, level: buildLevel(H),
    av: { x: 40, y: H - 34, vy: 0, onGround: true, jumps: 0, hold: false, squash: 0 },
  };
  inboxEl.classList.add('pi-hunt');
  piCanvas.classList.remove('hidden');
  piBar();
  render();
  piDraw();
  banner('PI planning', 'Samla godisarna!');
  sfx.sprint();
  tip('pi');
}

function piBar() {
  const p = G.pi;
  const plan = !!p && p.phase === 'plan';
  // The level has its bar over the canvas; while planning, the start button sits in the top bar instead,
  // so nothing covers the cards on the radar.
  piEl.classList.toggle('hidden', !p || plan);
  document.body.classList.toggle('pi', !!p);
  $('#sprint').classList.toggle('hidden', plan); // the button takes the sprint name's place; the schema version stays
  $('#pi-go').classList.toggle('hidden', !plan);
  if (!p) return;
  $('#pi-go').textContent = `▶ Starta sprint ${G.sprint}`;
  if (!plan) piEl.innerHTML = `<span>🍬 <b>${p.caught}</b>/${PI_CANDIES}</span><span class="pi-hint">Tryck för att hoppa, två gånger för dubbelhopp</span>`;
}

// ---- The platform level: the PI program board, with desks to run on and sticky notes to jump onto ----

// Platforms are one-way: you land on them from above. A candy sits on each segment, some easy, some only
// reachable from a sticky note or with a double jump.
function piSpeedAt(f) { return PI_SPEED0 + (PI_SPEED1 - PI_SPEED0) * Math.max(0, Math.min(1, f)); }

function buildLevel(H) {
  const ground = H - 34;
  const hi = (n) => Math.max(64, ground - n); // keep things below the PI bar on short screens
  const plats = [{ x: -300, w: 300 + PI_SPEED0 * 1.8, y: ground, kind: 'floor' }];
  const candies = [];
  let x = PI_SPEED0 * 1.8;
  for (let i = 0; i < PI_CANDIES; i++) {
    const v = piSpeedAt(i / PI_CANDIES); // roughly how fast you'll be running here
    const kind = i === 0 ? 'air' : pick(['gap', 'note', 'high', 'air']);
    const emoji = pick(CANDY);
    if (kind === 'gap') {
      // A candy in the arc over a gap.
      const gap = v * rand(0.2, 0.32);
      candies.push({ x: x + gap / 2, y: hi(rand(85, 105)), emoji });
      x += gap;
      const w = v * rand(0.7, 1);
      plats.push({ x, w, y: ground, kind: 'floor' });
      x += w;
    } else if (kind === 'note' || kind === 'high') {
      // A sticky note above the desk: a low one you can jump onto, or a high one that needs a double jump.
      const w = v * rand(1.1, 1.4);
      plats.push({ x, w, y: ground, kind: 'floor' });
      const nw = rand(95, 125);
      const ny = hi(kind === 'note' ? rand(70, 90) : rand(150, 170));
      const nx = x + w * rand(0.3, 0.45);
      plats.push({ x: nx, w: nw, y: ny, kind: 'note', color: pick(NOTE_COLORS), tilt: rand(-0.05, 0.05) });
      candies.push({ x: nx + nw / 2, y: ny - 26, emoji });
      x += w;
    } else {
      // A candy floating above the desk: one jump.
      const w = v * rand(0.9, 1.1);
      plats.push({ x, w, y: ground, kind: 'floor' });
      candies.push({ x: x + w / 2, y: hi(rand(55, 90)), emoji });
      x += w;
    }
    if (kind !== 'gap' && Math.random() < 0.6) x += v * rand(0.18, 0.28); // a gap to jump
  }
  plats.push({ x, w: 900, y: ground, kind: 'floor' });
  return { plats, candies, end: x + 200, ground };
}

function piPress(down) {
  const a = G.pi.av;
  a.hold = down;
  if (!down) return;
  if (a.onGround || a.jumps < 2) {
    a.vy = -PI_JUMP * (a.onGround ? 1 : 0.92);
    a.jumps = a.onGround ? 1 : a.jumps + 1;
    a.onGround = false;
    sfx.chipJump(a.jumps > 1);
  }
}

function piPhysics(dt) {
  const p = G.pi, a = p.av, lv = p.level;
  p.time += dt;
  a.squash = Math.max(0, a.squash - dt);
  a.x += piSpeedAt(a.x / lv.end) * dt;
  const prevY = a.y;
  // Let go early and the jump ends lower.
  a.vy += PI_GRAV * dt * (a.vy < 0 && !a.hold ? 2.4 : 1);
  a.y += a.vy * dt;
  const was = a.onGround;
  a.onGround = false;
  if (a.vy >= 0) {
    for (const pl of lv.plats) {
      if (a.x + 7 > pl.x && a.x - 7 < pl.x + pl.w && prevY <= pl.y + 1 && a.y >= pl.y) {
        a.y = pl.y; a.vy = 0; a.onGround = true; a.jumps = 0;
        if (!was) a.squash = 0.12;
        break;
      }
    }
  }
  for (const k of lv.candies) {
    if (!k.got && Math.abs(k.x - a.x) < 22 && Math.abs(k.y - (a.y - 18)) < 28) {
      k.got = true;
      k.pop = 0.35;
      p.caught++;
      sfx.chipCandy(p.caught);
      piBar();
    }
    if (k.pop > 0) k.pop -= dt;
  }
  // Fell into a gap: the level is over, and you keep the candies you have.
  if (a.y > p.H + 40) { p.fell = true; sfx.chipFall(); endHunt(); return; }
  if (a.x >= lv.end) endHunt();
}

function piDraw() {
  const p = G.pi, lv = p.level, a = p.av;
  const W = L.inboxW, H = p.H, dpr = window.devicePixelRatio || 1;
  if (piCanvas.width !== Math.round(W * dpr) || piCanvas.height !== Math.round(H * dpr)) {
    piCanvas.width = Math.round(W * dpr);
    piCanvas.height = Math.round(H * dpr);
  }
  const g = pctx;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0d1530');
  sky.addColorStop(1, '#1b2850');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const cam = a.x - W * 0.22;
  // The program board in the background: faint columns, scrolling slower.
  g.strokeStyle = 'rgba(148, 163, 184, .08)';
  g.lineWidth = 1;
  for (let i = Math.floor(cam * 0.4 / 90); i < (cam * 0.4 + W) / 90 + 1; i++) {
    const x = i * 90 - cam * 0.4;
    g.beginPath(); g.moveTo(x, 40); g.lineTo(x, H); g.stroke();
  }
  for (const pl of lv.plats) {
    const x = pl.x - cam;
    if (x > W || x + pl.w < 0) continue;
    if (pl.kind === 'floor') {
      g.fillStyle = '#26345c';
      g.fillRect(x, pl.y, pl.w, H - pl.y);
      g.fillStyle = '#60a5fa';
      g.fillRect(x, pl.y, pl.w, 4);
    } else {
      g.save();
      g.translate(x + pl.w / 2, pl.y + 9);
      g.rotate(pl.tilt);
      g.fillStyle = 'rgba(0, 0, 0, .35)';
      g.fillRect(-pl.w / 2 + 3, -6, pl.w, 18);
      g.fillStyle = pl.color;
      g.fillRect(-pl.w / 2, -9, pl.w, 18);
      g.fillStyle = 'rgba(0, 0, 0, .12)';
      g.fillRect(-pl.w / 2, -9, pl.w, 4);
      g.restore();
    }
  }
  // The finish: a flag with the next sprint on it.
  const fx = lv.end - cam;
  if (fx < W + 40) {
    g.fillStyle = '#cbd5e1';
    g.fillRect(fx, lv.ground - 110, 3, 110);
    g.fillStyle = '#34d399';
    g.beginPath(); g.moveTo(fx + 3, lv.ground - 110); g.lineTo(fx + 46, lv.ground - 98); g.lineTo(fx + 3, lv.ground - 86); g.fill();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const k of lv.candies) {
    const x = k.x - cam;
    if (x < -30 || x > W + 30) continue;
    if (k.got) {
      if (k.pop > 0) {
        g.globalAlpha = k.pop / 0.35;
        g.font = 'bold 14px system-ui, sans-serif';
        g.fillStyle = '#fbbf24';
        g.fillText('✨', x, k.y - 30 * (1 - k.pop / 0.35));
        g.globalAlpha = 1;
      }
      continue;
    }
    g.font = '24px system-ui, sans-serif';
    g.fillText(k.emoji, x, k.y + Math.sin(p.time * 4 + k.x) * 3);
  }
  drawAvatar(g, a.x - cam, a.y, a, p.time);
}

// A round little developer in a hoodie and headphones. No gender cues on purpose.
function drawAvatar(g, x, y, a, t) {
  const sq = a.squash > 0 ? 1 - a.squash * 1.6 : 1;
  g.save();
  g.translate(x, y);
  g.scale(2 - sq, sq);
  // Legs: running on the ground, tucked in the air.
  g.fillStyle = '#1e293b';
  if (a.onGround) {
    const s = Math.sin(t * 22) * 4;
    g.fillRect(-6 + s, -7, 5, 7);
    g.fillRect(1 - s, -7, 5, 7);
  } else {
    g.fillRect(-6, -9, 5, 5);
    g.fillRect(2, -8, 5, 5);
  }
  // Hoodie body.
  g.fillStyle = '#7c6cf0';
  g.beginPath(); g.roundRect(-10, -24, 20, 18, 7); g.fill();
  // Head: the hood with a round face.
  g.beginPath(); g.arc(0, -31, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2c9a0';
  g.beginPath(); g.arc(2, -30, 7.5, 0, Math.PI * 2); g.fill();
  // Eyes, looking ahead.
  g.fillStyle = '#0f172a';
  g.beginPath(); g.arc(1.5, -31, 1.4, 0, Math.PI * 2); g.arc(6, -31, 1.4, 0, Math.PI * 2); g.fill();
  // Headphones.
  g.strokeStyle = '#0f172a';
  g.lineWidth = 2.5;
  g.beginPath(); g.arc(0, -31, 12.5, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  g.fillStyle = '#fbbf24';
  g.beginPath(); g.roundRect(-14, -35, 5, 9, 2); g.fill();
  g.restore();
}

function piUpdate(dt) {
  for (const r of [...G.releases]) {
    if (r.state !== 'deploying') continue;
    r.deployLeft -= dt;
    if (r.deployLeft <= 0) { finishDeploy(r); if (!G.running) return; }
  }
  const p = G.pi;
  if (p.phase !== 'hunt') return;
  piPhysics(dt);
  if (G.pi && G.pi.phase === 'hunt') piDraw();
}

// The level is over: every candy collected becomes a story, laid out at the top of the radar (where there's room).
function endHunt() {
  const p = G.pi;
  p.phase = 'plan';
  inboxEl.classList.remove('pi-hunt');
  piCanvas.classList.add('hidden');
  // Everything on its way (a held-back migration, the rest of an API change) lands now, so the plan can include it.
  const firstNew = G.nextId;
  for (const s of G.scheduled.splice(0)) s.fn();
  for (const c of G.cards.values()) if (c.id >= firstNew && c.where === 'inbox') placeFree(c);
  for (let i = 0; i < p.caught; i++) placeFree(spawnCard('story', { quiet: true }));
  if (p.fell) toast('🕳️ Ramlade ner i ett hål! Banan är slut.', 'warn');
  if (p.caught) { toast(`✨ ${p.caught} ${p.caught === 1 ? 'ny ändring' : 'nya ändringar'}. Planera i lugn och ro.`, 'good'); if (!p.fell) sfx.resolved(); }
  else toast('Inga godisar, inga nya ändringar. Planera det du har.', '');
  sfx.sprint();
  piBar();
}

function placeFree(c) {
  const span = L.inboxH - CARD_H - TOP - 6;
  const gap = (CARD_H + 10) / span; // one card's height plus margin, in progress units
  for (let p = 0; p <= 0.75; p += gap / 2) {
    for (const col of [0, 1, 2]) {
      const clash = [...G.cards.values()].some((o) => o !== c && o.where === 'inbox' && o.col === col && Math.abs(o.progress - p) < gap);
      if (!clash) { c.col = col; c.progress = p; positionCard(c); return; }
    }
  }
}

function endPI() {
  G.pi = null;
  piBar();
  banner(`Sprint ${G.sprint}`, 'Planen är satt. Kör!');
  sfx.sprint();
  last = performance.now();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G && G.running && !G.paused) {
    if (G.pi) piUpdate(dt); else update(dt);
    musicTick();
    if (G.running) render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Input: tap to select, tap a release to place, or drag ----------

let drag = null; // { id, x0, y0, offX, offY, src, ghost, moving }

function laneAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const rel = el && el.closest('[data-release]');
  return rel ? G.releases[+rel.dataset.release] : null;
}

function cancelDrag() {
  if (!drag) return;
  if (drag.ghost) drag.ghost.remove();
  if (drag.src) drag.src.classList.remove('lifted');
  for (const el of laneEls) el.classList.remove('hover');
  drag = null;
}

document.addEventListener('pointerdown', (e) => {
  if (!G || !G.running || G.paused) return;
  if (G.pi) {
    if (G.pi.phase === 'hunt') {
      // Anywhere on the screen jumps, except the buttons in the top bar.
      if (!e.target.closest('button')) { e.preventDefault(); piPress(true); }
      return;
    }
    if (e.target.closest('[data-pigo]')) { endPI(); return; }
  }
  const conf = e.target.closest('[data-conflict]');
  if (conf) { const [l, i] = conf.dataset.conflict.split(':').map(Number); tapConflict(l, i); return; }
  const ship = e.target.closest('[data-ship]');
  if (ship) { shipEarly(+ship.dataset.ship); return; }
  const cardEl = e.target.closest('[data-card]');
  if (cardEl) {
    const c = G.cards.get(+cardEl.dataset.card);
    if (!c) return;
    if (c.where === 'release' && releaseById(c.releaseId)?.state !== 'open') return;
    if (isLocked(c)) {
      // Taps on a merged card count as taps on its release (to place a selected card there).
      if (G.selected && G.selected !== c.id) tryPlace(G.selected, releaseById(c.releaseId));
      else { sfx.deny(); toast('🔗 Ihopmergad – går inte att sära på', 'bad'); }
      return;
    }
    const rect = cardEl.getBoundingClientRect();
    drag = { id: c.id, x0: e.clientX, y0: e.clientY, offX: e.clientX - rect.left, offY: e.clientY - rect.top, w: rect.width, h: rect.height, src: cardEl, ghost: null, moving: false };
    return;
  }
  const rel = e.target.closest('[data-release]');
  if (rel) { if (G.selected) tryPlace(G.selected, G.releases[+rel.dataset.release]); return; }
  if (e.target.closest('#inbox')) select(null);
});

document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.moving) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
    drag.moving = true;
    const g = drag.src.cloneNode(true);
    g.classList.add('ghost');
    g.classList.remove('selected', 'lifted', 'danger');
    g.style.width = drag.w + 'px';
    g.style.height = drag.h + 'px';
    document.body.appendChild(g);
    drag.ghost = g;
    drag.src.classList.add('lifted');
    sfx.pickup();
    if (G.selected !== drag.id) select(drag.id);
  }
  drag.ghost.style.left = '0px';
  drag.ghost.style.top = '0px';
  drag.ghost.style.transform = `translate(${e.clientX - drag.offX}px, ${e.clientY - drag.offY}px) scale(1.06) rotate(-2deg)`;
  const r = laneAt(e.clientX, e.clientY);
  laneEls.forEach((el, i) => el.classList.toggle('hover', !!r && r.lane === i));
});

document.addEventListener('pointerup', (e) => {
  if (G && G.pi && G.pi.phase === 'hunt') piPress(false);
  if (!drag) return;
  const d = drag;
  if (d.moving) {
    d.ghost.style.display = 'none';
    const r = laneAt(e.clientX, e.clientY);
    cancelDrag();
    if (r && G.cards.has(d.id)) tryPlace(d.id, r);
    else select(null);
    return;
  }
  cancelDrag();
  const c = G.cards.get(d.id);
  if (!c) return;
  if (G.selected === c.id) select(null);
  else if (G.selected && c.where === 'release') tryPlace(G.selected, releaseById(c.releaseId));
  else { select(c.id); sfx.pickup(); }
});

document.addEventListener('pointercancel', cancelDrag);
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Screens ----------

function showHi() {
  const hi = +storageGet('rm-hi', '0');
  $('#hi-start').textContent = hi ? `Rekord: ${fmt(hi)} poäng` : '';
}

function start() {
  initAudio();
  if (AC && AC.state === 'suspended') AC.resume();
  inboxEl.querySelectorAll('.card').forEach((el) => el.remove());
  inboxEl.classList.remove('pi-hunt');
  piCanvas.classList.add('hidden');
  toastsEl.innerHTML = '';
  cancelDrag();
  tipQueue.length = 0;
  tipOpen = false;
  G = newGame();
  piBar();
  for (let i = 0; i < LANES; i++) newRelease(i);
  measure(); // after the lanes have content: filling them shrinks the inbox
  $('#start-screen').classList.add('hidden');
  $('#over-screen').classList.add('hidden');
  last = performance.now();
  banner('Sprint 1', 'Kör!');
}

function gameOver(title, why) {
  if (!G.running) return;
  G.running = false;
  sfx.gameOver();
  cancelDrag();
  document.body.classList.remove('hurt');
  void document.body.offsetWidth;
  document.body.classList.add('hurt');
  try { navigator.vibrate && navigator.vibrate([80, 60, 160]); } catch { /* ignore */ }
  $('#over-title').textContent = title;
  $('#over-reason').textContent = why;
  const hi = +storageGet('rm-hi', '0');
  const isHi = G.score > hi;
  if (isHi) storageSet('rm-hi', String(G.score));
  const min = Math.floor(G.t / 60), sec = Math.floor(G.t % 60);
  $('#over-text').textContent = isHi ? 'Nytt rekord! Det blir en fin incidentrapport.' : `Rekord: ${fmt(hi)} poäng. Postmortem bokad till måndag 08:00.`;
  $('#over-stats').innerHTML = `
    <div><b>${fmt(G.score)}</b>poäng</div>
    <div><b>${fmt(G.shipped)}</b>releaser i prod</div>
    <div><b>${G.leadCount ? fmt(G.leadSum / G.leadCount) + ' s' : '–'}</b>snittledtid</div>
    <div><b>${min}:${String(sec).padStart(2, '0')}</b>överlevde (sprint ${G.sprint})</div>`;
  $('#over-screen').classList.remove('hidden');
}

function setPaused(p) {
  if (!G || !G.running) return;
  G.paused = p || tipOpen;
  cancelDrag();
  $('#pause-screen').classList.toggle('hidden', !p);
  last = performance.now();
}

const SOUND_MODES = { all: ['🔊', 'Musik och ljud'], sfx: ['🔉', 'Bara ljudeffekter'], off: ['🔇', 'Ljud av'] };
if (!SOUND_MODES[soundMode]) soundMode = 'all';
function updateMuteBtn() {
  const [icon, label] = SOUND_MODES[soundMode];
  $('#mute-btn').textContent = icon;
  $('#mute-btn').setAttribute('aria-label', label);
}

// ---------- Instruction pages and info cards ----------
// The same <section class="page"> blocks serve three uses:
//   'start' — the pages marked data-start, before the first game;
//   'help'  — from the pause screen: the start pages plus every info card already seen;
//   'tip'   — a single card, shown (and the game paused) the first time its mechanic comes up.

const allPages = [...document.querySelectorAll('#start-screen .page')];
const dotsEl = $('#dots');
let pages = [];
let page = 0;
let introMode = 'start';
let tipOpen = false;
const tipQueue = [];

document.querySelectorAll('[data-mod]').forEach((el) => el.style.setProperty('--mod', MODULES[el.dataset.mod].color));

function usePages(list) {
  pages = list;
  allPages.forEach((p) => p.classList.remove('active'));
  dotsEl.innerHTML = pages.length > 1 ? pages.map(() => '<i></i>').join('') : '';
}

function showPage(i) {
  page = Math.max(0, Math.min(pages.length - 1, i));
  const last = page === pages.length - 1;
  pages.forEach((p, j) => p.classList.toggle('active', j === page));
  [...dotsEl.children].forEach((d, j) => d.classList.toggle('on', j === page));
  $('#prev-btn').style.display = introMode === 'tip' ? 'none' : '';
  $('#prev-btn').style.visibility = page ? 'visible' : 'hidden';
  $('#next-btn').textContent = !last ? 'Nästa ›'
    : introMode === 'tip' ? 'Uppfattat!' : introMode === 'help' ? 'Tillbaka till spelet' : 'Starta sprinten';
  $('#skip-btn').style.display = introMode === 'start' && !last ? '' : 'none';
  $('#hi-start').style.display = introMode === 'start' ? '' : 'none';
  $('#intro-panel').scrollTop = 0;
}

function openIntro(mode, list) {
  introMode = mode;
  usePages(list);
  $('#start-screen').classList.toggle('tip', mode === 'tip');
  $('#start-screen').classList.remove('hidden');
  showPage(0);
}

function tip(key) {
  // Every game shows each card the first time its mechanic comes up, however many games you've played.
  if (G.seenTips.has(key) || tipQueue.includes(key)) return;
  tipQueue.push(key);
  if (!tipOpen) showNextTip();
}

function showNextTip() {
  const key = tipQueue.shift();
  G.seenTips.add(key);
  G.lastTip = G.t;
  tipOpen = true;
  G.paused = true;
  cancelDrag();
  openIntro('tip', allPages.filter((p) => p.dataset.key === key));
  sfx.deadline();
}

function finishIntro() {
  $('#start-screen').classList.add('hidden');
  if (introMode === 'tip') {
    tipOpen = false;
    if (tipQueue.length) { showNextTip(); return; }
    setPaused(false);
  } else if (introMode === 'help') {
    setPaused(false);
  } else {
    start();
    sfx.sprint();
  }
}

function openHelp() {
  $('#pause-screen').classList.add('hidden');
  openIntro('help', allPages.filter((p) => p.hasAttribute('data-start') || G.seenTips.has(p.dataset.key)));
}

$('#next-btn').addEventListener('click', () => {
  initAudio();
  if (page === pages.length - 1) finishIntro();
  else { showPage(page + 1); sfx.click(); }
});
$('#prev-btn').addEventListener('click', () => { showPage(page - 1); sfx.click(); });
$('#skip-btn').addEventListener('click', () => { initAudio(); finishIntro(); });
$('#help-btn').addEventListener('click', openHelp);

// Swipe between pages.
let swipe = null;
$('#start-screen').addEventListener('pointerdown', (e) => { swipe = { x: e.clientX, y: e.clientY }; });
$('#start-screen').addEventListener('pointerup', (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { showPage(page + (dx < 0 ? 1 : -1)); sfx.click(); }
});
openIntro('start', allPages.filter((p) => p.hasAttribute('data-start')));
$('#again-btn').addEventListener('click', () => { start(); sfx.sprint(); });
$('#resume-btn').addEventListener('click', () => setPaused(false));
$('#pause-btn').addEventListener('click', () => setPaused(!(G && G.paused)));
$('#mute-btn').addEventListener('click', () => {
  soundMode = { all: 'sfx', sfx: 'off', off: 'all' }[soundMode];
  storageSet('rm-sound', soundMode);
  initAudio();
  updateMuteBtn();
  toast(SOUND_MODES[soundMode][1], '');
  sfx.click();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

updateMuteBtn();
showHi();
measure();
