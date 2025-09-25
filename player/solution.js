const WebSocket = require("ws");

const SERVER_ADDRESS = "ws://localhost:80";

const ws = new WebSocket(SERVER_ADDRESS);

let myMeeple = null;
let coins = [];
let speedLimit = 10;

ws.on("open", () => {
  console.log("Connected to the server!");

  const meeple = {
    name: "SolutionBot",
    color: "gold",
    secret: "solution-secret",
  };
  myMeeple = { ...meeple, x: 0, y: 0 };
  ws.send(JSON.stringify({ type: "create", ...meeple }));
});

ws.on("message", (message) => {
  const data = JSON.parse(message);

  if (data.type === "gameState") {
    coins = data.coins;
    speedLimit = data.speedLimit;
    if (data.players[myMeeple.name]) {
      myMeeple.x = data.players[myMeeple.name].x;
      myMeeple.y = data.players[myMeeple.name].y;
    }
  }
});

ws.on("close", () => {
  console.log("Disconnected from the server.");
});

// Simple AI: move towards the nearest coin
setInterval(() => {
  if (!myMeeple || coins.length === 0) {
    return;
  }

  let nearestCoin = coins[0];
  let minDistance = Infinity;

  for (const coin of coins) {
    const distance = Math.sqrt(
      Math.pow(coin.x - myMeeple.x, 2) + Math.pow(coin.y - myMeeple.y, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearestCoin = coin;
    }
  }

  const angle = Math.atan2(
    nearestCoin.y - myMeeple.y,
    nearestCoin.x - myMeeple.x
  );
  const velocity = Math.min(5, speedLimit);

  ws.send(JSON.stringify({ type: "move", angle, velocity }));
}, 1000);
