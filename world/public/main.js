const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const leaderboard = document.getElementById("leaderboard");
const speedLimitDisplay = document.getElementById("speed-limit");
const serverUrlElement = document.getElementById("server-url");
const toastContainer = document.getElementById("toast-container");

const ws = new WebSocket(`ws://${window.location.host}`);

ws.onopen = () => {
  console.log("Connected to the WebSocket server");
};

ws.onerror = (error) => {
  console.error("WebSocket Error:", error);
  serverUrlElement.textContent = "Connection Failed. See console for details.";
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "serverInfo") {
    serverUrlElement.href = data.url;
    serverUrlElement.textContent = data.url;
    return;
  }

  if (data.type === "notification") {
    showToast(data.message, data.color);
    return;
  }

  if (data.type !== "gameState") return;

  const gameState = data;

  // Update leaderboard
  updateLeaderboard(gameState.leaderboard);

  // Update speed limit
  speedLimitDisplay.textContent = gameState.speedLimit;

  // Clear canvas and redraw
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPlayers(gameState.players);
  drawCoins(gameState.coins);
};

function updateLeaderboard(board) {
  leaderboard.innerHTML = "";
  for (const player in board) {
    const li = document.createElement("li");
    li.textContent = `${player}: ${board[player]}`;
    leaderboard.appendChild(li);
  }
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
