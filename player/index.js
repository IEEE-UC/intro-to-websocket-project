const WebSocket = require("ws");

// TODO: Replace with the actual server address
const SERVER_ADDRESS = "ws://localhost:80";

const ws = new WebSocket(SERVER_ADDRESS);

ws.on("open", () => {
  console.log("Connected to the server!");

  // TODO: Send a message to the server to create your meeple
  // The message should be a JSON string with 'name', 'color', and 'secret' properties.
  const meeple = {
    name: "MyMeeple",
    color: "blue",
    secret: "my-secret-key",
  };
  ws.send(JSON.stringify({ type: "create", ...meeple }));
});

ws.on("message", (message) => {
  const data = JSON.parse(message);
  console.log("Received:", data);

  // TODO: Handle messages from the server
  // - 'coins': An array of coin positions
  // - 'speedLimit': The current speed limit
  // - 'players': An object of all player positions
});

ws.on("close", () => {
  console.log("Disconnected from the server.");
});

// TODO: Implement your meeple's movement logic
// Send movement commands to the server, e.g.,
// ws.send(JSON.stringify({ type: 'move', angle: Math.random() * 2 * Math.PI, velocity: 5 }));
