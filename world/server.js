const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware to log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Game Constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const MAX_COINS = 10;

// Game state
let players = {}; // key: secret, value: player object
let coins = {}; // key: id, value: coin object
let speedLimit = 10;

// Helper to broadcast to all clients
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Helper to broadcast the full game state
function broadcastGameState() {
  const activePlayers = Object.values(players).filter((p) => p.connected);
  broadcast({
    type: "gameState",
    players: activePlayers.map((p) => ({
      name: p.name,
      color: p.color,
      x: p.x,
      y: p.y,
      score: p.score,
      overSpeed: p.overSpeed,
    })),
    coins: Object.values(coins),
    leaderboard: getLeaderboard(),
    speedLimit: speedLimit,
  });
}

function getLeaderboard() {
  return Object.values(players)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((p) => ({ name: p.name, score: p.score }));
}

// WebSocket connection handling
wss.on("connection", (ws) => {
  console.log("Client connected successfully!");
  ws.on("error", console.error);

  let playerSecret = null; // Will be set on 'create' message

  // Signal the client to construct its own URL
  ws.send(JSON.stringify({ type: "serverInfo" }));

  // Handle messages from clients
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case "create":
          playerSecret = data.secret || uuidv4();
          if (players[playerSecret]) {
            // Reconnection
            players[playerSecret].connected = true;
          } else {
            // New player
            players[playerSecret] = {
              name: data.name,
              color: data.color,
              secret: playerSecret,
              x: Math.random() * GAME_WIDTH,
              y: Math.random() * GAME_HEIGHT,
              score: 0,
              connected: true,
              overSpeed: false,
            };
          }
          ws.playerSecret = playerSecret; // Associate secret with this connection
          broadcast({
            type: "notification",
            message: `${players[playerSecret].name} has joined!`,
            color: "green",
          });
          break;

        case "move":
          const player = players[ws.playerSecret];
          if (player && player.connected) {
            const velocity = Math.min(data.velocity, 20); // Cap velocity
            player.overSpeed = velocity > speedLimit;

            if (!player.overSpeed) {
              player.x += Math.cos(data.angle) * velocity;
              player.y += Math.sin(data.angle) * velocity;

              // Boundary checks
              player.x = Math.max(0, Math.min(GAME_WIDTH, player.x));
              player.y = Math.max(0, Math.min(GAME_HEIGHT, player.y));
            }

            // Coin collision check
            for (const id in coins) {
              const coin = coins[id];
              const distance = Math.sqrt(
                Math.pow(player.x - coin.x, 2) + Math.pow(player.y - coin.y, 2)
              );
              if (distance < 15) {
                // 15px collision radius
                player.score++;
                delete coins[id];
                broadcast({ type: "coinCollected", coinId: id });
                broadcast({
                  type: "notification",
                  message: `${player.name} collected a coin!`,
                  color: "yellow",
                });
              }
            }
          }
          break;

        case "getPastCoins":
          ws.send(
            JSON.stringify({ type: "pastCoins", coins: Object.values(coins) })
          );
          break;
      }
    } catch (e) {
      console.error("Failed to handle message:", e);
    }
  });

  // Handle client disconnection
  ws.on("close", () => {
    if (ws.playerSecret && players[ws.playerSecret]) {
      players[ws.playerSecret].connected = false;
      console.log(`${players[ws.playerSecret].name} disconnected.`);
      broadcast({
        type: "notification",
        message: `${players[ws.playerSecret].name} has left.`,
        color: "red",
      });
    }
  });
});

// --- Game Logic Intervals ---

function spawnCoin() {
  if (Object.keys(coins).length >= MAX_COINS) return;
  const id = uuidv4();
  coins[id] = {
    id,
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
  };
  broadcast({
    type: "notification",
    message: "A new coin has spawned!",
    color: "yellow",
  });
}

function updateSpeedLimit() {
  speedLimit = Math.floor(Math.random() * 10) + 5; // Speed limit between 5 and 14
  broadcast({
    type: "notification",
    message: `New speed limit: ${speedLimit}`,
    color: "red",
  });
}

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "0.0.0.0";
}

// Start game loops
setInterval(spawnCoin, 5000);
setInterval(updateSpeedLimit, 20000);
setInterval(broadcastGameState, 1000 / 30); // Broadcast state 30 times a second

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  const localIp = getLocalIp(); // This is the container's IP, useful for debugging.
  console.log(`================================================`);
  console.log(`Visualizer URL: http://localhost:80`);
  console.log(`------------------------------------------------`);
  console.log(`INSTRUCTIONS FOR PARTICIPANTS:`);
  console.log(`1. Find your computer's Local IP Address.`);
  console.log(`   - On macOS, go to System Settings > Wi-Fi > Details.`);
  console.log(`   - On Windows, open Command Prompt and type 'ipconfig'.`);
  console.log(`2. Your Player WebSocket URL is: ws://<YOUR_IP_ADDRESS>:80`);
  console.log(`   (Replace <YOUR_IP_ADDRESS> with the IP you found).`);
  console.log(`================================================`);
  console.log(`(Container IP is: ${localIp})`);
});
