const STORAGE_WS_URL = "smartParkingEsp32WsUrl";
const STORAGE_SIM_DATE = "smartParkingOperationDate";
const MAX_LOGS = 150;

const state = {
  initialized: false,
  active: false,
  socket: null,
  reconnectTimer: null,
  reconnectEnabled: true,
  mode: "test",
  servoAcceso: null,
  uid: null,
  lastReader: null,
  rfidReads: 0,
  rfidAcceso: 0,
  rfidPago: 0,
  writeWaiting: false,
  logs: [],
  autoScroll: true,
  operationDate: obtenerFechaHoyISO(),
  clockTimer: null
};

function el(id) {
  return document.getElementById(id);
}

function obtenerFechaHoyISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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
  document.body?.setAttribute("data-theme", tema);
  if (accent) document.documentElement.style.setProperty("--accent", accent);
}

window.addEventListener("message", (evento) => {
  if (evento.origin !== window.location.origin) return;
  const data = evento.data || {};
  if (data.type === "smartparking:theme") aplicarTema(data.theme, data.accent);
});

function updateRfidConnectionIndicators(acceso = state.rfidAcceso, pago = state.rfidPago) {
  state.rfidAcceso = Number(acceso) === 1 ? 1 : 0;
  state.rfidPago = Number(pago) === 1 ? 1 : 0;

  const accessDot = el("rfid-entry-status-dot") || el("rfid-status-dot");
  const accessText = el("rfid-entry-status-text") || el("rfid-status-text");
  const paymentDot = el("rfid-exit-status-dot");
  const paymentText = el("rfid-exit-status-text");

  if (accessDot) accessDot.className = `sensor-pill ${state.rfidAcceso ? "ok" : "off"}`;
  if (accessText) accessText.textContent = state.rfidAcceso
    ? "Conectado · entrada/salida activa"
    : "Sin conexión al RFID de acceso";

  if (paymentDot) paymentDot.className = `sensor-pill ${state.rfidPago ? "ok" : "off"}`;
  if (paymentText) paymentText.textContent = state.rfidPago
    ? "Conectado · pago activo"
    : "Sin conexión al RFID de pago";
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
    const detail = "El navegador bloquea ws:// desde una página HTTPS. Usa wss://.";
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
    enviarFechaOperacion(false);
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
    button.dataset.closedAngle = "0";
  }
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

function nombreLector(reader = "") {
  const value = String(reader).toLowerCase();
  if (["acceso", "entrada", "salida", "entrada_salida"].includes(value)) return "Acceso / entrada-salida";
  if (["pago", "payment", "cobro"].includes(value)) return "Pago";
  return "No indicado";
}

function renderRfid(uid, cardData, reader = "") {
  const container = el("rfid-result");
  if (!container) return;

  container.className = "";
  container.replaceChildren();
  addDataRow(container, "Lector", nombreLector(reader));
  addDataRow(container, "UID", uid, "uid");
  addDataRow(container, "Hora", new Date().toLocaleTimeString("es-PE", { hour12: false }));
  addDataRow(container, "Fecha operación", state.operationDate);

  if (cardData?.hasData) {
    addDataRow(container, "Carro", cardData.carro || "—");
    addDataRow(container, "Marca", cardData.marca || "—");
    addDataRow(container, "Tipo", cardData.tipoCarro || "—");
    addDataRow(container, "Placa", cardData.placa || "—");
    addDataRow(container, "Nombre", cardData.nombre || "—");
    addDataRow(container, "DNI", cardData.dni || "—");
    addDataRow(container, "Teléfono", cardData.telefono || "—");
    addDataRow(container, "Saldo", `S/ ${cardData.saldo || "0.00"}`);
    addDataRow(container, "Estado", cardData.estadoSesion || cardData.estado || "Sin estado");
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
    setWriteStatus("Esperando tarjeta… acércala al RFID de pago.", "info");
    addLog("info", "RFID", "Modo escritura activado en lector de pago.");
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
    setWriteStatus(data.message || "No se pudo escribir la tarjeta. Verifica que sea compatible y vuelve a intentar.", "error");
    addLog("error", "RFID", data.message || "Fallo durante la escritura de la tarjeta.");
  } else if (data.writeStatus === "wrong_reader") {
    setWriteStatus("Usa el RFID de pago para escribir o actualizar tarjetas.", "error");
    addLog("warn", "RFID", "Escritura rechazada por lector incorrecto.");
  } else if (data.writeStatus === "cancelled") {
    state.writeWaiting = false;
    button.disabled = false;
    cancel.hidden = true;
    setWriteStatus("Escritura cancelada.");
    addLog("warn", "RFID", "Escritura cancelada.");
  }
}

function handleAccessStatus(data) {
  const status = data.accessStatus ?? data.entryStatus ?? data.exitStatus;
  if (!status) return;

  const tag = data.exitStatus !== undefined ? "SALIDA" : data.entryStatus !== undefined ? "ENTRADA" : "ACCESO";
  const ok = status === "success" || status === "ok" || status === true;
  addLog(ok ? "ok" : "error", tag, data.message || (ok ? "Acceso autorizado." : "Acceso rechazado."));
}

function handleIncidentStatus(data) {
  const status = data.incidentStatus ?? data.incidenciaStatus;
  if (!status) return;
  addLog("error", "INCIDENCIA", data.message || "Incidencia registrada para reportes.");
}

function handlePaymentStatus(data) {
  if (data.paymentStatus === undefined) return;

  const base = data.message || (data.paymentStatus === "success" ? "Pago aplicado." : "Pago rechazado.");
  const extra = data.paymentStatus === "success"
    ? ` Pago: S/ ${Number(data.pago || 0).toFixed(2)} · Nuevo saldo: S/ ${Number(data.saldoNuevo || 0).toFixed(2)}`
    : data.pago !== undefined
      ? ` Pago requerido: S/ ${Number(data.pago || 0).toFixed(2)}`
      : "";

  addLog(data.paymentStatus === "success" ? "ok" : "error", "PAGO", `${base}${extra}`);
}

function syncModeFromDevice(mode) {
  if (mode !== "live" && mode !== "test") return;
  setMode(mode, false);
}

function handleState(data) {
  if (!data || typeof data !== "object") return;
  if (data.gateway === true) return;

  if (data.writeStatus !== undefined) handleWriteStatus(data);
  handleAccessStatus(data);
  handleIncidentStatus(data);
  handlePaymentStatus(data);
  if (data.cmdStatus === "blocked") addLog("warn", "MODO", data.message || "Comando bloqueado.");
  if (data.mode !== undefined) syncModeFromDevice(data.mode);
  if (data.fechaOperacion || data.operationDate) aplicarFechaOperacion(data.fechaOperacion || data.operationDate, false);

  if (
    data.rfidAcceso !== undefined ||
    data.rfidPago !== undefined ||
    data.rfidEntrada !== undefined ||
    data.rfidSalida !== undefined
  ) {
    updateRfidConnectionIndicators(
      data.rfidAcceso ?? data.rfidEntrada ?? state.rfidAcceso,
      data.rfidPago ?? data.rfidSalida ?? state.rfidPago
    );
  }

  const servoValue = data.servoAcceso ?? data.servoEntrada;
  if (servoValue !== undefined && Number(servoValue) !== state.servoAcceso) {
    state.servoAcceso = Number(servoValue);
    updateServo("entry", state.servoAcceso);
    addLog("ok", "SERVO", `Acceso: ${state.servoAcceso}°`);
  }

  if (data.uid !== undefined && data.uid && data.uid !== "----") {
    const incomingUid = String(data.uid);
    const incomingReader = String(data.lastReader || data.reader || "");
    const uniqueRead = incomingUid !== state.uid || incomingReader !== state.lastReader;
    if (uniqueRead) {
      state.uid = incomingUid;
      state.lastReader = incomingReader;
      state.rfidReads += 1;
      renderRfid(state.uid, data.cardData, incomingReader);
      addLog("ok", "RFID", `Tarjeta detectada en ${nombreLector(incomingReader)} · ${state.uid}`);
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
    ? "Funcionamiento — acceso valida entrada/salida y pago queda separado"
    : "Modo prueba — control manual de la barrera habilitado";

  if (banner) {
    banner.className = `mode-banner ${live ? "live" : "test"}`;
    banner.innerHTML = live
      ? '<i class="ti ti-player-play"></i><span>Modo funcionamiento activo: RFID de acceso permite entrar o salir; RFID de pago descuenta saldo. Los intentos de salida sin pago quedan como incidencia.</span>'
      : '<i class="ti ti-info-circle"></i><span>Modo prueba activo: puedes abrir o cerrar manualmente la barrera única de acceso.</span>';
  }

  if (notifyDevice) {
    wsSend({ cmd: "mode", mode: state.mode });
    addLog("info", "MODO", live ? "Funcionamiento" : "Prueba");
  }
}

function toggleServo() {
  if (state.mode !== "test") {
    addLog("warn", "MODO", "Control manual bloqueado en modo funcionamiento.");
    return;
  }

  const current = state.servoAcceso;
  const open = current === 90;
  const angle = open ? 0 : 90;

  if (wsSend({ cmd: "servo", id: "acceso", angle })) {
    addLog("info", "CMD", `Servo acceso → ${angle}°`);
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
    reader: "pago",
    carro: el("rfid-car")?.value.trim() || "",
    marca: el("rfid-brand")?.value.trim() || "",
    placa: (el("rfid-plate")?.value.trim() || "").toUpperCase(),
    nombre: el("rfid-name")?.value.trim() || "",
    telefono: el("rfid-phone")?.value.trim() || "",
    saldo: el("rfid-balance")?.value.trim() || "",
    dni,
    tipoCarro: el("rfid-type")?.value || "Sedan"
  };

  const hasData = Object.entries(payload).some(([key, value]) => !["cmd", "reader"].includes(key) && String(value).trim());
  if (!hasData) {
    setWriteStatus("Completa al menos un campo antes de escribir.", "error");
    return;
  }

  if (wsSend(payload)) {
    setWriteStatus("Solicitud enviada. Acerca la tarjeta al RFID de pago…", "info");
    addLog("info", "RFID", `Datos enviados para escritura en pago${payload.placa ? ` · ${payload.placa}` : ""}.`);
  }
}

function aplicarFechaOperacion(fecha, notifyDevice = true) {
  const valor = /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ""))
    ? String(fecha)
    : obtenerFechaHoyISO();

  state.operationDate = valor;
  localStorage.setItem(STORAGE_SIM_DATE, valor);

  const input = el("sim-date-input");
  if (input && input.value !== valor) input.value = valor;

  tickSimulationClock();
  if (notifyDevice) enviarFechaOperacion(true);
}

function enviarFechaOperacion(log = true) {
  const enviado = wsSend({ cmd: "simulationDate", date: state.operationDate }, false);
  if (enviado && log) addLog("info", "FECHA", `Fecha de operación: ${state.operationDate}`);
}

function tickSimulationClock() {
  const ahora = new Date();
  const [year, month, day] = state.operationDate.split("-").map(Number);
  const fechaOperacion = new Date(
    year,
    month - 1,
    day,
    ahora.getHours(),
    ahora.getMinutes(),
    ahora.getSeconds()
  );

  const time = fechaOperacion.toLocaleTimeString("es-PE", { hour12: false });
  const date = fechaOperacion.toLocaleDateString("es-PE", {
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
  el("mode-btn-test")?.addEventListener("click", () => setMode("test"));
  el("mode-btn-live")?.addEventListener("click", () => setMode("live"));
  el("btn-servo-entry")?.addEventListener("click", toggleServo);
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

  el("sim-date-input")?.addEventListener("change", (event) => {
    aplicarFechaOperacion(event.target.value, true);
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
  const storedDate = localStorage.getItem(STORAGE_SIM_DATE) || obtenerFechaHoyISO();

  const wsInicial = window.location.protocol === "https:" && /^ws:\/\//i.test(storedWs || "")
    ? ""
    : storedWs || "";

  const defaultWs = normalizarWsUrl(wsInicial);

  if (el("esp32-ws-url")) el("esp32-ws-url").value = defaultWs;
  localStorage.setItem(STORAGE_WS_URL, defaultWs);

  bindEvents();
  setMode("test", false);
  setAutoScroll(true);
  updateRfidConnectionIndicators(0, 0);
  aplicarFechaOperacion(storedDate, false);

  state.clockTimer = setInterval(tickSimulationClock, 1000);
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
