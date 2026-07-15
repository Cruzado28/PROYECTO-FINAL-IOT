const STORAGE_WS_URL = "smartParkingEsp32WsUrl";
const STORAGE_SIM_DATE = "smartParkingOperationDate";
const STORAGE_LIVE_DASHBOARD = "smartParkingLiveDashboard";
const STORAGE_PAYMENTS = "smartParkingDailyPayments";
const STORAGE_PAYMENTS_BY_DATE = "smartParkingPaymentsByDate";
const STORAGE_HISTORY_BY_DATE = "smartParkingHistoryByDate";
const STORAGE_INCIDENTS_BY_DATE = "smartParkingIncidentsByDate";
const MAX_LOGS = 150;
const TOTAL_SPACES = 10;

const state = {
  initialized: false,
  active: false,
  socket: null,
  reconnectTimer: null,
  reconnectEnabled: true,
  mode: "live",
  servoAcceso: null,
  uid: null,
  lastReader: null,
  rfidReads: 0,
  rfidAcceso: 0,
  rfidPago: 0,
  logs: [],
  autoScroll: true,
  operationDate: obtenerFechaHoyISO(),
  clockTimer: null,
  devicesTimer: null,
  spaces: Array.from({ length: TOTAL_SPACES }, (_, index) => ({
    numero: index + 1,
    estado: "Libre",
    placa: "",
    uid: "",
    pago: 0,
    duracionMin: 0,
    incidencia: false
  }))
};

function el(id) {
  return document.getElementById(id);
}

function obtenerFechaHoyISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function ultimos3UID(uid = "") {
  const clean = String(uid || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return clean.length <= 3 ? clean || "---" : clean.slice(-3);
}

function obtenerGatewayWsUrl() {
  const protocolo = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocolo}//${window.location.host}/iot-ws?client=panel`;
}

function normalizarWsUrl(valor) {
  const texto = String(valor || "").trim();
  if (!texto || texto.toLowerCase() === "auto" || texto.toLowerCase() === "gateway") return obtenerGatewayWsUrl();
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
    } catch {}
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
    wsSend({ cmd: "mode", mode: "live" }, false);
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
  const open = numericAngle === 0;
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

function estadoLegible(estado = "") {
  const value = String(estado || "").toLowerCase();
  if (value.includes("pag")) return "Pagado";
  if (value.includes("incid")) return "Incidencia";
  if (value.includes("ocup") || value.includes("estacion") || value.includes("dentro")) return "Estacionado";
  return "Libre";
}

function claseEstadoEspacio(estado = "") {
  const value = estadoLegible(estado).toLowerCase();
  if (value.includes("pag")) return "paid";
  if (value.includes("incid")) return "incident";
  if (value.includes("estacion")) return "occupied";
  return "free";
}

function normalizarEspacio(item, index = 0) {
  const numero = Number(item.numero ?? item.espacio ?? item.id ?? index + 1) || index + 1;
  const uid = String(item.uid || "");
  const placa = String(item.placa || item.plate || (uid ? ultimos3UID(uid) : ""));
  const pago = Number(item.pago || 0);
  const incidencia = Boolean(item.incidencia) || /incid/i.test(String(item.estado || item.estadoSesion || item.status || ""));
  let estado = estadoLegible(item.estado || item.estadoSesion || item.status);

  // Si el ESP32 manda UID/placa pero el estado llega vacío, no debe verse verde.
  // Con UID activo se considera ocupado; si ya tiene pago, se considera pagado.
  if (estado === "Libre" && (uid || placa)) {
    estado = pago > 0 ? "Pagado" : "Estacionado";
  }
  if (incidencia) estado = "Incidencia";

  return {
    numero,
    estado,
    placa,
    uid,
    pago,
    duracionMin: Number(item.duracionMin || item.tiempoActualMinutos || 0),
    incidencia
  };
}


function crearEspaciosVacios() {
  return Array.from({ length: TOTAL_SPACES }, (_, index) => ({
    numero: index + 1,
    estado: "Libre",
    placa: "",
    uid: "",
    pago: 0,
    duracionMin: 0,
    incidencia: false
  }));
}

function leerObjetoStorage(clave, fallback = {}) {
  try {
    const raw = localStorage.getItem(clave);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function guardarObjetoStorage(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {}
}

function horaOperacionActual() {
  const ahora = new Date();
  return ahora.toLocaleTimeString("es-PE", { hour12: false });
}

function fechaLegibleDesdeISO(fechaISO = state.operationDate) {
  const partes = String(fechaISO || "").split("-");
  if (partes.length !== 3) return fechaISO || "—";
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function fechaHoraOperacion(data = {}) {
  const fecha = String(data.fechaOperacion || state.operationDate || obtenerFechaHoyISO());
  const hora = String(data.horaOperacion || data.hora || "").slice(0, 8) || horaOperacionActual();
  return { fechaISO: fecha, fecha: fechaLegibleDesdeISO(fecha), hora };
}

function claveSesion(data = {}) {
  const uid = String(data.uid || data.cardData?.uid || "").toUpperCase();
  const espacio = String(data.espacio || data.numeroEspacio || data.cardData?.espacio || "");
  const fecha = String(data.fechaOperacion || state.operationDate || obtenerFechaHoyISO());
  if (!uid && !espacio) return `${fecha}|sin-uid|${Date.now()}`;
  return `${fecha}|${uid || "UID"}|${espacio || "ESP"}`;
}

function leerHistorialFecha(fecha = state.operationDate) {
  const all = leerObjetoStorage(STORAGE_HISTORY_BY_DATE, {});
  return Array.isArray(all[fecha]) ? all[fecha] : [];
}

function guardarHistorialFecha(fecha, rows) {
  const all = leerObjetoStorage(STORAGE_HISTORY_BY_DATE, {});
  all[fecha] = Array.isArray(rows) ? rows.slice(-300) : [];
  guardarObjetoStorage(STORAGE_HISTORY_BY_DATE, all);
}

function leerIncidenciasFecha(fecha = state.operationDate) {
  const all = leerObjetoStorage(STORAGE_INCIDENTS_BY_DATE, {});
  return Array.isArray(all[fecha]) ? all[fecha] : [];
}

function guardarIncidenciasFecha(fecha, rows) {
  const all = leerObjetoStorage(STORAGE_INCIDENTS_BY_DATE, {});
  all[fecha] = Array.isArray(rows) ? rows.slice(-300) : [];
  guardarObjetoStorage(STORAGE_INCIDENTS_BY_DATE, all);
}

function leerPagosFecha(fecha = state.operationDate) {
  const all = leerObjetoStorage(STORAGE_PAYMENTS_BY_DATE, {});
  const data = all[fecha] || { total: 0, events: [] };
  return {
    total: Number(data.total || 0),
    events: Array.isArray(data.events) ? data.events : []
  };
}

function guardarPagosFecha(fecha, data) {
  const all = leerObjetoStorage(STORAGE_PAYMENTS_BY_DATE, {});
  all[fecha] = {
    total: Number(data.total || 0),
    events: (data.events || []).slice(-300)
  };
  guardarObjetoStorage(STORAGE_PAYMENTS_BY_DATE, all);
  // Compatibilidad con Dashboard previo: este storage siempre representa la fecha activa.
  if (fecha === state.operationDate) {
    localStorage.setItem(STORAGE_PAYMENTS, JSON.stringify(all[fecha]));
  }
}

function normalizarFilaHistorial(data = {}, estado = "Activa") {
  const fh = fechaHoraOperacion(data);
  const uid = String(data.uid || data.cardData?.uid || "").toUpperCase();
  const placa = String(data.placa || data.cardData?.placa || (uid ? ultimos3UID(uid) : "—")).toUpperCase();
  const espacio = Number(data.espacio || data.numeroEspacio || data.cardData?.espacio || 0) || "—";
  const duracionMin = Number(data.duracionMin || data.cardData?.duracionMin || 0);
  const pago = Number(data.pago || data.cardData?.pago || 0);
  return {
    key: claveSesion(data),
    fechaISO: fh.fechaISO,
    fecha: fh.fecha,
    ingreso: data.ingresoHora || data.horaIngreso || fh.hora,
    salida: data.salidaHora || data.horaSalida || "—",
    tiempoMin: duracionMin,
    tiempo: duracionMin > 0 ? `${duracionMin} min` : "—",
    conductor: "Registro automático",
    placa,
    uid,
    espacio,
    consumo: `S/ ${pago.toFixed(2)}`,
    descuento: "S/ 0.00",
    total: `S/ ${pago.toFixed(2)}`,
    pago,
    estado,
    detalle: data.message || "Registro generado por RFID"
  };
}

function upsertHistorial(data = {}, estado = "Activa") {
  const fecha = String(data.fechaOperacion || state.operationDate || obtenerFechaHoyISO());
  const rows = leerHistorialFecha(fecha);
  const key = claveSesion(data);
  const nuevo = normalizarFilaHistorial(data, estado);
  const index = rows.findIndex((row) => row.key === key);
  if (index >= 0) {
    const anterior = rows[index];
    rows[index] = {
      ...anterior,
      ...nuevo,
      ingreso: anterior.ingreso && anterior.ingreso !== "—" ? anterior.ingreso : nuevo.ingreso,
      salida: nuevo.salida !== "—" ? nuevo.salida : anterior.salida,
      tiempoMin: nuevo.tiempoMin || anterior.tiempoMin || 0,
      tiempo: nuevo.tiempoMin ? nuevo.tiempo : anterior.tiempo,
      pago: nuevo.pago || anterior.pago || 0,
      consumo: nuevo.pago ? nuevo.consumo : anterior.consumo,
      total: nuevo.pago ? nuevo.total : anterior.total,
      estado
    };
  } else {
    rows.push(nuevo);
  }
  guardarHistorialFecha(fecha, rows);
}

function registrarIncidenciaLocal(data = {}, tipo = "Incidencia") {
  const fh = fechaHoraOperacion(data);
  const uid = String(data.uid || data.cardData?.uid || "").toUpperCase();
  const placa = String(data.placa || data.cardData?.placa || (uid ? ultimos3UID(uid) : "—")).toUpperCase();
  const espacio = String(data.espacio || data.numeroEspacio || data.cardData?.espacio || "—");
  const tipoFinal = tipoIncidenciaLegible(data, tipo);
  const rows = leerIncidenciasFecha(fh.fechaISO);

  // La salida sin pago puede llegar como incidentStatus y accessStatus en el mismo segundo.
  // Se usa una llave por fecha + UID + espacio + tipo para que quede un solo registro claro.
  const key = [fh.fechaISO, uid || placa, espacio, tipoFinal].join("|");
  const existente = rows.findIndex((row) => row.key === key);
  const row = {
    key,
    fechaISO: fh.fechaISO,
    fecha: fh.fecha,
    hora: fh.hora,
    tipo: tipoFinal,
    placaUid: placa || uid || "—",
    detalle: data.message || "Intento de salida sin pago registrado por el lector de acceso",
    origen: data.lastReader || data.reader || "RFID de acceso"
  };
  if (existente >= 0) rows[existente] = { ...rows[existente], ...row };
  else rows.push(row);
  guardarIncidenciasFecha(fh.fechaISO, rows);
}

function restaurarFechaOperacionEnVivo() {
  // Cada fecha de operación trabaja como un día independiente. Si no hay sesiones en esa fecha, todo queda vacío.
  const rows = leerHistorialFecha(state.operationDate);
  const base = crearEspaciosVacios();
  for (const row of rows) {
    const numero = Number(row.espacio);
    if (!numero || numero < 1 || numero > TOTAL_SPACES) continue;
    if (/final/i.test(row.estado || "")) continue;
    base[numero - 1] = {
      numero,
      estado: /incid/i.test(row.estado || "") ? "Incidencia" : /pag/i.test(row.estado || "") ? "Pagado" : "Estacionado",
      placa: row.placa || (row.uid ? ultimos3UID(row.uid) : ""),
      uid: row.uid || "",
      pago: Number(row.pago || 0),
      duracionMin: Number(row.tiempoMin || 0),
      incidencia: /incid/i.test(row.estado || "")
    };
  }
  state.spaces = base;
  const pagos = leerPagosFecha(state.operationDate);
  localStorage.setItem(STORAGE_PAYMENTS, JSON.stringify(pagos));
  renderLiveSpaces();
}


function resumenLiveParaDashboard() {
  const spaces = state.spaces || [];
  const resumen = { total: TOTAL_SPACES, estacionados: 0, pagados: 0, incidencias: 0, libres: 0, activos: 0, promedioMin: 0, ingresosActuales: 0 };
  let sumaMin = 0;
  let conTiempo = 0;
  for (const space of spaces) {
    const cls = claseEstadoEspacio(space.estado);
    if (cls === "free") resumen.libres += 1;
    else if (cls === "paid") resumen.pagados += 1;
    else if (cls === "incident") resumen.incidencias += 1;
    else if (cls === "occupied") resumen.estacionados += 1;
    if (cls !== "free") resumen.activos += 1;
    if (Number(space.duracionMin) > 0) {
      sumaMin += Number(space.duracionMin);
      conTiempo += 1;
    }
    if (Number(space.pago) > 0) resumen.ingresosActuales += Number(space.pago);
  }
  resumen.promedioMin = conTiempo ? Math.round(sumaMin / conTiempo) : 0;
  try {
    const pagos = JSON.parse(localStorage.getItem(STORAGE_PAYMENTS) || "{}");
    resumen.ingresosDia = Number(pagos.total || resumen.ingresosActuales || 0);
  } catch {
    resumen.ingresosDia = resumen.ingresosActuales;
  }
  return resumen;
}

function publicarEstadoParaDashboard() {
  const payload = {
    spaces: state.spaces,
    resumen: resumenLiveParaDashboard(),
    fechaOperacion: state.operationDate,
    updatedAt: Date.now()
  };
  try { localStorage.setItem(STORAGE_LIVE_DASHBOARD, JSON.stringify(payload)); } catch {}
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "smartparking:live-dashboard", payload }, window.location.origin);
    }
  } catch {}
}

function registrarPagoLocalUnico(data = {}) {
  const ok = data.paymentStatus === "success" || data.paymentStatus === "ok" || data.paymentStatus === true;
  const pago = Number(data.pago || data.cardData?.pago || 0);
  if (!ok || pago <= 0) return;
  try {
    const fecha = String(data.fechaOperacion || state.operationDate || obtenerFechaHoyISO());
    const key = [fecha, data.uid || "", data.espacio || data.cardData?.espacio || "", pago.toFixed(2), data.duracionMin || data.cardData?.duracionMin || "", data.fechaHoraOperacion || data.horaOperacion || ""].join("|");
    const store = leerPagosFecha(fecha);
    const events = Array.isArray(store.events) ? store.events : [];
    if (events.some((event) => event.key === key)) return;
    const total = Number(store.total || 0) + pago;
    events.push({ key, pago, fecha, hora: new Date().toISOString(), placa: data.placa || data.cardData?.placa || ultimos3UID(data.uid || ""), espacio: data.espacio || data.cardData?.espacio || "—" });
    guardarPagosFecha(fecha, { total, events });
  } catch {}
}

function renderLiveSpaces() {
  const grid = el("live-spaces-grid");
  const summary = el("live-spaces-summary");
  if (!grid) return;

  const spaces = [...state.spaces].sort((a, b) => Number(a.numero) - Number(b.numero));
  const occupied = spaces.filter((s) => claseEstadoEspacio(s.estado) === "occupied").length;
  const paid = spaces.filter((s) => claseEstadoEspacio(s.estado) === "paid").length;
  const incident = spaces.filter((s) => claseEstadoEspacio(s.estado) === "incident").length;
  const free = spaces.length - occupied - paid - incident;

  if (summary) {
    summary.textContent = `${occupied} estacionado(s) · ${paid} pagado(s) · ${free} libre(s)${incident ? ` · ${incident} incidencia(s)` : ""}`;
  }

  grid.replaceChildren(...spaces.map((space) => {
    const estado = estadoLegible(space.estado);
    const cls = claseEstadoEspacio(estado);
    const placa = cls === "free" ? "LIBRE" : (space.placa || (space.uid ? ultimos3UID(space.uid) : "---"));
    const card = document.createElement("article");
    card.className = `live-space ${cls}`;

    const top = document.createElement("div");
    top.className = "live-space-top";
    const num = document.createElement("strong");
    num.textContent = String(space.numero).padStart(2, "0");
    const badge = document.createElement("span");
    badge.textContent = estado;
    top.append(num, badge);

    const plate = document.createElement("div");
    plate.className = "live-space-plate";
    plate.textContent = placa;

    const status = document.createElement("div");
    status.className = "live-space-status";
    status.innerHTML = `<span>Estado operativo</span><strong>${estado}</strong>`;

    const meta = document.createElement("small");
    const partes = [];
    if (space.uid) partes.push(`UID ${ultimos3UID(space.uid)}`);
    if (Number(space.duracionMin) > 0) partes.push(`${Number(space.duracionMin)} min`);
    if (Number(space.pago) > 0) partes.push(`S/ ${Number(space.pago).toFixed(2)}`);
    meta.textContent = partes.length ? partes.join(" · ") : "Sin vehículo";

    card.append(top, plate, status, meta);
    return card;
  }));
  publicarEstadoParaDashboard();
}

function actualizarEspaciosDesdeArray(spaces) {
  if (!Array.isArray(spaces)) return;
  const base = Array.from({ length: TOTAL_SPACES }, (_, index) => ({
    numero: index + 1,
    estado: "Libre",
    placa: "",
    uid: "",
    pago: 0,
    duracionMin: 0,
    incidencia: false
  }));
  for (const item of spaces) {
    const normal = normalizarEspacio(item);
    if (normal.numero >= 1 && normal.numero <= TOTAL_SPACES) base[normal.numero - 1] = normal;
  }
  state.spaces = base;
  renderLiveSpaces();
}

function actualizarEspacioPorEvento(data, estadoForzado = null) {
  const numero = Number(data.espacio || data.numeroEspacio || data.space || 0);
  if (!numero || numero < 1 || numero > TOTAL_SPACES) return;
  const current = state.spaces[numero - 1] || { numero };
  const uid = String(data.uid || current.uid || "");
  const placa = String(data.placa || data.cardData?.placa || current.placa || (uid ? ultimos3UID(uid) : ""));
  const estado = estadoForzado || data.estado || current.estado || "Libre";
  state.spaces[numero - 1] = {
    ...current,
    numero,
    estado: estadoLegible(estado),
    placa: estadoLegible(estado) === "Libre" ? "" : placa,
    uid: estadoLegible(estado) === "Libre" ? "" : uid,
    pago: Number(data.pago || current.pago || 0),
    duracionMin: Number(data.duracionMin || current.duracionMin || 0),
    incidencia: estadoLegible(estado) === "Incidencia" || Boolean(data.incidencia)
  };
  renderLiveSpaces();
}

function renderRfid(uid, cardData = {}, reader = "") {
  const container = el("rfid-result");
  if (!container) return;
  const placa = cardData?.placa || ultimos3UID(uid);
  container.className = "";
  container.replaceChildren();
  addDataRow(container, "Lector", nombreLector(reader));
  addDataRow(container, "UID", uid, "uid");
  addDataRow(container, "Placa automática", placa, "uid");
  addDataRow(container, "Hora", new Date().toLocaleTimeString("es-PE", { hour12: false }));
  addDataRow(container, "Fecha operación", state.operationDate);
  addDataRow(container, "Espacio", cardData?.espacio || "—");
  addDataRow(container, "Estado", cardData?.estadoSesion || cardData?.estado || "Lectura recibida");
  if (cardData?.pago !== undefined && Number(cardData.pago) > 0) addDataRow(container, "Último pago", `S/ ${Number(cardData.pago).toFixed(2)}`);
  addDataRow(container, "Lecturas", String(state.rfidReads));
}


function esEventoSalidaSinPago(data = {}) {
  const texto = [
    data.tipoAcceso,
    data.tipoIncidencia,
    data.estado,
    data.estadoSesion,
    data.cardData?.estadoSesion,
    data.message,
    data.detalle
  ].map((v) => String(v || '').toLowerCase()).join(' ');
  return /salida[_\s-]*sin[_\s-]*pago|sin[_\s-]*pago|debe pagar|pagar primero|pago pendiente|incidencia/.test(texto);
}

function tipoIncidenciaLegible(data = {}, fallback = "Incidencia") {
  const raw = String(data.tipoIncidencia || data.tipoAcceso || data.tipo || fallback || '').toLowerCase();
  const msg = String(data.message || data.detalle || '').toLowerCase();
  if (raw.includes('salida_sin_pago') || raw.includes('sin_pago') || msg.includes('debe pagar') || msg.includes('sin pago')) return 'Salida sin pago';
  if (raw.includes('doble') || msg.includes('doble')) return 'Doble ingreso';
  if (raw.includes('venc')) return 'Salida vencida';
  return fallback;
}

function handleAccessStatus(data) {
  const status = data.accessStatus ?? data.entryStatus ?? data.exitStatus;
  if (!status) return;
  const tipo = String(data.tipoAcceso || data.tipo || "").toLowerCase();
  const ok = status === "success" || status === "ok" || status === true;
  const salidaSinPago = !ok && esEventoSalidaSinPago(data);
  const tag = tipo.includes("salida") || salidaSinPago ? "SALIDA" : tipo.includes("entrada") ? "ENTRADA" : "ACCESO";
  addLog(ok ? "ok" : "error", tag, data.message || (ok ? "Acceso autorizado." : "Acceso rechazado."));

  if (ok && tipo.includes("entrada")) {
    upsertHistorial(data, "Estacionado");
    actualizarEspacioPorEvento(data, "Estacionado");
  }
  else if (ok && tipo.includes("salida")) {
    upsertHistorial({ ...data, salidaHora: fechaHoraOperacion(data).hora }, "Finalizada");
    actualizarEspacioPorEvento(data, "Libre");
  }
  else if (salidaSinPago || (!ok && (tipo.includes("sin_pago") || tipo.includes("incid")))) {
    const incidente = { ...data, tipoIncidencia: data.tipoIncidencia || "salida_sin_pago", incidencia: true };
    upsertHistorial(incidente, "Incidencia");
    registrarIncidenciaLocal(incidente, "Salida sin pago");
    actualizarEspacioPorEvento(incidente, "Incidencia");
  }
}

function handleIncidentStatus(data) {
  const status = data.incidentStatus ?? data.incidenciaStatus;
  if (!status) return;
  const tipo = tipoIncidenciaLegible(data, "Incidencia");
  addLog("error", "INCIDENCIA", data.message || "Incidencia registrada para reportes.");
  upsertHistorial({ ...data, incidencia: true }, "Incidencia");
  registrarIncidenciaLocal(data, tipo);
  actualizarEspacioPorEvento({ ...data, incidencia: true }, "Incidencia");
}

function handlePaymentStatus(data) {
  if (data.paymentStatus === undefined) return;
  const ok = data.paymentStatus === "success" || data.paymentStatus === "ok" || data.paymentStatus === true;
  const pagoNumero = Number(data.pago || 0);
  const duracionNumero = Number(data.duracionMin || 0);
  const pagoTexto = ok ? ` Pago: S/ ${pagoNumero.toFixed(2)}` : "";
  const duracionTexto = ok && data.duracionMin !== undefined ? ` · ${duracionNumero} min` : "";
  addLog(ok ? "ok" : "error", "PAGO", `${data.message || (ok ? "Pago aplicado por tiempo." : "Pago rechazado.")}${pagoTexto}${duracionTexto}`);
  registrarPagoLocalUnico(data);
  if (ok) {
    upsertHistorial(data, "Pagado");
    actualizarEspacioPorEvento(data, "Pagado");
  }
}

function syncModeFromDevice(mode) {
  if (mode !== undefined) setMode("live", false);
}

function handleState(data) {
  if (!data || typeof data !== "object") return;
  if (data.gateway === true) return;

  handleAccessStatus(data);
  handleIncidentStatus(data);
  handlePaymentStatus(data);
  if (data.cmdStatus === "blocked") addLog("warn", "MODO", data.message || "Comando bloqueado.");
  if (data.mode !== undefined) syncModeFromDevice(data.mode);
  if (data.fechaOperacion || data.operationDate) aplicarFechaOperacion(data.fechaOperacion || data.operationDate, false);

  if (Array.isArray(data.spaces) || Array.isArray(data.espacios)) {
    actualizarEspaciosDesdeArray(data.spaces || data.espacios);
  }

  if (data.rfidAcceso !== undefined || data.rfidPago !== undefined || data.rfidEntrada !== undefined || data.rfidSalida !== undefined) {
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
      renderRfid(state.uid, data.cardData || data, incomingReader);
      addLog("ok", "RFID", `Tarjeta detectada en ${nombreLector(incomingReader)} · placa ${data.cardData?.placa || data.placa || ultimos3UID(incomingUid)}`);
    }
  }
}

function setMode(mode, notifyDevice = true) {
  state.mode = "live";
  const page = document.querySelector(".sensor-page-wrap");
  const subtitle = el("mode-switch-sub");
  const banner = el("mode-banner");

  page?.classList.add("operational-mode");
  page?.classList.add("manual-locked");

  if (subtitle) subtitle.textContent = "Funcionamiento operativo";
  if (banner) {
    banner.className = "mode-banner live";
    banner.innerHTML = '<i class="ti ti-player-play"></i><span>Funcionamiento activo: entrada/salida por RFID de acceso, pago por tiempo en RFID de pago y espacios actualizados con placa y estado.</span>';
  }

  if (notifyDevice) {
    wsSend({ cmd: "mode", mode: "live" });
  }
}

function toggleServo() {
  addLog("warn", "SERVO", "Control manual deshabilitado. La barrera funciona automáticamente con el RFID de acceso.");
}

function aplicarFechaOperacion(fecha, notifyDevice = true) {
  const valor = /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || "")) ? String(fecha) : obtenerFechaHoyISO();
  const cambioFecha = state.operationDate !== valor;
  state.operationDate = valor;
  localStorage.setItem(STORAGE_SIM_DATE, valor);
  const input = el("sim-date-input");
  if (input && input.value !== valor) input.value = valor;
  tickSimulationClock();
  if (cambioFecha) {
    state.logs = [];
    renderLogs();
    restaurarFechaOperacionEnVivo();
    addLog("info", "FECHA", `Fecha cambiada a ${valor}. Registros del día cargados por separado.`);
  }
  if (notifyDevice) enviarFechaOperacion(true);
}

function enviarFechaOperacion(log = true) {
  const enviado = wsSend({ cmd: "simulationDate", date: state.operationDate }, false);
  if (enviado && log) addLog("info", "FECHA", `Fecha de operación: ${state.operationDate}`);
}

function tickSimulationClock() {
  const ahora = new Date();
  const [year, month, day] = state.operationDate.split("-").map(Number);
  const fechaOperacion = new Date(year, month - 1, day, ahora.getHours(), ahora.getMinutes(), ahora.getSeconds());
  if (el("sim-clock")) el("sim-clock").textContent = fechaOperacion.toLocaleTimeString("es-PE", { hour12: false });
  if (el("sim-date")) {
    el("sim-date").textContent = fechaOperacion.toLocaleDateString("es-PE", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }
}

async function cargarResumenIot() {
  try {
    const res = await fetch("/api/v2/iot/resumen");
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.mensaje || "Error IoT");
    const r = data.resumen;
    if (el("iot-total")) el("iot-total").textContent = r.totalDispositivos ?? "—";
    if (el("iot-online")) el("iot-online").textContent = r.dispositivosOnline ?? "—";
    if (el("iot-offline")) el("iot-offline").textContent = r.dispositivosOffline ?? "—";
    if (el("iot-latency")) el("iot-latency").textContent = `${r.latenciaPromedioMs ?? "—"} ms`;
  } catch {
    // No bloquea la operación en vivo.
  }
}

function dispositivoVisible(d = {}) {
  const text = `${d.nombre || ""} ${d.tipoDispositivo || ""} ${d.codigo || ""}`.toLowerCase();
  return !/(cam|camera|esp32-cam|potenci|laser|láser|ldr|oled.*salida|servo.*salida)/i.test(text);
}

async function cargarDispositivosIot() {
  const grid = el("devices-grid");
  if (!grid) return;
  try {
    const res = await fetch("/api/v2/iot/dispositivos");
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.mensaje || "Error dispositivos");
    const dispositivos = (data.dispositivos || []).filter(dispositivoVisible);
    grid.innerHTML = dispositivos.length ? dispositivos.map((d) => `
      <article class="device-card">
        <div class="device-card-head"><strong>${d.nombre || d.codigo}</strong><span class="status-badge ${d.estado === "Online" ? "online" : d.estado === "Advertencia" ? "warn" : "offline"}">${d.estado || "Sin estado"}</span></div>
        <small>${d.codigo || "—"} · ${d.tipoDispositivo || "Dispositivo"}</small>
        <div class="device-meta"><span>Ubicación</span><strong>${d.ubicacion || "—"}</strong></div>
        <div class="device-meta"><span>Conexión</span><strong>${d.tipoConexion || "—"}</strong></div>
        <div class="device-meta"><span>Señal</span><strong>${d.intensidadSenal ?? 0}%</strong></div>
        <div class="device-meta"><span>Última lectura</span><strong>${d.ultimaLectura || "—"}</strong></div>
      </article>
    `).join("") : '<div class="empty-state">No existen dispositivos activos para la maqueta actual.</div>';
  } catch {
    grid.innerHTML = '<div class="empty-state">No se pudieron cargar los dispositivos.</div>';
  }
}

async function cargarLogsIot() {
  const grid = el("iot-logs");
  if (!grid) return;
  try {
    const res = await fetch("/api/v2/iot/logs?limite=8");
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.mensaje || "Error logs");
    const logs = data.logs || [];
    grid.innerHTML = logs.length ? logs.map((log) => `
      <div class="iot-log-row">
        <strong>${log.codigoEvento || log.nivel || "LOG"}</strong>
        <span>${log.mensaje || "Sin mensaje"}</span>
        <small>${log.fechaHora || "—"}</small>
      </div>
    `).join("") : '<div class="empty-state">No hay logs almacenados.</div>';
  } catch {
    grid.innerHTML = '<div class="empty-state">No se pudieron cargar los logs.</div>';
  }
}

async function cargarDatosAuxiliares() {
  await Promise.all([cargarResumenIot(), cargarDispositivosIot(), cargarLogsIot()]);
}

function bindEvents() {
  el("btn-esp32-reconnect")?.addEventListener("click", () => conectarESP32(true));
  // No hay modo prueba: el sistema queda siempre en funcionamiento operativo.
  el("btn-servo-entry")?.addEventListener("click", toggleServo);
  el("btn-log-clear")?.addEventListener("click", () => { state.logs = []; renderLogs(); });
  el("btn-log-auto")?.addEventListener("click", () => setAutoScroll(!state.autoScroll));
  el("refresh-iot")?.addEventListener("click", cargarDatosAuxiliares);

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

  el("sim-date-input")?.addEventListener("change", (event) => aplicarFechaOperacion(event.target.value, true));
}

export function inicializarSensoresEnVivo() {
  if (state.initialized) return;
  state.initialized = true;
  const storedWs = localStorage.getItem(STORAGE_WS_URL);
  const storedDate = localStorage.getItem(STORAGE_SIM_DATE) || obtenerFechaHoyISO();
  const wsInicial = window.location.protocol === "https:" && /^ws:\/\//i.test(storedWs || "") ? "" : storedWs || "";
  const defaultWs = normalizarWsUrl(wsInicial);

  if (el("esp32-ws-url")) el("esp32-ws-url").value = defaultWs;
  localStorage.setItem(STORAGE_WS_URL, defaultWs);

  bindEvents();
  setMode("live", false);
  setAutoScroll(true);
  updateRfidConnectionIndicators(0, 0);
  aplicarFechaOperacion(storedDate, false);
  restaurarFechaOperacionEnVivo();
  cargarDatosAuxiliares();

  state.clockTimer = setInterval(tickSimulationClock, 1000);
  state.devicesTimer = setInterval(cargarDatosAuxiliares, 30000);
}

export function activarSensoresEnVivo() {
  inicializarSensoresEnVivo();
  state.active = true;
  if (!state.socket || state.socket.readyState === WebSocket.CLOSED) conectarESP32(false);
}

export function detenerSensoresEnVivo() {
  state.active = false;
  state.reconnectEnabled = false;
  closeSocket();
  setConnectionStatus("offline", "Conexión detenida.");
}


export function aplicarCamaraGuardada() {
  // Compatibilidad con versiones anteriores: la ESP32-CAM ya fue retirada del proyecto.
}
