const { WebSocketServer, WebSocket } = require("ws");

const PANEL_CLIENTS = new Set();
const ESP32_CLIENTS = new Set();

function safeSend(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  const message =
    typeof payload === "string" || Buffer.isBuffer(payload)
      ? payload
      : JSON.stringify(payload);

  socket.send(message);
  return true;
}

function broadcast(targets, payload) {
  let total = 0;

  for (const client of targets) {
    if (safeSend(client, payload)) {
      total += 1;
    }
  }

  return total;
}

function getClientRole(requestUrl = "") {
  try {
    const url = new URL(
      requestUrl,
      "http://localhost"
    );

    const rawClient =
      url.searchParams.get("client") ||
      url.searchParams.get("role") ||
      "panel";

    const client = rawClient
      .trim()
      .toLowerCase();

    if (
      client === "esp32" ||
      client === "gateway" ||
      client === "device"
    ) {
      return "esp32";
    }

    return "panel";
  } catch {
    return "panel";
  }
}

function getGatewayStatus() {
  return {
    gateway: true,
    type: "status",
    panels: PANEL_CLIENTS.size,
    devices: ESP32_CLIENTS.size,
    timestamp: new Date().toISOString()
  };
}

function broadcastGatewayStatus() {
  const status = getGatewayStatus();

  broadcast(PANEL_CLIENTS, status);
  broadcast(ESP32_CLIENTS, status);
}

function attachIotGateway(server) {
  const wss = new WebSocketServer({
    server,
    path: "/iot-ws"
  });

  wss.on("connection", (socket, request) => {
    const role = getClientRole(request.url);

    socket.role = role;
    socket.isAlive = true;

    const registry =
      role === "esp32"
        ? ESP32_CLIENTS
        : PANEL_CLIENTS;

    registry.add(socket);

    safeSend(socket, {
      gateway: true,
      type: "connected",
      role,
      message:
        role === "esp32"
          ? "ESP32 o gateway físico conectado al puente IoT."
          : "Panel web conectado al puente IoT.",
      ...getGatewayStatus()
    });

    broadcastGatewayStatus();

    console.log(
      `[IoT WS] Cliente conectado como ${role}. Paneles: ${PANEL_CLIENTS.size}. Dispositivos: ${ESP32_CLIENTS.size}.`
    );

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (message) => {
      if (role === "panel") {
        const sent = broadcast(ESP32_CLIENTS, message);

        if (sent === 0) {
          safeSend(socket, {
            gateway: true,
            type: "warning",
            message:
              "No hay ESP32 o gateway físico conectado para recibir el comando.",
            timestamp: new Date().toISOString()
          });
        }

        return;
      }

      broadcast(PANEL_CLIENTS, message);
    });

    socket.on("close", () => {
      registry.delete(socket);

      console.log(
        `[IoT WS] Cliente desconectado: ${role}. Paneles: ${PANEL_CLIENTS.size}. Dispositivos: ${ESP32_CLIENTS.size}.`
      );

      broadcastGatewayStatus();
    });

    socket.on("error", (error) => {
      console.error(
        `[IoT WS] Error en cliente ${role}:`,
        error.message
      );
    });
  });

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }

      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  console.log(
    "[IoT WS] Gateway inicializado en /iot-ws"
  );

  return wss;
}

module.exports = attachIotGateway;
