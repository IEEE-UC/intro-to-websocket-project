const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const leaderboard = document.getElementById("leaderboard");
const speedLimitDisplay = document.getElementById("speed-limit");
const serverUrlElement = document.getElementById("server-url");
const toastContainer = document.getElementById("toast-container");

const ws = new WebSocket(`ws://${window.location.host}`);

// --- Local Game State ---
let localGameState = {
  players: [],
  coins: [],
};

ws.onopen = () => {
  console.log("Connected to the WebSocket server");
};

ws.onerror = (error) => {
  console.error("WebSocket Error:", error);
  serverUrlElement.textContent = "Connection Failed. See console for details.";
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "serverInfo":
      const playerUrl = `ws://${window.location.host}`;
      serverUrlElement.href = playerUrl;
      serverUrlElement.textContent = playerUrl;
      break;

    case "notification":
      showToast(data.message, data.color);
      break;

    case "gameState":
      localGameState.players = data.players;
      localGameState.coins = data.coins; // Full sync
      updateLeaderboard(data.leaderboard);
      speedLimitDisplay.textContent = data.speedLimit;
      break;

    case "coinCollected":
      // Remove the specific coin more quickly than waiting for a full gameState sync
      localGameState.coins = localGameState.coins.filter(
        (c) => c.id !== data.coinId
      );
      break;
  }
};

function updateLeaderboard(board) {
  leaderboard.innerHTML = "";
  board.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = `${player.name}: ${player.score}`;
    leaderboard.appendChild(li);
  });
}

function drawPlayers(players) {
  players.forEach((player) => {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.fillText(player.name, player.x - 15, player.y - 15);

    if (player.overSpeed) {
      ctx.font = "20px Arial";
      ctx.fillText("🛑", player.x - 10, player.y + 8);
    }
  });
}

function drawCoins(coins) {
  coins.forEach((coin) => {
    ctx.fillStyle = "gold";
    ctx.fillRect(coin.x - 5, coin.y - 5, 10, 10);
  });
}

function showToast(message, color = "green") {
  const toast = document.createElement("div");
  toast.className = `toast ${color}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// --- Render Loop ---
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPlayers(localGameState.players);
  drawCoins(localGameState.coins);
  requestAnimationFrame(render);
}

// Start the render loop
render();
