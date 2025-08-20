import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(__dirname)); // serves index.html if you add one

// ---------- tiny seeded RNG ----------
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...String(s)].reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// ---------- base moods (kept) ----------
const MOODS = [
  { key: "GIGA", emoji: "🧠", text: "galaxy-brain" },
  { key: "FIRE", emoji: "🔥", text: "on fire" },
  { key: "CLOWN", emoji: "🤡", text: "clown mode" },
  { key: "COZY", emoji: "🧸", text: "cozy gremlin" },
  { key: "ANGRY", emoji: "😤", text: "malding slightly" },
  { key: "CHAD", emoji: "😎", text: "effortlessly cool" },
  { key: "SLEEP", emoji: "🥱", text: "sleepy noodle" },
  { key: "RAINBOW", emoji: "🌈", text: "wholesomely chaotic" },
  { key: "CRY", emoji: "😭", text: "dramatic arc incoming" }
];

const REASONS = [
  "mercury did a little trolling in your house of Wi‑Fi",
  "the coffee to water ratio displeased the spirits",
  "your GPU rolled a nat 1 on vibes",
  "a background process (you) leaked motivation",
  "retrograde + Arch updates = destiny",
  "your socks aren’t matching the sigma frequency",
  "the moon said ‘skill issue’ and left"
];

// ---------- meme pool (extend with your links) ----------
const MEMES = [
  { name: "Distracted Boyfriend", url: "https://i.imgflip.com/1ur9b0.jpg" },
  { name: "This Is Fine", url: "https://i.imgflip.com/wxica.jpg" },
  { name: "Doge", url: "https://i.imgflip.com/4t0m5.jpg" },
  { name: "Galaxy Brain", url: "https://i.imgflip.com/1b6v.jpg" },
  { name: "NPC Wojak", url: "https://i.imgflip.com/5k2n9d.jpg" },
  { name: "Surprised Pikachu", url: "https://i.imgflip.com/2kbn1e.jpg" },
  { name: "Drake Hotline Bling", url: "https://i.imgflip.com/30b1gx.jpg" },
  { name: "Gru Plan", url: "https://i.imgflip.com/26jxvz.jpg" }
];

// ---------- absurd fortune parts ----------
const ENTITIES = [
  "an emotionally unavailable pigeon",
  "a very small car (toy‑size, huge consequences)",
  "cosmic microwave background radiation",
  "a bureaucratic goblin from Tech Support",
  "yesterday’s version of you",
  "a rubber duck with MBA",
  "your future manager’s coffee cup",
  "Schrödinger’s deadline",
  "a USB‑C cable that doesn’t fit"
];

const ACTIONS = [
  "falls toward your head",
  "slides into your DMs",
  "judges your tabs (37 open)",
  "queues a side quest",
  "crits you for psychic damage",
  "blesses your keyboard",
  "opens a ticket about you",
  "starts an infinite loop",
  "switches your default shell"
];

const OUTCOMES = [
  "you forget the bad stuff by lunchtime",
  "you gain +2 to charisma when ordering food",
  "your code compiles purely out of respect",
  "someone finally laughs at your commit messages",
  "you become temporarily immune to cringe",
  "your Wi‑Fi negotiates peace with reality",
  "all bugs rebrand as features for 24 hours",
  "you can nap without consequences (one time)"
];

const TWISTS = [
  "but only if you hydrate first",
  "unless you say ‘just one more quick fix’",
  "provided you don’t open TikTok before noon",
  "as long as you ignore that one email",
  "unless Mercury notices you noticing Mercury",
  "if the elevator music is jazz",
  "until a wild meeting appears"
];

const THREATS = ["low", "moderate", "elevated", "spicy", "absurd"];

// ---------- core logic ----------
function buildRng({ name = "anon", mode = "daily", seedExtra = "" }) {
  const today = new Date().toISOString().slice(0, 10);
  let seed;
  if (mode === "random") seed = Math.floor(Math.random() * 1e9);
  else seed = hash(name + "|" + today + "|" + seedExtra);
  return { rng: mulberry32(seed >>> 0), today };
}

function predict({ name = "anonymous", mode = "daily", inputs = {} }) {
  const { rng, today } = buildRng({ name, mode, seedExtra: JSON.stringify(inputs) });

  // base mood
  let choice = pick(MOODS, rng);
  let confidence = Math.floor(rng() * 101);

  // light biases for fun
  const { sleep, coffee, wifi } = inputs;
  if (sleep !== undefined) {
    const s = Number(sleep);
    if (!Number.isNaN(s)) {
      if (s <= 3) choice = { key: "ANGRY", emoji: "😤", text: "malding slightly" }, confidence = Math.max(confidence, 65);
      else if (s >= 8) choice = { key: "CHAD", emoji: "😎", text: "effortlessly cool" }, confidence = Math.max(confidence, 70);
    }
  }
  if (coffee !== undefined) {
    const c = Number(coffee);
    if (!Number.isNaN(c)) {
      if (c >= 3) choice = { key: "FIRE", emoji: "🔥", text: "on fire" };
      if (c === 0) confidence = Math.min(confidence, 55);
    }
  }
  if (wifi && String(wifi).toLowerCase().includes("bad")) {
    choice = { key: "CLOWN", emoji: "🤡", text: "clown mode" };
  }

  const reason = pick(REASONS, rng);
  return {
    name, date: today,
    mood: choice.text, emoji: choice.emoji,
    confidence, reason
  };
}

function fortune({ name = "anonymous", mode = "daily" }) {
  const { rng, today } = buildRng({ name, mode });

  const entity = pick(ENTITIES, rng);
  const action = pick(ACTIONS, rng);
  const outcome = pick(OUTCOMES, rng);
  const twist = pick(TWISTS, rng);
  const threatLevel = pick(THREATS, rng);
  const luck = Math.floor(rng() * 101);

  const sentence =
    `${entity} ${action}; as a result, ${outcome} — ${twist}.`;

  return {
    name, date: today,
    threatLevel, luck,
    omen: sentence,
    plotTwist: twist,
    disclaimer: "nonsense generator; don’t take actions based on this 🙂"
  };
}

function randomMeme({ name = "anonymous", mode = "daily" }) {
  const { rng, today } = buildRng({ name, mode, seedExtra: "meme" });
  const m = pick(MEMES, rng);
  return { date: today, ...m };
}
// ---------- routes ----------
app.get("/", (_req, res) => {
  res.type("text").send("Mood Predictor API. Try /predict, /fortune, /meme");
});

app.get("/predict", (req, res) => {
  const { name, mode = "daily", ...rest } = req.query;
  res.json(predict({ name, mode, inputs: rest }));
});

app.post("/predict", (req, res) => {
  const { name, mode = "daily", inputs = {} } = req.body || {};
  res.json(predict({ name, mode, inputs }));
});

app.get("/fortune", (req, res) => {
  const { name, mode = "daily" } = req.query;
  res.json(fortune({ name, mode }));
});

app.get("/meme", (req, res) => {
  const { name, mode = "daily" } = req.query;
  res.json(randomMeme({ name, mode }));
});

// optional fun: combined endpoint
app.get("/daily", (req, res) => {
  const { name, mode = "daily" } = req.query;
  res.json({
    predict: predict({ name, mode }),
    fortune: fortune({ name, mode }),
    meme: randomMeme({ name, mode })
  });
});

// --- DnD dice roller ---
// example: /roll?expr=2d6+3
// adv: /roll?expr=d20&adv=1
// dis: /roll?expr=d20&dis=1

function rollOnce(sides) {
  return crypto.randomInt(1, sides + 1);
}
function parseExpr(expr) {
  // like 2d6+3 or d20-1
  const m = String(expr).trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  return {
    count: m[1] ? parseInt(m[1], 10) : 1,
    sides: parseInt(m[2], 10),
    mod: m[3] ? parseInt(m[3], 10) : 0
  };
}

app.get("/roll", (req, res) => {
  const { expr = "d20", adv, dis } = req.query;
  const p = parseExpr(expr);
  if (!p) return res.status(400).json({ error: "bad expr (try 2d6+3)" });
  const { count, sides, mod } = p;

  const useAdv = String(adv) === "1";
  const useDis = String(dis) === "1";

  // advantage/disadv only for single d20
  if (count === 1 && sides === 20 && (useAdv || useDis)) {
    const a = rollOnce(20), b = rollOnce(20);
    const kept = useAdv ? Math.max(a, b) : Math.min(a, b);
    return res.json({
      expr, rolls: [a, b], kept, mod,
      total: kept + mod,
      crit: kept === 20, fumble: kept === 1,
      mode: useAdv ? "advantage" : "disadvantage"
    });
  }

  // normal
  const rolls = Array.from({ length: count }, () => rollOnce(sides));
  const total = rolls.reduce((s, r) => s + r, 0) + mod;
  res.json({
    expr, rolls, mod, total,
    crits: sides === 20 ? rolls.filter(r => r === 20).length : 0,
    fumbles: sides === 20 ? rolls.filter(r => r === 1).length : 0
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mood Predictor listening on http://localhost:${PORT}`));

