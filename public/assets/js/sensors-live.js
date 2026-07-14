const STORAGE_WS_URL = "smartParkingEsp32WsUrl";
const STORAGE_CAMERA_URL = "smartParkingEsp32CameraUrl";
const MAX_LOGS = 150;
const SIM_SPEED_MAX = 1440;

const state = {
  initialized: false,
  active: false,
  socket: null,
  reconnectTimer: null,
  reconnectEnabled: true,
  mode: "test",
  servoEntrada: null,
  servoSalida: null,
  laser: null,
  ldr: null,
  pot: null,
  uid: null,
  lastReader: null,
  rfidReads: 0,
  rfidEntrada: 0,
  rfidSalida: 0,
  writeWaiting: false,
  logs: [],
  autoScroll: true,
  simTime: new Date(),
  simSpeed: 1,
  lastSimTick: Date.now(),
  clockTimer: null
};

function el(id) {
  return document.getElementById(id);
}

function obtenerGatewayWsUrl() {
  const protocolo = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocolo}//${window.location.host}/iot-ws?client=panel`;
}

function normalizarWsUrl(valor) {
  const texto = String(valor || "").trim();

  if (!texto || texto.toLowerCase() === "auto" || texto.toLowerCase() === "gateway") {
    return obtenerGatewayWsUrl();
  }

  if (/^\/iot-ws/i.test(texto)) {
    const protocolo = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocolo}//${window.location.host}${texto}`;
  }

  if (/^wss?:\/\//i.test(texto)) return texto;

  return `ws://${texto.includes(":") ? texto : `${texto}:81`}`;
}

function aplicarTema(theme, accent) {
  const tema = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", tema);
  if (accent) document.documentElement.style.setProperty("--accent", accent);
}

window.addEventListener("message", (evento) => {
  if (evento.origin !== window.location.origin) return;
  const data = evento.data || {};
  if (data.type === "smartparking:theme") aplicarTema(data.theme, data.accent);
});

function updateRfidConnectionIndicators(entrada = state.rfidEntrada, salida = state.rfidSalida) {
  state.rfidEntrada = Number(entrada) === 1 ? 1 : 0;
  state.rfidSalida = Number(salida) === 1 ? 1 : 0;

  const entryDot = el("rfid-entry-status-dot") || el("rfid-status-dot");
  const entryText = el("rfid-entry-status-text") || el("rfid-status-text");
  const exitDot = el("rfid-exit-status-dot");
  const exitText = el("rfid-exit-status-text");

  if (entryDot) entryDot.className = `sensor-pill ${state.rfidEntrada ? "ok" : "off"}`;
  if (entryText) entryText.textContent = state.rfidEntrada
    ? "Conectado · lectura/escritura activa"
    : "Sin conexión al lector de entrada";

  if (exitDot) exitDot.className = `sensor-pill ${state.rfidSalida ? "ok" : "off"}`;
  if (exitText) exitText.textContent = state.rfidSalida
    ? "Conectado · cobro activo"
    : "Sin conexión al lector de salida";
}

function setConnectionStatus(status, detail = "") {
  const indicator = el("esp32-indicator");
  const title = el("esp32-status-text");
  const subtitle = el("esp32-status-detail");

  if (!indicator || !title || !subtitle) return;

  indicator.className = `esp32-indicator ${status}`;

  if (status === "connected") {
    title.textContent = "ESP32 conectado";
    subtitle.textContent = detail || "Datos recibidos en tiempo real.";
  } else if (status === "connecting") {
    title.textContent = "Conectando al ESP32…";
    subtitle.textContent = detail || "Abriendo conexión WebSocket.";
    updateRfidConnectionIndicators(0, 0);
  } else {
    title.textContent = "ESP32 desconectado";
    subtitle.textContent = detail || "Sin datos en tiempo real.";
    updateRfidConnectionIndicators(0, 0);
  }
}

function addLog(type, tag, message) {
  state.logs.push({
    type,
    tag,
    message: String(message),
    timestamp: new Date().toLocaleTimeString("es-PE", { hour12: false })
  });

  if (state.logs.length > MAX_LOGS) state.logs.shift();
  renderLogs();
}

function renderLogs() {
  const container = el("sensor-live-log");
  if (!container) return;

  if (!state.logs.length) {
    container.innerHTML = '<div class="sensor-log-empty">Aún no hay eventos del ESP32.</div>';
    return;
  }

  container.replaceChildren(...state.logs.map((entry) => {
    const row = document.createElement("div");
    row.className = `sensor-log-entry ${entry.type}`;

    const time = document.createElement("time");
    time.textContent = entry.timestamp;

    const tag = document.createElement("b");
    tag.textContent = entry.tag;

    const message = document.createElement("span");
    message.textContent = entry.message;

    row.append(time, tag, message);
    return row;
  }));

  if (state.autoScroll) container.scrollTop = container.scrollHeight;
}

function setAutoScroll(enabled) {
  state.autoScroll = enabled;
  const button = el("btn-log-auto");
  if (!button) return;
  button.classList.toggle("active", enabled);
  button.innerHTML = enabled
    ? '<i class="ti ti-arrow-bar-to-down"></i> Auto'
    : '<i class="ti ti-lock"></i> Fijo';

  if (enabled) {
    const container = el("sensor-live-log");
    if (container) container.scrollTop = container.scrollHeight;
  }
}

function closeSocket() {
  clearTimeout(state.reconnectTimer);
  state.reconnectTimer = null;

  if (state.socket) {
    try {
      state.socket.onopen = null;
      state.socket.onmessage = null;
      state.socket.onerror = null;
      state.socket.onclose = null;
      state.socket.close();
    } catch {
      // La conexión ya estaba cerrada.
    }
  }

  state.socket = null;
}

function scheduleReconnect() {
  clearTimeout(state.reconnectTimer);
  if (!state.active || !state.reconnectEnabled) return;
  state.reconnectTimer = setTimeout(() => conectarESP32(false), 5000);
}

function conectarESP32(manual = true) {
  if (!state.active) state.active = true;

  closeSocket();
  state.reconnectEnabled = true;

  const input = el("esp32-ws-url");
  const url = normalizarWsUrl(input?.value);
  if (input) input.value = url;
  localStorage.setItem(STORAGE_WS_URL, url);

  if (window.location.protocol === "https:" && url.startsWith("ws://")) {
    const detail = "El navegador bloquea ws:// desde una página HTTPS. Usa la prueba local o un WebSocket wss://.";
    setConnectionStatus("offline", detail);
    addLog("error", "WS", detail);
    state.reconnectEnabled = false;
    return;
  }

  setConnectionStatus("connecting", url);
  if (manual || !state.logs.length) addLog("info", "WS", `Intentando conectar a ${url}`);

  let socket;
  try {
    socket = new WebSocket(url);
  } catch (error) {
    setConnectionStatus("offline", "No se pudo crear la conexión WebSocket.");
    addLog("error", "WS", error.message || "No se pudo abrir el WebSocket");
    scheduleReconnect();
    return;
  }

  state.socket = socket;

  socket.onopen = () => {
    if (socket !== state.socket) return;
    setConnectionStatus("connected", url);
    addLog("ok", "WS", "Conexión establecida. Esperando datos reales del ESP32.");
    wsSend({ cmd: "mode", mode: state.mode }, false);
  };

  socket.onmessage = (event) => {
    if (socket !== state.socket) return;
    try {
      const data = JSON.parse(event.data);
      handleState(data);
    } catch (error) {
      addLog("error", "WS", `Mensaje no válido: ${error.message}`);
    }
  };

  socket.onerror = () => {
    if (socket !== state.socket) return;
    setConnectionStatus("offline", "Error de comunicación con el ESP32.");
  };

  socket.onclose = () => {
    if (socket !== state.socket) return;
    state.socket = null;
    setConnectionStatus("offline", "Reintentando en 5 segundos…");
    addLog("warn", "WS", "Conexión cerrada.");
    scheduleReconnect();
  };
}

function wsSend(payload, logWhenDisconnected = true) {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    if (logWhenDisconnected) addLog("warn", "CMD", "Comando no enviado: el ESP32 está desconectado.");
    return false;
  }

  state.socket.send(JSON.stringify(payload));
  return true;
}

function updateServo(id, angle) {
  const numericAngle = Number(angle);
  const isEntry = id === "entry";
  const open = numericAngle === 90;
  const arc = el(`servo-${id}-arc`);
  const angleLabel = el(`servo-${id}-angle`);
  const stateLabel = el(`servo-${id}-state`);
  const button = el(`btn-servo-${id}`);

  if (arc) {
    const offset = 148 * (1 - Math.max(0, Math.min(180, numericAngle)) / 180);
    arc.style.strokeDashoffset = String(offset);
    arc.style.stroke = open ? "var(--green)" : "var(--red)";
  }

  if (angleLabel) angleLabel.textContent = `${numericAngle}°`;

  if (stateLabel) {
    stateLabel.textContent = open ? "ABIERTA" : "CERRADA";
    stateLabel.className = `servo-state ${open ? "open" : "closed"}`;
  }

  if (button) {
    button.classList.toggle("close", open);
    button.innerHTML = open
      ? '<i class="ti ti-lock"></i> Cerrar'
      : '<i class="ti ti-lock-open"></i> Abrir';
    button.dataset.open = open ? "true" : "false";
    button.dataset.closedAngle = isEntry ? "0" : "180";
  }
}

function updateLaser(value) {
  const on = Number(value) === 1;
  const label = el("laser-value");
  const detail = el("laser-detail");
  const dot = el("laser-dot");
  const button = el("btn-laser");

  if (label) {
    label.textContent = on ? "ENCENDIDO" : "APAGADO";
    label.style.color = on ? "var(--red)" : "var(--muted)";
  }
  if (detail) detail.textContent = on ? "Haz activo" : "Sin emisión";
  if (dot) dot.className = `sensor-pill ${on ? "on" : "off"}`;
  if (button) {
    button.classList.toggle("on", on);
    button.dataset.on = on ? "true" : "false";
    button.innerHTML = on
      ? '<i class="ti ti-power"></i> Apagar láser'
      : '<i class="ti ti-power"></i> Encender láser';
  }
}

function updateLdr(value) {
  const free = Number(value) === 1;
  const label = el("ldr-value");
  const detail = el("ldr-detail");
  const dot = el("ldr-dot");

  if (label) {
    label.textContent = free ? "LIBRE" : "BLOQUEADO";
    label.style.color = free ? "var(--green)" : "var(--red)";
  }
  if (detail) detail.textContent = free ? "Paso libre detectado" : "Obstáculo u oscuridad";
  if (dot) dot.className = `sensor-pill ${free ? "ok" : "on"}`;
}

function formatSpeed(speed) {
  const value = Number(speed) || 1;
  if (value < 2) return "x1";
  if (value < 10) return `x${value.toFixed(1)}`;
  return `x${Math.round(value)}`;
}

function describeSpeed(speed) {
  const value = Number(speed) || 1;
  if (value < 1.5) return "Tiempo real";
  if (value >= SIM_SPEED_MAX - 2) return "1 min real = 1 día simulado";

  const simulatedMinutes = value;
  if (simulatedMinutes >= 60) {
    return `1 min real = ${(simulatedMinutes / 60).toFixed(1)} h simuladas`;
  }

  return `1 min real = ${Math.round(simulatedMinutes)} min simulados`;
}

function updatePot(rawValue, speedFromDevice) {
  const raw = Math.max(0, Math.min(4095, Number(rawValue) || 0));
  const percentage = raw / 4095;
  const speed = Number(speedFromDevice) > 0
    ? Number(speedFromDevice)
    : 1 + percentage * (SIM_SPEED_MAX - 1);
  const offset = 132 - percentage * 132;
  const speedText = formatSpeed(speed);

  const arc = el("pwm-arc");
  if (arc) {
    arc.style.strokeDashoffset = offset.toFixed(1);
    arc.style.stroke = "var(--accent)";
  }

  if (el("pwm-val")) el("pwm-val").textContent = speedText;
  if (el("pwm-sub")) el("pwm-sub").innerHTML = `ADC: ${raw} / 4095<br>${describeSpeed(speed)}`;
  if (el("sim-speed-badge")) el("sim-speed-badge").textContent = speedText;
  if (el("sim-speed-desc")) el("sim-speed-desc").textContent = describeSpeed(speed);
  if (el("sim-speed-bar")) el("sim-speed-bar").style.width = `${(percentage * 100).toFixed(1)}%`;

  state.simSpeed = speed;
}

function addDataRow(container, key, value, className = "") {
  const row = document.createElement("div");
  row.className = "rfid-data-row";

  const label = document.createElement("span");
  label.textContent = key;

  const data = document.createElement("strong");
  data.className = className;
  data.textContent = value ?? "—";

  row.append(label, data);
  container.appendChild(row);
}

function renderRfid(uid, cardData, reader = "") {
  const container = el("rfid-result");
  if (!container) return;

  container.className = "";
  container.replaceChildren();
  addDataRow(container, "Lector", reader === "salida" ? "Salida / pago" : reader === "entrada" ? "Entrada / registro" : "No indicado");
  addDataRow(container, "UID", uid, "uid");
  addDataRow(container, "Hora", new Date().toLocaleTimeString("es-PE", { hour12: false }));

  if (cardData?.hasData) {
    addDataRow(container, "Carro", cardData.carro || "—");
    addDataRow(container, "Marca", cardData.marca || "—");
    addDataRow(container, "Tipo", cardData.tipoCarro || "—");
    addDataRow(container, "Placa", cardData.placa || "—");
    addDataRow(container, "Nombre", cardData.nombre || "—");
    addDataRow(container, "DNI", cardData.dni || "—");
    addDataRow(container, "Teléfono", cardData.telefono || "—");
    addDataRow(container, "Saldo", `S/ ${cardData.saldo || "0.00"}`);
    addDataRow(container, "Ingreso sim.", cardData.ingresoMin ? `min ${cardData.ingresoMin}` : "Sin ingreso activo");
  } else {
    addDataRow(container, "Datos", "Tarjeta sin información grabada");
  }

  addDataRow(container, "Lecturas", String(state.rfidReads));
}

function setWriteStatus(message, type = "") {
  const box = el("rfid-write-status");
  if (!box) return;
  box.hidden = false;
  box.className = `write-status ${type}`.trim();
  box.textContent = message;
}

function handleWriteStatus(data) {
  const button = el("btn-rfid-write");
  const cancel = el("btn-rfid-cancel");
  if (!button || !cancel) return;

  if (data.writeStatus === "waiting") {
    state.writeWaiting = true;
    button.disabled = true;
    cancel.hidden = false;
    setWriteStatus("Esperando tarjeta… acércala al RFID de entrada, no al de salida.", "info");
    addLog("info", "RFID", "Modo escritura activado en lector de entrada.");
  } else if (data.writeStatus === "success") {
    state.writeWaiting = false;
    button.disabled = false;
    cancel.hidden = true;
    setWriteStatus(`Datos grabados correctamente${data.uid ? ` en ${data.uid}` : ""}.`, "success");
    addLog("ok", "RFID", `Escritura exitosa${data.uid ? ` · ${data.uid}` : ""}.`);
  } else if (data.writeStatus === "error") {
    state.writeWaiting = false;
    button.disabled = false;
    cancel.hidden = true;
    setWriteStatus("No se pudo escribir la tarjeta. Verifica que sea compatible y vuelve a intentar.", "error");
    addLog("error", "RFID", "Fallo durante la escritura de la tarjeta.");
  } else if (data.writeStatus === "wrong_reader") {
    setWriteStatus("La tarjeta se acercó al lector de salida. Para registrar datos, usa el RFID de entrada.", "error");
    addLog("warn", "RFID", "Escritura rechazada porque se usó el lector de salida.");
  } else if (data.writeStatus === "cancelled") {
    state.writeWaiting = false;
    button.disabled = false;
    cancel.hidden = true;
    setWriteStatus("Escritura cancelada.");
    addLog("warn", "RFID", "Escritura cancelada.");
  }
}

function handleEntryStatus(data) {
  if (data.entryStatus === "success") {
    addLog("ok", "ENTRADA", data.message || "Ingreso registrado y barrera abierta.");
  } else if (data.entryStatus === "error") {
    addLog("error", "ENTRADA", data.message || "No se pudo procesar la entrada.");
  }
}

function handlePaymentStatus(data) {
  const base = data.message || (data.paymentStatus === "success" ? "Pago aplicado." : "Pago rechazado.");
  const extra = data.paymentStatus === "success"
    ? ` Pago: S/ ${Number(data.pago || 0).toFixed(2)} · Nuevo saldo: S/ ${Number(data.saldoNuevo || 0).toFixed(2)}`
    : data.pago !== undefined
      ? ` Pago requerido: S/ ${Number(data.pago || 0).toFixed(2)}`
      : "";

  addLog(data.paymentStatus === "success" ? "ok" : "error", "SALIDA", `${base}${extra}`);
}

function syncModeFromDevice(mode) {
  if (mode !== "live" && mode !== "test") return;
  setMode(mode, false);
}

function handleState(data) {
  if (!data || typeof data !== "object") return;
  if (data.gateway === true) return;

  if (data.writeStatus !== undefined) handleWriteStatus(data);
  if (data.entryStatus !== undefined) handleEntryStatus(data);
  if (data.paymentStatus !== undefined) handlePaymentStatus(data);
  if (data.cmdStatus === "blocked") addLog("warn", "MODO", data.message || "Comando bloqueado.");
  if (data.mode !== undefined) syncModeFromDevice(data.mode);

  if (data.rfidEntrada !== undefined || data.rfidSalida !== undefined) {
    updateRfidConnectionIndicators(data.rfidEntrada ?? state.rfidEntrada, data.rfidSalida ?? state.rfidSalida);
  }

  if (data.servoEntrada !== undefined && Number(data.servoEntrada) !== state.servoEntrada) {
    state.servoEntrada = Number(data.servoEntrada);
    updateServo("entry", state.servoEntrada);
    addLog("ok", "SERVO", `Entrada: ${state.servoEntrada}°`);
  }

  if (data.servoSalida !== undefined && Number(data.servoSalida) !== state.servoSalida) {
    state.servoSalida = Number(data.servoSalida);
    updateServo("exit", state.servoSalida);
    addLog("ok", "SERVO", `Salida: ${state.servoSalida}°`);
  }

  if (data.laser !== undefined && Number(data.laser) !== state.laser) {
    state.laser = Number(data.laser);
    updateLaser(state.laser);
    addLog(state.laser ? "ok" : "warn", "LÁSER", state.laser ? "Encendido" : "Apagado");
  }

  if (data.ldr !== undefined && Number(data.ldr) !== state.ldr) {
    state.ldr = Number(data.ldr);
    updateLdr(state.ldr);
    addLog(state.ldr ? "info" : "warn", "LDR", state.ldr ? "Paso libre" : "Obstáculo detectado");
  }

  if (data.pot !== undefined) {
    state.pot = Number(data.pot);
    updatePot(state.pot, data.simSpeed);
  }

  if (data.uid !== undefined && data.uid && data.uid !== "----") {
    const incomingUid = String(data.uid);
    const incomingReader = String(data.lastReader || "");
    const uniqueRead = incomingUid !== state.uid || incomingReader !== state.lastReader;
    if (uniqueRead) {
      state.uid = incomingUid;
      state.lastReader = incomingReader;
      state.rfidReads += 1;
      renderRfid(state.uid, data.cardData, incomingReader);
      addLog("ok", "RFID", `Tarjeta detectada en ${incomingReader || "lector"} · ${state.uid}`);
    }
  }
}

function setMode(mode, notifyDevice = true) {
  state.mode = mode === "live" ? "live" : "test";
  const page = document.querySelector(".sensor-page-wrap");
  const testButton = el("mode-btn-test");
  const liveButton = el("mode-btn-live");
  const subtitle = el("mode-switch-sub");
  const banner = el("mode-banner");

  const live = state.mode === "live";
  page?.classList.toggle("manual-locked", live);
  testButton?.classList.toggle("active-test", !live);
  liveButton?.classList.toggle("active-live", live);

  if (subtitle) subtitle.textContent = live
    ? "Funcionamiento — RFID de entrada registra ingreso y RFID de salida descuenta saldo"
    : "Modo prueba — controles manuales habilitados";

  if (banner) {
    banner.className = `mode-banner ${live ? "live" : "test"}`;
    banner.innerHTML = live
      ? '<i class="ti ti-player-play"></i><span>Modo funcionamiento activo: la entrada escribe el ingreso; la salida cobra, actualiza saldo y abre la barrera si el saldo alcanza.</span>'
      : '<i class="ti ti-info-circle"></i><span>Modo prueba activo: puedes accionar servos y láser manualmente.</span>';
  }

  if (notifyDevice) {
    wsSend({ cmd: "mode", mode: state.mode });
    addLog("info", "MODO", live ? "Funcionamiento" : "Prueba");
  }
}

function toggleServo(id) {
  if (state.mode !== "test") {
    addLog("warn", "MODO", "Control manual bloqueado en modo funcionamiento.");
    return;
  }

  const isEntry = id === "entry";
  const current = isEntry ? state.servoEntrada : state.servoSalida;
  const open = current === 90;
  const angle = open ? (isEntry ? 0 : 180) : 90;
  const firmwareId = isEntry ? "entrada" : "salida";

  if (wsSend({ cmd: "servo", id: firmwareId, angle })) {
    addLog("info", "CMD", `Servo ${firmwareId} → ${angle}°`);
  }
}

function toggleLaser() {
  if (state.mode !== "test") {
    addLog("warn", "MODO", "Control manual bloqueado en modo funcionamiento.");
    return;
  }

  const value = state.laser === 1 ? 0 : 1;
  if (wsSend({ cmd: "laser", value })) {
    addLog("info", "CMD", `Láser → ${value ? "ON" : "OFF"}`);
  }
}

function sendWriteCard() {
  const dni = el("rfid-dni")?.value.trim() || "";
  if (dni && !/^\d{8}$/.test(dni)) {
    setWriteStatus("El DNI debe tener exactamente 8 dígitos.", "error");
    return;
  }

  const payload = {
    cmd: "writeCard",
    carro: el("rfid-car")?.value.trim() || "",
    marca: el("rfid-brand")?.value.trim() || "",
    placa: (el("rfid-plate")?.value.trim() || "").toUpperCase(),
    nombre: el("rfid-name")?.value.trim() || "",
    telefono: el("rfid-phone")?.value.trim() || "",
    saldo: el("rfid-balance")?.value.trim() || "",
    dni,
    tipoCarro: el("rfid-type")?.value || "Sedan"
  };

  const hasData = Object.entries(payload).some(([key, value]) => key !== "cmd" && String(value).trim());
  if (!hasData) {
    setWriteStatus("Completa al menos un campo antes de escribir.", "error");
    return;
  }

  if (wsSend(payload)) {
    setWriteStatus("Solicitud enviada. Acerca la tarjeta al RFID de entrada…", "info");
    addLog("info", "RFID", `Datos enviados para escritura en entrada${payload.placa ? ` · ${payload.placa}` : ""}.`);
  }
}

function applyCameraUrl(urlValue, announce = true) {
  const input = el("esp32-camera-url");
  const image = el("camera-stream");
  const panel = el("camera-panel");
  const empty = el("camera-empty");
  const status = el("camera-status");
  const subtitle = el("camera-subtitle");
  const device = el("camera-device");

  const url = String(urlValue ?? input?.value ?? "").trim();
  if (input) input.value = url;
  localStorage.setItem(STORAGE_CAMERA_URL, url);

  if (!image || !panel || !empty || !status) {
    if (announce) addLog("info", "CÁMARA", url ? "URL de cámara guardada para Monitoreo en Tiempo Real." : "URL de cámara eliminada.");
    return;
  }

  image.onload = null;
  image.onerror = null;

  if (!url) {
    image.hidden = true;
    image.removeAttribute("src");
    panel.classList.remove("has-stream", "stream-error");
    status.textContent = "No configurada";
    status.className = "status-badge neutral";
    if (subtitle) subtitle.textContent = "Configura la URL desde Sensores en vivo";
    if (device) device.textContent = "ESP32-CAM";
    if (announce) addLog("info", "CÁMARA", "URL de transmisión eliminada.");
    return;
  }

  status.textContent = "Conectando";
  status.className = "status-badge warn";
  if (subtitle) subtitle.textContent = "Intentando abrir transmisión real…";
  if (device) device.textContent = url;

  image.onload = () => {
    image.hidden = false;
    panel.classList.add("has-stream");
    panel.classList.remove("stream-error");
    status.textContent = "Online";
    status.className = "status-badge online";
    if (subtitle) subtitle.textContent = "Transmisión en vivo configurada";
    if (el("camera-reading")) el("camera-reading").textContent = `Última lectura: ${new Date().toLocaleTimeString("es-PE")}`;
    if (announce) addLog("ok", "CÁMARA", "Transmisión cargada correctamente.");
  };

  image.onerror = () => {
    image.hidden = true;
    panel.classList.remove("has-stream");
    panel.classList.add("stream-error");
    status.textContent = "Sin señal";
    status.className = "status-badge offline";
    if (subtitle) subtitle.textContent = "No se pudo abrir la URL configurada";
    if (announce) addLog("error", "CÁMARA", "No se pudo cargar la transmisión.");
  };

  image.src = `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;
}

function tickSimulationClock() {
  const now = Date.now();
  const elapsed = now - state.lastSimTick;
  state.lastSimTick = now;
  state.simTime = new Date(state.simTime.getTime() + elapsed * state.simSpeed);

  const time = state.simTime.toLocaleTimeString("es-PE", { hour12: false });
  const date = state.simTime.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  if (el("sim-clock")) el("sim-clock").textContent = time;
  if (el("sim-date")) el("sim-date").textContent = date;
}

function bindEvents() {
  el("btn-esp32-reconnect")?.addEventListener("click", () => conectarESP32(true));
  el("btn-camera-apply")?.addEventListener("click", () => applyCameraUrl(undefined, true));
  el("mode-btn-test")?.addEventListener("click", () => setMode("test"));
  el("mode-btn-live")?.addEventListener("click", () => setMode("live"));
  el("btn-servo-entry")?.addEventListener("click", () => toggleServo("entry"));
  el("btn-servo-exit")?.addEventListener("click", () => toggleServo("exit"));
  el("btn-laser")?.addEventListener("click", toggleLaser);
  el("btn-rfid-write")?.addEventListener("click", sendWriteCard);
  el("btn-rfid-cancel")?.addEventListener("click", () => wsSend({ cmd: "cancelWrite" }));
  el("btn-log-clear")?.addEventListener("click", () => {
    state.logs = [];
    renderLogs();
  });
  el("btn-log-auto")?.addEventListener("click", () => setAutoScroll(!state.autoScroll));

  el("sensor-live-log")?.addEventListener("scroll", () => {
    const container = el("sensor-live-log");
    if (!container) return;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 24;
    if (atBottom !== state.autoScroll) setAutoScroll(atBottom);
  });

  el("esp32-ws-url")?.addEventListener("change", (event) => {
    event.target.value = normalizarWsUrl(event.target.value);
    localStorage.setItem(STORAGE_WS_URL, event.target.value);
  });

  document.querySelectorAll(".rfid-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".rfid-tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".rfid-page").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      el(button.dataset.rfidPage)?.classList.add("active");
    });
  });
}

export function inicializarSensoresEnVivo() {
  if (state.initialized) return;
  state.initialized = true;

  const storedWs = localStorage.getItem(STORAGE_WS_URL);
  const storedCamera = localStorage.getItem(STORAGE_CAMERA_URL);

  const wsInicial = window.location.protocol === "https:" && /^ws:\/\//i.test(storedWs || "")
    ? ""
    : storedWs || "";

  const defaultWs = normalizarWsUrl(wsInicial);

  if (el("esp32-ws-url")) el("esp32-ws-url").value = defaultWs;
  localStorage.setItem(STORAGE_WS_URL, defaultWs);

  if (storedCamera && el("esp32-camera-url")) el("esp32-camera-url").value = storedCamera;

  bindEvents();
  setMode("test", false);
  setAutoScroll(true);
  updateRfidConnectionIndicators(0, 0);
  applyCameraUrl(storedCamera || "", false);

  state.clockTimer = setInterval(tickSimulationClock, 100);
}

export function activarSensoresEnVivo() {
  inicializarSensoresEnVivo();
  state.active = true;

  if (!state.socket || state.socket.readyState === WebSocket.CLOSED) {
    conectarESP32(false);
  }
}

export function detenerSensoresEnVivo() {
  state.active = false;
  state.reconnectEnabled = false;
  closeSocket();
  setConnectionStatus("offline", "Conexión detenida.");
}

export function aplicarCamaraGuardada() {
  const storedCamera = localStorage.getItem(STORAGE_CAMERA_URL) || "";
  applyCameraUrl(storedCamera, false);
}
