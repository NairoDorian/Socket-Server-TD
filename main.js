const http = require("http");
const express = require("express");
const app = express();

app.use(express.static("public"));

const serverPort = process.env.PORT || 3000;
const server = http.createServer(app);
const WebSocket = require("ws");

// Disable per‑message deflate for performance if compression isn’t needed.
const wsOptions = { perMessageDeflate: false };

const wss =
  process.env.NODE_ENV === "production"
    ? new WebSocket.Server({ server, ...wsOptions })
    : new WebSocket.Server({ port: 5001, ...wsOptions });

server.listen(serverPort, () =>
  console.log(`Server started on port ${serverPort} in stage ${process.env.NODE_ENV}`)
);

let keepAliveId;

// Broadcast to all connected clients except the sender (unless includeSelf is true)
const broadcast = (sender, message, includeSelf = false) => {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && (includeSelf || client !== sender)) {
      client.send(message);
    }
  }
};

// Ping all clients every 50 seconds to keep the connection alive.
const keepServerAlive = () => {
  keepAliveId = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send("ping");
      }
    }
  }, 50000);
};

wss.on("connection", (ws) => {
  // Optionally log connection info (suppress in production for performance)
  if (process.env.NODE_ENV !== "production") {
    console.log("Connection Opened. Client count:", wss.clients.size);
  }

  if (wss.clients.size === 1) {
    if (process.env.NODE_ENV !== "production") {
      console.log("First connection: starting keepalive");
    }
    keepServerAlive();
  }

  ws.on("message", (data) => {
    const message = data.toString();
    if (message === "pong") {
      if (process.env.NODE_ENV !== "production") {
        console.log("keepAlive");
      }
      return;
    }
    broadcast(ws, message);
  });

  ws.on("close", () => {
    if (process.env.NODE_ENV !== "production") {
      console.log("Closing connection. Client count:", wss.clients.size);
    }
    if (wss.clients.size === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.log("Last client disconnected, stopping keepalive");
      }
      clearInterval(keepAliveId);
    }
  });
});

app.get("/", (req, res) => res.send("Hello World!"));
