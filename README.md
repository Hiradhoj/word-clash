# Word Clash Online — Minimal Dark Edition

A local-hosted, real-time multiplayer word guessing game for 2–4 players. Players each use a browser and race for 60 seconds; both players may independently score the same word.

## Files

- `server.js` — authoritative room management, word checking, scores and countdown
- `public/index.html` — multiplayer interface
- `public/style.css` — Minimal Dark design
- `public/script.js` — live Socket.IO browser client
- `package.json` — Node dependencies
- `words_alpha.txt` — **copy in yourself** from your existing `word-clash-new` folder or download the open-source word list (see below); intentionally not included in this ZIP

## Installation on Mac

1. Ensure Node.js 20 or newer and npm are installed: `node -v && npm -v`.
2. Unzip into `~/Desktop/word-clash-online`.
3. In Terminal:
   ```sh
   cd ~/Desktop/word-clash-online
   cp ~/Desktop/word-clash-new/words_alpha.txt ./words_alpha.txt
   npm install
   npm start
   ```
4. Open `http://localhost:3000` in Chrome or Safari.
5. Create a room and share the room code. Open `http://localhost:3000` in another browser tab or private window to join as a second player.

If the dictionary has not already been downloaded to the old project, while in the project folder run:

```sh
curl -fL https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt -o words_alpha.txt
```

If the local dictionary file is missing, uncommon words rely on Free Dictionary API via the server and need an internet connection. Category mode uses explicitly curated starter lists rather than the whole English dictionary.

## Test on another phone or laptop (same Wi-Fi)

Find your Mac's LAN IP, commonly `ipconfig getifaddr en0` (the interface may differ).
Run `npm start`, keep the Mac awake, then on your phone visit `http://YOUR_MAC_IP:3000` on the same network. Some networks block local device-to-device connections and macOS Firewall may ask for permission to allow incoming connections.

**Internet multiplayer across different networks:** this local server cannot be reached from outside your Wi-Fi. For that you must deploy the Node.js server to a public HTTPS host; room codes do not make localhost publicly accessible.

## Game rules and limits

- 2–4 players per room, only the host can start/end a round.
- One 60-second round; server calculates scores and final result.
- First-letter mode: a single English word starting with the specified letter. Words are validated on the Node.js server against `words_alpha.txt`, then Free Dictionary API if not found.
- Category mode: only entries in the current built-in animals, food, countries lists count (these lists are **not** exhaustive).
- Each player may score a word only once in a round; **two different players can both score the same word**.
- Players who disconnect are removed from the room. Refresh/reconnect currently requires rejoining in the lobby; finished/active rounds won't allow new players. Room state and scores are held in memory and reset when the server restarts.
- This is a prototype, not yet scaled or hardened for public release. Public hosting should add authentication/reconnection, moderation/rate limits, stricter anti-abuse, persistence, and possibly curated vocabulary standards.

## Troubleshooting

- `Cannot find module 'express'`: run `npm install` in the `word-clash-online` folder.
- Port 3000 already in use: stop other server with Ctrl+C, or `PORT=3001 npm start` and visit `http://localhost:3001`.
- Dictionary file missing: run `ls -lh words_alpha.txt` in the project root; if absent copy it as above.
- Red 'Offline' in the app: check that `npm start` is still running, then reload.
- Word rejected: check the challenge letter or starter category list; the word may not occur in this word list or API.
- Word checking hangs: the API backup has a 3.5 second timeout. Check your local dictionary file and internet connection.
