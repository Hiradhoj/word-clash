<div align="center">

# ⚡ WORD CLASH

### Think fast. Type faster. Win the word battle.

**A real-time multiplayer word-guessing game for 2–4 players.**  
Compete for 60 seconds, discover valid English words, and climb the live leaderboard.

![Status](https://img.shields.io/badge/status-prototype-c6ff4d?style=flat-square&labelColor=15181d)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-real--time-ffffff?style=flat-square&logo=socketdotio&logoColor=white&labelColor=15181d)
![Players](https://img.shields.io/badge/players-2--4-a78bfa?style=flat-square&labelColor=15181d)

</div>

---

## 🎮 What is Word Clash?

Word Clash is a browser-based multiplayer word game where friends race to think of words before the clock runs out. **Create a private room, share the six-character code, and play simultaneously** on separate devices. The server controls the round timer, validates answers, and updates scores in real time.

The interface uses a **Minimal Dark** theme with neon-lime accents, playful avatars, score animations, and optional sound effects.

> **Project status:** Working local-network prototype. To play across different Wi-Fi networks, deploy the Node.js server to a publicly accessible HTTPS host. A room code is not a public link by itself.

## ✨ Features

- **2–4 players** per private room; host controls when rounds start and end.
- **60-second rounds**, with a shared server-controlled timer.
- **Real-time gameplay**: everyone submits words at the same time.
- **Two game modes**: starting-letter challenge and category challenge (animals, food, countries).
- **Dictionary validation** performed by the server using a large local English word list, with online Dictionary API fallback for missing entries.
- **Fair scoring**: +1 point for each accepted word; you cannot reuse a word yourself, but different players can score the same word.
- **Live scoreboard**, player avatars, visual feedback, and optional sound effects.
- **Responsive design** for desktop and mobile browsers.

## 🕹️ How to play

1. Open Word Clash and enter your display name.
2. **Create a room** and choose a game mode, or **join a room** using your friend's six-character code.
3. Wait for at least two players (maximum four).
4. The host presses **Start 60-second round**.
5. Type as many valid answers as you can before time expires. All players compete simultaneously.
6. The highest score wins; equal highest scores produce a tie.

**Example — Starting letter `F`:** `flower`, `fabulous`, `fantastic`.

**Example — Animals category:** `tiger`, `elephant`, `dolphin`.

## 🧰 Tech stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript | Responsive game interface |
| Backend | Node.js 20+ and Express | Hosts the game and serves the website |
| Live multiplayer | Socket.IO | Rooms, submissions, score broadcasts |
| Word validation | `words_alpha.txt` + Free Dictionary API | English word lookup and backup |
| Storage | Server memory | Temporary rooms and scores (no database yet) |

## 🚀 Run locally on macOS

### 1. Install Node.js

Install **Node.js 20 or newer** and npm. On a Mac with Homebrew:

```bash
brew install node
```

Or install the LTS release from [nodejs.org](https://nodejs.org/en/download).

Verify:

```bash
node -v
npm -v
```

If Terminal says `command not found`, complete the Node.js installation and reopen Terminal.

### 2. Open the project

Extract the project ZIP and put the `word-clash-online` folder on your Desktop. Then:

```bash
cd ~/Desktop/word-clash-online
```

### 3. Add the large English dictionary

The dictionary file **is not included** in the starter ZIP. Download it into the project root:

```bash
curl -fL https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt -o words_alpha.txt
```

Alternatively, if you already have the file from the earlier Word Clash project:

```bash
cp ~/Desktop/word-clash-new/words_alpha.txt ./words_alpha.txt
```

Verify that it exists:

```bash
ls -lh words_alpha.txt
```

The local word list contains hundreds of thousands of entries. It is broad but not a perfectly curated game dictionary; unusual or questionable entries can appear. The online backup also does not guarantee universal coverage.

### 4. Install dependencies

```bash
npm install
```

### 5. Start the multiplayer server

```bash
npm start
```

Open **http://localhost:3000** in a browser. Keep the Terminal window open while playing; stop the server with `Control + C`.

For automatic server restart while developing:

```bash
npm run dev
```

## 👥 Test multiplayer

### On one Mac

1. Open `http://localhost:3000` in Chrome or Safari.
2. Create a room and copy the six-character code.
3. Open a separate private/incognito window at the same address.
4. Enter a different player name and join with the code.
5. Start the round from the host window, then submit words in both windows.

### On two devices using the same Wi-Fi

Keep `npm start` running on your Mac. Find its local IP address (Wi-Fi often uses `en0`):

```bash
ipconfig getifaddr en0
```

From a phone on the same network, visit `http://YOUR_MAC_IP:3000`, replacing `YOUR_MAC_IP` with the address returned by Terminal. Your Mac must remain awake, and its firewall/network must allow connections to the server.

### Across different networks

`localhost` and local-network IP addresses cannot be reached by friends over the public internet. Deploy this Node.js application to a host that supports persistent Socket.IO/WebSocket connections and HTTPS. Set the host-provided `PORT` environment variable if required; the server already supports `process.env.PORT`. Do not publish the development server directly without hardening it.

## 📂 Project structure

```text
word-clash-online/
├── public/
│   ├── index.html       # Game screens and controls
│   ├── style.css        # Minimal Dark styling and animations
│   └── script.js        # Browser-side Socket.IO logic
├── server.js            # Rooms, game timer, validation and scores
├── package.json         # Dependencies and commands
├── words_alpha.txt      # Download separately; place in project root
└── README.md            # Documentation
```

## 📏 Game rules

| Rule | Behaviour |
| --- | --- |
| Players per room | 2–4 |
| Round duration | 60 seconds |
| Starting-letter mode | Submit a valid, single English word beginning with the assigned letter |
| Category mode | Submit an entry from the current built-in category list |
| Correct answer | +1 point |
| Repeat by the same player | 0 points |
| Same word by different players | Both may earn +1 |
| Winner | Player with highest score; ties are possible |

**Dictionary note:** Category mode currently uses small curated lists; it does *not* accept every animal, food, or country in existence. The main English word list does not automatically classify words into categories.

## 🔧 Troubleshooting

| Problem | What to do |
| --- | --- |
| `node: command not found` / `npm: command not found` | Install Node.js and reopen Terminal. |
| `Cannot find module 'express'` | Run `npm install` in the project folder. |
| `EADDRINUSE` / port 3000 busy | Stop the other server, or run `PORT=3001 npm start` and visit port 3001. |
| Dictionary missing | Download `words_alpha.txt` into the same folder as `server.js`. |
| A valid word is rejected | Check the letter, category, and dictionary coverage; some words may not be listed. |
| Connection shows offline | Verify that `npm start` is running; reload the page. |
| Phone cannot connect | Ensure both devices share Wi-Fi; check Mac's IP, firewall and network isolation settings. |
| Room code does not work | Confirm the code and that the server is running; rooms disappear when the server restarts. |

## 🛣️ Roadmap

- [x] Minimal Dark responsive interface
- [x] Real-time Socket.IO rooms and 2–4-player matches
- [x] 60-second server-controlled rounds
- [x] Large dictionary with API fallback
- [x] Live scoreboard, avatars, animations and sounds
- [ ] Larger, better curated category dictionaries
- [ ] Reconnection to an ongoing match
- [ ] Public deployment with HTTPS
- [ ] Player accounts, profiles and persistent leaderboards
- [ ] Anti-spam protection, moderation and stronger game security
- [ ] Tournaments, achievements and custom round settings

## ⚠️ Current limitations

This is a **prototype**: game rooms and scores are stored in memory, so restarting the server clears them. Disconnecting players may need to rejoin in a new lobby, and players cannot join an active match. Public production use requires additional measures such as authentication, rate limits, abuse prevention, reconnection support, durable storage, and scalable room state.

## 📚 Credits & references

- [Socket.IO](https://socket.io/) — multiplayer communication
- [Express](https://expressjs.com/) — web server
- [dwyl/english-words](https://github.com/dwyl/english-words) — large English word list (see repository for licensing and attribution information)
- [Free Dictionary API](https://dictionaryapi.dev/) — supplementary word lookup

---

<div align="center">

**⚡ WORD CLASH — Every word counts.**

*Made for fast thinkers and friendly competition.*

</div>
