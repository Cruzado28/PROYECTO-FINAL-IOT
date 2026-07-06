// ============================================================
// DATA
// ============================================================
const VEHICLES_DATA = [];

let HISTORY_DATA = [];
let historialVisible = [];

let EVENTS_DATA = [];

let IOT_DEVICES = [];

let IOT_LOGS = [];

let rolesData = [
  {name:'Usuario Común',icon:'fa-user',discount:'0%',hours:'0h gratis',color:'gray',desc:'Tarifa estándar sin beneficios'},
  {name:'Trabajador',icon:'fa-briefcase',discount:'100%',hours:'Exonerado',color:'green',desc:'Personal del centro comercial'},
  {name:'Cliente VIP',icon:'fa-crown',discount:'50%',hours:'1h gratis',color:'purple',desc:'Clientes frecuentes premium'},
  {name:'Propietario de Tienda',icon:'fa-store',discount:'100%',hours:'Exonerado',color:'blue',desc:'Arrendatarios del centro'},
  {name:'Empresario Frecuente',icon:'fa-user-tie',discount:'30%',hours:'2h gratis',color:'amber',desc:'Clientes corporativos'},
  {name:'Invitado Especial',icon:'fa-star',discount:'20%',hours:'1h gratis',color:'teal',desc:'Invitados a eventos especiales'},
  {name:'Proveedor',icon:'fa-truck',discount:'0%',hours:'3h gratis',color:'gray',desc:'Proveedores y distribuidores'},
];

const PROMOS_DATA = [
  {name:'Promo Básica',min:'S/ 50',benefit:'1 hora gratis',from:'2025-06-01',to:'2025-12-31',status:'Activa'},
  {name:'Promo Media',min:'S/ 100',benefit:'2 horas gratis',from:'2025-06-01',to:'2025-12-31',status:'Activa'},
  {name:'Promo Premium',min:'S/ 200',benefit:'Estacionamiento gratuito',from:'2025-06-01',to:'2025-12-31',status:'Activa'},
  {name:'Promoción Fin de Semana',min:'S/ 75',benefit:'1.5 horas gratis',from:'2025-06-15',to:'2025-06-30',status:'Activa'},
  {name:'Noche de Estreno',min:'S/ 150',benefit:'3 horas gratis',from:'2025-06-20',to:'2025-06-22',status:'Inactiva'},
];

const STORES_DATA = [
  {name:'Plaza Vea',cat:'Supermercado',icon:'fa-cart-shopping',location:'Planta Baja',status:'Activo',kind:'consumo'},
  {name:'McDonald\'s',cat:'Restaurante',icon:'fa-utensils',location:'Food Court · P1',status:'Activo',kind:'consumo'},
  {name:'Cinemark',cat:'Cine',icon:'fa-film',location:'Piso 4',status:'Activo',kind:'tiempo'},
  {name:'Boticas Arcángel',cat:'Farmacia',icon:'fa-pills',location:'P1 · Ala Sur',status:'Activo',kind:'consumo'},
  {name:'Ripley',cat:'Ropa',icon:'fa-shirt',location:'Pisos 1 y 2',status:'Activo',kind:'consumo'},
  {name:'Starbucks',cat:'Cafetería',icon:'fa-mug-saucer',location:'Planta Baja',status:'Activo',kind:'consumo'},
  {name:'Banco BCP',cat:'Banco',icon:'fa-building-columns',location:'P1 · Entrada',status:'Activo',kind:'consumo'},
  {name:'Samsung Store',cat:'Electrónica',icon:'fa-mobile-screen',location:'P2 · Ala Norte',status:'Inactivo',kind:'consumo'},
  {name:'Smart Fit',cat:'Gimnasio',icon:'fa-dumbbell',location:'Piso 3',status:'Activo',kind:'tiempo'},
];

const TIMELINE_BASE = [
  {date:'18/06/2025',hour:'11:45',store:'Plaza Vea',cat:'Supermercado',desc:'Compra de abarrotes y productos del hogar',amount:'S/ 120.00',kind:'consumo'},
  {date:'18/06/2025',hour:'11:10',store:'McDonald\'s',cat:'Restaurante',desc:'Almuerzo familiar - Combo familiar x2',amount:'S/ 65.50',kind:'consumo'},
  {date:'18/06/2025',hour:'10:35',store:'Boticas Arcángel',cat:'Farmacia',desc:'Medicamentos y vitaminas',amount:'S/ 38.90',kind:'consumo'},
  {date:'17/06/2025',hour:'16:20',store:'Cinemark',cat:'Cine',desc:'2 entradas película estelar + pop corn',amount:'90 min',kind:'tiempo'},
  {date:'17/06/2025',hour:'14:30',store:'Ripley',cat:'Ropa',desc:'Ropa de temporada - camisas',amount:'S/ 189.00',kind:'consumo'},
];

let currentVehicle = null;
let activeTimeline = [...TIMELINE_BASE];
let vehiclesData = [...VEHICLES_DATA];
let promosData = [];
let storesData = [];
let charts = {};
let tarifaActual = null;

// ============================================================
// INIT
// ============================================================
async function init(){
  renderParkingMap();
  renderEventsFeed();
  renderRankings();
  renderVehiclesTable();
  renderVehiclesFeed();
  renderHistoryTable();
  renderIoTDevices();
  renderIoTLogs();
  renderRoles();
  renderPromos();
  renderStores();
  initCharts();
  updateThemeUI();

  await cargarDashboardReal();
  await cargarEventosReales();
  await cargarVehiculosReales();
  await cargarHistorialReal();
  await cargarTarifaReal();
  await cargarRolesReales();
  await cargarPromocionesReales();
  await cargarEstablecimientosReales();
  await cargarDispositivosIoTReales();
  await cargarResumenIoTReal();
  await cargarLogsIoTReales();
  await cargarAdministradorReal();
  await cargarConfiguracionSistemaReal();

}

// ============================================================
// DATOS REALES DEL DASHBOARD
// ============================================================

function actualizarKpiDashboard(
  etiqueta,
  valor,
  detalle = "Datos obtenidos de MySQL"
) {
  const tarjetas = Array.from(
    document.querySelectorAll(".kpi-card")
  );

  const tarjeta = tarjetas.find((elemento) => {
    const label = elemento.querySelector(".kpi-label");

    return (
      label &&
      label.textContent.trim().toUpperCase() ===
        etiqueta.toUpperCase()
    );
  });

  if (!tarjeta) {
    return;
  }

  const valorElemento =
    tarjeta.querySelector(".kpi-value");

  const detalleElemento =
    tarjeta.querySelector(".kpi-sub");

  const tendenciaElemento =
    tarjeta.querySelector(".kpi-trend");

  if (valorElemento) {
    valorElemento.textContent = valor;
  }

  if (detalleElemento) {
    detalleElemento.textContent = detalle;
  }

  // Oculta porcentajes simulados como +100 % o +80 %.
  if (tendenciaElemento) {
    tendenciaElemento.style.display = "none";
  }
}


function formatearDuracionDashboard(minutos) {
  const totalMinutos = Math.max(
    0,
    Number(minutos) || 0
  );

  if (totalMinutos < 60) {
    return `${totalMinutos} min`;
  }

  const horas = Math.floor(totalMinutos / 60);
  const minutosRestantes = totalMinutos % 60;

  return `${horas}h ${minutosRestantes}m`;
}


function obtenerClaseEstadoEspacio(estado) {
  const clases = {
    Libre: "spot-free",
    Ocupado: "spot-occupied",
    Reservado: "spot-reserved",
    Mantenimiento: "spot-maintenance"
  };

  return clases[estado] || "spot-free";
}

async function exportarDashboardPDF() {
  const boton =
    document.getElementById("dashboard-exportar-btn");

  try {
    if (boton) {
      boton.disabled = true;
      boton.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    }

    const respuesta = await fetch(
      "/api/v2/dashboard/exportar/pdf"
    );

    if (!respuesta.ok) {
      let mensaje =
        "No se pudo generar el reporte del Dashboard";

      try {
        const datosError = await respuesta.json();

        mensaje =
          datosError.mensaje || mensaje;
      } catch (errorLectura) {
        console.error(
          "No se pudo leer el error del reporte:",
          errorLectura
        );
      }

      throw new Error(mensaje);
    }

    const archivo = await respuesta.blob();

    const disposicion =
      respuesta.headers.get(
        "Content-Disposition"
      ) || "";

    const coincidencia =
      disposicion.match(
        /filename="?([^"]+)"?/i
      );

    const nombreArchivo =
      coincidencia?.[1] ||
      `dashboard-smart-parking-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;

    const enlaceTemporal =
      URL.createObjectURL(archivo);

    const enlace =
      document.createElement("a");

    enlace.href = enlaceTemporal;
    enlace.download = nombreArchivo;

    document.body.appendChild(enlace);

    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(enlaceTemporal);

    showToast(
      "success",
      "Dashboard exportado a PDF",
      "fa-file-pdf"
    );
  } catch (error) {
    console.error(
      "Error al exportar el Dashboard:",
      error
    );

    showToast(
      "error",
      error.message ||
      "No se pudo exportar el Dashboard",
      "fa-triangle-exclamation"
    );
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.innerHTML =
        '<i class="fa-solid fa-download"></i> Exportar PDF';
    }
  }
}

async function cargarGraficosDashboardReal() {
  try {
    const respuesta = await fetch(
      "/api/v2/dashboard/graficos"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudieron obtener los gráficos"
      );
    }

    const datos = await respuesta.json();

    if (!datos.ok || !datos.graficos) {
      throw new Error(
        datos.mensaje ||
        "La respuesta de gráficos no es válida"
      );
    }

    const graficos = datos.graficos;

    // Ocupación por hora
    if (charts.hourly) {
      charts.hourly.data.labels =
        graficos.ocupacionPorHora.map(
          (registro) => registro.etiqueta
        );

      charts.hourly.data.datasets[0].data =
        graficos.ocupacionPorHora.map(
          (registro) => Number(registro.total)
        );

      charts.hourly.update();
    }

    // Ingresos de los últimos siete días
    if (charts.income) {
      charts.income.data.labels =
        graficos.ingresosPorDia.map(
          (registro) => registro.etiqueta
        );

      charts.income.data.datasets[0].data =
        graficos.ingresosPorDia.map(
          (registro) => Number(registro.total)
        );

      charts.income.update();
    }

    // Vehículos registrados por tipo
    if (charts.types) {
      const tipos =
        graficos.vehiculosPorTipo.length > 0
          ? graficos.vehiculosPorTipo
          : [
              {
                etiqueta: "Sin registros",
                total: 0
              }
            ];

      charts.types.data.labels =
        tipos.map(
          (registro) => registro.etiqueta
        );

      charts.types.data.datasets[0].data =
        tipos.map(
          (registro) => Number(registro.total)
        );

      charts.types.update();
    }

    // Vehículos con beneficios según su rol
    if (charts.benefits) {
      const beneficios =
        graficos.usoBeneficios.length > 0
          ? graficos.usoBeneficios
          : [
              {
                etiqueta: "Sin beneficios",
                total: 0
              }
            ];

      charts.benefits.data.labels =
        beneficios.map(
          (registro) => registro.etiqueta
        );

      charts.benefits.data.datasets[0].data =
        beneficios.map(
          (registro) => Number(registro.total)
        );

      charts.benefits.update();
    }

    console.log(
      "Gráficos del Dashboard actualizados con datos reales",
      graficos
    );
  } catch (error) {
    console.error(
      "Error al cargar los gráficos reales:",
      error
    );

    showToast(
      "error",
      "No se pudieron cargar los gráficos del Dashboard",
      "fa-chart-column"
    );
  }
}

async function cargarDashboardReal() {
  try {
    const [
      respuestaResumen,
      respuestaEspacios
    ] = await Promise.all([
      fetch("/api/v2/dashboard/resumen"),
      fetch("/api/v2/dashboard/espacios")
    ]);

    if (
      !respuestaResumen.ok ||
      !respuestaEspacios.ok
    ) {
      throw new Error(
        "El servidor no pudo entregar los datos del dashboard"
      );
    }

    const datosResumen =
      await respuestaResumen.json();

    const datosEspacios =
      await respuestaEspacios.json();

    if (!datosResumen.ok || !datosEspacios.ok) {
      throw new Error(
        "Las API devolvieron una respuesta no válida"
      );
    }

    const resumen = datosResumen.resumen;

    // Tarjetas que ya cuentan con datos reales.
    actualizarKpiDashboard(
      "ESPACIOS TOTALES",
      resumen.totalEspacios,
      "Capacidad total"
    );

    actualizarKpiDashboard(
      "ESPACIOS OCUPADOS",
      resumen.espaciosOcupados,
      "Ocupados actualmente"
    );

    actualizarKpiDashboard(
      "ESPACIOS DISPONIBLES",
      resumen.espaciosLibres,
      "Disponibles actualmente"
    );

    actualizarKpiDashboard(
      "VEHÍCULOS ACTIVOS",
      resumen.vehiculosActivos,
      "En el estacionamiento ahora"
    );

    actualizarKpiDashboard(
      "INGRESOS DEL DÍA",
      `S/ ${Number(
        resumen.ingresosDelDia
      ).toFixed(2)}`,
      "Pagos registrados hoy"
    );

    actualizarKpiDashboard(
      "TIEMPO PROMEDIO",
      formatearDuracionDashboard(
        resumen.permanenciaPromedioMinutos
      ),
      "Permanencia promedio"
    );

    // Métricas adicionales calculadas desde MySQL.
    actualizarKpiDashboard(
      "HORAS EXONERADAS",
      `${Number(
        resumen.horasExoneradasMes
      ).toFixed(2)} h`,
      "Acumulado del mes"
    );

    actualizarKpiDashboard(
      "DESCUENTOS APLICADOS",
      `S/ ${Number(
        resumen.descuentosAplicadosDia
      ).toFixed(2)}`,
      "Descuentos registrados hoy"
    );

    actualizarKpiDashboard(
      "USUARIOS VIP",
      Number(resumen.usuariosVip),
      "Conductores con beneficios VIP"
    );

    actualizarKpiDashboard(
      "CONSUMO REGISTRADO",
      `S/ ${Number(
        resumen.consumoRegistradoDia
      ).toFixed(2)}`,
      "Consumo registrado hoy"
    );

    // Eliminar el mapa simulado anterior.
    Object.keys(SPOT_STATE).forEach((clave) => {
      delete SPOT_STATE[clave];
    });

    Object.keys(SPOT_VEHICLE_MAP).forEach((clave) => {
      delete SPOT_VEHICLE_MAP[clave];
    });

    // Registrar en el mapa los estados reales de MySQL.
    datosEspacios.espacios.forEach((espacio) => {
      SPOT_STATE[espacio.numero] =
        obtenerClaseEstadoEspacio(espacio.estado);
    });

    // Volver a dibujar el gemelo digital.
    renderParkingMap();

    await Promise.all([
      cargarGraficosDashboardReal(),
      cargarRankingsReales()
    ]);

    const contadorMonitor =
      document.getElementById("v-feed-count");

    if (contadorMonitor) {
      contadorMonitor.textContent =
        `${resumen.vehiculosActivos} activos · actualizado ahora`;
    }

    const subtituloDashboard =
      document.querySelector(
        "#page-dashboard .section-sub"
      );

    if (subtituloDashboard) {
      subtituloDashboard.textContent =
        "Visión general del sistema · Actualizado ahora";
    }

    console.log(
      "Dashboard actualizado con datos reales",
      {
        resumen,
        espacios: datosEspacios.espacios
      }
    );
  } catch (error) {
    console.error(
      "Error al cargar el dashboard real:",
      error
    );

    showToast(
      "error",
      "No se pudieron cargar los datos reales",
      "fa-triangle-exclamation"
    );
  }
}

// ============================================================
// AUTH
// ============================================================
const fetchOriginal = window.fetch.bind(window);

let cierreSesionAutomatico = false;

window.fetch = async function (recurso, opciones = {}) {
  const url =
    typeof recurso === "string"
      ? recurso
      : recurso.url;

  const esApiProtegida =
    url.startsWith("/api/v2/") &&
    !url.startsWith("/api/v2/auth/login");

  if (!esApiProtegida) {
    return fetchOriginal(recurso, opciones);
  }

  const token = sessionStorage.getItem(
    "smartParkingToken"
  );

  const encabezados = new Headers(
    opciones.headers || {}
  );

  if (token) {
    encabezados.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  const respuesta = await fetchOriginal(
    recurso,
    {
      ...opciones,
      headers: encabezados
    }
  );

  if (
    respuesta.status === 401 &&
    token &&
    !cierreSesionAutomatico
  ) {
    cierreSesionAutomatico = true;

    sessionStorage.removeItem(
      "smartParkingToken"
    );

    sessionStorage.removeItem(
      "smartParkingAdmin"
    );

    const pantallaLogin =
      document.getElementById("login-screen");

    const sistema =
      document.getElementById("main-layout");

    const campoContrasena =
      document.getElementById("login-pass");

    const mensajeError =
      document.getElementById("login-err");

    if (sistema) {
      sistema.style.display = "none";
    }

    if (pantallaLogin) {
      pantallaLogin.style.display = "flex";
    }

    if (campoContrasena) {
      campoContrasena.value = "";
    }

    if (mensajeError) {
      mensajeError.textContent =
        "Tu sesión expiró. Inicia sesión nuevamente.";

      mensajeError.style.display = "block";
    }
  }

  return respuesta;
};

let sistemaInicializado = false;

function cargarVistaIntegrada(tipo) {
  const configuracion = {
    dashboard: {
      frameId: "dashboard-modern-frame",
      loadingId: "dashboard-frame-loading"
    },
    sensors: {
      frameId: "sensors-live-frame",
      loadingId: "sensors-frame-loading"
    }
  }[tipo];

  if (!configuracion) return;

  const frame = document.getElementById(configuracion.frameId);
  const loading = document.getElementById(configuracion.loadingId);

  if (!frame || frame.dataset.loaded === "true") return;

  frame.addEventListener("load", () => {
    frame.hidden = false;
    if (loading) loading.style.display = "none";
  }, { once: true });

  frame.src = frame.dataset.src;
  frame.dataset.loaded = "true";
}

window.addEventListener("message", (evento) => {
  if (evento.origin !== window.location.origin) return;

  const datos = evento.data || {};

  if (datos.type === "smartparking:embed-height") {
    const frame = datos.page === "sensors"
      ? document.getElementById("sensors-live-frame")
      : document.getElementById("dashboard-modern-frame");

    if (frame) {
      const altura = Math.max(720, Math.min(Number(datos.height) || 720, 4200));
      frame.style.height = `${altura}px`;
    }
  }

  if (datos.type === "smartparking:session-expired") {
    doLogout();
  }
});

async function mostrarSistemaAutenticado(administrador) {
  document.getElementById(
    "login-screen"
  ).style.display = "none";

  document.getElementById(
    "main-layout"
  ).style.display = "flex";

  if (administrador) {
    aplicarPreferenciasVisuales(
      administrador.temaPreferido,
      administrador.colorPrincipal
    );
  }

  cargarVistaIntegrada("dashboard");

  if (!sistemaInicializado) {
    sistemaInicializado = true;
    await init();
  }
}


async function verificarSesionGuardada() {
  const token = sessionStorage.getItem(
    "smartParkingToken"
  );

  if (!token) {
    return;
  }

  try {
    const respuesta = await fetch(
      "/api/v2/auth/verificar",
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(
        datos.mensaje || "Sesión no válida"
      );
    }

    let administrador = null;

    try {
      administrador = JSON.parse(
        sessionStorage.getItem(
          "smartParkingAdmin"
        )
      );
    } catch (error) {
      administrador = datos.administrador;
    }

    await mostrarSistemaAutenticado(
      administrador || datos.administrador
    );
  } catch (error) {
    sessionStorage.removeItem(
      "smartParkingToken"
    );

    sessionStorage.removeItem(
      "smartParkingAdmin"
    );

    document.getElementById(
      "login-screen"
    ).style.display = "flex";

    document.getElementById(
      "main-layout"
    ).style.display = "none";
  }
}

async function doLogin() {
  const usuario =
    document.getElementById("login-user").value.trim();

  const contrasena =
    document.getElementById("login-pass").value;

  const errorElemento =
    document.getElementById("login-err");

  errorElemento.style.display = "none";

  if (!usuario || !contrasena) {
    errorElemento.textContent =
      "Ingresa el usuario y la contraseña.";

    errorElemento.style.display = "block";
    return;
  }

  try {
    const respuesta = await fetch(
      "/api/v2/auth/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usuario,
          contrasena
        })
      }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(
        datos.mensaje ||
        "No se pudo iniciar sesión"
      );
    }

    cierreSesionAutomatico = false;

    sessionStorage.setItem(
      "smartParkingToken",
      datos.token
    );

    sessionStorage.setItem(
      "smartParkingAdmin",
      JSON.stringify(datos.administrador)
    );

    await mostrarSistemaAutenticado(
      datos.administrador
    );

    showToast(
      "success",
      `Bienvenido, ${datos.administrador.nombre}`,
      "fa-check"
    );
  } catch (error) {
    errorElemento.textContent =
      error.message ||
      "Usuario o contraseña incorrectos";

    errorElemento.style.display = "block";
  }
}

function doLogout() {
  sessionStorage.removeItem(
    "smartParkingToken"
  );

  sessionStorage.removeItem(
    "smartParkingAdmin"
  );

  cierreSesionAutomatico = false;
  sistemaInicializado = false;

  const contenedorToast =
    document.getElementById("toast-container");

  if (contenedorToast) {
    contenedorToast.innerHTML = "";
  }

  window.location.reload();
}

document.addEventListener(
  "DOMContentLoaded",
  verificarSesionGuardada
);

function togglePass(el){
  const inp=el.closest('.login-input-wrap').querySelector('input');
  if(inp.type==='password'){inp.type='text';el.className='fa-solid fa-eye-slash login-input-icon';}
  else{inp.type='password';el.className='fa-solid fa-eye login-input-icon';}
}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.getElementById('login-screen').style.display!=='none')doLogin();});

// ============================================================
// NAVIGATION
// ============================================================
const PAGE_NAMES={dashboard:'Dashboard',sensors:'Sensores en Vivo',monitor:'Monitoreo en Tiempo Real',vehicles:'Vehículos',history:'Historial y Reportes',tariffs:'Tarifas y Beneficios',settings:'Configuración'};

function navigateTo(page,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));

  const pagina = document.getElementById('page-'+page);
  if (!pagina) {
    showToast('error','La sección solicitada no está disponible','fa-circle-xmark');
    return;
  }

  pagina.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(el)el.classList.add('active');
  document.getElementById('breadcrumbs').innerHTML=`<span>Smart Parking IoT</span><span class="sep">›</span><span class="current">${PAGE_NAMES[page]||page}</span>`;

  if (page === 'dashboard') cargarVistaIntegrada('dashboard');
  if (page === 'sensors') cargarVistaIntegrada('sensors');

  closeDetailPanel();
}

function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ============================================================
// THEME
// ============================================================
function toggleTheme(){
  const html=document.documentElement;
  const isDark=html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme',isDark?'light':'dark');
  updateThemeUI();
  if(charts.hourly)reinitCharts();
}
function updateThemeUI(){
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const moon=document.getElementById('theme-moon');
  const sun=document.getElementById('theme-sun');
  const toggle=document.getElementById('dark-mode-toggle');
  if(isDark){
    moon.style.cssText='font-size:14px;padding:3px;border-radius:50%;background:var(--accent);color:#fff';
    sun.style.cssText='font-size:14px;padding:3px;border-radius:50%';
    if(toggle)toggle.classList.add('on');
  } else {
    sun.style.cssText='font-size:14px;padding:3px;border-radius:50%;background:var(--accent);color:#fff';
    moon.style.cssText='font-size:14px;padding:3px;border-radius:50%';
    if(toggle)toggle.classList.remove('on');
  }
}
function setAccent(color,hover,el){
  document.documentElement.style.setProperty('--accent',color);
  document.documentElement.style.setProperty('--accent-hover',hover);
  document.querySelectorAll('.color-opt').forEach(o=>o.classList.remove('active'));
  el.classList.add('active');
  showToast('success','Color principal actualizado','fa-palette');
}

function setFontSize(size,el){
  const zoomMap={small:'0.92',normal:'1',large:'1.1'};
  const content=document.getElementById('content-scroll');
  if(content)content.style.zoom=zoomMap[size]||'1';
  document.querySelectorAll('#font-size-group .btn').forEach(b=>{b.classList.remove('btn-primary');b.classList.add('btn-secondary');});
  el.classList.remove('btn-secondary');
  el.classList.add('btn-primary');
  showToast('info','Tamaño de fuente actualizado','fa-text-height')
}

// ============================================================
// TABS
// ============================================================
function switchTab(section,tab,el){
  const sections=document.querySelectorAll(`[id^="${section}-"]`);
  sections.forEach(s=>s.style.display='none');
  document.getElementById(`${section}-${tab}`).style.display='block';
  el.closest('.tabs').querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
}

// ============================================================
// CHARTS
// ============================================================
function getChartDefaults(){
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  return {
    gridColor:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)',
    textColor:isDark?'#8b92a5':'#9ca3af',
    bgCard:isDark?'#1a2035':'#ffffff',
  };
}

function initCharts(){
  const d=getChartDefaults();
  const accentColor='#4f8ef7';

  // Hourly occupancy
  if(document.getElementById('chart-hourly')){
    charts.hourly=new Chart(document.getElementById('chart-hourly'),{
      type:'bar',
      data:{
        labels:['6h','7h','8h','9h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h','21h'],
        datasets:[{label:'Vehículos',data:[1,2,3,5,7,8,9,8,7,6,7,9,8,6,4,2],backgroundColor:accentColor+'33',borderColor:accentColor,borderWidth:1.5,borderRadius:3}]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:d.gridColor},ticks:{color:d.textColor,font:{size:10}}},y:{grid:{color:d.gridColor},ticks:{color:d.textColor,font:{size:10},stepSize:2},min:0,max:10}}}
    });
  }
  // Income chart
  if(document.getElementById('chart-income')){
    charts.income=new Chart(document.getElementById('chart-income'),{
      type:'line',
      data:{
        labels:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
        datasets:[{label:'Ingresos S/',data:[1420,1680,1550,1920,2100,2450,1847],backgroundColor:'rgba(34,197,94,0.08)',borderColor:'#22c55e',borderWidth:2,tension:0.4,fill:true,pointRadius:3,pointBackgroundColor:'#22c55e'}]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:d.gridColor},ticks:{color:d.textColor,font:{size:10}}},y:{grid:{color:d.gridColor},ticks:{color:d.textColor,font:{size:10},callback:v=>'S/'+v}}}}
    });
  }
  // Vehicle types
  if(document.getElementById('chart-types')){
    charts.types=new Chart(document.getElementById('chart-types'),{
      type:'doughnut',
      data:{
        labels:['Auto','SUV','Camioneta','Moto','Otro'],
        datasets:[{data:[4,1,1,1,1],backgroundColor:['#4f8ef7','#22c55e','#a78bfa','#f59e0b','#14b8a6'],borderWidth:0}]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'65%'}
    });
  }
  // Benefits
  if(document.getElementById('chart-benefits')){
    charts.benefits=new Chart(document.getElementById('chart-benefits'),{
      type:'bar',
      data:{
        labels:['Consumo>S/50','Consumo>S/100','Consumo>S/200','Trabajador','VIP'],
        datasets:[{label:'Usos',data:[38,24,9,45,18],backgroundColor:'#a78bfa33',borderColor:'#a78bfa',borderWidth:1.5,borderRadius:3}]
      },
      options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{grid:{color:d.gridColor},ticks:{color:d.textColor,font:{size:10}}},y:{grid:{display:false},ticks:{color:d.textColor,font:{size:9}}}}}
    });
  }
  // History charts
  if(document.getElementById('chart-hist-occ')){
    charts.histOcc=new Chart(document.getElementById('chart-hist-occ'),{
      type:'line',
      data:{
        labels:['12 Jun','13 Jun','14 Jun','15 Jun','16 Jun','17 Jun','18 Jun'],
        datasets:[{label:'Ocupación %',data:[68,72,65,81,78,84,73],borderColor:'#4f8ef7',borderWidth:2,tension:0.4,fill:false,pointRadius:3,pointBackgroundColor:'#4f8ef7'}]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:d.gridColor},ticks:{color:d.textColor,font:{size:10}}},y:{grid:{color:d.gridColor},ticks:{color:d.textColor,font:{size:10},callback:v=>v+'%'},min:0,max:100}}}
    });
  }
  if(document.getElementById('chart-hist-income')){
    charts.histInc=new Chart(document.getElementById('chart-hist-income'),{
      type:'bar',
      data:{
        labels:['12 Jun','13 Jun','14 Jun','15 Jun','16 Jun','17 Jun','18 Jun'],
        datasets:[{label:'Ingresos',data:[1650,1820,1420,2100,1780,2050,1847],backgroundColor:'#22c55e33',borderColor:'#22c55e',borderWidth:1.5,borderRadius:3}]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:d.gridColor},ticks:{color:d.textColor,font:{size:10}}},y:{grid:{color:d.gridColor},ticks:{color:d.textColor,font:{size:10},callback:v=>'S/'+v}}}}
    });
  }
}

function reinitCharts() {
  Object.values(charts).forEach((grafico) => {
    if (grafico && grafico.destroy) {
      grafico.destroy();
    }
  });

  charts = {};

  setTimeout(async () => {
    initCharts();

    await Promise.all([
      cargarGraficosDashboardReal(),
      cargarGraficosHistorialReal()
    ]);
  }, 50);
}

// ============================================================
// PARKING MAP
// ============================================================
const PARKING_TOTAL=10;
// Mapa de espacio -> índice de vehículo en VEHICLES_DATA (solo para espacios ocupados)
const SPOT_VEHICLE_MAP={1:0,2:1,4:2,5:3,7:4,8:5,9:6};
const SPOT_STATE={1:'spot-occupied',2:'spot-occupied',3:'spot-reserved',4:'spot-occupied',5:'spot-occupied',6:'spot-maintenance',7:'spot-occupied',8:'spot-occupied',9:'spot-occupied',10:'spot-free'};

function renderParkingMap(){
  const map=document.getElementById('parking-map');
  const spots=[];
  for(let i=1;i<=PARKING_TOTAL;i++){
    spots.push({id:i,cls:SPOT_STATE[i]||'spot-free'});
  }
  if(map){
    map.style.cssText='display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:12px;max-width:520px';
    map.innerHTML=spots.map(s=>`<div class="parking-spot ${s.cls}" style="height:56px;font-size:13px" onclick="showSpotInfo(${s.id},'${s.cls}')" onmouseenter="showSpotTooltip(event,${s.id},'${s.cls}')" onmouseleave="hideSpotTooltip()">${s.id}</div>`).join('');
  }
  updateParkingBadges();
  renderMonitorParkingStrip();
}

function updateParkingBadges(){
  const counts={free:0,occupied:0,reserved:0,maintenance:0};
  for(let i=1;i<=PARKING_TOTAL;i++){
    const cls=SPOT_STATE[i]||'spot-free';
    if(cls==='spot-free')counts.free++;
    else if(cls==='spot-occupied')counts.occupied++;
    else if(cls==='spot-reserved')counts.reserved++;
    else counts.maintenance++;
  }
  const badgeWrap=document.getElementById('parking-badges');
  if(badgeWrap){
    badgeWrap.innerHTML=`
      <span class="badge badge-green">${counts.free} Libre${counts.free!==1?'s':''}</span>
      <span class="badge badge-red">${counts.occupied} Ocupado${counts.occupied!==1?'s':''}</span>
      <span class="badge badge-amber">${counts.reserved} Reservado${counts.reserved!==1?'s':''}</span>
      <span class="badge badge-gray">${counts.maintenance} Mant.</span>
    `;
  }
}

function renderMonitorParkingStrip(){
  const strip=document.getElementById('monitor-parking-strip');
  if(!strip)return;
  const spots=[];
  for(let i=1;i<=PARKING_TOTAL;i++)spots.push({id:i,cls:SPOT_STATE[i]||'spot-free'});
  strip.innerHTML=spots.map(s=>`<div class="parking-spot ${s.cls}" style="height:32px;font-size:11px" onclick="showSpotInfo(${s.id},'${s.cls}')" onmouseenter="showSpotTooltip(event,${s.id},'${s.cls}')" onmouseleave="hideSpotTooltip()">${s.id}</div>`).join('');
}

function showSpotInfo(id,cls){
  if(cls==='spot-occupied'&&SPOT_VEHICLE_MAP[id]!==undefined){
    const v=vehiclesData[SPOT_VEHICLE_MAP[id]]||VEHICLES_DATA[SPOT_VEHICLE_MAP[id]];
    openDetailPanel(v);
  } else if(cls==='spot-free'){
    showToast('success',`Espacio ${id} disponible · Listo para asignar`,'fa-square-parking');
  } else if(cls==='spot-reserved'){
    showToast('info',`Espacio ${id} reservado · En espera de vehículo`,'fa-bookmark');
  } else {
    showToast('warning',`Espacio ${id} en mantenimiento · No disponible`,'fa-screwdriver-wrench');
  }
}

function showSpotTooltip(e,id,cls){
  const tt=document.getElementById('spot-tooltip');
  let content='';
  const states={'spot-free':'Disponible','spot-occupied':'Ocupado','spot-reserved':'Reservado','spot-maintenance':'En Mantenimiento'};
  const colors={'spot-free':'var(--green)','spot-occupied':'var(--red)','spot-reserved':'var(--amber)','spot-maintenance':'var(--text-muted)'};
  if(cls==='spot-occupied'&&SPOT_VEHICLE_MAP[id]!==undefined){
    const v=vehiclesData[SPOT_VEHICLE_MAP[id]]||VEHICLES_DATA[SPOT_VEHICLE_MAP[id]];
    content=`<div style="font-size:11px;font-weight:600;color:${colors[cls]};margin-bottom:6px">● ${states[cls]}</div><div style="font-size:12px;font-weight:700;color:var(--accent);font-family:monospace">${v.plate}</div><div style="font-size:11px;color:var(--text-primary);margin-top:2px">${v.owner}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">Ingreso: ${v.entry} · ${v.time}</div>`;
  } else {
    content=`<div style="font-size:11px;font-weight:600;color:${colors[cls]};margin-bottom:4px">● ${states[cls]}</div><div style="font-size:11px;color:var(--text-secondary)">Espacio N° ${id}</div>`;
  }
  tt.innerHTML=content;
  tt.style.display='block';
  tt.style.left=(e.clientX+12)+'px';
  tt.style.top=(e.clientY-10)+'px';
}
function hideSpotTooltip(){document.getElementById('spot-tooltip').style.display='none';}

// ============================================================
// EVENTS FEED
// ============================================================
function escaparHtmlEvento(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function renderEventsFeed() {
  const feed = document.getElementById("events-feed");

  if (!feed) {
    return;
  }

  if (EVENTS_DATA.length === 0) {
    feed.innerHTML = `
      <div style="
        padding:20px;
        text-align:center;
        color:var(--text-muted);
        font-size:12px;
      ">
        No existen eventos registrados.
      </div>
    `;

    return;
  }

  const colors = {
    green: "var(--green)",
    blue: "var(--accent)",
    amber: "var(--amber)",
    red: "var(--red)",
    teal: "var(--teal)"
  };

  const bgs = {
    green: "var(--green-bg)",
    blue: "var(--accent-glow)",
    amber: "var(--amber-bg)",
    red: "var(--red-bg)",
    teal: "var(--teal-bg)"
  };

  feed.innerHTML = EVENTS_DATA.map((evento) => `
    <div class="event-item">
      <div
        class="event-icon"
        style="
          background:${bgs[evento.color] || bgs.blue};
          color:${colors[evento.color] || colors.blue};
        "
      >
        <i class="fa-solid ${escaparHtmlEvento(evento.icon)}"></i>
      </div>

      <div class="event-text">
        <div class="event-title">
          ${escaparHtmlEvento(evento.title)}
        </div>

        <div class="event-meta">
          ${escaparHtmlEvento(evento.meta)}
        </div>
      </div>

      <div style="
        font-size:10px;
        color:var(--text-muted);
        flex-shrink:0;
        margin-left:auto;
      ">
        ${escaparHtmlEvento(evento.time)}
      </div>
    </div>
  `).join("");
}

function obtenerConfiguracionEvento(tipoEvento, nivel) {
  const tipo = String(tipoEvento || "").toLowerCase();
  const nivelNormalizado = String(nivel || "").toLowerCase();

  if (tipo.includes("ingreso")) {
    return {
      icon: "fa-right-to-bracket",
      color: "green",
      title: "Vehículo ingresó"
    };
  }

  if (tipo.includes("salida rechazada")) {
    return {
      icon: "fa-triangle-exclamation",
      color: "red",
      title: "Salida rechazada"
    };
  }

  if (tipo.includes("salida")) {
    return {
      icon: "fa-right-from-bracket",
      color: "blue",
      title: "Vehículo salió"
    };
  }

  if (tipo.includes("pago")) {
    return {
      icon: "fa-money-bill-wave",
      color: "green",
      title: "Pago registrado"
    };
  }

  if (tipo.includes("inicializacion")) {
    return {
      icon: "fa-power-off",
      color: "teal",
      title: "Sistema inicializado"
    };
  }

  if (
    nivelNormalizado.includes("error") ||
    nivelNormalizado.includes("advertencia")
  ) {
    return {
      icon: "fa-triangle-exclamation",
      color: "red",
      title: tipoEvento || "Advertencia del sistema"
    };
  }

  return {
    icon: "fa-circle-info",
    color: "blue",
    title: tipoEvento || "Evento del sistema"
  };
}


function formatearTiempoEvento(fechaHora) {
  if (!fechaHora) {
    return "Sin fecha";
  }

  const fecha = new Date(
    String(fechaHora).replace(" ", "T")
  );

  if (Number.isNaN(fecha.getTime())) {
    return fechaHora;
  }

  const diferenciaMilisegundos =
    Date.now() - fecha.getTime();

  const minutos = Math.max(
    0,
    Math.floor(diferenciaMilisegundos / 60000)
  );

  if (minutos < 1) {
    return "Ahora";
  }

  if (minutos < 60) {
    return `Hace ${minutos} min`;
  }

  const horas = Math.floor(minutos / 60);

  if (horas < 24) {
    return `Hace ${horas} h`;
  }

  const dias = Math.floor(horas / 24);

  return `Hace ${dias} día${dias === 1 ? "" : "s"}`;
}


async function cargarEventosReales() {
  try {
    const respuesta = await fetch(
      "/api/v2/historial/eventos?limite=10"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudieron obtener los eventos"
      );
    }

    const datos = await respuesta.json();

    if (!datos.ok) {
      throw new Error(
        datos.mensaje || "Respuesta de eventos no válida"
      );
    }

    EVENTS_DATA = datos.eventos.map((evento) => {
      const configuracion =
        obtenerConfiguracionEvento(
          evento.tipoEvento,
          evento.nivel
        );

      return {
        type: evento.tipoEvento,
        icon: configuracion.icon,
        color: configuracion.color,
        title: configuracion.title,
        meta: evento.descripcion,
        time: formatearTiempoEvento(
          evento.fechaHora
        )
      };
    });

    renderEventsFeed();

    console.log(
      "Eventos recientes actualizados con datos reales",
      EVENTS_DATA
    );
  } catch (error) {
    console.error(
      "Error al cargar los eventos reales:",
      error
    );

    EVENTS_DATA = [];
    renderEventsFeed();
  }
}

// ============================================================
// RANKINGS
// ============================================================
function renderRankings(
  establecimientos = [],
  promociones = []
) {
  const storesEl =
    document.getElementById("ranking-stores");

  const promosEl =
    document.getElementById("ranking-promos");

  if (storesEl) {
    if (establecimientos.length === 0) {
      storesEl.innerHTML = `
        <div style="
          padding:14px 6px;
          text-align:center;
          color:var(--text-muted);
          font-size:11px;
        ">
          No existen visitas registradas.
        </div>
      `;
    } else {
      storesEl.innerHTML =
        establecimientos.map(
          (establecimiento, indice) => `
            <div class="ranking-item">
              <div class="ranking-num">
                ${indice + 1}
              </div>

              <div class="ranking-info">
                <div style="
                  font-weight:500;
                  font-size:12px;
                ">
                  ${escaparHtmlEvento(
                    establecimiento.nombre
                  )}
                </div>

                <div style="
                  color:var(--text-muted);
                  font-size:10px;
                ">
                  ${establecimiento.totalVisitas}
                  visita${
                    establecimiento.totalVisitas === 1
                      ? ""
                      : "s"
                  }
                </div>
              </div>

              <div class="ranking-val">
                S/ ${Number(
                  establecimiento.consumoTotal
                ).toFixed(2)}
              </div>
            </div>
          `
        ).join("");
    }
  }

  if (promosEl) {
    if (promociones.length === 0) {
      promosEl.innerHTML = `
        <div style="
          padding:14px 6px;
          text-align:center;
          color:var(--text-muted);
          font-size:11px;
        ">
          No existen promociones aplicadas.
        </div>
      `;
    } else {
      promosEl.innerHTML =
        promociones.map(
          (promocion, indice) => `
            <div class="ranking-item">
              <div class="ranking-num">
                ${indice + 1}
              </div>

              <div
                class="ranking-info"
                style="font-size:12px"
              >
                ${escaparHtmlEvento(
                  promocion.nombre
                )}
              </div>

              <div
                class="ranking-val"
                style="color:var(--amber)"
              >
                ${promocion.totalUsos}
                uso${
                  promocion.totalUsos === 1
                    ? ""
                    : "s"
                }
              </div>
            </div>
          `
        ).join("");
    }
  }
}


async function cargarRankingsReales() {
  try {
    const respuesta = await fetch(
      "/api/v2/dashboard/rankings"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudieron obtener los rankings"
      );
    }

    const datos = await respuesta.json();

    if (!datos.ok || !datos.rankings) {
      throw new Error(
        datos.mensaje ||
        "La respuesta de rankings no es válida"
      );
    }

    renderRankings(
      datos.rankings.establecimientos || [],
      datos.rankings.promociones || []
    );

    console.log(
      "Rankings actualizados con datos reales",
      datos.rankings
    );
  } catch (error) {
    console.error(
      "Error al cargar los rankings reales:",
      error
    );

    renderRankings([], []);
  }
}

// ============================================================
// VEHICLES TABLE
// ============================================================
function renderVehiclesTable(data){
  const tbody=document.getElementById('vehicles-tbody');
  if(!tbody)return;
  const d=data||vehiclesData;
  const roleColors={VIP:'badge-purple','Trabajador':'badge-green','Común':'badge-gray','Propietario':'badge-blue','Proveedor':'badge-amber','Empresario':'badge-teal'};
  const statusColors={Activo:'badge-green',Inactivo:'badge-gray',Bloqueado:'badge-red'};
  tbody.innerHTML=d.map(v=>`
    <tr>
      <td><span style="font-family:monospace;font-weight:700;color:var(--accent);font-size:13px">${v.plate}</span></td>
      <td>${v.owner}</td>
      <td>${v.type}</td>
      <td><span class="badge ${roleColors[v.role]||'badge-gray'}">${v.role}</span></td>
      <td><span class="badge ${statusColors[v.status]||'badge-gray'}"><span class="status-dot ${v.status==='Activo'?'dot-green':v.status==='Bloqueado'?'dot-red':'dot-gray'}"></span>${v.status}</span></td>
      <td style="font-weight:600">${v.revenue}</td>
      <td>${v.benefits}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="openDetailPanel(${JSON.stringify(v).replace(/"/g,"'")})" title="Ver detalle"><i class="fa-solid fa-eye"></i></button>
        ${v.status === "Activo"
          ? `
            <button
              class="btn btn-ghost btn-sm"
              onclick="openVehicleModal(${v.id})"
              title="Editar"
            >
              <i class="fa-solid fa-pen"></i>
            </button>
          `
          : `
            <button
              class="btn btn-ghost btn-sm"
              disabled
              title="El vehículo está inactivo"
              style="opacity: 0.35; cursor: not-allowed;"
            >
              <i class="fa-solid fa-pen"></i>
            </button>
          `
      }
${
  v.status === "Activo"
    ? `
      <button
        class="btn btn-danger btn-sm"
        onclick="deleteVehicle(${v.id}, '${v.plate}')"
        title="Desactivar vehículo"
      >
        <i class="fa-solid fa-trash"></i>
      </button>
    `
    : `
      <button
        class="btn btn-ghost btn-sm"
        onclick="reactivateVehicle(${v.id}, '${v.plate}')"
        title="Reactivar vehículo"
        style="
          color: #22c55e;
          border-color: rgba(34, 197, 94, 0.35);
          background: rgba(34, 197, 94, 0.10);
        "
      >
        <i class="fa-solid fa-rotate-left"></i>
      </button>
    `
}        
        </div>
      </td>
    </tr>
  `).join('');
}

function filterVehicles(){
  const q=(document.getElementById('v-search').value||'').toLowerCase();
  const role=document.getElementById('v-filter-role').value;
  const status=document.getElementById('v-filter-status').value;
  const filtered=vehiclesData.filter(v=>{
    const matchQ=!q||(v.plate+v.owner).toLowerCase().includes(q);
    const matchR=!role||v.role.includes(role);
    const matchS=!status||v.status===status;
    return matchQ&&matchR&&matchS;
  });
  renderVehiclesTable(filtered);
}

async function deleteVehicle(idVehiculo, placa) {
  const confirmado = window.confirm(
    `¿Deseas desactivar el vehículo ${placa}?\n\n` +
    "El vehículo quedará inactivo y su tarjeta RFID será desactivada."
  );

  if (!confirmado) {
    return;
  }

  try {
    const respuesta = await fetch(
      `/api/v2/vehiculos/${idVehiculo}`,
      {
        method: "DELETE"
      }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(
        datos.mensaje ||
        "No se pudo desactivar el vehículo"
      );
    }

    await cargarVehiculosReales();
    await cargarDashboardReal();

    showToast(
      "success",
      datos.mensaje ||
      `Vehículo ${placa} desactivado correctamente`,
      "fa-circle-check"
    );
  } catch (error) {
    console.error(
      "Error al desactivar el vehículo:",
      error
    );

    showToast(
      "error",
      error.message ||
      "No se pudo desactivar el vehículo",
      "fa-triangle-exclamation"
    );
  }
}

async function reactivateVehicle(idVehiculo, placa) {
  const confirmado = window.confirm(
    `¿Deseas reactivar el vehículo ${placa}?\n\n` +
    "El vehículo y su última tarjeta RFID volverán a estar activos."
  );

  if (!confirmado) {
    return;
  }

  try {
    const respuesta = await fetch(
      `/api/v2/vehiculos/${idVehiculo}/reactivar`,
      {
        method: "PATCH"
      }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(
        datos.mensaje ||
        "No se pudo reactivar el vehículo"
      );
    }

    await cargarVehiculosReales();
    await cargarDashboardReal();

    showToast(
      "success",
      datos.mensaje ||
      `Vehículo ${placa} reactivado correctamente`,
      "fa-circle-check"
    );
  } catch (error) {
    console.error(
      "Error al reactivar el vehículo:",
      error
    );

    showToast(
      "error",
      error.message ||
      "No se pudo reactivar el vehículo",
      "fa-triangle-exclamation"
    );
  }
}

// ============================================================
// VEHICLES FEED (Monitor)
// ============================================================
function renderVehiclesFeed() {
  const feed = document.getElementById("vehicles-feed");

  if (!feed) {
    return;
  }

  const activos = vehiclesData.filter(
    (vehiculo) => vehiculo.inside
  );

    const contadorMonitor =
    document.getElementById(
      "monitor-detected-count"
    );

  if (contadorMonitor) {
    contadorMonitor.textContent =
      `${activos.length} activo${
        activos.length === 1 ? "" : "s"
      }`;
  }

  if (activos.length === 0) {
    feed.innerHTML = `
      <div style="
        padding:24px 14px;
        text-align:center;
        color:var(--text-muted);
        font-size:12px;
      ">
        <i
          class="fa-solid fa-square-parking"
          style="
            display:block;
            font-size:24px;
            margin-bottom:10px;
          "
        ></i>

        No hay vehículos dentro del estacionamiento.
      </div>
    `;

    return;
  }

  feed.innerHTML = activos.map((vehiculo, indice) => `
    <div
      class="vehicle-item ${indice === 0 ? "selected" : ""}"
      onclick="selectMonitorVehicle(this, '${vehiculo.plate}')"
    >
      <div class="v-plate">
        ${vehiculo.plate}
      </div>

      <div class="v-name">
        ${vehiculo.owner}
      </div>

      <div class="v-meta">
        <span>
          Ingreso: ${vehiculo.entry}
        </span>

        <span class="v-time">
          ${vehiculo.time}
        </span>
      </div>

      <div style="margin-top:3px">
        <span
          class="badge badge-green"
          style="font-size:10px"
        >
          Dentro
        </span>
      </div>
    </div>
  `).join("");
}

function selectMonitorVehicle(el,plate){
  el.closest('.v-list-body').querySelectorAll('.vehicle-item').forEach(x=>x.classList.remove('selected'));
  el.classList.add('selected');
  const v=vehiclesData.find(x=>x.plate===plate);
  if(v)openDetailPanel(v);
}

function normalizarRolVehiculo(rol) {
  const equivalencias = {
    "Cliente VIP": "VIP",
    "Usuario Comun": "Común",
    "Propietario de Tienda": "Propietario",
    "Empresario Frecuente": "Empresario",
    "Invitado Especial": "Invitado",
    "Trabajador": "Trabajador",
    "Proveedor": "Proveedor"
  };

  return equivalencias[rol] || rol || "Común";
}


function formatearHoraIngresoVehiculo(fechaHora) {
  if (!fechaHora) {
    return "—";
  }

  const fecha = new Date(fechaHora);

  if (Number.isNaN(fecha.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(fecha);
}


function formatearPermanenciaVehiculo(fechaHora) {
  if (!fechaHora) {
    return "—";
  }

  const fechaIngreso = new Date(fechaHora);

  if (Number.isNaN(fechaIngreso.getTime())) {
    return "—";
  }

  const minutosTotales = Math.max(
    0,
    Math.floor(
      (Date.now() - fechaIngreso.getTime()) / 60000
    )
  );

  if (minutosTotales < 60) {
    return `${minutosTotales} min`;
  }

  const horas = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;

  return `${horas}h ${minutos}m`;
}


function describirBeneficiosVehiculo(vehiculo) {
  if (vehiculo.exoneracionTotal) {
    return "Exoneración total";
  }

  const beneficios = [];

  if (Number(vehiculo.horasGratis) > 0) {
    beneficios.push(
      `${Number(vehiculo.horasGratis)} h gratis`
    );
  }

  if (Number(vehiculo.porcentajeDescuento) > 0) {
    beneficios.push(
      `${Number(vehiculo.porcentajeDescuento)}% descuento`
    );
  }

  return beneficios.length > 0
    ? beneficios.join(" · ")
    : "Sin beneficios";
}


async function cargarVehiculosReales() {
  try {
    const respuesta = await fetch("/api/v2/vehiculos");

    if (!respuesta.ok) {
      throw new Error(
        "No se pudieron obtener los vehículos"
      );
    }

    const datos = await respuesta.json();

    if (!datos.ok) {
      throw new Error(
        datos.mensaje ||
          "La respuesta de vehículos no es válida"
      );
    }

    vehiclesData = datos.vehiculos.map((vehiculo) => {
      const dentroDelEstacionamiento = Boolean(
        vehiculo.dentroDelEstacionamiento
      );

      return {
        id: vehiculo.idVehiculo,
        idRol: Number(vehiculo.idRol),
        plate: vehiculo.placa,
        owner: vehiculo.conductor,
        type: vehiculo.tipo,
        role: normalizarRolVehiculo(vehiculo.rol),
        status: vehiculo.estado,

        revenue: "—",
        benefits: describirBeneficiosVehiculo(vehiculo),

        entry: dentroDelEstacionamiento
          ? formatearHoraIngresoVehiculo(
              vehiculo.fechaHoraIngreso
            )
          : "—",

        time: dentroDelEstacionamiento
          ? formatearPermanenciaVehiculo(
              vehiculo.fechaHoraIngreso
            )
          : "—",

        color: vehiculo.color || "No especificado",
        brand: vehiculo.marca || "No especificada",
        model: vehiculo.modelo || "No especificado",
        doc: vehiculo.documento || "—",
        phone: vehiculo.telefono || "—",
        email: vehiculo.correo || "—",

        uidRfid: vehiculo.uidRfid,
        saldoVirtual:
          vehiculo.saldoVirtual === null
            ? null
            : Number(vehiculo.saldoVirtual),

        estadoTarjeta: vehiculo.estadoTarjeta,
        inside: dentroDelEstacionamiento,
        idSesion: vehiculo.idSesionActiva,
        idEspacio: vehiculo.idEspacioActual,
        estadoSesion: vehiculo.estadoSesion
      };
    });

    renderVehiclesTable();
    renderVehiclesFeed();

    const totalVip = vehiclesData.filter(
      (vehiculo) => vehiculo.role === "VIP"
    ).length;

    actualizarKpiDashboard(
      "USUARIOS VIP",
      totalVip,
      "Vehículos registrados como VIP"
    );

    const contadorMonitor =
      document.getElementById("v-feed-count");

    if (contadorMonitor) {
      const totalDentro = vehiclesData.filter(
        (vehiculo) => vehiculo.inside
      ).length;

      contadorMonitor.textContent =
        `${totalDentro} activos · actualizado ahora`;
    }

    console.log(
      "Vehículos actualizados con datos reales",
      vehiclesData
    );
  } catch (error) {
    console.error(
      "Error al cargar los vehículos reales:",
      error
    );

    vehiclesData = [];
    renderVehiclesTable();
    renderVehiclesFeed();

    showToast(
      "error",
      "No se pudieron cargar los vehículos",
      "fa-triangle-exclamation"
    );
  }
}

// ============================================================
// DETAIL PANEL
// ============================================================
function openDetailPanel(v){
  if(typeof v==='string')v=JSON.parse(v.replace(/'/g,'"'));
  currentVehicle=v;
  document.getElementById('dp-title').textContent=v.owner||'Detalle';
  document.getElementById('dp-plate').textContent='Placa: '+(v.plate||'');
  document.getElementById('dp-add-activity-btn').style.display='inline-flex';
  
  const tl=activeTimeline.map(t=>`
    <div class="timeline-item">
      <div class="timeline-dot" style="background:${t.kind==='tiempo'?'var(--purple-bg)':'var(--accent-glow)'};border-color:${t.kind==='tiempo'?'var(--purple)':'var(--accent)'}"><i class="fa-solid ${t.kind==='tiempo'?'fa-clock':'fa-bag-shopping'}" style="color:${t.kind==='tiempo'?'var(--purple)':'var(--accent)'};font-size:12px"></i></div>
      <div class="timeline-content">
        <div class="timeline-title">${t.store} · ${t.cat}</div>
        <div class="timeline-meta">${t.date} ${t.hour} · ${t.desc}</div>
        <div class="timeline-amount" style="color:${t.kind==='tiempo'?'var(--purple)':'var(--accent)'}">${t.amount}</div>
      </div>
    </div>
  `).join('');

  document.getElementById('dp-body').innerHTML=`
    <div class="info-block">
      <div class="info-block-title"><i class="fa-solid fa-user" style="color:var(--accent)"></i> Datos del Conductor</div>
      <div class="info-row"><span class="info-key">Nombre</span><span class="info-val">${v.owner||'—'}</span></div>
      <div class="info-row"><span class="info-key">Documento</span><span class="info-val">${v.doc||'—'}</span></div>
      <div class="info-row"><span class="info-key">Teléfono</span><span class="info-val">${v.phone||'—'}</span></div>
      <div class="info-row"><span class="info-key">Correo</span><span class="info-val" style="font-size:11px">${v.email||'—'}</span></div>
      <div class="info-row"><span class="info-key">Rol</span><span class="info-val"><span class="badge badge-purple">${v.role||'—'}</span></span></div>
    </div>
    <div class="info-block">
      <div class="info-block-title"><i class="fa-solid fa-car" style="color:var(--accent)"></i> Datos del Vehículo</div>
      <div class="info-row"><span class="info-key">Placa</span><span class="info-val" style="font-family:monospace;color:var(--accent)">${v.plate}</span></div>
      <div class="info-row"><span class="info-key">Tipo</span><span class="info-val">${v.type||'—'}</span></div>
      <div class="info-row"><span class="info-key">Marca / Modelo</span><span class="info-val">${v.brand||'—'} ${v.model||''}</span></div>
      <div class="info-row"><span class="info-key">Color</span><span class="info-val">${v.color||'—'}</span></div>
    </div>
    <div class="info-block">
      <div class="info-block-title"><i class="fa-solid fa-clock" style="color:var(--accent)"></i> Permanencia Actual</div>
      <div class="info-row"><span class="info-key">Hora de ingreso</span><span class="info-val">${v.entry||'—'}</span></div>
      <div class="info-row"><span class="info-key">Tiempo estacionado</span><span class="info-val" style="color:var(--green)">${v.time||'—'}</span></div>
      <div class="info-row"><span class="info-key">Tarifa actual</span><span class="info-val">S/ 3.50/h</span></div>
      <div class="info-row"><span class="info-key">Beneficio aplicado</span><span class="info-val">${v.role==='Trabajador'||v.role==='Propietario'?'<span class="badge badge-green">Exonerado</span>':v.role==='VIP'?'<span class="badge badge-purple">50% descuento</span>':'<span class="badge badge-gray">Sin beneficio</span>'}</span></div>
      <div class="info-row"><span class="info-key">Consumo registrado</span><span class="info-val" style="color:var(--accent);font-weight:700">S/ ${activeTimeline.filter(t=>t.kind!=='tiempo').reduce((s,t)=>s+(parseFloat(t.amount.replace('S/ ',''))||0),0).toFixed(2)}</span></div>
    </div>
    <div class="info-block">
      <div class="info-block-title" style="display:flex;justify-content:space-between;align-items:center"><span><i class="fa-solid fa-timeline" style="color:var(--accent)"></i> Actividades en el Centro Comercial</span></div>
      <div class="timeline" id="detail-timeline">${tl}</div>
    </div>
  `;
  document.getElementById('detail-panel').classList.add('open');
}

function closeDetailPanel(){
  document.getElementById('detail-panel').classList.remove('open');
}

function openActivityModal(){
  if(!currentVehicle){
    showToast('warning','Selecciona un vehículo primero','fa-triangle-exclamation');
    return;
  }
  const sel=document.getElementById('act-store');
  sel.innerHTML=storesData.filter(s=>s.status==='Activo').map(s=>`<option value="${s.name}" data-kind="${s.kind}" data-cat="${s.cat}">${s.name} (${s.cat})</option>`).join('');
  document.getElementById('act-desc').value='';
  document.getElementById('act-amount').value='';
  document.getElementById('act-minutes').value='';
  onActivityStoreChange();
  document.getElementById('modal-activity').classList.add('open');
}

function actualizarAyudaTipoEstablecimiento() {
  const tipo =
    document.getElementById("store-kind")
      ?.value || "consumo";

  const ayuda =
    document.getElementById(
      "store-kind-hint"
    );

  if (!ayuda) {
    return;
  }

  ayuda.textContent =
    tipo === "tiempo"
      ? "Este establecimiento registrará duración en minutos."
      : "Este establecimiento registrará consumos en soles.";
}

function onStoreCatChange() {
  const categoria =
    document.getElementById("store-cat")
      ?.value || "";

  const selectorTipo =
    document.getElementById("store-kind");

  if (!selectorTipo) {
    return;
  }

  if (
    categoria === "Cine" ||
    categoria === "Gimnasio"
  ) {
    selectorTipo.value = "tiempo";
  } else {
    selectorTipo.value = "consumo";
  }

  actualizarAyudaTipoEstablecimiento();
}

function onActivityStoreChange(){
  const sel=document.getElementById('act-store');
  const opt=sel.options[sel.selectedIndex];
  const kind=opt?opt.dataset.kind:'consumo';
  const amountWrap=document.getElementById('act-amount-wrap');
  const minutesWrap=document.getElementById('act-minutes-wrap');
  const hint=document.getElementById('act-type-hint');
  if(kind==='tiempo'){
    amountWrap.style.display='none';
    minutesWrap.style.display='block';
    hint.innerHTML='<i class="fa-solid fa-circle-info"></i> Este establecimiento registra duración en minutos (cine, gimnasio).';
  } else {
    amountWrap.style.display='block';
    minutesWrap.style.display='none';
    hint.innerHTML='<i class="fa-solid fa-circle-info"></i> Este establecimiento registra consumo en soles.';
  }
}

function saveActivity(){
  if(!currentVehicle)return;
  const sel=document.getElementById('act-store');
  const opt=sel.options[sel.selectedIndex];
  if(!opt){showToast('error','No hay establecimientos disponibles','fa-xmark');return;}
  const kind=opt.dataset.kind;
  const cat=opt.dataset.cat;
  const desc=document.getElementById('act-desc').value.trim();
  let amount='';
  if(kind==='tiempo'){
    const min=parseFloat(document.getElementById('act-minutes').value);
    if(!min||min<=0){showToast('error','Ingresa un tiempo válido en minutos','fa-xmark');return;}
    amount=min+' min';
  } else {
    const amt=parseFloat(document.getElementById('act-amount').value);
    if(!amt||amt<=0){showToast('error','Ingresa un monto válido','fa-xmark');return;}
    amount='S/ '+amt.toFixed(2);
  }
  const now=new Date();
  const newItem={
    date:now.toLocaleDateString('es-PE'),
    hour:now.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}),
    store:opt.value,
    cat:cat,
    desc:desc||(kind==='tiempo'?'Visita registrada':'Compra registrada'),
    amount:amount,
    kind:kind
  };
  activeTimeline.unshift(newItem);
  closeModal('modal-activity');
  if(currentVehicle)openDetailPanel(currentVehicle);
  showToast('success','Actividad agregada correctamente','fa-check');
}

// ============================================================
// HISTORY TABLE
// ============================================================
async function exportarHistorialPDF() {
  const boton =
    document.getElementById("historial-pdf-btn");

  const parametros = new URLSearchParams();

  const filtros = {
    placa:
      document.getElementById("h-plate")?.value.trim() || "",

    conductor:
      document.getElementById("h-driver")?.value.trim() || "",

    fechaInicio:
      document.getElementById("h-from")?.value || "",

    fechaFin:
      document.getElementById("h-to")?.value || "",

    estado:
      document.getElementById("h-status")?.value || "",

    tipo:
      document.getElementById("h-type")?.value || ""
  };

  Object.entries(filtros).forEach(
    ([nombre, valor]) => {
      if (valor) {
        parametros.set(nombre, valor);
      }
    }
  );

  const url =
    "/api/v2/historial/exportar/pdf" +
    (
      parametros.toString()
        ? `?${parametros.toString()}`
        : ""
    );

  try {
    if (boton) {
      boton.disabled = true;
      boton.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    }

    const respuesta = await fetch(url);

    if (!respuesta.ok) {
      let mensaje =
        "No se pudo generar el archivo PDF";

      try {
        const error = await respuesta.json();
        mensaje = error.mensaje || mensaje;
      } catch (errorLectura) {
        console.error(
          "No se pudo leer el error del PDF:",
          errorLectura
        );
      }

      throw new Error(mensaje);
    }

    const archivo = await respuesta.blob();

    const disposicion =
      respuesta.headers.get("Content-Disposition") || "";

    const coincidencia =
      disposicion.match(/filename="?([^"]+)"?/i);

    const nombreArchivo =
      coincidencia?.[1] ||
      `historial-smart-parking-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;

    const enlaceTemporal =
      URL.createObjectURL(archivo);

    const enlace =
      document.createElement("a");

    enlace.href = enlaceTemporal;
    enlace.download = nombreArchivo;

    document.body.appendChild(enlace);

    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(enlaceTemporal);

    showToast(
      "success",
      "Historial exportado a PDF",
      "fa-file-pdf"
    );
  } catch (error) {
    console.error(
      "Error al exportar el historial a PDF:",
      error
    );

    showToast(
      "error",
      error.message ||
      "No se pudo exportar el historial a PDF",
      "fa-triangle-exclamation"
    );
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.innerHTML =
        '<i class="fa-solid fa-file-pdf"></i> PDF';
    }
  }
}

async function exportarHistorialExcel() {
  const boton =
    document.getElementById("historial-excel-btn");

  const parametros = new URLSearchParams();

  const filtros = {
    placa:
      document.getElementById("h-plate")?.value.trim() || "",

    conductor:
      document.getElementById("h-driver")?.value.trim() || "",

    fechaInicio:
      document.getElementById("h-from")?.value || "",

    fechaFin:
      document.getElementById("h-to")?.value || "",

    estado:
      document.getElementById("h-status")?.value || "",

    tipo:
      document.getElementById("h-type")?.value || ""
  };

  Object.entries(filtros).forEach(
    ([nombre, valor]) => {
      if (valor) {
        parametros.set(nombre, valor);
      }
    }
  );

  const url =
    "/api/v2/historial/exportar/excel" +
    (
      parametros.toString()
        ? `?${parametros.toString()}`
        : ""
    );

  try {
    if (boton) {
      boton.disabled = true;
      boton.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    }

    const respuesta = await fetch(url);

    if (!respuesta.ok) {
      let mensaje =
        "No se pudo generar el archivo Excel";

      try {
        const error = await respuesta.json();

        mensaje = error.mensaje || mensaje;
      } catch (errorLectura) {
        console.error(
          "No se pudo leer el error de exportación:",
          errorLectura
        );
      }

      throw new Error(mensaje);
    }

    const archivo = await respuesta.blob();

    const disposicion =
      respuesta.headers.get("Content-Disposition") || "";

    const coincidencia =
      disposicion.match(
        /filename="?([^"]+)"?/i
      );

    const nombreArchivo =
      coincidencia?.[1] ||
      `historial-smart-parking-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

    const enlaceTemporal =
      URL.createObjectURL(archivo);

    const enlace =
      document.createElement("a");

    enlace.href = enlaceTemporal;
    enlace.download = nombreArchivo;

    document.body.appendChild(enlace);

    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(enlaceTemporal);

    showToast(
      "success",
      "Historial exportado a Excel",
      "fa-file-excel"
    );
  } catch (error) {
    console.error(
      "Error al exportar el historial:",
      error
    );

    showToast(
      "error",
      error.message ||
      "No se pudo exportar el historial",
      "fa-triangle-exclamation"
    );
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.innerHTML =
        '<i class="fa-solid fa-table"></i> Excel';
    }
  }
}

function escaparHtmlHistorial(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function renderHistoryTable(data = HISTORY_DATA) {
  const tbody = document.getElementById("history-tbody");

  if (!tbody) {
    return;
  }

  historialVisible = Array.isArray(data) ? data : [];

  const contador = document.querySelector(
    "#page-history .table-header .badge-blue"
  );

  if (contador) {
    contador.textContent =
      `${historialVisible.length} registro${
        historialVisible.length === 1 ? "" : "s"
      }`;
  }

  if (historialVisible.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="10"
          style="
            padding:28px;
            text-align:center;
            color:var(--text-muted);
          "
        >
          No existen sesiones que coincidan con los filtros.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = historialVisible.map((historial, indice) => {
    let claseTiempo = "badge-gray";

    if (historial.status === "Activa") {
      claseTiempo = "badge-green";
    }

    if (historial.status === "Penalizada") {
      claseTiempo = "badge-red";
    }

    return `
      <tr>
        <td>${escaparHtmlHistorial(historial.date)}</td>

        <td>${escaparHtmlHistorial(historial.in)}</td>

        <td>${escaparHtmlHistorial(historial.out)}</td>

        <td>
          <span class="badge ${claseTiempo}">
            ${escaparHtmlHistorial(historial.total)}
          </span>
        </td>

        <td>${escaparHtmlHistorial(historial.driver)}</td>

        <td
          style="
            font-family:monospace;
            color:var(--accent);
            font-weight:700;
          "
        >
          ${escaparHtmlHistorial(historial.plate)}
        </td>

        <td>${escaparHtmlHistorial(historial.consume)}</td>

        <td style="color:var(--green)">
          ${escaparHtmlHistorial(historial.discount)}
        </td>

        <td style="font-weight:700">
          ${escaparHtmlHistorial(historial.total_pay)}
        </td>

        <td>
          <button
            class="btn btn-ghost btn-sm"
            onclick="openHistoryDetail(${indice})"
            title="Ver detalle de la sesión"
          >
            <i class="fa-solid fa-eye"></i>

            ${
              historial.activities.length > 0
                ? `${historial.activities.length} movimiento${
                    historial.activities.length === 1 ? "" : "s"
                  }`
                : "Ver"
            }
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function openHistoryDetail(index) {
  const historial = historialVisible[index];

  if (!historial) {
    return;
  }

  currentVehicle = null;

  document.getElementById("dp-title").textContent =
    historial.driver;

  document.getElementById("dp-plate").textContent =
    `Placa: ${historial.plate} · Visita del ${historial.date}`;

  document.getElementById(
    "dp-add-activity-btn"
  ).style.display = "none";

  const actividades = historial.activities || [];

  const lineaTiempo = actividades.length > 0
    ? actividades.map((actividad) => `
        <div class="timeline-item">
          <div
            class="timeline-dot"
            style="
              background:var(--green-bg);
              border-color:var(--green);
            "
          >
            <i
              class="fa-solid fa-money-bill-wave"
              style="
                color:var(--green);
                font-size:12px;
              "
            ></i>
          </div>

          <div class="timeline-content">
            <div class="timeline-title">
              ${escaparHtmlHistorial(actividad.store)}
              ·
              ${escaparHtmlHistorial(actividad.cat)}
            </div>

            <div class="timeline-meta">
              ${escaparHtmlHistorial(historial.date)}
              ${escaparHtmlHistorial(actividad.hour)}
              ·
              ${escaparHtmlHistorial(actividad.desc)}
            </div>

            <div class="timeline-amount">
              ${escaparHtmlHistorial(actividad.amount)}
            </div>
          </div>
        </div>
      `).join("")
    : `
        <div class="empty-state" style="padding:20px">
          <i class="fa-solid fa-receipt"></i>

          <div style="font-size:12px;margin-top:8px">
            No existen pagos asociados a esta sesión.
          </div>
        </div>
      `;

  document.getElementById("dp-body").innerHTML = `
    <div class="info-block">
      <div class="info-block-title">
        <i
          class="fa-solid fa-user"
          style="color:var(--accent)"
        ></i>
        Datos de la Visita
      </div>

      <div class="info-row">
        <span class="info-key">Conductor</span>
        <span class="info-val">
          ${escaparHtmlHistorial(historial.driver)}
        </span>
      </div>

      <div class="info-row">
        <span class="info-key">Placa</span>
        <span
          class="info-val"
          style="
            font-family:monospace;
            color:var(--accent);
          "
        >
          ${escaparHtmlHistorial(historial.plate)}
        </span>
      </div>

      <div class="info-row">
        <span class="info-key">Tipo de vehículo</span>
        <span class="info-val">
          ${escaparHtmlHistorial(historial.type)}
        </span>
      </div>

      <div class="info-row">
        <span class="info-key">Estado</span>
        <span class="info-val">
          ${escaparHtmlHistorial(historial.status)}
        </span>
      </div>

      <div class="info-row">
        <span class="info-key">Fecha</span>
        <span class="info-val">
          ${escaparHtmlHistorial(historial.date)}
        </span>
      </div>

      <div class="info-row">
        <span class="info-key">Hora de ingreso</span>
        <span class="info-val">
          ${escaparHtmlHistorial(historial.in)}
        </span>
      </div>

      <div class="info-row">
        <span class="info-key">Hora de salida</span>
        <span class="info-val">
          ${escaparHtmlHistorial(historial.out)}
        </span>
      </div>

      <div class="info-row">
        <span class="info-key">Tiempo total</span>
        <span class="info-val">
          ${escaparHtmlHistorial(historial.total)}
        </span>
      </div>
    </div>

    <div class="info-block">
      <div class="info-block-title">
        <i
          class="fa-solid fa-receipt"
          style="color:var(--accent)"
        ></i>
        Resumen de Pago
      </div>

      <div class="info-row">
        <span class="info-key">Consumo registrado</span>
        <span class="info-val">
          ${escaparHtmlHistorial(historial.consume)}
        </span>
      </div>

      <div class="info-row">
        <span class="info-key">Descuento aplicado</span>
        <span
          class="info-val"
          style="color:var(--green)"
        >
          ${escaparHtmlHistorial(historial.discount)}
        </span>
      </div>

      <div class="info-row">
        <span class="info-key">
          Total pagado por estacionamiento
        </span>

        <span
          class="info-val"
          style="
            color:var(--accent);
            font-weight:700;
          "
        >
          ${escaparHtmlHistorial(historial.total_pay)}
        </span>
      </div>
    </div>

    <div class="info-block">
      <div class="info-block-title">
        <i
          class="fa-solid fa-timeline"
          style="color:var(--accent)"
        ></i>
        Movimientos de la Sesión
      </div>

      <div class="timeline">
        ${lineaTiempo}
      </div>
    </div>
  `;

  document
    .getElementById("detail-panel")
    .classList.add("open");
}

function convertirFechaHistorial(fechaHora) {
  if (!fechaHora) {
    return {
      fecha: "—",
      hora: "—",
      fechaISO: ""
    };
  }

  const fecha = new Date(
    String(fechaHora).replace(" ", "T")
  );

  if (Number.isNaN(fecha.getTime())) {
    return {
      fecha: "—",
      hora: "—",
      fechaISO: ""
    };
  }

  return {
    fecha: new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(fecha),

    hora: new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).format(fecha),

    fechaISO: String(fechaHora).slice(0, 10)
  };
}


function formatearDuracionHistorial(minutos, estado) {
  if (estado === "Activa") {
    return "Activo";
  }

  const totalMinutos = Math.max(
    0,
    Number(minutos) || 0
  );

  if (totalMinutos < 60) {
    return `${totalMinutos} min`;
  }

  const horas = Math.floor(totalMinutos / 60);
  const minutosRestantes = totalMinutos % 60;

  return `${horas}h ${minutosRestantes}m`;
}


function aplicarFiltrosHistorial() {
  const placa = (
    document.getElementById("h-plate")?.value || ""
  ).trim().toLowerCase();

  const conductor = (
    document.getElementById("h-driver")?.value || ""
  ).trim().toLowerCase();

  const fechaInicio =
    document.getElementById("h-from")?.value || "";

  const fechaFin =
    document.getElementById("h-to")?.value || "";

  const estado =
    document.getElementById("h-status")?.value || "";

  const tipo =
    document.getElementById("h-type")?.value || "";

  const filtrados = HISTORY_DATA.filter((historial) => {
    const coincidePlaca =
      !placa ||
      historial.plate.toLowerCase().includes(placa);

    const coincideConductor =
      !conductor ||
      historial.driver
        .toLowerCase()
        .includes(conductor);

    const coincideInicio =
      !fechaInicio ||
      historial.dateISO >= fechaInicio;

    const coincideFin =
      !fechaFin ||
      historial.dateISO <= fechaFin;

    const coincideEstado =
      !estado ||
      historial.status === estado;

    const coincideTipo =
      !tipo ||
      historial.type === tipo;

    return (
      coincidePlaca &&
      coincideConductor &&
      coincideInicio &&
      coincideFin &&
      coincideEstado &&
      coincideTipo
    );
  });

  renderHistoryTable(filtrados);

  showToast(
    "success",
    `${filtrados.length} registro(s) encontrado(s)`,
    "fa-filter"
  );
}


function limpiarFiltrosHistorial() {
  [
    "h-plate",
    "h-driver",
    "h-from",
    "h-to",
    "h-status",
    "h-type"
  ].forEach((id) => {
    const elemento = document.getElementById(id);

    if (elemento) {
      elemento.value = "";
    }
  });

  renderHistoryTable();

  showToast(
    "info",
    "Filtros limpiados",
    "fa-xmark"
  );
}

async function cargarGraficosHistorialReal() {
  try {
    const respuesta = await fetch(
      "/api/v2/historial/graficos"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudieron obtener los gráficos del historial"
      );
    }

    const datos = await respuesta.json();

    if (!datos.ok || !datos.graficos) {
      throw new Error(
        datos.mensaje ||
        "La respuesta de gráficos no es válida"
      );
    }

    const graficos = datos.graficos;

    // Ocupación histórica de los últimos siete días.
    if (charts.histOcc) {
      charts.histOcc.data.labels =
        graficos.ocupacionHistorica.map(
          (registro) => registro.etiqueta
        );

      charts.histOcc.data.datasets[0].data =
        graficos.ocupacionHistorica.map(
          (registro) =>
            Number(registro.porcentaje)
        );

      charts.histOcc.update();
    }

    // Ingresos reales de los últimos siete días.
    if (charts.histInc) {
      charts.histInc.data.labels =
        graficos.ingresosSemanales.map(
          (registro) => registro.etiqueta
        );

      charts.histInc.data.datasets[0].data =
        graficos.ingresosSemanales.map(
          (registro) => Number(registro.total)
        );

      charts.histInc.update();
    }

    console.log(
      "Gráficos del historial actualizados con datos reales",
      graficos
    );
  } catch (error) {
    console.error(
      "Error al cargar los gráficos del historial:",
      error
    );

    showToast(
      "error",
      "No se pudieron cargar los gráficos del historial",
      "fa-chart-line"
    );
  }
}

async function cargarHistorialReal() {
  try {
    const [
      respuestaSesiones,
      respuestaPagos
    ] = await Promise.all([
      fetch("/api/v2/historial/sesiones?limite=200"),
      fetch("/api/v2/historial/pagos?limite=200")
    ]);

    if (
      !respuestaSesiones.ok ||
      !respuestaPagos.ok
    ) {
      throw new Error(
        "No se pudo obtener el historial"
      );
    }

    const datosSesiones =
      await respuestaSesiones.json();

    const datosPagos =
      await respuestaPagos.json();

    if (!datosSesiones.ok || !datosPagos.ok) {
      throw new Error(
        "Las API de historial devolvieron un error"
      );
    }

    const pagosPorSesion = new Map();

    datosPagos.pagos.forEach((pago) => {
      const lista =
        pagosPorSesion.get(pago.idSesion) || [];

      lista.push(pago);

      pagosPorSesion.set(pago.idSesion, lista);
    });

    HISTORY_DATA = datosSesiones.sesiones.map(
      (sesion) => {
        const ingreso = convertirFechaHistorial(
          sesion.fechaHoraIngreso
        );

        const salida = convertirFechaHistorial(
          sesion.fechaHoraSalida
        );

        const pagos =
          pagosPorSesion.get(sesion.idSesion) || [];

        return {
          idSesion: sesion.idSesion,
          date: ingreso.fecha,
          dateISO: ingreso.fechaISO,
          in: ingreso.hora,
          out: sesion.fechaHoraSalida
            ? salida.hora
            : "—",

          total: formatearDuracionHistorial(
            sesion.tiempoTotalMinutos,
            sesion.estado
          ),

          driver: sesion.conductor,
          plate: sesion.placa,
          type: sesion.tipoVehiculo,
          status: sesion.estado,

          consume:
            `S/ ${Number(
              sesion.consumoRegistrado
            ).toFixed(2)}`,

          discount:
            `S/ ${Number(
              sesion.montoDescuento
            ).toFixed(2)}`,

          total_pay:
            `S/ ${Number(
              sesion.totalPagado
            ).toFixed(2)}`,

          activities: pagos.map((pago) => {
            const fechaPago =
              convertirFechaHistorial(
                pago.fechaPago
              );

            return {
              kind: "pago",
              store:
                pago.observaciones ||
                "Pago de estacionamiento",

              cat:
                pago.metodoPago ||
                "Método no indicado",

              hour: fechaPago.hora,

              desc:
                pago.referencia ||
                pago.estado,

              amount:
                `S/ ${Number(
                  pago.monto
                ).toFixed(2)}`
            };
          })
        };
      }
    );

    renderHistoryTable();

    await cargarGraficosHistorialReal();

    console.log(
      "Historial actualizado con datos reales",
      HISTORY_DATA
    );
  } catch (error) {
    console.error(
      "Error al cargar el historial real:",
      error
    );

    HISTORY_DATA = [];
    renderHistoryTable();

    showToast(
      "error",
      "No se pudo cargar el historial",
      "fa-triangle-exclamation"
    );
  }
}

// ============================================================
// IoT
// ============================================================
function renderIoTDevices() {
  const contenedor =
    document.getElementById("iot-devices");

  if (!contenedor) {
    return;
  }

  if (IOT_DEVICES.length === 0) {
    contenedor.innerHTML = `
      <div class="chart-card" style="grid-column:1/-1;text-align:center;color:var(--text-muted)">
        No existen dispositivos IoT registrados.
      </div>
    `;
    return;
  }

  contenedor.innerHTML = IOT_DEVICES.map(
    (dispositivo) => {
      const porcentaje = Math.max(
        0,
        Math.min(100, dispositivo.signal)
      );

      const estado = dispositivo.status;

      const colorEstado =
        estado === "online"
          ? "var(--green)"
          : estado === "advertencia"
            ? "var(--amber)"
            : estado === "mantenimiento"
              ? "var(--purple)"
              : "var(--red)";

      const fondoEstado =
        estado === "online"
          ? "var(--green-bg)"
          : estado === "advertencia"
            ? "var(--amber-bg)"
            : estado === "mantenimiento"
              ? "var(--purple-bg)"
              : "var(--red-bg)";

      const barras = [...Array(5)]
        .map(
          (_, indice) => `
            <div
              class="bar ${
                indice < Math.ceil(porcentaje / 20)
                  ? "active"
                  : ""
              }"
              style="height:${6 + indice * 3}px"
            ></div>
          `
        )
        .join("");

      const conexionWifi =
        dispositivo.connection === "WiFi";

      return `
        <div class="device-card">
          <div class="device-header">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:34px;height:34px;border-radius:var(--radius-sm);background:var(--accent-glow);display:flex;align-items:center;justify-content:center;color:var(--accent)">
                <i class="fa-solid ${dispositivo.icon}" style="font-size:17px"></i>
              </div>

              <div>
                <div class="device-name">${dispositivo.name}</div>
                <div style="font-size:10px;color:var(--text-muted)">
                  ${dispositivo.codigo}
                </div>
              </div>
            </div>

            <div
              class="device-status"
              style="color:${colorEstado};background:${fondoEstado};padding:3px 8px;border-radius:20px;font-size:10px"
            >
              ${estado.toUpperCase()}
            </div>
          </div>

          <div class="stat-row">
            <span class="stat-label">Tipo</span>
            <span class="stat-val">${dispositivo.tipo}</span>
          </div>

          <div class="stat-row">
            <span class="stat-label">Conexión</span>
            <span class="badge ${conexionWifi ? "badge-blue" : "badge-teal"}">
              <i class="fa-solid ${conexionWifi ? "fa-wifi" : "fa-plug"}" style="font-size:11px"></i>
              ${dispositivo.connection}
            </span>
          </div>

          <div class="stat-row">
            <span class="stat-label">Señal</span>

            <div style="display:flex;align-items:center;gap:6px">
              <div class="signal-bars">${barras}</div>
              <span class="stat-val">${porcentaje}%</span>
            </div>
          </div>

          <div class="stat-row">
            <span class="stat-label">Dirección</span>
            <span class="stat-val" style="font-family:monospace;font-size:11px">
              ${dispositivo.ip}
            </span>
          </div>

          <div class="stat-row">
            <span class="stat-label">Latencia</span>
            <span class="stat-val">${dispositivo.latency} ms</span>
          </div>

          <div class="stat-row">
            <span class="stat-label">Ubicación</span>
            <span class="stat-val">${dispositivo.location}</span>
          </div>

          <div class="stat-row">
            <span class="stat-label">Última lectura</span>
            <span class="stat-val" style="color:var(--text-secondary)">
              ${dispositivo.last}
            </span>
          </div>
        </div>
      `;
    }
  ).join("");
}

function formatearSincronizacionIoT(fecha) {
  if (!fecha) {
    return "Sin registros";
  }

  const fechaConvertida = new Date(fecha);

  if (Number.isNaN(fechaConvertida.getTime())) {
    return String(fecha);
  }

  return fechaConvertida.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function recargarDatosIoT() {
  const boton =
    document.getElementById("iot-refresh-btn");

  const icono = boton?.querySelector("i");

  try {
    if (boton) {
      boton.disabled = true;
    }

    if (icono) {
      icono.classList.add("fa-spin");
    }

    await Promise.all([
      cargarDispositivosIoTReales(),
      cargarResumenIoTReal(),
      cargarLogsIoTReales()
    ]);

    showToast(
      "success",
      "Datos IoT actualizados",
      "fa-check"
    );
  } catch (error) {
    console.error(
      "Error al actualizar Administración IoT:",
      error
    );

    showToast(
      "error",
      "No se pudieron actualizar los datos IoT",
      "fa-triangle-exclamation"
    );
  } finally {
    if (boton) {
      boton.disabled = false;
    }

    if (icono) {
      icono.classList.remove("fa-spin");
    }
  }
}

async function cargarResumenIoTReal() {
  try {
    const respuesta = await fetch(
      "/api/v2/iot/resumen"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudo obtener el resumen IoT"
      );
    }

    const datos = await respuesta.json();

    if (!datos.ok || !datos.resumen) {
      throw new Error(
        datos.mensaje ||
        "El resumen IoT recibido no es válido"
      );
    }

    const resumen = datos.resumen;

    const totalAlertas =
      Number(resumen.dispositivosOffline || 0) +
      Number(resumen.dispositivosAdvertencia || 0) +
      Number(resumen.dispositivosMantenimiento || 0);

    const latencia =
      Number(resumen.latenciaPromedioMs) || 0;

    const badgeOnline =
      document.getElementById("iot-online-badge");

    const badgeAlertas =
      document.getElementById("iot-alert-badge");

    const kpiLatencia =
      document.getElementById("iot-kpi-latencia");

    const kpiLatenciaEstado =
      document.getElementById(
        "iot-kpi-latencia-estado"
      );

    const kpiSincronizacion =
      document.getElementById(
        "iot-kpi-sincronizacion"
      );

    const kpiEventos =
      document.getElementById("iot-kpi-eventos");

    if (badgeOnline) {
      badgeOnline.innerHTML = `
        <span
          class="status-dot dot-green"
          style="margin:0;margin-right:4px"
        ></span>
        ${Number(resumen.dispositivosOnline)} Online
      `;
    }

    if (badgeAlertas) {
      badgeAlertas.textContent =
        `${totalAlertas} ${
          totalAlertas === 1 ? "Alerta" : "Alertas"
        }`;

      badgeAlertas.title =
        `${Number(resumen.dispositivosOffline)} offline, ` +
        `${Number(resumen.dispositivosAdvertencia)} en advertencia y ` +
        `${Number(resumen.dispositivosMantenimiento)} en mantenimiento`;
    }

    if (kpiLatencia) {
      kpiLatencia.textContent =
        `${latencia} ms`;
    }

    if (kpiLatenciaEstado) {
      if (latencia <= 20) {
        kpiLatenciaEstado.textContent = "Excelente";
        kpiLatenciaEstado.style.color = "var(--green)";
      } else if (latencia <= 50) {
        kpiLatenciaEstado.textContent = "Aceptable";
        kpiLatenciaEstado.style.color = "var(--amber)";
      } else {
        kpiLatenciaEstado.textContent = "Latencia alta";
        kpiLatenciaEstado.style.color = "var(--red)";
      }
    }

    if (kpiSincronizacion) {
      kpiSincronizacion.textContent =
        formatearSincronizacionIoT(
          resumen.ultimaSincronizacion
        );
    }

    if (kpiEventos) {
      kpiEventos.textContent =
        Number(resumen.eventosHoy) || 0;
    }

    console.log(
      "Resumen IoT actualizado con datos reales",
      resumen
    );
  } catch (error) {
    console.error(
      "Error al cargar el resumen IoT:",
      error
    );

    showToast(
      "error",
      "No se pudo cargar el resumen IoT",
      "fa-triangle-exclamation"
    );
  }
}

function obtenerIconoDispositivoIoT(tipo) {
  const iconos = {
    "ESP32": "fa-microchip",
    "ESP32-CAM": "fa-camera",
    "RFID": "fa-satellite-dish",
    "Sensor": "fa-wave-square",
    "OLED": "fa-desktop",
    "Servomotor": "fa-gears",
    "Puntero laser": "fa-bullseye",
    "LDR": "fa-sun",
    "Potenciometro": "fa-sliders",
    "Otro": "fa-plug"
  };

  return iconos[tipo] || "fa-plug";
}


function formatearFechaIoT(fecha) {
  if (!fecha) {
    return "Sin registro";
  }

  const partes = String(fecha).split(" ");

  if (partes.length !== 2) {
    return fecha;
  }

  const fechaPartes = partes[0].split("-");

  if (fechaPartes.length !== 3) {
    return fecha;
  }

  return `${fechaPartes[2]}/${fechaPartes[1]}/${fechaPartes[0]} ${partes[1]}`;
}

function actualizarMonitorCamaraReal() {
  const camara = IOT_DEVICES.find(
    (dispositivo) =>
      dispositivo.tipo === "ESP32-CAM"
  );

  const nombre =
    document.getElementById("monitor-camera-name");

  const estado =
    document.getElementById("monitor-camera-status");

  const direccion =
    document.getElementById("monitor-camera-address");

  const latencia =
    document.getElementById("monitor-camera-latency");

  const ultimaLectura =
    document.getElementById("monitor-camera-last");

  const estadoDispositivo =
    document.getElementById(
      "monitor-camera-device-state"
    );

  const indicador =
    document.getElementById("monitor-camera-rec");

  const estadoSistema =
    document.getElementById(
      "monitor-system-status"
    );

  const activos = vehiclesData.filter(
    (vehiculo) => vehiculo.inside
  ).length;

  const contador =
    document.getElementById(
      "monitor-detected-count"
    );

  if (contador) {
    contador.textContent =
      `${activos} activo${activos === 1 ? "" : "s"}`;
  }

  if (!camara) {
    if (nombre) {
      nombre.textContent = "Cámara no registrada";
    }

    if (estado) {
      estado.textContent = "Sin conexión";
      estado.className = "badge badge-gray";
    }

    if (direccion) {
      direccion.textContent = "Sin dirección";
    }

    if (latencia) {
      latencia.textContent = "—";
    }

    if (ultimaLectura) {
      ultimaLectura.textContent = "Sin registro";
    }

    if (estadoDispositivo) {
      estadoDispositivo.textContent =
        "No registrada";
    }

        if (estadoSistema) {
      estadoSistema.textContent =
        "Cámara no registrada";

      estadoSistema.style.color =
        "var(--red)";
    }

    return;
  }

  const estaOnline =
    camara.status === "online";
  
  if (estadoSistema) {
    estadoSistema.textContent =
      estaOnline
        ? "Sistema conectado"
        : "Sistema sin conexión";

    estadoSistema.style.color =
      estaOnline
        ? "var(--green)"
        : "var(--red)";
  }

  if (nombre) {
    nombre.textContent = camara.name;
  }

  if (estado) {
    estado.textContent =
      estaOnline ? "Online" : camara.status;

    estado.className =
      estaOnline
        ? "badge badge-green"
        : "badge badge-red";
  }

  if (direccion) {
    direccion.textContent = camara.ip;
  }

  if (latencia) {
    latencia.textContent =
      camara.latency > 0
        ? `${camara.latency} ms`
        : "Sin dato";
  }

  if (ultimaLectura) {
    ultimaLectura.textContent =
      camara.last || "Sin registro";
  }

  if (estadoDispositivo) {
    estadoDispositivo.textContent =
      estaOnline ? "Operativo" : camara.status;

    estadoDispositivo.style.color =
      estaOnline
        ? "var(--green)"
        : "var(--red)";
  }

  if (indicador) {
    indicador.innerHTML = `
      <span class="dot"></span>
      ${estaOnline ? "CONECTADA" : "SIN SEÑAL"}
    `;
  }
}

async function cargarDispositivosIoTReales() {
  try {
    const respuesta = await fetch(
      "/api/v2/iot/dispositivos"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudieron obtener los dispositivos IoT"
      );
    }

    const datos = await respuesta.json();

    if (
      !datos.ok ||
      !Array.isArray(datos.dispositivos)
    ) {
      throw new Error(
        datos.mensaje ||
        "La respuesta de dispositivos no es válida"
      );
    }

    IOT_DEVICES = datos.dispositivos.map(
      (dispositivo) => ({
        idDispositivo:
          dispositivo.idDispositivo,

        codigo:
          dispositivo.codigo,

        name:
          dispositivo.nombre,

        icon:
          obtenerIconoDispositivoIoT(
            dispositivo.tipoDispositivo
          ),

        tipo:
          dispositivo.tipoDispositivo,

        status:
          String(dispositivo.estado).toLowerCase(),

        signal:
          Number(dispositivo.intensidadSenal) || 0,

        latency:
          Number(dispositivo.latenciaMs) || 0,

        uptime:
          "No calculado",

        last:
          formatearFechaIoT(
            dispositivo.ultimaLectura ||
            dispositivo.ultimaConexion
          ),

        ip:
          dispositivo.direccionRed ||
          "Sin dirección",

        connection:
          dispositivo.tipoConexion || "Otro",

        location:
          dispositivo.ubicacion ||
          "Ubicación no registrada",

        description:
          dispositivo.descripcion || ""
      })
    );

    renderIoTDevices();

    actualizarMonitorCamaraReal();

    console.log(
      "Dispositivos IoT actualizados con datos reales",
      IOT_DEVICES
    );
  } catch (error) {
    console.error(
      "Error al cargar los dispositivos IoT:",
      error
    );

    IOT_DEVICES = [];
    renderIoTDevices();

    showToast(
      "error",
      "No se pudieron cargar los dispositivos IoT",
      "fa-triangle-exclamation"
    );
  }
}

function obtenerHoraLogIoT(fecha) {
  if (!fecha) {
    return "--:--:--";
  }

  const partes = String(fecha).split(" ");

  return partes.length === 2
    ? partes[1]
    : String(fecha);
}


function escaparTextoIoT(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


async function cargarLogsIoTReales() {
  try {
    const respuesta = await fetch(
      "/api/v2/iot/logs?limite=30"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudieron obtener los logs IoT"
      );
    }

    const datos = await respuesta.json();

    if (!datos.ok || !Array.isArray(datos.logs)) {
      throw new Error(
        datos.mensaje ||
        "La respuesta de logs no es válida"
      );
    }

    IOT_LOGS = datos.logs.map((log) => ({
      idLog: log.idLog,

      time:
        obtenerHoraLogIoT(log.fechaHora),

      date:
        formatearFechaIoT(log.fechaHora),

      level:
        log.nivel,

      code:
        log.codigoEvento || "SIN_CODIGO",

      msg:
        `${log.dispositivo}: ${log.mensaje}`
    }));

    renderIoTLogs();

    console.log(
      "Logs IoT actualizados con datos reales",
      IOT_LOGS
    );
  } catch (error) {
    console.error(
      "Error al cargar los logs IoT:",
      error
    );

    IOT_LOGS = [];
    renderIoTLogs();

    showToast(
      "error",
      "No se pudieron cargar los logs IoT",
      "fa-triangle-exclamation"
    );
  }
}

function renderIoTLogs() {
  const contenedor =
    document.getElementById("iot-logs");

  if (!contenedor) {
    return;
  }

  if (IOT_LOGS.length === 0) {
    contenedor.innerHTML = `
      <div style="padding:20px;text-align:center;color:var(--text-muted)">
        No existen registros IoT disponibles.
      </div>
    `;
    return;
  }

  const clasesPorNivel = {
    OK: "log-ok",
    INFO: "log-info",
    WARN: "log-warn",
    ERROR: "log-err",
    ERR: "log-err",
    DEBUG: "log-info"
  };

  contenedor.innerHTML = IOT_LOGS.map(
    (log) => `
      <div class="log-line" title="${escaparTextoIoT(log.date)}">
        <span class="log-time">
          ${escaparTextoIoT(log.time)}
        </span>

        <span class="log-level ${
          clasesPorNivel[log.level] || "log-info"
        }">
          [${escaparTextoIoT(log.level)}]
        </span>

        <span style="color:var(--text-muted);font-family:monospace;font-size:10px">
          ${escaparTextoIoT(log.code)}
        </span>

        <span style="color:var(--text-secondary)">
          ${escaparTextoIoT(log.msg)}
        </span>
      </div>
    `
  ).join("");
}

// ============================================================
// CONFIGURACIÓN GENERAL DEL SISTEMA
// ============================================================
function actualizarToggleConfiguracion(
  idElemento,
  activado
) {
  const elemento =
    document.getElementById(idElemento);

  if (!elemento) {
    return;
  }

  elemento.classList.toggle(
    "on",
    Boolean(activado)
  );
}

function obtenerEstadoToggleConfiguracion(idElemento) {
  const elemento = document.getElementById(idElemento);

  return elemento
    ? elemento.classList.contains("on")
    : false;
}


async function guardarConfiguracionSistema() {
  const boton =
    document.getElementById("config-guardar-btn");

  const campoNombre =
    document.getElementById("config-sistema-nombre");

  const campoTiempo =
    document.getElementById("config-sistema-tiempo");

  const nombreEstacionamiento =
    campoNombre?.value.trim() || "";

  const tiempoMaximoHoras =
    Number(campoTiempo?.value);

  if (!nombreEstacionamiento) {
    showToast(
      "error",
      "Ingresa el nombre del estacionamiento",
      "fa-triangle-exclamation"
    );
    return;
  }

  if (
    !Number.isInteger(tiempoMaximoHoras) ||
    tiempoMaximoHoras < 1 ||
    tiempoMaximoHoras > 168
  ) {
    showToast(
      "error",
      "El tiempo máximo debe estar entre 1 y 168 horas",
      "fa-triangle-exclamation"
    );
    return;
  }

  const configuracion = {
    nombreEstacionamiento,
    tiempoMaximoHoras,

    alertasVisuales:
      obtenerEstadoToggleConfiguracion(
        "config-alertas-visuales"
      ),

    alertasSonoras:
      obtenerEstadoToggleConfiguracion(
        "config-alertas-sonoras"
      ),

    correosAutomaticos:
      obtenerEstadoToggleConfiguracion(
        "config-correos-automaticos"
      ),

    alertasSensoresDesconectados:
      obtenerEstadoToggleConfiguracion(
        "config-alertas-sensores"
      )
  };

  const preferencias = {
    temaPreferido:
      document.documentElement.getAttribute(
        "data-theme"
      ) === "light"
        ? "light"
        : "dark",

    colorPrincipal:
      getComputedStyle(
        document.documentElement
      )
        .getPropertyValue("--accent")
        .trim() || "#4f8ef7"
  };

  try {
    if (boton) {
      boton.disabled = true;
      boton.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    }

    const [
      respuestaConfiguracion,
      respuestaPreferencias
    ] = await Promise.all([
      fetch(
        "/api/v2/configuracion/sistema",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(configuracion)
        }
      ),

      fetch(
        "/api/v2/configuracion/administrador/preferencias",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(preferencias)
        }
      )
    ]);

    const [
      datosConfiguracion,
      datosPreferencias
    ] = await Promise.all([
      respuestaConfiguracion.json(),
      respuestaPreferencias.json()
    ]);

    if (
      !respuestaConfiguracion.ok ||
      !datosConfiguracion.ok
    ) {
      throw new Error(
        datosConfiguracion.mensaje ||
        "No se pudo guardar la configuración"
      );
    }

    if (
      !respuestaPreferencias.ok ||
      !datosPreferencias.ok
    ) {
      throw new Error(
        datosPreferencias.mensaje ||
        "No se pudieron guardar las preferencias visuales"
      );
    }

    await Promise.all([
      cargarConfiguracionSistemaReal(),
      cargarAdministradorReal()
    ]);

    showToast(
      "success",
      "Configuración guardada correctamente",
      "fa-check"
    );
  } catch (error) {
    console.error(
      "Error al guardar la configuración:",
      error
    );

    showToast(
      "error",
      error.message ||
      "No se pudo guardar la configuración",
      "fa-triangle-exclamation"
    );
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.innerHTML =
        '<i class="fa-solid fa-check"></i> Guardar Cambios';
    }
  }
}

async function cargarConfiguracionSistemaReal() {
  try {
    const respuesta = await fetch(
      "/api/v2/configuracion/sistema"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudo obtener la configuración"
      );
    }

    const datos = await respuesta.json();

    if (!datos.ok || !datos.configuracion) {
      throw new Error(
        datos.mensaje ||
        "La configuración recibida no es válida"
      );
    }

    const configuracion = datos.configuracion;

    const campoNombre =
      document.getElementById(
        "config-sistema-nombre"
      );

    const campoEspacios =
      document.getElementById(
        "config-sistema-espacios"
      );

    const campoTiempo =
      document.getElementById(
        "config-sistema-tiempo"
      );

    if (campoNombre) {
      campoNombre.value =
        configuracion.nombreEstacionamiento || "";
    }

    if (campoEspacios) {
      campoEspacios.value =
        Number(configuracion.numeroEspacios) || 0;
    }

    if (campoTiempo) {
      campoTiempo.value =
        Number(configuracion.tiempoMaximoHoras) || 24;
    }

    actualizarToggleConfiguracion(
      "config-alertas-visuales",
      configuracion.alertasVisuales
    );

    actualizarToggleConfiguracion(
      "config-alertas-sonoras",
      configuracion.alertasSonoras
    );

    actualizarToggleConfiguracion(
      "config-correos-automaticos",
      configuracion.correosAutomaticos
    );

    actualizarToggleConfiguracion(
      "config-alertas-sensores",
      configuracion.alertasSensoresDesconectados
    );

    console.log(
      "Configuración del sistema actualizada",
      configuracion
    );
  } catch (error) {
    console.error(
      "Error al cargar la configuración:",
      error
    );

    showToast(
      "error",
      "No se pudo cargar la configuración",
      "fa-triangle-exclamation"
    );
  }
}

// ============================================================
// CONFIGURACIÓN DEL ADMINISTRADOR
// ============================================================
function obtenerColorHoverConfiguracion(color) {
  const colores = {
    "#4f8ef7": "#6ba0ff",
    "#22c55e": "#4ade80",
    "#a78bfa": "#c4b5fd",
    "#f59e0b": "#fbbf24",
    "#ef4444": "#f87171",
    "#14b8a6": "#2dd4bf"
  };

  return colores[color.toLowerCase()] || color;
}


function aplicarPreferenciasVisuales(
  temaPreferido,
  colorPrincipal
) {
  const tema =
    temaPreferido === "light"
      ? "light"
      : "dark";

  const color =
    colorPrincipal || "#4f8ef7";

  document.documentElement.setAttribute(
    "data-theme",
    tema
  );

  document.documentElement.style.setProperty(
    "--accent",
    color
  );

  document.documentElement.style.setProperty(
    "--accent-hover",
    obtenerColorHoverConfiguracion(color)
  );

  document.querySelectorAll(".color-opt").forEach(
    (elemento) => {
      const accion =
        elemento.getAttribute("onclick") || "";

      elemento.classList.toggle(
        "active",
        accion.includes(color)
      );
    }
  );

  updateThemeUI();

  if (charts.hourly) {
    reinitCharts();
  }
}

async function cargarAdministradorReal() {
  try {
    const respuesta = await fetch(
      "/api/v2/configuracion/administrador"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudo obtener el administrador"
      );
    }

    const datos = await respuesta.json();

    if (!datos.ok || !datos.administrador) {
      throw new Error(
        datos.mensaje ||
        "La respuesta del administrador no es válida"
      );
    }

    const administrador = datos.administrador;

    aplicarPreferenciasVisuales(
      administrador.temaPreferido,
      administrador.colorPrincipal
    );

    const campoNombre =
      document.getElementById("config-admin-nombre");

    const campoCorreo =
      document.getElementById("config-admin-correo");

    const campoUsuario =
      document.getElementById("config-admin-usuario");

    const campoEstado =
      document.getElementById("config-admin-estado");

    if (campoNombre) {
      campoNombre.value = administrador.nombre || "";
    }

    if (campoCorreo) {
      campoCorreo.value = administrador.correo || "";
    }

    if (campoUsuario) {
      campoUsuario.value = administrador.usuario || "";
    }

    if (campoEstado) {
      campoEstado.value = administrador.estado || "";
    }

    const nombresSidebar =
      document.querySelectorAll(".sidebar-user-info .name");

    nombresSidebar.forEach((elemento) => {
      elemento.textContent =
        administrador.nombre || "Administrador";
    });

    const avatares =
      document.querySelectorAll(".user-avatar");

    const iniciales = String(
      administrador.nombre || "AD"
    )
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra.charAt(0).toUpperCase())
      .join("");

    avatares.forEach((avatar) => {
      avatar.textContent = iniciales || "AD";
    });

    console.log(
      "Administrador actualizado con datos reales",
      administrador
    );
  } catch (error) {
    console.error(
      "Error al cargar el administrador:",
      error
    );

    showToast(
      "error",
      "No se pudo cargar el administrador",
      "fa-triangle-exclamation"
    );
  }
}

// ============================================================
// TARIFFS
// ============================================================
async function cargarTarifaReal() {
  try {
    const respuesta = await fetch(
      "/api/v2/configuracion/tarifa"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudo obtener la tarifa activa"
      );
    }

    const datos = await respuesta.json();

    if (!datos.ok || !datos.tarifa) {
      throw new Error(
        datos.mensaje || "La tarifa recibida no es válida"
      );
    }

    tarifaActual = datos.tarifa;

    const campoHora =
      document.getElementById("tarifa-hora");

    const campoMinuto =
      document.getElementById("tarifa-minuto");

    const campoGracia =
      document.getElementById("tarifa-gracia");

    const campoTiempoSalida =
      document.getElementById("tarifa-tiempo-salida");

    const campoMaxima =
      document.getElementById("tarifa-maxima");

    const campoHorarioInicio =
      document.getElementById("tarifa-horario-inicio");

    const campoHorarioFin =
      document.getElementById("tarifa-horario-fin");

    if (campoHora) {
      campoHora.value =
        Number(tarifaActual.tarifaHora).toFixed(2);
    }

    if (campoMinuto) {
      campoMinuto.value =
        Number(tarifaActual.tarifaMinuto).toFixed(4);
    }

    if (campoGracia) {
      campoGracia.value =
        tarifaActual.tiempoGraciaMinutos;
    }

    if (campoTiempoSalida) {
      campoTiempoSalida.value =
        tarifaActual.tiempoSalidaDespuesPagoMinutos;
    }

    if (campoMaxima) {
      campoMaxima.value =
        Number(
          tarifaActual.tarifaMaximaDiaria
        ).toFixed(2);
    }

    if (campoHorarioInicio) {
      campoHorarioInicio.value =
        tarifaActual.horarioPromocionalInicio || "";
    }

    if (campoHorarioFin) {
      campoHorarioFin.value =
        tarifaActual.horarioPromocionalFin || "";
    }

    calcSim();

    console.log(
      "Tarifa actualizada con datos reales",
      tarifaActual
    );
  } catch (error) {
    console.error(
      "Error al cargar la tarifa real:",
      error
    );

    showToast(
      "error",
      "No se pudo cargar la tarifa",
      "fa-triangle-exclamation"
    );
  }
}

async function guardarTarifaReal() {
  const boton =
    document.getElementById("tarifa-guardar-btn");

  const obtenerValorNumerico = (id) => {
    const campo = document.getElementById(id);
    const texto = campo?.value?.trim() ?? "";

    if (texto === "") {
      return null;
    }

    const valor = Number(texto);

    return Number.isFinite(valor)
      ? valor
      : null;
  };

  const tarifaHora =
    obtenerValorNumerico("tarifa-hora");

  const tarifaMinuto =
    obtenerValorNumerico("tarifa-minuto");

  const tiempoGraciaMinutos =
    obtenerValorNumerico("tarifa-gracia");

  const tiempoSalidaDespuesPagoMinutos =
    obtenerValorNumerico(
      "tarifa-tiempo-salida"
    );

  const tarifaMaximaDiaria =
    obtenerValorNumerico("tarifa-maxima");

  const horarioPromocionalInicio =
    document.getElementById(
      "tarifa-horario-inicio"
    )?.value || null;

  const horarioPromocionalFin =
    document.getElementById(
      "tarifa-horario-fin"
    )?.value || null;

  const valoresNumericos = [
    tarifaHora,
    tarifaMinuto,
    tiempoGraciaMinutos,
    tiempoSalidaDespuesPagoMinutos,
    tarifaMaximaDiaria
  ];

  if (
    valoresNumericos.some(
      (valor) =>
        valor === null ||
        valor < 0
    )
  ) {
    showToast(
      "error",
      "Completa correctamente todos los valores tarifarios",
      "fa-triangle-exclamation"
    );

    return;
  }

  if (
    !Number.isInteger(tiempoGraciaMinutos) ||
    !Number.isInteger(
      tiempoSalidaDespuesPagoMinutos
    )
  ) {
    showToast(
      "error",
      "Los tiempos deben ingresarse en minutos completos",
      "fa-triangle-exclamation"
    );

    return;
  }

  try {
    if (boton) {
      boton.disabled = true;
      boton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Guardando...
      `;
    }

    const respuesta = await fetch(
      "/api/v2/configuracion/tarifa",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tarifaHora,
          tarifaMinuto,
          tiempoGraciaMinutos,
          tiempoSalidaDespuesPagoMinutos,
          tarifaMaximaDiaria,
          horarioPromocionalInicio,
          horarioPromocionalFin
        })
      }
    );

    let datos = null;

    try {
      datos = await respuesta.json();
    } catch (errorLectura) {
      throw new Error(
        "El servidor devolvió una respuesta no válida"
      );
    }

    if (!respuesta.ok || !datos.ok) {
      throw new Error(
        datos.mensaje ||
        "No se pudo actualizar la tarifa"
      );
    }

    tarifaActual = datos.tarifa;

    await cargarTarifaReal();

    showToast(
      "success",
      datos.mensaje ||
      "Tarifa actualizada correctamente",
      "fa-circle-check"
    );
  } catch (error) {
    console.error(
      "Error al guardar la tarifa:",
      error
    );

    showToast(
      "error",
      error.message ||
      "No se pudo guardar la tarifa",
      "fa-triangle-exclamation"
    );
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.innerHTML = `
        <i class="fa-solid fa-check"></i>
        Guardar
      `;
    }
  }
}


function calcSim() {
  const horas = Number(
    document.getElementById("sim-hours")?.value
  ) || 0;

  const idRol = Number(
    document.getElementById("sim-role")?.value
  );

  const rolSeleccionado = rolesData.find(
    (rol) => Number(rol.idRol) === idRol
  );

  const tarifaHora = tarifaActual
    ? Number(tarifaActual.tarifaHora)
    : 0;

  const horasGratis = rolSeleccionado
    ? Number(rolSeleccionado.horasGratis) || 0
    : 0;

  const porcentajeDescuento = rolSeleccionado
    ? Number(
        rolSeleccionado.porcentajeDescuento
      ) || 0
    : 0;

  const exoneracionTotal = rolSeleccionado
    ? Boolean(rolSeleccionado.exoneracionTotal)
    : false;

  const horasCobrables = exoneracionTotal
    ? 0
    : Math.max(0, horas - horasGratis);

  const montoBase =
    horasCobrables * tarifaHora;

  const descuento = exoneracionTotal
    ? horas * tarifaHora
    : montoBase * (
        porcentajeDescuento / 100
      );

  const total = exoneracionTotal
    ? 0
    : Math.max(0, montoBase - descuento);

  const resultado =
    document.getElementById("sim-result");

  const detalle =
    document.getElementById("sim-detail");

  if (resultado) {
    resultado.textContent =
      `S/ ${total.toFixed(2)}`;
  }

  if (detalle) {
    if (exoneracionTotal) {
      detalle.textContent =
        `${horas}h · Exoneración total · ` +
        `Total S/ 0.00`;
    } else {
      detalle.textContent =
        `${horas}h · ${horasGratis}h gratis · ` +
        `${horasCobrables}h cobrables × ` +
        `S/ ${tarifaHora.toFixed(2)} · ` +
        `Descuento ${porcentajeDescuento}% · ` +
        `Total S/ ${total.toFixed(2)}`;
    }
  }
}

function obtenerColorRol(nombre, indice) {
  const coloresPorRol = {
    "Usuario Comun": "gray",
    "Trabajador": "green",
    "Cliente VIP": "purple",
    "Propietario de Tienda": "blue",
    "Empresario Frecuente": "amber",
    "Invitado Especial": "teal",
    "Proveedor": "gray"
  };

  const coloresDisponibles = [
    "gray",
    "green",
    "purple",
    "blue",
    "amber",
    "teal"
  ];

  return (
    coloresPorRol[nombre] ||
    coloresDisponibles[indice % coloresDisponibles.length]
  );
}


async function cargarRolesReales() {
  try {
    const respuesta = await fetch(
      "/api/v2/configuracion/roles"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudieron obtener los roles"
      );
    }

    const datos = await respuesta.json();

    if (!datos.ok || !Array.isArray(datos.roles)) {
      throw new Error(
        datos.mensaje ||
        "La respuesta de roles no es válida"
      );
    }

    rolesData = datos.roles.map((rol, indice) => ({
      idRol: rol.idRol,
      name: rol.nombre,
      icon: rol.icono || "fa-user",

      discount:
        `${Number(rol.porcentajeDescuento)}%`,

      hours: rol.exoneracionTotal
        ? "Exonerado"
        : `${Number(rol.horasGratis)}h gratis`,

      color: obtenerColorRol(
        rol.nombre,
        indice
      ),

      desc:
        rol.descripcion ||
        "Rol registrado en el sistema",

      porcentajeDescuento:
        Number(rol.porcentajeDescuento),

      horasGratis:
        Number(rol.horasGratis),

      exoneracionTotal:
        Boolean(rol.exoneracionTotal),

      prioridadAcceso:
        rol.prioridadAcceso,

      estado:
        rol.estado
    }));

    renderRoles();

    const selectorRol =
      document.getElementById("sim-role");

    if (selectorRol) {
      selectorRol.innerHTML = rolesData
        .filter((rol) => rol.estado === "Activo")
        .map((rol) => {
          let beneficio = `${rol.porcentajeDescuento}%`;

          if (rol.exoneracionTotal) {
            beneficio = "Exonerado";
          } else if (rol.horasGratis > 0) {
            beneficio =
              `${rol.horasGratis}h gratis · ` +
              `${rol.porcentajeDescuento}%`;
          }

          return `
            <option value="${rol.idRol}">
              ${rol.name} (${beneficio})
            </option>
          `;
        })
        .join("");
    }

    const selectorRolVehiculo =
      document.getElementById("vehicle-role");

    if (selectorRolVehiculo) {
      const rolesActivos = rolesData.filter(
        (rol) => rol.estado === "Activo"
      );

      selectorRolVehiculo.innerHTML =
        rolesActivos.length > 0
          ? `
              <option value="">
                Seleccione un rol
              </option>
              ${rolesActivos
                .map(
                  (rol) => `
                    <option value="${rol.idRol}">
                      ${rol.name}
                    </option>
                  `
                )
                .join("")}
            `
          : `
              <option value="">
                No existen roles activos
              </option>
            `;
    }

    calcSim();

    console.log(
      "Roles actualizados con datos reales",
      rolesData
    );
  } catch (error) {
    console.error(
      "Error al cargar los roles reales:",
      error
    );

    showToast(
      "error",
      "No se pudieron cargar los roles",
      "fa-triangle-exclamation"
    );
  }
}

function renderRoles() {
  const contenedor =
    document.getElementById("roles-list");

  if (!contenedor) {
    return;
  }

  if (!Array.isArray(rolesData) || rolesData.length === 0) {
    contenedor.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-users-gear"></i>
        <div>No existen roles registrados.</div>
      </div>
    `;

    return;
  }

  const colores = {
    gray: "badge-gray",
    green: "badge-green",
    purple: "badge-purple",
    blue: "badge-blue",
    amber: "badge-amber",
    teal: "badge-teal"
  };

  contenedor.innerHTML = rolesData.map(
    (rol, indice) => {
      const activo = rol.estado === "Activo";

      const beneficioPrincipal =
        rol.exoneracionTotal
          ? "Exonerado"
          : `${rol.porcentajeDescuento}%`;

      const beneficioSecundario =
        rol.exoneracionTotal
          ? "Sin cobro por estacionamiento"
          : `${rol.horasGratis}h gratis`;

      return `
        <div
          class="role-card"
          style="${activo ? "" : "opacity:0.68;"}"
        >
          <div
            style="
              width:36px;
              height:36px;
              border-radius:var(--radius-sm);
              background:var(--accent-glow);
              display:flex;
              align-items:center;
              justify-content:center;
              color:var(--accent);
            "
          >
            <i
              class="fa-solid ${escaparHtmlEvento(
                rol.icon || "fa-user"
              )}"
              style="font-size:17px"
            ></i>
          </div>

          <div style="flex:1">
            <div
              style="
                display:flex;
                align-items:center;
                gap:7px;
                flex-wrap:wrap;
              "
            >
              <div style="font-size:13px;font-weight:600">
                ${escaparHtmlEvento(rol.name)}
              </div>

              <span
                class="badge ${
                  activo ? "badge-green" : "badge-gray"
                }"
              >
                ${escaparHtmlEvento(rol.estado)}
              </span>
            </div>

            <div
              style="
                font-size:11px;
                color:var(--text-secondary);
                margin-top:3px;
              "
            >
              ${escaparHtmlEvento(rol.desc)}
            </div>

            <div
              style="
                font-size:10px;
                color:var(--text-muted);
                margin-top:3px;
              "
            >
              Prioridad:
              ${escaparHtmlEvento(
                rol.prioridadAcceso === "Maxima"
                  ? "Máxima"
                  : rol.prioridadAcceso
              )}
            </div>
          </div>

          <div
            style="
              text-align:right;
              display:flex;
              flex-direction:column;
              gap:4px;
              align-items:flex-end;
            "
          >
            <span
              class="badge ${
                colores[rol.color] || "badge-gray"
              }"
            >
              ${beneficioPrincipal}
            </span>

            <span
              style="
                font-size:11px;
                color:var(--text-muted);
              "
            >
              ${beneficioSecundario}
            </span>
          </div>

          <div
            style="
              display:flex;
              gap:4px;
              margin-left:8px;
            "
          >
            <button
              class="btn btn-ghost btn-sm"
              onclick="openRoleModal(${indice})"
              title="Editar rol"
            >
              <i class="fa-solid fa-pen"></i>
            </button>

            <button
              class="btn ${
                activo
                  ? "btn-danger"
                  : "btn-ghost"
              } btn-sm"
              onclick="cambiarEstadoRol(${indice})"
              title="${
                activo
                  ? "Desactivar rol"
                  : "Reactivar rol"
              }"
              ${
                activo
                  ? ""
                  : `style="
                      color:var(--green);
                      border-color:rgba(34,197,94,0.35);
                      background:var(--green-bg);
                    "`
              }
            >
              <i
                class="fa-solid ${
                  activo
                    ? "fa-pause"
                    : "fa-rotate-left"
                }"
              ></i>
            </button>
          </div>
        </div>
      `;
    }
  ).join("");
}

async function cargarPromocionesReales() {
  try {
    const respuesta = await fetch(
      "/api/v2/configuracion/promociones"
    );

    if (!respuesta.ok) {
      throw new Error(
        "No se pudieron obtener las promociones"
      );
    }

    const datos = await respuesta.json();

    if (
      !datos.ok ||
      !Array.isArray(datos.promociones)
    ) {
      throw new Error(
        datos.mensaje ||
        "La respuesta de promociones no es válida"
      );
    }

    promosData = datos.promociones.map(
      (promocion) => ({
        idPromocion: promocion.idPromocion,

        name: promocion.nombre,

        min:
          `S/ ${Number(
            promocion.montoMinimo
          ).toFixed(2)}`,

        benefit:
          promocion.beneficioDescripcion ||
          describirBeneficioPromocion(promocion),

        from: promocion.fechaInicio,
        to: promocion.fechaFin,
        status: promocion.estado,

        tipoBeneficio:
          promocion.tipoBeneficio,

        valorBeneficio:
          Number(promocion.valorBeneficio),

        limiteUsos:
          promocion.limiteUsos,

        usosRealizados:
          Number(promocion.usosRealizados) || 0
      })
    );

    renderPromos();

    console.log(
      "Promociones actualizadas con datos reales",
      promosData
    );
  } catch (error) {
    console.error(
      "Error al cargar las promociones reales:",
      error
    );

    promosData = [];
    renderPromos();

    showToast(
      "error",
      "No se pudieron cargar las promociones",
      "fa-triangle-exclamation"
    );
  }
}


function describirBeneficioPromocion(promocion) {
  const valor = Number(
    promocion.valorBeneficio
  ) || 0;

  switch (promocion.tipoBeneficio) {
    case "Porcentaje":
      return `${valor}% de descuento`;

    case "Horas gratis":
      return `${valor} hora${
        valor === 1 ? "" : "s"
      } gratis`;

    case "Minutos gratis":
      return `${valor} minutos gratis`;

    case "Exoneracion total":
      return "Estacionamiento completamente gratuito";

    case "Monto fijo":
      return `Descuento fijo de S/ ${valor.toFixed(2)}`;

    default:
      return "Beneficio registrado";
  }
}

function escaparHtmlPromocion(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPromos() {
  const contenedor =
    document.getElementById("promos-list");

  if (!contenedor) {
    return;
  }

  if (promosData.length === 0) {
    contenedor.innerHTML = `
      <div
        class="empty-state"
        style="
          padding:28px;
          background:var(--bg-card);
          border:1px solid var(--border);
          border-radius:var(--radius-md);
        "
      >
        <i class="fa-solid fa-tags"></i>

        <div style="font-size:12px">
          No existen promociones registradas.
        </div>
      </div>
    `;

    return;
  }

  contenedor.innerHTML = promosData.map(
    (promocion, indice) => {
      const activa =
        promocion.status === "Activa";

      const claseEstado =
        activa
          ? "badge-green"
          : promocion.status === "Vencida"
            ? "badge-red"
            : "badge-gray";

      const limiteTexto =
        promocion.limiteUsos === null ||
        promocion.limiteUsos === undefined
          ? "Sin límite de usos"
          : `${promocion.usosRealizados || 0} de ` +
            `${promocion.limiteUsos} usos`;

      return `
        <div class="promo-card">
          <div
            style="
              width:36px;
              height:36px;
              border-radius:var(--radius-sm);
              background:var(--amber-bg);
              display:flex;
              align-items:center;
              justify-content:center;
              color:var(--amber);
              flex-shrink:0;
            "
          >
            <i
              class="fa-solid fa-gift"
              style="font-size:17px"
            ></i>
          </div>

          <div style="flex:1;min-width:0">
            <div
              style="
                font-size:13px;
                font-weight:600;
              "
            >
              ${escaparHtmlPromocion(promocion.name)}
            </div>

            <div
              style="
                font-size:11px;
                color:var(--text-secondary);
              "
            >
              Consumo mínimo ${escaparHtmlPromocion(promocion.min)}
              →
              ${escaparHtmlPromocion(promocion.benefit)}
            </div>

            <div
              style="
                font-size:10px;
                color:var(--text-muted);
                margin-top:2px;
              "
            >
              ${escaparHtmlPromocion(promocion.from)}
              al
              ${escaparHtmlPromocion(promocion.to)}
              ·
              ${escaparHtmlPromocion(limiteTexto)}
            </div>
          </div>

          <span class="badge ${claseEstado}">
            ${escaparHtmlPromocion(promocion.status)}
          </span>

          <div
            style="
              display:flex;
              gap:4px;
              margin-left:4px;
            "
          >
            <button
              class="btn btn-ghost btn-sm"
              onclick="togglePromo(${indice})"
              title="${
                activa
                  ? "Desactivar promoción"
                  : "Activar promoción"
              }"
            >
              <i
                class="fa-solid fa-${
                  activa ? "pause" : "play"
                }"
              ></i>
            </button>

            <button
              class="btn btn-ghost btn-sm"
              onclick="openPromoModal(${indice})"
              title="Editar promoción"
            >
              <i class="fa-solid fa-pen"></i>
            </button>
          </div>
        </div>
      `;
    }
  ).join("");
}

async function togglePromo(indice) {
  const promocion = promosData[indice];

  if (!promocion) {
    return;
  }

  const nuevoEstado =
    promocion.status === "Activa"
      ? "Inactiva"
      : "Activa";

  const accion =
    nuevoEstado === "Activa"
      ? "activar"
      : "desactivar";

  const confirmado = window.confirm(
    `¿Deseas ${accion} la promoción ` +
    `"${promocion.name}"?`
  );

  if (!confirmado) {
    return;
  }

  try {
    const respuesta = await fetch(
      `/api/v2/configuracion/promociones/` +
      `${promocion.idPromocion}/estado`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          estado: nuevoEstado
        })
      }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(
        datos.mensaje ||
        "No se pudo cambiar el estado de la promoción"
      );
    }

    await cargarPromocionesReales();
    await cargarRankingsReales();

    showToast(
      "success",
      datos.mensaje,
      nuevoEstado === "Activa"
        ? "fa-circle-play"
        : "fa-circle-pause"
    );
  } catch (error) {
    console.error(
      "Error al cambiar el estado de la promoción:",
      error
    );

    showToast(
      "error",
      error.message ||
      "No se pudo cambiar el estado de la promoción",
      "fa-triangle-exclamation"
    );
  }
}

async function cargarEstablecimientosReales() {
  try {
    const respuesta = await fetch(
      "/api/v2/configuracion/establecimientos"
    );

    const datos = await respuesta.json();

    if (
      !respuesta.ok ||
      !datos.ok ||
      !Array.isArray(datos.establecimientos)
    ) {
      throw new Error(
        datos.mensaje ||
        "No se pudieron obtener los establecimientos"
      );
    }

    storesData = datos.establecimientos.map(
      (establecimiento) => ({
        idEstablecimiento:
          Number(
            establecimiento.idEstablecimiento
          ),

        name:
          establecimiento.nombre,

        cat:
          establecimiento.categoria,

        icon:
          establecimiento.icono ||
          "fa-store",

        location:
          establecimiento.ubicacion ||
          "Sin especificar",

        status:
          establecimiento.estado,

        kind:
          establecimiento.tipoRegistro === "Tiempo"
            ? "tiempo"
            : "consumo",

        description:
          establecimiento.descripcion ||
          ""
      })
    );

    renderStores();

    console.log(
      "Establecimientos actualizados con datos reales",
      storesData
    );
  } catch (error) {
    console.error(
      "Error al cargar los establecimientos reales:",
      error
    );

    storesData = [];
    renderStores();

    showToast(
      "error",
      error.message ||
      "No se pudieron cargar los establecimientos",
      "fa-triangle-exclamation"
    );
  }
}

function renderStores() {
  const contenedor =
    document.getElementById("stores-list");

  if (!contenedor) {
    return;
  }

  if (
    !Array.isArray(storesData) ||
    storesData.length === 0
  ) {
    contenedor.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-store"></i>
        <div>No existen establecimientos registrados.</div>
      </div>
    `;

    return;
  }

  contenedor.innerHTML = storesData.map(
    (establecimiento, indice) => {
      const activo =
        establecimiento.status === "Activo";

      const esTiempo =
        establecimiento.kind === "tiempo";

      return `
        <div
          class="store-card"
          style="${activo ? "" : "opacity:0.68;"}"
        >
          <div
            style="
              width:36px;
              height:36px;
              border-radius:var(--radius-sm);
              background:var(--teal-bg);
              display:flex;
              align-items:center;
              justify-content:center;
              color:var(--teal);
            "
          >
            <i
              class="fa-solid ${escaparHtmlEvento(
                establecimiento.icon || "fa-store"
              )}"
              style="font-size:17px"
            ></i>
          </div>

          <div style="flex:1;min-width:0">
            <div
              style="
                display:flex;
                align-items:center;
                gap:7px;
                flex-wrap:wrap;
              "
            >
              <div style="font-size:13px;font-weight:600">
                ${escaparHtmlEvento(
                  establecimiento.name
                )}
              </div>

              <span
                class="badge ${
                  activo
                    ? "badge-green"
                    : "badge-gray"
                }"
              >
                ${escaparHtmlEvento(
                  establecimiento.status
                )}
              </span>
            </div>

            <div
              style="
                font-size:11px;
                color:var(--text-secondary);
                margin-top:3px;
              "
            >
              ${escaparHtmlEvento(
                establecimiento.cat
              )}
              ·
              ${escaparHtmlEvento(
                establecimiento.location
              )}
            </div>

            <div
              style="
                font-size:10px;
                color:var(--text-muted);
                margin-top:3px;
                white-space:nowrap;
                overflow:hidden;
                text-overflow:ellipsis;
              "
              title="${escaparHtmlEvento(
                establecimiento.description ||
                "Sin descripción"
              )}"
            >
              ${escaparHtmlEvento(
                establecimiento.description ||
                "Sin descripción"
              )}
            </div>
          </div>

          <span
            class="badge ${
              esTiempo
                ? "badge-purple"
                : "badge-blue"
            }"
          >
            <i
              class="fa-solid ${
                esTiempo
                  ? "fa-clock"
                  : "fa-money-bill"
              }"
              style="font-size:11px"
            ></i>
            ${
              esTiempo
                ? "Por tiempo"
                : "Por consumo"
            }
          </span>

          <div
            style="
              display:flex;
              gap:4px;
              margin-left:4px;
            "
          >
            <button
              class="btn btn-ghost btn-sm"
              type="button"
              onclick="openStoreModal(${indice})"
              title="Editar establecimiento"
            >
              <i class="fa-solid fa-pen"></i>
            </button>

            <button
              class="btn ${
                activo
                  ? "btn-danger"
                  : "btn-ghost"
              } btn-sm"
              type="button"
              onclick="cambiarEstadoEstablecimiento(${indice})"
              title="${
                activo
                  ? "Desactivar establecimiento"
                  : "Reactivar establecimiento"
              }"
              ${
                activo
                  ? ""
                  : `style="
                      color:var(--green);
                      border-color:rgba(34,197,94,0.35);
                      background:var(--green-bg);
                    "`
              }
            >
              <i
                class="fa-solid ${
                  activo
                    ? "fa-pause"
                    : "fa-rotate-left"
                }"
              ></i>
            </button>
          </div>
        </div>
      `;
    }
  ).join("");
}

async function cambiarEstadoEstablecimiento(
  indice
) {
  const establecimiento =
    storesData[indice];

  if (
    !establecimiento ||
    !establecimiento.idEstablecimiento
  ) {
    showToast(
      "error",
      "No se encontró el establecimiento seleccionado",
      "fa-triangle-exclamation"
    );

    return;
  }

  const nuevoEstado =
    establecimiento.status === "Activo"
      ? "Inactivo"
      : "Activo";

  const accion =
    nuevoEstado === "Activo"
      ? "reactivar"
      : "desactivar";

  const confirmado = window.confirm(
    `¿Deseas ${accion} el establecimiento ` +
    `"${establecimiento.name}"?`
  );

  if (!confirmado) {
    return;
  }

  try {
    const respuesta = await fetch(
      `/api/v2/configuracion/establecimientos/` +
      `${establecimiento.idEstablecimiento}/estado`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          estado: nuevoEstado
        })
      }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(
        datos.mensaje ||
        "No se pudo cambiar el estado del establecimiento"
      );
    }

    await cargarEstablecimientosReales();

    showToast(
      "success",
      datos.mensaje ||
      "Estado del establecimiento actualizado",
      nuevoEstado === "Activo"
        ? "fa-circle-play"
        : "fa-circle-pause"
    );
  } catch (error) {
    console.error(
      "Error al cambiar el estado del establecimiento:",
      error
    );

    showToast(
      "error",
      error.message ||
      "No se pudo cambiar el estado del establecimiento",
      "fa-triangle-exclamation"
    );
  }
}

// ============================================================
// MODALS
// ============================================================
function openVehicleModal(idVehiculo = null) {
  const modal =
    document.getElementById("modal-vehicle");

  const titulo =
    document.getElementById("vehicle-modal-title");

  const campoId =
    document.getElementById("vehicle-edit-id");

  const boton =
    document.getElementById("vehicle-save-btn");

  const error =
    document.getElementById("vehicle-form-error");

  const camposTexto = [
    "vehicle-plate",
    "vehicle-brand",
    "vehicle-model",
    "vehicle-color",
    "vehicle-driver-name",
    "vehicle-driver-document",
    "vehicle-driver-phone",
    "vehicle-driver-email",
    "vehicle-rfid"
  ];

  camposTexto.forEach((id) => {
    const campo = document.getElementById(id);

    if (campo) {
      campo.value = "";
    }
  });

  const tipo =
    document.getElementById("vehicle-type");

  const rol =
    document.getElementById("vehicle-role");

  const saldo =
    document.getElementById("vehicle-balance");

  if (tipo) {
    tipo.value = "Auto";
  }

  if (rol) {
    rol.value = "";
  }

  if (saldo) {
    saldo.value = "0.00";
  }

  if (campoId) {
    campoId.value = "";
  }

  if (error) {
    error.textContent = "";
    error.style.display = "none";
  }

  if (idVehiculo !== null) {
    const vehiculo = vehiclesData.find(
      (registro) =>
        Number(registro.id) === Number(idVehiculo)
    );

    if (!vehiculo) {
      showToast(
        "error",
        "No se encontró el vehículo seleccionado",
        "fa-triangle-exclamation"
      );

      return;
    }

    if (campoId) {
      campoId.value = vehiculo.id;
    }

    if (titulo) {
      titulo.textContent = "Editar Vehículo";
    }

    if (boton) {
      boton.innerHTML = `
        <i class="fa-solid fa-check"></i>
        Guardar cambios
      `;
    }

    const campoPlaca =
      document.getElementById("vehicle-plate");

    const campoTipo =
      document.getElementById("vehicle-type");

    const campoMarca =
      document.getElementById("vehicle-brand");

    const campoModelo =
      document.getElementById("vehicle-model");

    const campoColor =
      document.getElementById("vehicle-color");

    const campoRol =
      document.getElementById("vehicle-role");

    const campoNombre =
      document.getElementById(
        "vehicle-driver-name"
      );

    const campoDocumento =
      document.getElementById(
        "vehicle-driver-document"
      );

    const campoTelefono =
      document.getElementById(
        "vehicle-driver-phone"
      );

    const campoCorreo =
      document.getElementById(
        "vehicle-driver-email"
      );

    const campoRfid =
      document.getElementById("vehicle-rfid");

    const campoSaldo =
      document.getElementById("vehicle-balance");

    if (campoPlaca) {
      campoPlaca.value = vehiculo.plate || "";
    }

    if (campoTipo) {
      campoTipo.value = vehiculo.type || "Auto";
    }

    if (campoMarca) {
      campoMarca.value =
        vehiculo.brand === "No especificada"
          ? ""
          : vehiculo.brand || "";
    }

    if (campoModelo) {
      campoModelo.value =
        vehiculo.model === "No especificado"
          ? ""
          : vehiculo.model || "";
    }

    if (campoColor) {
      campoColor.value =
        vehiculo.color === "No especificado"
          ? ""
          : vehiculo.color || "";
    }

    if (campoRol) {
      campoRol.value = String(
        vehiculo.idRol || ""
      );
    }

    if (campoNombre) {
      campoNombre.value = vehiculo.owner || "";
    }

    if (campoDocumento) {
      campoDocumento.value =
        vehiculo.doc === "—"
          ? ""
          : vehiculo.doc || "";
    }

    if (campoTelefono) {
      campoTelefono.value =
        vehiculo.phone === "—"
          ? ""
          : vehiculo.phone || "";
    }

    if (campoCorreo) {
      campoCorreo.value =
        vehiculo.email === "—"
          ? ""
          : vehiculo.email || "";
    }

    if (campoRfid) {
      campoRfid.value =
        vehiculo.uidRfid || "";
    }

    if (campoSaldo) {
      campoSaldo.value = Number(
        vehiculo.saldoVirtual || 0
      ).toFixed(2);
    }
  } else {
    if (titulo) {
      titulo.textContent = "Nuevo Vehículo";
    }

    if (boton) {
      boton.innerHTML = `
        <i class="fa-solid fa-check"></i>
        Guardar
      `;
    }
  }

  if (modal) {
    modal.classList.add("open");
  }

  setTimeout(() => {
    document
      .getElementById("vehicle-plate")
      ?.focus();
  }, 100);
}

function actualizarCampoValorPromocion() {
  const tipo =
    document.getElementById("promo-type")
      ?.value || "Porcentaje";

  const campoValor =
    document.getElementById("promo-value");

  const etiqueta =
    document.getElementById(
      "promo-value-label"
    );

  const ayuda =
    document.getElementById(
      "promo-value-help"
    );

  const configuraciones = {
    Porcentaje: {
      etiqueta: "Porcentaje de descuento (%) *",
      ayuda:
        "Ingresa un valor entre 1 y 100.",
      paso: "0.01",
      maximo: "100"
    },

    "Horas gratis": {
      etiqueta: "Cantidad de horas gratis *",
      ayuda:
        "Ingresa la cantidad de horas que serán gratuitas.",
      paso: "0.01",
      maximo: ""
    },

    "Minutos gratis": {
      etiqueta: "Cantidad de minutos gratis *",
      ayuda:
        "Ingresa la cantidad de minutos que serán gratuitos.",
      paso: "1",
      maximo: ""
    },

    "Monto fijo": {
      etiqueta: "Monto de descuento (S/) *",
      ayuda:
        "Ingresa el monto fijo que se descontará.",
      paso: "0.01",
      maximo: ""
    },

    "Exoneracion total": {
      etiqueta: "Valor del beneficio",
      ayuda:
        "La exoneración total no requiere un valor adicional.",
      paso: "1",
      maximo: ""
    }
  };

  const configuracion =
    configuraciones[tipo] ||
    configuraciones.Porcentaje;

  if (etiqueta) {
    etiqueta.textContent =
      configuracion.etiqueta;
  }

  if (ayuda) {
    ayuda.textContent =
      configuracion.ayuda;
  }

  if (campoValor) {
    campoValor.step =
      configuracion.paso;

    if (configuracion.maximo) {
      campoValor.max =
        configuracion.maximo;
    } else {
      campoValor.removeAttribute("max");
    }

    const esExoneracion =
      tipo === "Exoneracion total";

    campoValor.disabled =
      esExoneracion;

    if (esExoneracion) {
      campoValor.value = "0";
    } else if (
      !campoValor.value ||
      Number(campoValor.value) <= 0
    ) {
      campoValor.value =
        tipo === "Minutos gratis"
          ? "30"
          : "10";
    }
  }
}

function openPromoModal(editIndex) {
  const estaEditando =
    editIndex !== undefined &&
    editIndex >= 0;

  const promocion =
    estaEditando
      ? promosData[editIndex]
      : null;

  const campoIndice =
    document.getElementById(
      "promo-edit-index"
    );

  const titulo =
    document.getElementById(
      "promo-modal-title"
    );

  const boton =
    document.getElementById(
      "promo-save-btn"
    );

  const error =
    document.getElementById(
      "promo-form-error"
    );

  if (campoIndice) {
    campoIndice.value =
      estaEditando
        ? editIndex
        : -1;
  }

  if (titulo) {
    titulo.textContent =
      estaEditando
        ? "Editar Promoción"
        : "Nueva Promoción";
  }

  if (boton) {
    boton.innerHTML = `
      <i class="fa-solid fa-check"></i>
      ${
        estaEditando
          ? "Guardar Cambios"
          : "Crear Promoción"
      }
    `;
  }

  if (error) {
    error.textContent = "";
    error.style.display = "none";
  }

  document.getElementById(
    "promo-name"
  ).value =
    promocion?.name || "";

  document.getElementById(
    "promo-min"
  ).value =
    promocion
      ? Number(
          String(promocion.min)
            .replace("S/", "")
            .trim()
        )
      : "0";

  document.getElementById(
    "promo-type"
  ).value =
    promocion?.tipoBeneficio ||
    "Porcentaje";

  document.getElementById(
    "promo-value"
  ).value =
    promocion
      ? Number(
          promocion.valorBeneficio
        )
      : "10";

  document.getElementById(
    "promo-benefit"
  ).value =
    promocion?.benefit || "";

  document.getElementById(
    "promo-limit"
  ).value =
    promocion?.limiteUsos ??
    "";

  document.getElementById(
    "promo-from"
  ).value =
    promocion?.from || "";

  document.getElementById(
    "promo-to"
  ).value =
    promocion?.to || "";

  document.getElementById(
    "promo-status"
  ).value =
    promocion?.status ||
    "Activa";

  actualizarCampoValorPromocion();

  document
    .getElementById("modal-promo")
    .classList.add("open");

  setTimeout(() => {
    document
      .getElementById("promo-name")
      ?.focus();
  }, 100);
}

function openStoreModal(editIndex) {
  const estaEditando =
    editIndex !== undefined &&
    Number.isInteger(Number(editIndex)) &&
    Number(editIndex) >= 0 &&
    Boolean(storesData[Number(editIndex)]);

  const indice = estaEditando
    ? Number(editIndex)
    : -1;

  const establecimiento = estaEditando
    ? storesData[indice]
    : null;

  const campoIndice =
    document.getElementById("store-edit-index");

  const titulo =
    document.getElementById("store-modal-title");

  const boton =
    document.getElementById("store-save-btn");

  const error =
    document.getElementById("store-form-error");

  campoIndice.value = String(indice);

  titulo.textContent = estaEditando
    ? "Editar Establecimiento"
    : "Nuevo Establecimiento";

  boton.disabled = false;
  boton.innerHTML = `
    <i class="fa-solid fa-check"></i>
    ${
      estaEditando
        ? "Guardar Cambios"
        : "Guardar"
    }
  `;

  if (error) {
    error.textContent = "";
    error.style.display = "none";
  }

  document.getElementById(
    "store-name"
  ).value =
    establecimiento?.name || "";

  document.getElementById(
    "store-kind"
  ).value =
    establecimiento?.kind || "consumo";

  document.getElementById(
    "store-cat"
  ).value =
    establecimiento?.cat || "Restaurante";

  document.getElementById(
    "store-location"
  ).value =
    establecimiento?.location || "";

  document.getElementById(
    "store-desc"
  ).value =
    establecimiento?.description || "";

  document.getElementById(
    "store-status"
  ).value =
    establecimiento?.status || "Activo";

  actualizarAyudaTipoEstablecimiento();

  document
    .getElementById("modal-store")
    .classList.add("open");

  setTimeout(() => {
    document
      .getElementById("store-name")
      ?.focus();
  }, 100);
}
function openRoleModal(editIndex) {
  const estaEditando =
    editIndex !== undefined &&
    editIndex >= 0;

  const campoIndice =
    document.getElementById("role-edit-index");

  const titulo =
    document.getElementById("role-modal-title");

  const boton =
    document.getElementById("role-save-btn");

  const campoNombre =
    document.getElementById("role-name");

  const campoIcono =
    document.getElementById("role-icon");

  const campoDescripcion =
    document.getElementById("role-desc");

  const campoDescuento =
    document.getElementById("role-discount");

  const campoHoras =
    document.getElementById("role-hours");

  const campoPrioridad =
    document.getElementById("role-priority");

  const selectorExoneracion =
    document.getElementById(
      "role-exempt-toggle"
    );

  if (campoIndice) {
    campoIndice.value =
      estaEditando ? editIndex : -1;
  }

  if (titulo) {
    titulo.textContent =
      estaEditando ? "Editar Rol" : "Nuevo Rol";
  }

  if (boton) {
    boton.disabled = false;

    boton.innerHTML = `
      <i class="fa-solid fa-check"></i>
      ${
        estaEditando
          ? "Guardar Cambios"
          : "Crear Rol"
      }
    `;
  }

  if (estaEditando) {
    const rol = rolesData[editIndex];

    if (!rol) {
      showToast(
        "error",
        "No se encontró el rol seleccionado",
        "fa-triangle-exclamation"
      );

      return;
    }

    campoNombre.value = rol.name || "";
    campoIcono.value = rol.icon || "fa-user";
    campoDescripcion.value = rol.desc || "";

    campoDescuento.value =
      Number(rol.porcentajeDescuento) || 0;

    campoHoras.value =
      Number(rol.horasGratis) || 0;

    campoPrioridad.value =
      rol.prioridadAcceso === "Maxima"
        ? "Máxima"
        : rol.prioridadAcceso || "Normal";

    selectorExoneracion.classList.toggle(
      "on",
      Boolean(rol.exoneracionTotal)
    );
  } else {
    campoNombre.value = "";
    campoIcono.value = "fa-user";
    campoDescripcion.value = "";
    campoDescuento.value = "0";
    campoHoras.value = "0";
    campoPrioridad.value = "Normal";

    selectorExoneracion.classList.remove("on");
  }

  document
    .getElementById("modal-role")
    .classList.add("open");
}
function closeModal(id){document.getElementById(id).classList.remove('open');}

async function saveVehicle() {
  const boton =
    document.getElementById("vehicle-save-btn");

  const contenedorError =
    document.getElementById("vehicle-form-error");

  const idEdicion = Number(
    document.getElementById("vehicle-edit-id")
      ?.value || 0
  );

  const estaEditando =
    Number.isInteger(idEdicion) &&
    idEdicion > 0;

  const placa =
    document
      .getElementById("vehicle-plate")
      ?.value.trim()
      .toUpperCase() || "";

  const tipo =
    document.getElementById("vehicle-type")
      ?.value || "";

  const marca =
    document
      .getElementById("vehicle-brand")
      ?.value.trim() || "";

  const modelo =
    document
      .getElementById("vehicle-model")
      ?.value.trim() || "";

  const color =
    document
      .getElementById("vehicle-color")
      ?.value.trim() || "";

  const idRol = Number(
    document.getElementById("vehicle-role")
      ?.value
  );

  const nombreConductor =
    document
      .getElementById("vehicle-driver-name")
      ?.value.trim() || "";

  const documento =
    document
      .getElementById(
        "vehicle-driver-document"
      )
      ?.value.trim() || "";

  const telefono =
    document
      .getElementById("vehicle-driver-phone")
      ?.value.trim() || "";

  const correo =
    document
      .getElementById("vehicle-driver-email")
      ?.value.trim() || "";

  const uidRfid =
    document
      .getElementById("vehicle-rfid")
      ?.value.trim()
      .toUpperCase() || "";

  const saldoVirtual = Number(
    document.getElementById("vehicle-balance")
      ?.value || 0
  );

  function mostrarError(mensaje) {
    if (contenedorError) {
      contenedorError.textContent = mensaje;
      contenedorError.style.display = "block";
    }

    showToast(
      "error",
      mensaje,
      "fa-triangle-exclamation"
    );
  }

  if (contenedorError) {
    contenedorError.textContent = "";
    contenedorError.style.display = "none";
  }

  if (!placa) {
    mostrarError(
      "Ingresa la placa del vehículo"
    );
    return;
  }

  if (!tipo) {
    mostrarError(
      "Selecciona el tipo de vehículo"
    );
    return;
  }

  if (
    !Number.isInteger(idRol) ||
    idRol <= 0
  ) {
    mostrarError(
      "Selecciona un rol válido"
    );
    return;
  }

  if (!nombreConductor) {
    mostrarError(
      "Ingresa el nombre del conductor"
    );
    return;
  }

  if (!documento) {
    mostrarError(
      "Ingresa el documento del conductor"
    );
    return;
  }

  if (
    !Number.isFinite(saldoVirtual) ||
    saldoVirtual < 0
  ) {
    mostrarError(
      "El saldo inicial no puede ser negativo"
    );
    return;
  }

  const datosVehiculo = {
    placa,
    tipo,
    marca,
    modelo,
    color,
    idRol,
    uidRfid,
    saldoVirtual,

    conductor: {
      nombre: nombreConductor,
      documento,
      telefono,
      correo
    }
  };

  const url = estaEditando
    ? `/api/v2/vehiculos/${idEdicion}`
    : "/api/v2/vehiculos";

  const metodo = estaEditando
    ? "PUT"
    : "POST";

  try {
    if (boton) {
      boton.disabled = true;

      boton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        ${estaEditando
          ? "Actualizando..."
          : "Guardando..."}
      `;
    }

    const respuesta = await fetch(url, {
      method: metodo,

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(datosVehiculo)
    });

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(
        datos.mensaje ||
        (
          estaEditando
            ? "No se pudo actualizar el vehículo"
            : "No se pudo registrar el vehículo"
        )
      );
    }

    closeModal("modal-vehicle");

    await cargarVehiculosReales();
    await cargarDashboardReal();

    showToast(
      "success",
      estaEditando
        ? `Vehículo ${placa} actualizado correctamente`
        : `Vehículo ${placa} registrado correctamente`,
      "fa-circle-check"
    );
  } catch (error) {
    console.error(
      estaEditando
        ? "Error al actualizar el vehículo:"
        : "Error al registrar el vehículo:",
      error
    );

    mostrarError(
      error.message ||
      (
        estaEditando
          ? "No se pudo actualizar el vehículo"
          : "No se pudo registrar el vehículo"
      )
    );
  } finally {
    if (boton) {
      boton.disabled = false;

      boton.innerHTML = estaEditando
        ? `
            <i class="fa-solid fa-check"></i>
            Guardar cambios
          `
        : `
            <i class="fa-solid fa-check"></i>
            Guardar
          `;
    }
  }
}

async function saveStore() {
  const boton =
    document.getElementById("store-save-btn");

  const contenedorError =
    document.getElementById("store-form-error");

  const indiceEdicion = Number(
    document.getElementById(
      "store-edit-index"
    )?.value ?? -1
  );

  const estaEditando =
    Number.isInteger(indiceEdicion) &&
    indiceEdicion >= 0 &&
    Boolean(storesData[indiceEdicion]);

  const establecimientoActual =
    estaEditando
      ? storesData[indiceEdicion]
      : null;

  const nombre =
    document
      .getElementById("store-name")
      ?.value.trim() || "";

  const categoria =
    document.getElementById(
      "store-cat"
    )?.value || "";

  const tipoVisual =
    document.getElementById(
      "store-kind"
    )?.value || "consumo";

  const ubicacion =
    document
      .getElementById("store-location")
      ?.value.trim() ||
    "Sin especificar";

  const estado =
    document.getElementById(
      "store-status"
    )?.value || "Activo";

  const descripcion =
    document
      .getElementById("store-desc")
      ?.value.trim() || "";

  const iconosCategoria = {
    Restaurante: "fa-utensils",
    Supermercado: "fa-cart-shopping",
    Farmacia: "fa-pills",
    Cine: "fa-film",
    Gimnasio: "fa-dumbbell",
    Electrónica: "fa-mobile-screen",
    Ropa: "fa-shirt",
    Banco: "fa-building-columns",
    Cafetería: "fa-mug-saucer",
    Servicios: "fa-briefcase"
  };

  const icono =
    iconosCategoria[categoria] ||
    "fa-store";

  const tipoRegistro =
    tipoVisual === "tiempo"
      ? "Tiempo"
      : "Consumo";

  function mostrarError(mensaje) {
    if (contenedorError) {
      contenedorError.textContent = mensaje;
      contenedorError.style.display = "block";
    }

    showToast(
      "error",
      mensaje,
      "fa-triangle-exclamation"
    );
  }

  if (contenedorError) {
    contenedorError.textContent = "";
    contenedorError.style.display = "none";
  }

  if (!nombre) {
    mostrarError(
      "Ingresa el nombre del establecimiento"
    );
    return;
  }

  if (nombre.length > 120) {
    mostrarError(
      "El nombre no puede superar los 120 caracteres"
    );
    return;
  }

  if (!categoria) {
    mostrarError(
      "Selecciona una categoría"
    );
    return;
  }

  if (ubicacion.length > 150) {
    mostrarError(
      "La ubicación no puede superar los 150 caracteres"
    );
    return;
  }

  if (descripcion.length > 255) {
    mostrarError(
      "La descripción no puede superar los 255 caracteres"
    );
    return;
  }

  const datosEstablecimiento = {
    nombre,
    categoria,
    icono,
    ubicacion,
    tipoRegistro,
    estado,
    descripcion
  };

  const url = estaEditando
    ? `/api/v2/configuracion/establecimientos/` +
      `${establecimientoActual.idEstablecimiento}`
    : "/api/v2/configuracion/establecimientos";

  const metodo = estaEditando
    ? "PUT"
    : "POST";

  try {
    if (boton) {
      boton.disabled = true;
      boton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        ${
          estaEditando
            ? "Actualizando..."
            : "Guardando..."
        }
      `;
    }

    const respuesta = await fetch(url, {
      method: metodo,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        datosEstablecimiento
      )
    });

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(
        datos.mensaje ||
        (
          estaEditando
            ? "No se pudo actualizar el establecimiento"
            : "No se pudo crear el establecimiento"
        )
      );
    }

    closeModal("modal-store");
    await cargarEstablecimientosReales();

    showToast(
      "success",
      datos.mensaje ||
      (
        estaEditando
          ? "Establecimiento actualizado correctamente"
          : "Establecimiento creado correctamente"
      ),
      "fa-circle-check"
    );
  } catch (error) {
    console.error(
      estaEditando
        ? "Error al actualizar el establecimiento:"
        : "Error al crear el establecimiento:",
      error
    );

    mostrarError(
      error.message ||
      "No se pudo guardar el establecimiento"
    );
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.innerHTML = `
        <i class="fa-solid fa-check"></i>
        ${
          estaEditando
            ? "Guardar Cambios"
            : "Guardar"
        }
      `;
    }
  }
}
async function saveRole() {
  const boton =
    document.getElementById("role-save-btn");

  const indiceEdicion = Number(
    document.getElementById("role-edit-index")
      ?.value ?? -1
  );

  const estaEditando =
    Number.isInteger(indiceEdicion) &&
    indiceEdicion >= 0;

  const rolActual = estaEditando
    ? rolesData[indiceEdicion]
    : null;

  const nombre =
    document
      .getElementById("role-name")
      ?.value.trim() || "";

  const icono =
    document.getElementById("role-icon")
      ?.value || "fa-user";

  const descripcion =
    document
      .getElementById("role-desc")
      ?.value.trim() ||
    "Rol registrado en el sistema";

  const porcentajeDescuento = Number(
    document.getElementById("role-discount")
      ?.value
  );

  const horasGratis = Number(
    document.getElementById("role-hours")
      ?.value
  );

  const prioridadAcceso =
    document.getElementById("role-priority")
      ?.value || "Normal";

  const exoneracionTotal =
    document
      .getElementById("role-exempt-toggle")
      ?.classList.contains("on") || false;

  if (!nombre) {
    showToast(
      "error",
      "Ingresa un nombre para el rol",
      "fa-triangle-exclamation"
    );

    return;
  }

  if (
    !Number.isFinite(porcentajeDescuento) ||
    porcentajeDescuento < 0 ||
    porcentajeDescuento > 100
  ) {
    showToast(
      "error",
      "El descuento debe estar entre 0 y 100",
      "fa-triangle-exclamation"
    );

    return;
  }

  if (
    !Number.isInteger(horasGratis) ||
    horasGratis < 0
  ) {
    showToast(
      "error",
      "Las horas gratuitas deben ser un número entero no negativo",
      "fa-triangle-exclamation"
    );

    return;
  }

  if (
    estaEditando &&
    (!rolActual || !rolActual.idRol)
  ) {
    showToast(
      "error",
      "No se encontró el identificador del rol",
      "fa-triangle-exclamation"
    );

    return;
  }

  const url = estaEditando
    ? `/api/v2/configuracion/roles/${rolActual.idRol}`
    : "/api/v2/configuracion/roles";

  const metodo =
    estaEditando ? "PUT" : "POST";

  try {
    if (boton) {
      boton.disabled = true;

      boton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        ${
          estaEditando
            ? "Actualizando..."
            : "Creando..."
        }
      `;
    }

    const respuesta = await fetch(url, {
      method: metodo,

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        nombre,
        icono,
        descripcion,
        porcentajeDescuento,
        horasGratis,
        exoneracionTotal,
        prioridadAcceso,
        estado:
          rolActual?.estado || "Activo"
      })
    });

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(
        datos.mensaje ||
        (
          estaEditando
            ? "No se pudo actualizar el rol"
            : "No se pudo crear el rol"
        )
      );
    }

    closeModal("modal-role");

    await Promise.all([
      cargarRolesReales(),
      cargarVehiculosReales(),
      cargarDashboardReal()
    ]);

    showToast(
      "success",
      datos.mensaje ||
      (
        estaEditando
          ? "Rol actualizado correctamente"
          : "Rol creado correctamente"
      ),
      "fa-circle-check"
    );
  } catch (error) {
    console.error(
      estaEditando
        ? "Error al actualizar el rol:"
        : "Error al crear el rol:",
      error
    );

    showToast(
      "error",
      error.message ||
      "No se pudo guardar el rol",
      "fa-triangle-exclamation"
    );
  } finally {
    if (boton) {
      boton.disabled = false;

      boton.innerHTML = `
        <i class="fa-solid fa-check"></i>
        ${
          estaEditando
            ? "Guardar Cambios"
            : "Crear Rol"
        }
      `;
    }
  }
}

async function cambiarEstadoRol(indice) {
  const rol = rolesData[indice];

  if (!rol || !rol.idRol) {
    showToast(
      "error",
      "No se encontró el rol seleccionado",
      "fa-triangle-exclamation"
    );

    return;
  }

  const nuevoEstado =
    rol.estado === "Activo"
      ? "Inactivo"
      : "Activo";

  const accion =
    nuevoEstado === "Activo"
      ? "reactivar"
      : "desactivar";

  const confirmado = window.confirm(
    `¿Deseas ${accion} el rol "${rol.name}"?`
  );

  if (!confirmado) {
    return;
  }

  try {
    const respuesta = await fetch(
      `/api/v2/configuracion/roles/${rol.idRol}/estado`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          estado: nuevoEstado
        })
      }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
      throw new Error(
        datos.mensaje ||
        "No se pudo cambiar el estado del rol"
      );
    }

    await Promise.all([
      cargarRolesReales(),
      cargarVehiculosReales(),
      cargarDashboardReal()
    ]);

    showToast(
      "success",
      datos.mensaje ||
      "Estado del rol actualizado",
      "fa-circle-check"
    );
  } catch (error) {
    console.error(
      "Error al cambiar el estado del rol:",
      error
    );

    showToast(
      "error",
      error.message ||
      "No se pudo cambiar el estado del rol",
      "fa-triangle-exclamation"
    );
  }
}
async function savePromo() {
  const boton =
    document.getElementById(
      "promo-save-btn"
    );

  const contenedorError =
    document.getElementById(
      "promo-form-error"
    );

  const editIndex = Number(
    document.getElementById(
      "promo-edit-index"
    )?.value || -1
  );

  const estaEditando =
    Number.isInteger(editIndex) &&
    editIndex >= 0 &&
    Boolean(promosData[editIndex]);

  const promocionActual =
    estaEditando
      ? promosData[editIndex]
      : null;

  const nombre =
    document
      .getElementById("promo-name")
      ?.value.trim() || "";

  const montoMinimo = Number(
    document.getElementById(
      "promo-min"
    )?.value
  );

  const tipoBeneficio =
    document.getElementById(
      "promo-type"
    )?.value || "";

  const valorBeneficio =
    tipoBeneficio ===
    "Exoneracion total"
      ? 0
      : Number(
          document.getElementById(
            "promo-value"
          )?.value
        );

  const beneficioDescripcion =
    document
      .getElementById(
        "promo-benefit"
      )
      ?.value.trim() || "";

  const fechaInicio =
    document.getElementById(
      "promo-from"
    )?.value || "";

  const fechaFin =
    document.getElementById(
      "promo-to"
    )?.value || "";

  const estado =
    document.getElementById(
      "promo-status"
    )?.value || "Activa";

  const limiteTexto =
    document.getElementById(
      "promo-limit"
    )?.value.trim() || "";

  const limiteUsos =
    limiteTexto === ""
      ? null
      : Number(limiteTexto);

  function mostrarErrorPromocion(
    mensaje
  ) {
    if (contenedorError) {
      contenedorError.textContent =
        mensaje;

      contenedorError.style.display =
        "block";
    }

    showToast(
      "error",
      mensaje,
      "fa-triangle-exclamation"
    );
  }

  if (contenedorError) {
    contenedorError.textContent = "";
    contenedorError.style.display =
      "none";
  }

  if (!nombre) {
    mostrarErrorPromocion(
      "Ingresa el nombre de la promoción"
    );
    return;
  }

  if (
    !Number.isFinite(montoMinimo) ||
    montoMinimo < 0
  ) {
    mostrarErrorPromocion(
      "Ingresa un monto mínimo válido"
    );
    return;
  }

  if (
    tipoBeneficio !==
      "Exoneracion total" &&
    (
      !Number.isFinite(
        valorBeneficio
      ) ||
      valorBeneficio <= 0
    )
  ) {
    mostrarErrorPromocion(
      "Ingresa un valor de beneficio mayor que cero"
    );
    return;
  }

  if (
    tipoBeneficio ===
      "Porcentaje" &&
    valorBeneficio > 100
  ) {
    mostrarErrorPromocion(
      "El porcentaje no puede ser mayor que 100"
    );
    return;
  }

  if (!fechaInicio || !fechaFin) {
    mostrarErrorPromocion(
      "Selecciona las fechas de inicio y fin"
    );
    return;
  }

  if (fechaFin < fechaInicio) {
    mostrarErrorPromocion(
      "La fecha final no puede ser anterior a la fecha inicial"
    );
    return;
  }

  if (
    limiteUsos !== null &&
    (
      !Number.isInteger(limiteUsos) ||
      limiteUsos <= 0
    )
  ) {
    mostrarErrorPromocion(
      "El límite de usos debe ser un número entero mayor que cero"
    );
    return;
  }

  const cuerpo = {
    nombre,
    montoMinimo,
    tipoBeneficio,
    valorBeneficio,
    beneficioDescripcion,
    fechaInicio,
    fechaFin,
    estado,
    limiteUsos
  };

  const url = estaEditando
    ? `/api/v2/configuracion/promociones/` +
      `${promocionActual.idPromocion}`
    : "/api/v2/configuracion/promociones";

  const metodo =
    estaEditando
      ? "PUT"
      : "POST";

  try {
    if (boton) {
      boton.disabled = true;

      boton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        ${
          estaEditando
            ? "Actualizando..."
            : "Guardando..."
        }
      `;
    }

    const respuesta = await fetch(
      url,
      {
        method: metodo,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify(cuerpo)
      }
    );

    const datos =
      await respuesta.json();

    if (
      !respuesta.ok ||
      !datos.ok
    ) {
      throw new Error(
        datos.mensaje ||
        (
          estaEditando
            ? "No se pudo actualizar la promoción"
            : "No se pudo crear la promoción"
        )
      );
    }

    closeModal("modal-promo");

    await cargarPromocionesReales();
    await cargarRankingsReales();

    showToast(
      "success",
      datos.mensaje,
      "fa-circle-check"
    );
  } catch (error) {
    console.error(
      estaEditando
        ? "Error al actualizar la promoción:"
        : "Error al crear la promoción:",
      error
    );

    mostrarErrorPromocion(
      error.message ||
      "No se pudo guardar la promoción"
    );
  } finally {
    if (boton) {
      boton.disabled = false;

      boton.innerHTML = `
        <i class="fa-solid fa-check"></i>
        ${
          estaEditando
            ? "Guardar Cambios"
            : "Crear Promoción"
        }
      `;
    }
  }
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));

// ============================================================
// TOAST
// ============================================================
function showToast(type,msg,icon='fa-circle-info'){
  const icons={success:'fa-circle-check',error:'fa-circle-xmark',warning:'fa-triangle-exclamation',info:'fa-circle-info'};
  const tc=document.getElementById('toast-container');
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  t.innerHTML=`<i class="fa-solid ${icon||icons[type]}"></i><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(20px)';t.style.transition='all 0.2s ease';setTimeout(()=>t.remove(),200);},3500);
}
