import { apiFetch, leerJson } from "./api.js";

const TOTAL_SPACES = 10;
const STORAGE_LIVE_STATE = "smartParkingLiveDashboard";
const STORAGE_PAYMENTS = "smartParkingDailyPayments";
const STORAGE_PAYMENTS_BY_DATE = "smartParkingPaymentsByDate";
const STORAGE_HISTORY_BY_DATE = "smartParkingHistoryByDate";
const STORAGE_INCIDENTS_BY_DATE = "smartParkingIncidentsByDate";
const STORAGE_SIM_DATE = "smartParkingOperationDate";
let dashboardSocket = null;
let dashboardSocketStarted = false;
let reconnectTimer = null;

const dashboardState = {
  spaces: Array.from({ length: TOTAL_SPACES }, (_, index) => ({
    numero: index + 1,
    estado: "Libre",
    placa: "",
    uid: "",
    pago: 0,
    duracionMin: 0,
    incidencia: false
  })),
  ingresosDia: 0,
  payments: [],
  fechaOperacion: fechaOperacionActiva()
};

function byId(id) {
  return document.getElementById(id);
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function fechaHoyISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function fechaOperacionActiva() {
  return localStorage.getItem(STORAGE_SIM_DATE) || fechaHoyISO();
}

function fechaLegibleDesdeISO(fechaISO = fechaOperacionActiva()) {
  const parts = String(fechaISO || '').split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : (fechaISO || '—');
}

function horaActualOperacion() {
  return new Date().toLocaleTimeString('es-PE', { hour12: false });
}

function fechaHoraOperacion(data = {}) {
  const fechaISO = String(data.fechaOperacion || dashboardState.fechaOperacion || fechaOperacionActiva());
  const hora = String(data.horaOperacion || data.hora || '').slice(0, 8) || horaActualOperacion();
  return { fechaISO, fecha: fechaLegibleDesdeISO(fechaISO), hora };
}

function espaciosVacios() {
  return Array.from({ length: TOTAL_SPACES }, (_, index) => ({
    numero: index + 1,
    estado: 'Libre',
    placa: '',
    uid: '',
    pago: 0,
    duracionMin: 0,
    incidencia: false
  }));
}

function esEventoSalidaSinPago(data = {}) {
  const texto = [data.tipoAcceso, data.tipoIncidencia, data.estado, data.estadoSesion, data.cardData?.estadoSesion, data.message, data.detalle]
    .map((v) => String(v || '').toLowerCase()).join(' ');
  return /salida[_\s-]*sin[_\s-]*pago|sin[_\s-]*pago|debe pagar|pagar primero|pago pendiente|incidencia/.test(texto);
}

function tipoIncidenciaLegible(data = {}, fallback = 'Incidencia') {
  const raw = String(data.tipoIncidencia || data.tipoAcceso || data.tipo || fallback || '').toLowerCase();
  const msg = String(data.message || data.detalle || '').toLowerCase();
  if (raw.includes('salida_sin_pago') || raw.includes('sin_pago') || msg.includes('debe pagar') || msg.includes('sin pago')) return 'Salida sin pago';
  if (raw.includes('doble') || msg.includes('doble')) return 'Doble ingreso';
  if (raw.includes('venc')) return 'Salida vencida';
  return fallback;
}

function claveSesion(data = {}) {
  const uid = String(data.uid || data.cardData?.uid || '').toUpperCase();
  const espacio = String(data.espacio || data.numeroEspacio || data.cardData?.espacio || '');
  const fecha = String(data.fechaOperacion || dashboardState.fechaOperacion || fechaOperacionActiva());
  return `${fecha}|${uid || 'UID'}|${espacio || 'ESP'}`;
}

function leerHistorialFecha(fecha = dashboardState.fechaOperacion) {
  const all = readJsonStorage(STORAGE_HISTORY_BY_DATE, {});
  return Array.isArray(all[fecha]) ? all[fecha] : [];
}

function guardarHistorialFecha(fecha, rows) {
  const all = readJsonStorage(STORAGE_HISTORY_BY_DATE, {});
  all[fecha] = Array.isArray(rows) ? rows.slice(-300) : [];
  writeJsonStorage(STORAGE_HISTORY_BY_DATE, all);
}

function leerIncidenciasFecha(fecha = dashboardState.fechaOperacion) {
  const all = readJsonStorage(STORAGE_INCIDENTS_BY_DATE, {});
  return Array.isArray(all[fecha]) ? all[fecha] : [];
}

function guardarIncidenciasFecha(fecha, rows) {
  const all = readJsonStorage(STORAGE_INCIDENTS_BY_DATE, {});
  all[fecha] = Array.isArray(rows) ? rows.slice(-300) : [];
  writeJsonStorage(STORAGE_INCIDENTS_BY_DATE, all);
}

function normalizarFilaHistorial(data = {}, estado = 'Activa') {
  const fh = fechaHoraOperacion(data);
  const uid = String(data.uid || data.cardData?.uid || '').toUpperCase();
  const placa = String(data.placa || data.cardData?.placa || (uid ? ultimos3UID(uid) : '—')).toUpperCase();
  const duracionMin = Number(data.duracionMin || data.cardData?.duracionMin || 0);
  const pago = Number(data.pago || data.cardData?.pago || 0);
  return {
    key: claveSesion(data),
    fechaISO: fh.fechaISO,
    fecha: fh.fecha,
    ingreso: data.ingresoHora || data.horaIngreso || fh.hora,
    salida: data.salidaHora || data.horaSalida || '—',
    tiempoMin: duracionMin,
    tiempo: duracionMin > 0 ? `${duracionMin} min` : '—',
    conductor: 'Registro automático',
    placa,
    uid,
    espacio: Number(data.espacio || data.numeroEspacio || data.cardData?.espacio || 0) || '—',
    consumo: `S/ ${pago.toFixed(2)}`,
    descuento: 'S/ 0.00',
    total: `S/ ${pago.toFixed(2)}`,
    pago,
    estado,
    detalle: data.message || 'Registro generado por RFID'
  };
}

function upsertHistorialLocal(data = {}, estado = 'Activa') {
  const fecha = String(data.fechaOperacion || dashboardState.fechaOperacion || fechaOperacionActiva());
  const rows = leerHistorialFecha(fecha);
  const key = claveSesion(data);
  const nuevo = normalizarFilaHistorial(data, estado);
  const index = rows.findIndex((row) => row.key === key);
  if (index >= 0) {
    const anterior = rows[index];
    rows[index] = {
      ...anterior,
      ...nuevo,
      ingreso: anterior.ingreso && anterior.ingreso !== '—' ? anterior.ingreso : nuevo.ingreso,
      salida: nuevo.salida !== '—' ? nuevo.salida : anterior.salida,
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

function registrarIncidenciaLocal(data = {}, tipo = 'Incidencia') {
  const fh = fechaHoraOperacion(data);
  const uid = String(data.uid || data.cardData?.uid || '').toUpperCase();
  const placa = String(data.placa || data.cardData?.placa || (uid ? ultimos3UID(uid) : '—')).toUpperCase();
  const espacio = String(data.espacio || data.numeroEspacio || data.cardData?.espacio || '—');
  const tipoFinal = tipoIncidenciaLegible(data, tipo);
  const rows = leerIncidenciasFecha(fh.fechaISO);
  const key = [fh.fechaISO, uid || placa, espacio, tipoFinal].join('|');
  const row = {
    key, fechaISO: fh.fechaISO, fecha: fh.fecha, hora: fh.hora, tipo: tipoFinal,
    placaUid: placa || uid || '—',
    detalle: data.message || 'Intento de salida sin pago registrado por el lector de acceso',
    origen: data.lastReader || data.reader || 'RFID de acceso'
  };
  const index = rows.findIndex((item) => item.key === key);
  if (index >= 0) rows[index] = { ...rows[index], ...row };
  else rows.push(row);
  guardarIncidenciasFecha(fh.fechaISO, rows);
}

function enviarFechaOperacionAlESP32() {
  if (!dashboardSocket || dashboardSocket.readyState !== WebSocket.OPEN) return;
  try { dashboardSocket.send(JSON.stringify({ cmd: 'simulationDate', date: dashboardState.fechaOperacion })); } catch {}
}

function duracion(minutos) {
  const total = Math.max(0, Number(minutos) || 0);
  const horas = Math.floor(total / 60);
  const restantes = total % 60;
  if (horas === 0) return `${restantes}m`;
  return `${horas}h ${String(restantes).padStart(2, "0")}m`;
}

function ultimos3UID(uid = "") {
  const limpio = String(uid || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return limpio.length <= 3 ? limpio || "---" : limpio.slice(-3);
}

function estadoLegible(estado = "") {
  const value = String(estado || "").toLowerCase();
  if (value.includes("pag")) return "Pagado";
  if (value.includes("incid")) return "Incidencia";
  if (value.includes("ocup") || value.includes("estacion") || value.includes("dentro")) return "Estacionado";
  if (value.includes("manten")) return "Mantenimiento";
  return "Libre";
}

function estadoClase(estado) {
  const valor = estadoLegible(estado).toLowerCase();
  if (valor.includes("pag")) return "paid";
  if (valor.includes("incid")) return "incident";
  if (valor.includes("estacion")) return "occupied";
  if (valor.includes("manten")) return "maintenance";
  return "free";
}

function normalizarEspacio(item = {}, index = 0) {
  const numero = Number(item.numero ?? item.espacio ?? item.id ?? index + 1) || index + 1;
  const uid = String(item.uid || "").toUpperCase();
  let placa = String(item.placa || item.plate || "").toUpperCase();
  if (!placa && uid) placa = ultimos3UID(uid);
  const pago = Number(item.pago || 0);
  const incidencia = Boolean(item.incidencia) || /incid/i.test(String(item.estado || item.estadoSesion || item.status || ""));
  let estado = estadoLegible(item.estado || item.estadoSesion || item.status);
  if (estado === "Libre" && (uid || placa)) estado = pago > 0 ? "Pagado" : "Estacionado";
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

function resumenDesdeEspacios(spaces = dashboardState.spaces) {
  const resumen = {
    total: TOTAL_SPACES,
    estacionados: 0,
    pagados: 0,
    incidencias: 0,
    libres: 0,
    activos: 0,
    promedioMin: 0,
    ingresosActuales: 0
  };
  let sumaMin = 0;
  let conTiempo = 0;
  spaces.forEach((s) => {
    const cls = estadoClase(s.estado);
    if (cls === "free") resumen.libres += 1;
    else if (cls === "paid") resumen.pagados += 1;
    else if (cls === "incident") resumen.incidencias += 1;
    else if (cls === "occupied") resumen.estacionados += 1;
    if (cls !== "free" && cls !== "maintenance") resumen.activos += 1;
    if (Number(s.duracionMin) > 0) {
      sumaMin += Number(s.duracionMin);
      conTiempo += 1;
    }
    if (Number(s.pago) > 0) resumen.ingresosActuales += Number(s.pago);
  });
  resumen.promedioMin = conTiempo ? Math.round(sumaMin / conTiempo) : 0;
  return resumen;
}

function leerPagosGuardados(fecha = dashboardState.fechaOperacion) {
  const byDate = readJsonStorage(STORAGE_PAYMENTS_BY_DATE, {});
  const data = byDate[fecha] || (fecha === fechaOperacionActiva() ? readJsonStorage(STORAGE_PAYMENTS, { total: 0, events: [] }) : { total: 0, events: [] });
  return {
    total: Number(data.total || 0),
    events: Array.isArray(data.events) ? data.events : []
  };
}

function guardarPagos(data, fecha = dashboardState.fechaOperacion) {
  const byDate = readJsonStorage(STORAGE_PAYMENTS_BY_DATE, {});
  byDate[fecha] = {
    total: Number(data.total || 0),
    events: (data.events || []).slice(-300)
  };
  writeJsonStorage(STORAGE_PAYMENTS_BY_DATE, byDate);
  if (fecha === dashboardState.fechaOperacion) {
    localStorage.setItem(STORAGE_PAYMENTS, JSON.stringify(byDate[fecha]));
  }
}

function registrarPagoUnico(data = {}) {
  const ok = data.paymentStatus === "success" || data.paymentStatus === "ok" || data.paymentStatus === true;
  const pago = Number(data.pago || data.cardData?.pago || 0);
  if (!ok || pago <= 0) return;
  const fecha = String(data.fechaOperacion || dashboardState.fechaOperacion || "");
  const key = [fecha, data.uid || "", data.espacio || "", pago.toFixed(2), data.duracionMin || "", data.fechaHoraOperacion || ""].join("|");
  const pagos = leerPagosGuardados(fecha);
  if (pagos.events.some((e) => e.key === key)) return;
  pagos.total = Number(pagos.total || 0) + pago;
  pagos.events.push({ key, pago, fecha, hora: new Date().toISOString() });
  guardarPagos(pagos, fecha);
  upsertHistorialLocal(data, "Pagado");
  dashboardState.ingresosDia = pagos.total;
  dashboardState.payments = pagos.events;
}

function guardarEstadoLive() {
  try {
    const resumen = resumenDesdeEspacios();
    const pagos = leerPagosGuardados(fecha);
    const payload = {
      spaces: dashboardState.spaces,
      resumen: {
        ...resumen,
        ingresosDia: pagos.total || dashboardState.ingresosDia || resumen.ingresosActuales
      },
      fechaOperacion: dashboardState.fechaOperacion,
      updatedAt: Date.now()
    };
    localStorage.setItem(STORAGE_LIVE_STATE, JSON.stringify(payload));
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "smartparking:live-dashboard", payload }, window.location.origin);
    }
  } catch {
    // No bloquear dashboard por localStorage.
  }
}

function leerEstadoLiveGuardado() {
  try {
    const raw = localStorage.getItem(STORAGE_LIVE_STATE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.spaces)) return null;
    if (parsed.fechaOperacion && parsed.fechaOperacion !== dashboardState.fechaOperacion) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setText(id, value) {
  const node = byId(id);
  if (node) node.textContent = value;
}

function renderDashboardLive() {
  const resumen = resumenDesdeEspacios();
  const pagos = leerPagosGuardados(fecha);
  const ingresos = Number(pagos.total || dashboardState.ingresosDia || resumen.ingresosActuales || 0);

  setText("stat-total", resumen.total);
  setText("stat-occupied", resumen.activos);
  setText("stat-free", resumen.libres);
  setText("stat-average", duracion(resumen.promedioMin));
  setText("spaces-summary", `${resumen.estacionados} estacionado(s) · ${resumen.pagados} pagado(s) · ${resumen.libres} libre(s)${resumen.incidencias ? ` · ${resumen.incidencias} incidencia(s)` : ""}`);
  setText("vehicles-summary", `${resumen.activos} activos · actualizado ahora`);

  const grid = byId("spaces-grid");
  if (grid) {
    const spaces = [...dashboardState.spaces].sort((a, b) => Number(a.numero) - Number(b.numero));
    grid.innerHTML = spaces.map((space) => {
      const cls = estadoClase(space.estado);
      const estado = estadoLegible(space.estado);
      const placa = cls === "free" ? "Libre" : (space.placa || (space.uid ? ultimos3UID(space.uid) : "---"));
      const meta = cls === "free" ? "Sin vehículo" : `${estado}${Number(space.pago) > 0 ? ` · S/ ${Number(space.pago).toFixed(2)}` : ""}`;
      return `
        <div class="space-cell ${cls}" title="${estado}">
          <span class="dot"></span>
          <strong>${String(space.numero).padStart(2, "0")}</strong>
          <b class="space-plate">${placa}</b>
          <span>${meta}</span>
        </div>`;
    }).join("");
  }

  const lista = byId("vehicle-list");
  if (lista) {
    const activos = dashboardState.spaces.filter((s) => estadoClase(s.estado) !== "free" && estadoClase(s.estado) !== "maintenance");
    lista.innerHTML = activos.length ? activos.map((e) => `
      <div class="vehicle-item">
        <div class="vehicle-space">${String(e.numero).padStart(2, "0")}</div>
        <div class="vehicle-info"><strong>${e.placa || ultimos3UID(e.uid)}</strong><span>${estadoLegible(e.estado)} · UID ${ultimos3UID(e.uid)}</span></div>
        <div class="vehicle-time"><strong>${duracion(e.duracionMin)}</strong><span>${Number(e.pago) > 0 ? `S/ ${Number(e.pago).toFixed(2)}` : "Pendiente"}</span></div>
      </div>
    `).join("") : '<div class="empty-state">No hay vehículos dentro del estacionamiento.</div>';
  }

  guardarEstadoLive();
}

function aplicarEspacios(spaces) {
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
  spaces.forEach((item, index) => {
    const normal = normalizarEspacio(item, index);
    if (normal.numero >= 1 && normal.numero <= TOTAL_SPACES) base[normal.numero - 1] = normal;
  });
  dashboardState.spaces = base;
  renderDashboardLive();
}

function aplicarEventoEspacio(data = {}, estadoForzado = null) {
  const numero = Number(data.espacio || data.numeroEspacio || data.space || data.cardData?.espacio || 0);
  if (!numero || numero < 1 || numero > TOTAL_SPACES) return;
  const current = dashboardState.spaces[numero - 1] || { numero };
  const uid = String(data.uid || current.uid || "").toUpperCase();
  const placa = String(data.placa || data.cardData?.placa || current.placa || (uid ? ultimos3UID(uid) : "")).toUpperCase();
  const estado = estadoForzado || data.estado || data.estadoSesion || current.estado || "Libre";
  const finalEstado = estadoLegible(estado);
  dashboardState.spaces[numero - 1] = {
    ...current,
    numero,
    estado: finalEstado,
    placa: finalEstado === "Libre" ? "" : placa,
    uid: finalEstado === "Libre" ? "" : uid,
    pago: finalEstado === "Libre" ? 0 : Number(data.pago || data.cardData?.pago || current.pago || 0),
    duracionMin: finalEstado === "Libre" ? 0 : Number(data.duracionMin || data.cardData?.duracionMin || current.duracionMin || 0),
    incidencia: finalEstado === "Incidencia" || Boolean(data.incidencia)
  };
  renderDashboardLive();
}

function manejarMensajeLive(data = {}) {
  if (!data || typeof data !== "object" || data.gateway === true) return;

  const fechaEvento = data.fechaOperacion || dashboardState.fechaOperacion;
  if (fechaEvento) {
    dashboardState.fechaOperacion = String(fechaEvento);
    localStorage.setItem(STORAGE_SIM_DATE, dashboardState.fechaOperacion);
    syncDashboardDateInputs();
  }

  registrarPagoUnico(data);

  if (Array.isArray(data.spaces) || Array.isArray(data.espacios)) {
    aplicarEspacios(data.spaces || data.espacios);
  }

  if (data.accessStatus !== undefined) {
    const tipo = String(data.tipoAcceso || "").toLowerCase();
    const ok = data.accessStatus === "success" || data.accessStatus === "ok" || data.accessStatus === true;
    const salidaSinPago = !ok && esEventoSalidaSinPago(data);
    if (ok && tipo.includes("entrada")) {
      upsertHistorialLocal(data, "Estacionado");
      aplicarEventoEspacio(data, "Estacionado");
    }
    else if (ok && tipo.includes("salida")) {
      upsertHistorialLocal({ ...data, salidaHora: fechaHoraOperacion(data).hora }, "Finalizada");
      aplicarEventoEspacio(data, "Libre");
    }
    else if (salidaSinPago || (!ok && (tipo.includes("sin_pago") || tipo.includes("incid")))) {
      const incidente = { ...data, tipoIncidencia: data.tipoIncidencia || "salida_sin_pago", incidencia: true };
      upsertHistorialLocal(incidente, "Incidencia");
      registrarIncidenciaLocal(incidente, "Salida sin pago");
      aplicarEventoEspacio(incidente, "Incidencia");
    }
  }

  if (data.incidentStatus !== undefined || data.incidenciaStatus !== undefined) {
    const incidente = { ...data, incidencia: true };
    upsertHistorialLocal(incidente, "Incidencia");
    registrarIncidenciaLocal(incidente, tipoIncidenciaLegible(data, "Incidencia"));
    aplicarEventoEspacio(incidente, "Incidencia");
  }

  if (data.paymentStatus !== undefined) {
    const ok = data.paymentStatus === "success" || data.paymentStatus === "ok" || data.paymentStatus === true;
    if (ok) {
      upsertHistorialLocal(data, "Pagado");
      aplicarEventoEspacio(data, "Pagado");
    }
  }
}

function obtenerWsUrl() {
  const protocolo = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocolo}//${window.location.host}/iot-ws?client=panel&view=dashboard`;
}

function iniciarDashboardSocket() {
  if (dashboardSocketStarted) return;
  dashboardSocketStarted = true;

  const conectar = () => {
    clearTimeout(reconnectTimer);
    try {
      dashboardSocket = new WebSocket(obtenerWsUrl());
    } catch {
      reconnectTimer = setTimeout(conectar, 4000);
      return;
    }

    dashboardSocket.onopen = () => {
      enviarFechaOperacionAlESP32();
    };

    dashboardSocket.onmessage = (event) => {
      try {
        manejarMensajeLive(JSON.parse(event.data));
      } catch {
        // Ignorar mensajes no JSON.
      }
    };
    dashboardSocket.onclose = () => {
      reconnectTimer = setTimeout(conectar, 4000);
    };
    dashboardSocket.onerror = () => {
      try { dashboardSocket.close(); } catch {}
    };
  };

  conectar();
}

function syncDashboardDateInputs() {
  ["dashboard-date-input", "legacy-dashboard-date-input"].forEach((id) => {
    const input = byId(id);
    if (input && input.value !== dashboardState.fechaOperacion) input.value = dashboardState.fechaOperacion;
  });
}

function cargarEstadoSegunFecha() {
  dashboardState.fechaOperacion = fechaOperacionActiva();
  const cached = leerEstadoLiveGuardado();
  if (cached?.spaces) {
    dashboardState.spaces = cached.spaces.map(normalizarEspacio);
    dashboardState.ingresosDia = Number(cached.resumen?.ingresosDia || leerPagosGuardados(dashboardState.fechaOperacion).total || 0);
  } else {
    dashboardState.spaces = espaciosVacios();
    dashboardState.ingresosDia = leerPagosGuardados(dashboardState.fechaOperacion).total || 0;
  }
  syncDashboardDateInputs();
  renderDashboardLive();
}

function cambiarFechaDashboard(fecha, notifyDevice = true) {
  const valor = /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || "")) ? String(fecha) : fechaHoyISO();
  dashboardState.fechaOperacion = valor;
  localStorage.setItem(STORAGE_SIM_DATE, valor);
  cargarEstadoSegunFecha();
  if (notifyDevice) enviarFechaOperacionAlESP32();
}

function bindDashboardDateInputs() {
  ["dashboard-date-input", "legacy-dashboard-date-input"].forEach((id) => {
    const input = byId(id);
    if (!input || input.dataset.smartparkDateBound) return;
    input.dataset.smartparkDateBound = "1";
    input.value = dashboardState.fechaOperacion;
    input.addEventListener("change", (event) => cambiarFechaDashboard(event.target.value, true));
  });
}

function cargarEstadoGuardadoInicial() {
  cargarEstadoSegunFecha();
}

export async function cargarDashboard() {
  dashboardState.fechaOperacion = fechaOperacionActiva();
  bindDashboardDateInputs();
  cargarEstadoGuardadoInicial();
  iniciarDashboardSocket();

  try {
    const [respuestaResumen, respuestaEspacios] = await Promise.all([
      apiFetch("/api/v2/dashboard/resumen"),
      apiFetch("/api/v2/dashboard/espacios")
    ]);

    const resumenDatos = await leerJson(respuestaResumen);
    const espaciosDatos = await leerJson(respuestaEspacios);

    if (!respuestaResumen.ok || !resumenDatos.ok) throw new Error(resumenDatos.mensaje || "No se pudo cargar el resumen");
    if (!respuestaEspacios.ok || !espaciosDatos.ok) throw new Error(espaciosDatos.mensaje || "No se pudieron cargar los espacios");

    const spaces = (espaciosDatos.espacios || []).map((e, index) => normalizarEspacio({
      numero: e.numero,
      estado: e.idSesion && !String(e.estadoSesion || "").toLowerCase().includes("final") ? "Estacionado" : e.estado,
      placa: e.placa,
      uid: e.uidRfid,
      duracionMin: e.tiempoActualMinutos,
      pago: e.pago || 0
    }, index));

    if (spaces.some((s) => estadoClase(s.estado) !== "free" || s.uid || s.placa)) {
      aplicarEspacios(spaces);
    } else {
      renderDashboardLive();
    }
  } catch {
    // Si la API falla, el dashboard sigue funcionando con datos en vivo por WebSocket.
    renderDashboardLive();
  }
}

export async function cargarCamara() {
  // La ESP32-CAM fue retirada del alcance del proyecto.
}

window.addEventListener("storage", (event) => {
  if ([STORAGE_SIM_DATE, STORAGE_LIVE_STATE, STORAGE_PAYMENTS_BY_DATE, STORAGE_PAYMENTS, STORAGE_HISTORY_BY_DATE, STORAGE_INCIDENTS_BY_DATE].includes(event.key)) {
    const nuevaFecha = fechaOperacionActiva();
    if (nuevaFecha !== dashboardState.fechaOperacion || event.key !== STORAGE_LIVE_STATE) {
      dashboardState.fechaOperacion = nuevaFecha;
      cargarEstadoSegunFecha();
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  bindDashboardDateInputs();
  syncDashboardDateInputs();
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type === "smartparking:set-date" && event.data.date) {
    cambiarFechaDashboard(event.data.date, true);
  }
});
