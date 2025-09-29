/**
 * Parses a raw message from the WebSocket server.
 * @param {string} message The raw message string from the server.
 * @returns {object | null} A parsed object, or null if parsing fails.
 */
function parseMessage(message) {
  try {
    return JSON.parse(message);
  } catch (error) {
    console.error("Failed to parse server message:", error);
    return null;
  }
}

module.exports = { parseMessage };
