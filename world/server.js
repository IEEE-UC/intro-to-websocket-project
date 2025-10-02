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
const MAX_COINS = 35;
const START_SPEED = 25;
const MIN_SPEED = 25;
const MAX_SPEED = 85;
const TICK_SPEED = 60; // game state updates a second
const MIN_OBSTACLES = 5;
const MAX_OBSTACLES = 12;
const MIN_OBST_SIZE = 10;
const MAX_OBST_SIZE = 150;

// Game state
let players = {}; // key: secret, value: player object
let coins = {}; // key: id, value: coin object
let speedLimit = START_SPEED;
let hardMode = false;
let obstacles = [];
let winners = [];

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
    obstacles: obstacles,
    winners: winners,
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
              angle: 0,
              velocity: 0,
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
            player.angle = data.angle;
            player.velocity = Math.min(data.velocity, 20); // Cap velocity
          }
          break;

        case "getPastCoins":
          ws.send(
            JSON.stringify({ type: "pastCoins", coins: Object.values(coins) })
          );
          break;
        case "reset":
          resetGame();
          break;
        case "toggleHardMode":
          toggleHardMode();
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

function updatePlayers() {
  const activePlayers = Object.values(players).filter((p) => p.connected);

  for (const player of activePlayers) {
    player.overSpeed = player.velocity > speedLimit;

    if (!player.overSpeed) {
      const speed = (player.velocity / 20) * speedLimit * 0.5;
      player.x += Math.cos(player.angle) * speed;
      player.y += Math.sin(player.angle) * speed;

      // Boundary checks
      player.x = Math.max(0, Math.min(GAME_WIDTH, player.x));
      player.y = Math.max(0, Math.min(GAME_HEIGHT, player.y));

      // Obstacle collision check
      if (hardMode) {
        for (const obstacle of obstacles) {
          if (isInside(player, obstacle.points)) {
            // Simple collision response: push the player out
            const distX = player.x - obstacle.centerX;
            const distY = player.y - obstacle.centerY;
            const dist = Math.sqrt(distX * distX + distY * distY);
            player.x =
              obstacle.centerX + (distX / dist) * (obstacle.radius + 1);
            player.y =
              obstacle.centerY + (distY / dist) * (obstacle.radius + 1);
          }
        }
      }
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
}

// --- Game Logic Intervals ---

function spawnCoin() {
  if (Object.keys(coins).length >= MAX_COINS) return;
  const id = uuidv4();
  let x, y;
  let validPosition = false;
  while (!validPosition) {
    x = Math.random() * GAME_WIDTH;
    y = Math.random() * GAME_HEIGHT;
    validPosition = true;
    if (hardMode) {
      for (const obstacle of obstacles) {
        if (isInside({ x, y }, obstacle.points)) {
          validPosition = false;
          break;
        }
      }
    }
  }
  coins[id] = { id, x, y };
  broadcast({
    type: "notification",
    message: "A new coin has spawned!",
    color: "yellow",
  });
}

function updateSpeedLimit() {
  speedLimit = Math.floor(Math.random() * (MAX_SPEED - MIN_SPEED)) + MIN_SPEED; // Speed limit between 5 and 14
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

function resetGame() {
  const leaderboard = getLeaderboard();
  if (leaderboard.length > 0) {
    winners.push(leaderboard[0]);
  }
  players = {};
  coins = {};
  obstacles = [];
  hardMode = false; // Ensure hard mode is turned off
  broadcast({
    type: "notification",
    message: "The game has been reset!",
    color: "blue",
  });
}

function toggleHardMode() {
  hardMode = !hardMode;
  if (hardMode) {
    coins = {}; // Clear coins when enabling hard mode
    generateObstacles();
    broadcast({
      type: "notification",
      message: "Hard mode enabled!",
      color: "red",
    });
  } else {
    obstacles = [];
    broadcast({
      type: "notification",
      message: "Hard mode disabled!",
      color: "blue",
    });
  }
}

function generateObstacles() {
  obstacles = [];
  const numObstacles =
    Math.floor(Math.random() * (MAX_OBSTACLES - MIN_OBSTACLES)) + MIN_OBSTACLES;
  for (let i = 0; i < numObstacles; i++) {
    const radius =
      Math.random() * (MAX_OBST_SIZE - MIN_OBST_SIZE) + MIN_OBST_SIZE;
    const centerX = Math.random() * (GAME_WIDTH - radius * 2) + radius;
    const centerY = Math.random() * (GAME_HEIGHT - radius * 2) + radius;
    const points = [];
    const numPoints = Math.floor(Math.random() * 5) + 3; // 3-7 points
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2;
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    }
    obstacles.push({ points, centerX, centerY, radius });
  }
}

function isInside(point, vs) {
  // ray-casting algorithm based on
  // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
  var x = point.x,
    y = point.y;
  var inside = false;
  for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    var xi = vs[i].x,
      yi = vs[i].y;
    var xj = vs[j].x,
      yj = vs[j].y;
    var intersect =
      yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Start game loops
setInterval(spawnCoin, 5000);
setInterval(updateSpeedLimit, 20000);
setInterval(broadcastGameState, 1000 / TICK_SPEED); // Broadcast state 60 times a second
setInterval(updatePlayers, 1000 / TICK_SPEED);

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
