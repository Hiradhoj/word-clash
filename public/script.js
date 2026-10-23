"use strict";

const $ = id => document.getElementById(id);
const socket = io();
const AVATARS = ["🦊", "🐼", "🐸", "🐯"];
const COLORS = ["#c6ff4d", "#b49aff", "#77d9f7", "#ffae76"];
let currentRoom = null;
let myId = null;
let ownWords = [];
let clockOffset = 0;
let soundOn = true;
let audioContext = null;
let checking = false;
let renderedPhase = null;

function screen(id) {
  for (const name of ["home", "lobby", "game", "results"]) $(name).hidden = name !== id;
}
function notice(message, success = false) {
  $("notice").hidden = !message;
  $("notice").classList.toggle("success", success);
  $("notice").textContent = message;
}
function beep(freq = 750, length = .12) {
  if (!soundOn) return;
  try {
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioClass) return;
    audioContext ||= new AudioClass();
    if (audioContext.state === "suspended") audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(.07, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + length);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + length);
  } catch (error) { console.warn("Audio unavailable", error); }
}
function say(message, error = false) {
  $("feedback").textContent = message;
  $("feedback").classList.toggle("error", error);
  if (error) beep(230);
}
function emitAck(event, data) {
  return new Promise(resolve => {
    socket.timeout(8000).emit(event, data, (error, response) => {
      resolve(error ? { ok: false, error: "Server did not respond. Check your connection." } : response);
    });
  });
}
function localPlayerName() {
  return $("yourName").value.trim().slice(0, 18);
}
function joinSuccess(response) {
  if (!response.ok) {
    notice(response.error || "Could not join room.");
    beep(230);
    return;
  }
  myId = response.playerId;
  ownWords = [];
  renderedPhase = null;
  window.history.replaceState({}, "", `?room=${encodeURIComponent(response.code)}`);
  notice("");
  beep();
}

$("createBtn").addEventListener("click", async () => {
  const name = localPlayerName();
  if (!name) return notice("Please enter your name first.");
  if (!socket.connected) return notice("Not connected to server yet.");
  $("createBtn").disabled = true;
  const result = await emitAck("create-room", { name, mode: $("mode").value });
  $("createBtn").disabled = false;
  joinSuccess(result);
});
$("joinBtn").addEventListener("click", async () => {
  const name = localPlayerName();
  const code = $("roomCodeInput").value.trim().toUpperCase();
  if (!name) return notice("Please enter your name first.");
  if (code.length !== 6) return notice("Enter the six-character room code.");
  if (!socket.connected) return notice("Not connected to server yet.");
  $("joinBtn").disabled = true;
  const result = await emitAck("join-room", { name, code });
  $("joinBtn").disabled = false;
  joinSuccess(result);
});
$("roomCodeInput").addEventListener("keydown", event => {
  if (event.key === "Enter") $("joinBtn").click();
});
function drawPlayers(target, room) {
  const board = $(target);
  board.replaceChildren();
  room.players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "player-card" + (player.id === myId ? " mine" : "");
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.style.background = COLORS[player.avatar];
    avatar.textContent = AVATARS[player.avatar];
    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.name;
    const meta = document.createElement("div");
    meta.className = "player-meta";
    meta.textContent = (player.id === room.hostId ? "HOST " : "") + (player.id === myId ? "(YOU)" : "");
    card.append(avatar, name, meta);
    if (target === "scoreboard") {
      const score = document.createElement("div");
      score.className = "score";
      score.textContent = player.score;
      card.appendChild(score);
    }
    board.appendChild(card);
  });
}
function results(room) {
  const max = Math.max(0, ...room.players.map(p => p.score));
  const winners = room.players.filter(p => room.winnerIds.includes(p.id));
  $("winnerTitle").textContent = !max ? "Nobody scored this round" : winners.length === 1 ? `🏆 ${winners[0].name} wins!` : "🤝 It's a tie!";
  $("winnerDetail").textContent = `Top score: ${max} point${max === 1 ? "" : "s"}`;
  const board = $("finalScores");
  board.replaceChildren();
  [...room.players].sort((a, b) => b.score - a.score).forEach(p => {
    const row = document.createElement("div");
    row.className = "result-row";
    const name = document.createElement("span");
    name.textContent = `${AVATARS[p.avatar]} ${p.name}${p.id === myId ? " (you)" : ""}`;
    const score = document.createElement("strong");
    score.textContent = `${p.score} pts`;
    row.append(name, score);
    board.appendChild(row);
  });
  $("againBtn").hidden = myId !== room.hostId;
}
function updateRoom(room) {
  if (myId && !room.players.some(p => p.id === myId)) {
    notice("You are no longer in that room. Rejoin using the code.");
    myId = null;
    currentRoom = null;
    screen("home");
    return;
  }
  // Offset makes the client timer follow the server clock.
  clockOffset = room.serverTime - Date.now();
  const isNewRound = currentRoom?.endsAt !== room.endsAt && room.phase === "playing";
  currentRoom = room;
  if (room.phase === "waiting") {
    screen("lobby");
    $("lobbyCode").textContent = room.code;
    $("lobbyMode").textContent = `Mode: ${room.mode === "letter" ? "Starting Letter" : "Category Challenge"}`;
    $("playerCountText").textContent = `${room.players.length}/4`;
    $("lobbyHelp").textContent = room.players.length < 2 ? "Invite at least one friend to start." : "Ready! Only the host can start the round.";
    drawPlayers("lobbyPlayers", room);
    $("startBtn").hidden = myId !== room.hostId;
    $("startBtn").disabled = room.players.length < 2;
  } else if (room.phase === "playing") {
    screen("game");
    $("gameRoomCode").textContent = room.code;
    $("challengeLabel").textContent = room.challenge.label;
    $("challengeValue").textContent = room.challenge.value;
    $("endBtn").hidden = myId !== room.hostId;
    if (isNewRound || renderedPhase !== "playing") {
      ownWords = [];
      $("wordHistory").replaceChildren();
      $("wordHistory").textContent = "No words yet.";
      $("wordInput").value = "";
      say("");
      beep(790);
    }
    drawPlayers("scoreboard", room);
    updateTimer();
  } else if (room.phase === "finished") {
    screen("results");
    results(room);
    if (renderedPhase !== "finished") beep(950, .3);
  }
  renderedPhase = room.phase;
}
function updateTimer() {
  if (!currentRoom || currentRoom.phase !== "playing") return;
  const ms = Math.max(0, currentRoom.endsAt - (Date.now() + clockOffset));
  const seconds = Math.ceil(ms / 1000);
  $("timer").textContent = `00:${String(seconds).padStart(2, "0")}`;
  $("timer").classList.toggle("urgent", seconds <= 10);
  $("progress").style.width = `${(ms / 60000) * 100}%`;
  // The server is authoritative: don't decide the winner in the browser.
}
setInterval(updateTimer, 100);

$("startBtn").addEventListener("click", async () => {
  const response = await emitAck("start-round", {});
  if (!response.ok) notice(response.error);
  else notice("");
});
$("wordForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (checking || currentRoom?.phase !== "playing") return;
  const word = $("wordInput").value.trim().toLowerCase();
  if (!word) return;
  checking = true;
  $("wordInput").disabled = true;
  $("submitBtn").disabled = true;
  say("Checking word…");
  const response = await emitAck("submit-word", { word });
  checking = false;
  $("wordInput").disabled = false;
  $("submitBtn").disabled = false;
  if (!response.ok) {
    say(response.error || "Word not accepted.", true);
  } else {
    ownWords.push(response.word);
    const history = $("wordHistory");
    if (ownWords.length === 1) history.replaceChildren();
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = response.word;
    history.appendChild(chip);
    say(`✓ ${response.word.toUpperCase()} — +1 point!`);
    $("wordInput").value = "";
    beep(900);
  }
  if (currentRoom?.phase === "playing") $("wordInput").focus();
});
$("endBtn").addEventListener("click", async () => {
  const result = await emitAck("end-round", {});
  if (!result.ok) notice(result.error);
});
$("againBtn").addEventListener("click", async () => {
  const result = await emitAck("start-round", {});
  if (!result.ok) notice(result.error);
});
async function leave() {
  await emitAck("leave-room", {});
  currentRoom = null;
  myId = null;
  renderedPhase = null;
  ownWords = [];
  window.history.replaceState({}, "", location.pathname);
  screen("home");
  notice("");
}
$("leaveLobbyBtn").addEventListener("click", leave);
$("leaveResultsBtn").addEventListener("click", leave);
$("soundBtn").addEventListener("click", () => {
  soundOn = !soundOn;
  $("soundBtn").textContent = soundOn ? "🔊 Sound ON" : "🔇 Sound OFF";
  if (soundOn) beep(650);
});
async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    notice(message, true);
  } catch {
    notice("Copy is unavailable. Select the room code manually.");
  }
}
$("copyCodeBtn").addEventListener("click", () => {
  if (currentRoom) copyText(currentRoom.code, "Room code copied!");
});
$("copyLinkBtn").addEventListener("click", () => {
  if (currentRoom) copyText(`${location.origin}${location.pathname}?room=${currentRoom.code}`, "Invitation link copied!");
});

socket.on("room-state", updateRoom);
socket.on("connect", () => {
  $("connection").textContent = "● Connected";
  $("connection").classList.add("online");
  if (myId && myId !== socket.id) {
    // The server removes disconnected sockets from rooms.
    currentRoom = null;
    myId = null;
    renderedPhase = null;
    screen("home");
    notice("Connection restored. Rejoin the room to continue.");
  }
});
socket.on("disconnect", () => {
  $("connection").textContent = "● Offline";
  $("connection").classList.remove("online");
  notice("Disconnected. Check your internet connection.");
});
socket.on("connect_error", () => {
  $("connection").textContent = "● Offline";
  $("connection").classList.remove("online");
  notice("Cannot reach the game server. Is npm start running?");
});

const invitedCode = new URLSearchParams(location.search).get("room");
if (invitedCode) $("roomCodeInput").value = invitedCode.toUpperCase().slice(0, 6);
screen("home");
console.log("Word Clash Online client loaded");
