"use strict";

const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomInt } = require("crypto");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT) || 3000;
const ROUND_MS = 60_000;
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;
const ROOM_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const START_LETTERS = "ABCDEFGHIJKLMNOPRSTUVW"; // Avoid X/Z for shorter rounds

const categoryLists = {
  animals: `ant anteater antelope ape baboon badger bat bear beaver bee beetle bird bison buffalo butterfly camel cat cheetah chicken chimpanzee cobra cow crab crocodile crow deer dog dolphin donkey dove dragonfly duck eagle eel elephant falcon ferret fish flamingo fox frog giraffe goat goose gorilla grasshopper hamster hawk hedgehog hippo horse hyena iguana jaguar jellyfish kangaroo koala leopard lion lizard lobster monkey moose mosquito mouse octopus orangutan otter owl panda panther parrot peacock penguin pig pigeon pony rabbit raccoon rat raven reindeer rhino scorpion seal shark sheep shrimp snail snake spider squirrel starfish swan tiger tortoise toucan turtle walrus whale wolf wombat zebra polar_bear sea_lion guinea_pig`.split(/\s+/).map(w => w.replaceAll("_", " ")),
  food: `apple apricot avocado bacon bagel banana beans beef biscuit bread broccoli brownie burger butter cabbage cake candy carrot cauliflower cereal cheese cherry chicken chocolate coconut cookie corn cucumber curry donut dumpling egg eggplant fish flour fries garlic ginger grape grapefruit guava hamburger honey jam jelly kiwi lamb lemon lentils lettuce lime mango meat melon milk mushroom mustard noodles oats olive onion orange pancake papaya pasta peach peanut pear pepper pineapple pizza plum popcorn potato pumpkin radish raspberry rice salad salmon sandwich sausage shrimp soup spinach strawberry steak sushi taco toast tofu tomato tuna turkey watermelon yogurt ice_cream sweet_potato fried_rice hot_dog`.split(/\s+/).map(w => w.replaceAll("_", " ")),
  countries: `afghanistan albania algeria argentina armenia australia austria bangladesh belgium bhutan bolivia brazil bulgaria cambodia cameroon canada chile china colombia croatia cuba cyprus denmark ecuador egypt estonia ethiopia fiji finland france georgia germany ghana greece hungary iceland india indonesia iran iraq ireland israel italy jamaica japan jordan kazakhstan kenya kuwait laos latvia lebanon libya lithuania luxembourg madagascar malaysia maldives mali malta mauritius mexico mongolia morocco myanmar namibia nepal netherlands nigeria norway oman pakistan panama paraguay peru philippines poland portugal qatar romania russia rwanda senegal serbia singapore slovakia slovenia somalia spain sudan sweden switzerland syria taiwan tajikistan tanzania thailand tunisia turkey uganda ukraine uruguay uzbekistan venezuela vietnam yemen zambia zimbabwe new_zealand south_africa south_korea north_korea united_kingdom united_states united_arab_emirates saudi_arabia sri_lanka costa_rica dominican_republic`.split(/\s+/).map(w => w.replaceAll("_", " "))
};
const categories = Object.fromEntries(Object.entries(categoryLists).map(([name, values]) => [name, new Set(values)]));

const file = path.join(__dirname, "words_alpha.txt");
let words = new Set();
try {
  const content = fs.readFileSync(file, "utf8");
  words = new Set(content.toLowerCase().split(/\r?\n/).map(w => w.trim()).filter(Boolean));
  console.log(`Loaded ${words.size.toLocaleString()} English words`);
} catch {
  console.warn("Dictionary file missing: add words_alpha.txt beside server.js. API-only fallback is slower and needs internet.");
}
const dictionaryCache = new Map();
async function isEnglishWord(word) {
  if (words.has(word)) return { valid: true };
  if (dictionaryCache.has(word)) return { valid: dictionaryCache.get(word) };
  // API only for words missing from the offline list; don't award points when it is unreachable.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word), { signal: controller.signal });
    if (response.status === 404) {
      dictionaryCache.set(word, false);
      return { valid: false };
    }
    if (!response.ok) return { valid: false, error: "Dictionary service unavailable. Try again." };
    const data = await response.json();
    const valid = Array.isArray(data) && data.some(entry => Array.isArray(entry.meanings) && entry.meanings.length);
    dictionaryCache.set(word, Boolean(valid));
    if (dictionaryCache.size > 15_000) dictionaryCache.clear();
    return { valid: Boolean(valid) };
  } catch {
    return { valid: false, error: "Dictionary connection failed. Try again." };
  } finally {
    clearTimeout(timeout);
  }
}

const app = express();
app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public")));
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();

function codeForNewRoom() {
  let code;
  do { code = Array.from({ length: 6 }, () => ROOM_LETTERS[randomInt(ROOM_LETTERS.length)]).join(""); }
  while (rooms.has(code));
  return code;
}
function cleanName(input) {
  return typeof input === "string" ? input.trim().replace(/\s+/g, " ").slice(0, 18) : "";
}
function cleanWord(input) {
  return typeof input === "string" ? input.trim().toLowerCase().replace(/\s+/g, " ") : "";
}
function publicState(room) {
  return {
    code: room.code,
    mode: room.mode,
    phase: room.phase,
    hostId: room.hostId,
    serverTime: Date.now(),
    endsAt: room.endsAt,
    challenge: room.challenge,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.used.size })),
    winnerIds: room.winnerIds,
    dictionaryReady: words.size > 0
  };
}
function sendState(room) {
  io.to(room.code).emit("room-state", publicState(room));
}
function finishRound(room) {
  if (room.phase !== "playing") return;
  clearTimeout(room.endTimer);
  room.endTimer = null;
  room.phase = "finished";
  const players = [...room.players.values()];
  const highest = Math.max(0, ...players.map(p => p.used.size));
  room.winnerIds = highest === 0 ? [] : players.filter(p => p.used.size === highest).map(p => p.id);
  sendState(room);
}
function roomOf(socket) {
  const code = socket.data.roomCode;
  const room = code && rooms.get(code);
  return room && room.players.has(socket.id) ? room : null;
}
function leaveRoom(socket) {
  const room = roomOf(socket);
  if (!room) return;
  room.players.delete(socket.id);
  socket.leave(room.code);
  socket.data.roomCode = null;
  if (!room.players.size) {
    clearTimeout(room.endTimer);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  sendState(room);
}
function ackReply(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

io.on("connection", socket => {
  socket.on("create-room", (data, ack) => {
    if (roomOf(socket)) return ackReply(ack, { ok: false, error: "Leave your current room first." });
    const name = cleanName(data?.name);
    const mode = data?.mode === "category" ? "category" : "letter";
    if (!name) return ackReply(ack, { ok: false, error: "Enter your name." });
    const code = codeForNewRoom();
    const room = { code, mode, phase: "waiting", hostId: socket.id, players: new Map(), endsAt: null, challenge: null, winnerIds: [], endTimer: null, roundSerial: 0 };
    room.players.set(socket.id, { id: socket.id, name, avatar: 0, used: new Set(), pending: false });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    ackReply(ack, { ok: true, code, playerId: socket.id });
    sendState(room);
  });

  socket.on("join-room", (data, ack) => {
    if (roomOf(socket)) return ackReply(ack, { ok: false, error: "Leave your current room first." });
    const code = typeof data?.code === "string" ? data.code.trim().toUpperCase() : "";
    const name = cleanName(data?.name);
    const room = rooms.get(code);
    if (!name) return ackReply(ack, { ok: false, error: "Enter your name." });
    if (!room) return ackReply(ack, { ok: false, error: "Room not found. Check the code." });
    if (room.phase !== "waiting") return ackReply(ack, { ok: false, error: "This round has started. Ask for the next round." });
    if (room.players.size >= MAX_PLAYERS) return ackReply(ack, { ok: false, error: "Room is full (4 players)." });
    const occupied = new Set([...room.players.values()].map(p => p.avatar));
    const avatar = [0, 1, 2, 3].find(i => !occupied.has(i));
    room.players.set(socket.id, { id: socket.id, name, avatar, used: new Set(), pending: false });
    socket.join(code);
    socket.data.roomCode = code;
    ackReply(ack, { ok: true, code, playerId: socket.id });
    sendState(room);
  });

  socket.on("start-round", (_data, ack) => {
    const room = roomOf(socket);
    if (!room) return ackReply(ack, { ok: false, error: "Join a room first." });
    if (room.hostId !== socket.id) return ackReply(ack, { ok: false, error: "Only the host can start the round." });
    if (room.phase === "playing") return ackReply(ack, { ok: false, error: "Round already started." });
    if (room.players.size < MIN_PLAYERS) return ackReply(ack, { ok: false, error: "At least 2 players are needed." });
    room.roundSerial++;
    for (const player of room.players.values()) { player.used.clear(); player.pending = false; }
    room.winnerIds = [];
    room.challenge = room.mode === "letter"
      ? { label: "WORDS STARTING WITH", value: START_LETTERS[randomInt(START_LETTERS.length)] }
      : { label: "CATEGORY CHALLENGE", value: Object.keys(categories)[randomInt(Object.keys(categories).length)].toUpperCase() };
    room.endsAt = Date.now() + ROUND_MS;
    room.phase = "playing";
    const thisRound = room.roundSerial;
    clearTimeout(room.endTimer);
    room.endTimer = setTimeout(() => {
      if (room.roundSerial === thisRound) finishRound(room);
    }, ROUND_MS);
    ackReply(ack, { ok: true });
    sendState(room);
  });

  socket.on("submit-word", async (data, ack) => {
    const room = roomOf(socket);
    if (!room || room.phase !== "playing") return ackReply(ack, { ok: false, error: "There is no active round." });
    if (Date.now() >= room.endsAt) {
      finishRound(room);
      return ackReply(ack, { ok: false, error: "Time is up!" });
    }
    const player = room.players.get(socket.id);
    if (player.pending) return ackReply(ack, { ok: false, error: "Please finish your previous word check." });
    const word = cleanWord(data?.word);
    if (!word || word.length > 40 || !/^[a-z]+(?: [a-z]+)*$/.test(word)) {
      return ackReply(ack, { ok: false, error: "Enter a word using English letters only (maximum 40 characters)." });
    }
    if (player.used.has(word)) return ackReply(ack, { ok: false, error: "You already scored this word." });
    if (room.mode === "letter") {
      if (word.includes(" ")) return ackReply(ack, { ok: false, error: "Use one word in Starting Letter mode." });
      if (!word.startsWith(room.challenge.value.toLowerCase())) {
        return ackReply(ack, { ok: false, error: `Word must start with ${room.challenge.value}.` });
      }
    }
    player.pending = true;
    const thisRound = room.roundSerial;
    let result;
    try {
      if (room.mode === "category") {
        const category = room.challenge.value.toLowerCase();
        result = { valid: categories[category].has(word) };
      } else {
        result = await isEnglishWord(word);
      }
    } finally {
      player.pending = false;
    }
    if (room.phase !== "playing" || room.roundSerial !== thisRound || Date.now() >= room.endsAt || room.players.get(socket.id) !== player) {
      return ackReply(ack, { ok: false, error: "Time is up! That answer did not score." });
    }
    if (!result.valid) return ackReply(ack, { ok: false, error: result.error || (room.mode === "category" ? "Not in this category's current word list." : "Not found in the dictionary.") });
    if (player.used.has(word)) return ackReply(ack, { ok: false, error: "You already scored this word." });
    player.used.add(word);
    ackReply(ack, { ok: true, word, score: player.used.size });
    sendState(room); // All connected players receive the updated live scores
  });

  socket.on("end-round", (_data, ack) => {
    const room = roomOf(socket);
    if (!room) return ackReply(ack, { ok: false, error: "Join a room first." });
    if (room.hostId !== socket.id) return ackReply(ack, { ok: false, error: "Only the host can end the round." });
    finishRound(room);
    ackReply(ack, { ok: true });
  });

  socket.on("leave-room", (_data, ack) => {
    leaveRoom(socket);
    ackReply(ack, { ok: true });
  });
  socket.on("disconnect", () => leaveRoom(socket));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Word Clash Online running at http://localhost:${PORT}`);
});
