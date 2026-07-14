const { WebSocketServer, WebSocket } = require("ws");

const PANEL_CLIENTS = new Set();
const ESP32_CLIENTS = new Set();
const CAMERA_CLIENTS = new Set();

function convertirATexto(payload) {
  if (typeof payload === "string") return payload;
  if (Buffer.isBuffer(payload)) return payload.toString("utf8");
  if (payload instanceof ArrayBuffer) return Buffer.from(payload).toString("utf8");
  if (Array.isArray(payload)) return Buffer.concat(payload).toString("utf8");
  return String(payload);
}

function safeSend(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  let message;

  if (typeof payload === "string") {
    message = payload;
  } else if (
    Buffer.isBuffer(payload) ||
    payload instanceof ArrayBuffer ||
    Array.isArray(payload)
  ) {
    message = convertirATexto(payload);
  } else {
    message = JSON.stringify(payload);
  }

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

function parseJsonSeguro(payload) {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function getClientRole(requestUrl = "") {
  try {
    const url = new URL(requestUrl, "http://localhost");

    const rawClient =
      url.searchParams.get("client") ||
      url.searchParams.get("role") ||
      "panel";

    const client = rawClient.trim().toLowerCase();

    if (client === "esp32" || client === "gateway" || client === "device") {
      return "esp32";
    }

    if (
      client === "camera" ||
      client === "cam" ||
      client === "esp32cam" ||
      client === "esp32-cam"
    ) {
      return "camera";
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
    cameras: CAMERA_CLIENTS.size,
    timestamp: new Date().toISOString()
  };
}

function broadcastGatewayStatus() {
  const status = getGatewayStatus();
  broadcast(PANEL_CLIENTS, status);
  broadcast(ESP32_CLIENTS, status);
  broadcast(CAMERA_CLIENTS, status);
}

function getRegistry(role) {
  if (role === "esp32") return ESP32_CLIENTS;
  if (role === "camera") return CAMERA_CLIENTS;
  return PANEL_CLIENTS;
}

function attachIotGateway(server) {
  const wss = new WebSocketServer({
    server,
    path: "/iot-ws",
    maxPayload: 12 * 1024 * 1024
  });

  wss.on("connection", (socket, request) => {
    const role = getClientRole(request.url);

    socket.role = role;
    socket.isAlive = true;

    const registry = getRegistry(role);
    registry.add(socket);

    safeSend(socket, {
      gateway: true,
      type: "connected",
      role,
      message:
        role === "esp32"
          ? "ESP32 conectado al puente IoT."
          : role === "camera"
            ? "ESP32-CAM conectada al puente IoT."
            : "Panel web conectado al puente IoT.",
      ...getGatewayStatus()
    });

    broadcastGatewayStatus();

    console.log(
      "[IoT WS] Cliente conectado como " +
        role +
        ". Paneles: " +
        PANEL_CLIENTS.size +
        ". Dispositivos: " +
        ESP32_CLIENTS.size +
        ". Camaras: " +
        CAMERA_CLIENTS.size +
        "."
    );

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (message) => {
      const payload = convertirATexto(message);

      if (role === "panel") {
        const data = parseJsonSeguro(payload);
        const target = String(data?.target || data?.to || "").toLowerCase();
        const isCameraCommand =
          target === "camera" ||
          target === "esp32cam" ||
          data?.type === "camera_cmd" ||
          data?.type === "camera_subscribe";

        const destino = isCameraCommand ? CAMERA_CLIENTS : ESP32_CLIENTS;
        const sent = broadcast(destino, payload);

        if (sent === 0) {
          safeSend(socket, {
            gateway: true,
            type: "warning",
            target: isCameraCommand ? "camera" : "esp32",
            message: isCameraCommand
              ? "No hay ESP32-CAM conectada para recibir el comando."
              : "No hay ESP32 conectado para recibir el comando.",
            timestamp: new Date().toISOString()
          });
        }

        return;
      }

      if (role === "camera") {
        broadcast(PANEL_CLIENTS, payload);
        return;
      }

      broadcast(PANEL_CLIENTS, payload);
    });

    socket.on("close", () => {
      registry.delete(socket);

      console.log(
        "[IoT WS] Cliente desconectado: " +
          role +
          ". Paneles: " +
          PANEL_CLIENTS.size +
          ". Dispositivos: " +
          ESP32_CLIENTS.size +
          ". Camaras: " +
          CAMERA_CLIENTS.size +
          "."
      );

      broadcastGatewayStatus();
    });

    socket.on("error", (error) => {
      console.error("[IoT WS] Error en cliente " + role + ":", error.message);
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

  console.log("[IoT WS] Gateway inicializado en /iot-ws");

  return wss;
}

module.exports = attachIotGateway;
