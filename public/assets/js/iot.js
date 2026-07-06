import { apiFetch, leerJson } from "./api.js";

function badge(estado) {
  if (estado === "Online") return "online";
  if (estado === "Advertencia") return "warn";
  return "offline";
}

export async function cargarIot() {
  const [rResumen, rDispositivos, rLogs] = await Promise.all([
    apiFetch("/api/v2/iot/resumen"),
    apiFetch("/api/v2/iot/dispositivos"),
    apiFetch("/api/v2/iot/logs?limite=30")
  ]);

  const resumen = await leerJson(rResumen);
  const dispositivos = await leerJson(rDispositivos);
  const logs = await leerJson(rLogs);

  if (!rResumen.ok || !resumen.ok) throw new Error(resumen.mensaje || "No se pudo cargar IoT");
  if (!rDispositivos.ok || !dispositivos.ok) throw new Error(dispositivos.mensaje || "No se pudieron cargar dispositivos");
  if (!rLogs.ok || !logs.ok) throw new Error(logs.mensaje || "No se pudieron cargar logs");

  const r = resumen.resumen;
  document.getElementById("iot-total").textContent = r.totalDispositivos;
  document.getElementById("iot-online").textContent = r.dispositivosOnline;
  document.getElementById("iot-offline").textContent = r.dispositivosOffline;
  document.getElementById("iot-latency").textContent = `${r.latenciaPromedioMs} ms`;

  const grid = document.getElementById("devices-grid");
  grid.innerHTML = dispositivos.dispositivos.length ? dispositivos.dispositivos.map((d) => `
    <article class="device-card">
      <div class="device-head"><div><strong>${d.nombre}</strong><span>${d.codigo} · ${d.tipoDispositivo}</span></div><span class="status-badge ${badge(d.estado)}">${d.estado}</span></div>
      <div class="device-meta">
        <div>Ubicación<b>${d.ubicacion || "—"}</b></div>
        <div>Conexión<b>${d.tipoConexion || "—"}</b></div>
        <div>Señal<b>${d.intensidadSenal || 0}%</b></div>
        <div>Latencia<b>${d.latenciaMs || 0} ms</b></div>
        <div>Dirección<b>${d.direccionRed || "—"}</b></div>
        <div>Última lectura<b>${d.ultimaLectura || "—"}</b></div>
      </div>
    </article>
  `).join("") : '<div class="empty-state">No existen dispositivos IoT registrados.</div>';

  const contenedor = document.getElementById("iot-logs");
  contenedor.innerHTML = logs.logs.length ? logs.logs.map((l) => `
    <article class="log-entry">
      <header><strong>${l.dispositivo} · ${l.nivel}</strong><time>${l.fechaHora}</time></header>
      <p>${l.mensaje}</p>
    </article>
  `).join("") : '<div class="empty-state">No existen logs registrados.</div>';
}
