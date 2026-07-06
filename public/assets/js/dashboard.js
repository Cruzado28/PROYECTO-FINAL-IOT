import { apiFetch, leerJson } from "./api.js";

function duracion(minutos) {
  const total = Math.max(0, Number(minutos) || 0);
  const horas = Math.floor(total / 60);
  const restantes = total % 60;
  if (horas === 0) return `${restantes}m`;
  return `${horas}h ${String(restantes).padStart(2, "0")}m`;
}

function estadoClase(estado) {
  const valor = String(estado || "").toLowerCase();
  if (valor.includes("ocup")) return "occupied";
  if (valor.includes("reserv")) return "reserved";
  if (valor.includes("manten")) return "maintenance";
  return "free";
}

export async function cargarDashboard() {
  const [respuestaResumen, respuestaEspacios] = await Promise.all([
    apiFetch("/api/v2/dashboard/resumen"),
    apiFetch("/api/v2/dashboard/espacios")
  ]);

  const resumenDatos = await leerJson(respuestaResumen);
  const espaciosDatos = await leerJson(respuestaEspacios);

  if (!respuestaResumen.ok || !resumenDatos.ok) {
    throw new Error(resumenDatos.mensaje || "No se pudo cargar el resumen");
  }
  if (!respuestaEspacios.ok || !espaciosDatos.ok) {
    throw new Error(espaciosDatos.mensaje || "No se pudieron cargar los espacios");
  }

  const r = resumenDatos.resumen;
  document.getElementById("stat-total").textContent = r.totalEspacios;
  document.getElementById("stat-occupied").textContent = r.espaciosOcupados;
  document.getElementById("stat-free").textContent = r.espaciosLibres;
  document.getElementById("stat-average").textContent = duracion(r.permanenciaPromedioMinutos);
  document.getElementById("spaces-summary").textContent = `${r.espaciosOcupados} ocupados · ${r.espaciosLibres} libres · ${r.espaciosMantenimiento} en mantenimiento`;

  const espacios = espaciosDatos.espacios || [];
  const grid = document.getElementById("spaces-grid");
  grid.innerHTML = espacios.length ? espacios.map((e) => `
    <div class="space-cell ${estadoClase(e.estado)}" title="${e.zona || "Zona general"}">
      <span class="dot"></span>
      <strong>${e.numero}</strong>
      <span>${e.estado}</span>
    </div>
  `).join("") : '<div class="empty-state">No existen espacios registrados.</div>';

  const activos = espacios.filter((e) => e.idSesion && !String(e.estadoSesion || "").toLowerCase().includes("final"));
  document.getElementById("vehicles-summary").textContent = `${activos.length} activos · actualizado ahora`;
  const lista = document.getElementById("vehicle-list");
  lista.innerHTML = activos.length ? activos.map((e) => `
    <div class="vehicle-item">
      <div class="vehicle-space">${e.numero}</div>
      <div class="vehicle-info"><strong>${e.placa || "SIN-PLACA"}</strong><span>${e.conductor || "Conductor no registrado"} · ${e.rol || "Sin rol"}</span></div>
      <div class="vehicle-time"><strong>${duracion(e.tiempoActualMinutos)}</strong><span>${e.fechaHoraIngreso || "Sin hora"}</span></div>
    </div>
  `).join("") : '<div class="empty-state">No hay vehículos dentro del estacionamiento.</div>';
}

export async function cargarCamara() {
  try {
    const respuesta = await apiFetch("/api/v2/iot/dispositivos");
    const datos = await leerJson(respuesta);
    if (!respuesta.ok || !datos.ok) throw new Error(datos.mensaje);

    const camara = (datos.dispositivos || []).find((d) =>
      `${d.tipoDispositivo} ${d.nombre}`.toLowerCase().includes("cam")
    );

    const estado = document.getElementById("camera-status");
    if (!camara) {
      document.getElementById("camera-subtitle").textContent = "No existe una cámara registrada";
      estado.textContent = "No configurada";
      estado.className = "status-badge neutral";
      return;
    }

    document.getElementById("camera-subtitle").textContent = `${camara.codigo} · ${camara.ubicacion || "Ubicación no registrada"}`;
    document.getElementById("camera-device").textContent = camara.direccionRed || camara.nombre;
    document.getElementById("camera-latency").textContent = `Latencia: ${camara.latenciaMs || 0} ms`;
    document.getElementById("camera-reading").textContent = `Última lectura: ${camara.ultimaLectura || "—"}`;
    estado.textContent = camara.estado;
    estado.className = `status-badge ${camara.estado === "Online" ? "online" : camara.estado === "Advertencia" ? "warn" : "offline"}`;
  } catch (error) {
    document.getElementById("camera-subtitle").textContent = "No se pudo consultar la cámara";
  }
}
