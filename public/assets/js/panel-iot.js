import { iniciarSesion, verificarSesion, cerrarSesion } from "./auth.js";
import { obtenerAdministrador } from "./api.js";
import { cargarDashboard } from "./dashboard.js";
import { cargarIot } from "./iot.js";
import {
  inicializarSensoresEnVivo,
  activarSensoresEnVivo,
  detenerSensoresEnVivo
} from "./sensors-live.js";

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const parametros = new URLSearchParams(window.location.search);
const embedPage = parametros.get("embed");
const isEmbed = embedPage === "dashboard" || embedPage === "sensors";
let resizeObserver = null;

if (isEmbed) {
  document.body.classList.add("embed-mode", `embed-${embedPage}`);
  loginScreen.hidden = true;
  loginScreen.style.display = "none";
}


function toast(mensaje, tipo = "success") {
  const contenedor = document.getElementById("toast-container");
  const elemento = document.createElement("div");
  elemento.className = `toast ${tipo}`;
  elemento.textContent = mensaje;
  contenedor.appendChild(elemento);
  setTimeout(() => elemento.remove(), 3500);
}

function notificarAlturaEmbed() {
  if (!isEmbed || window.parent === window) return;

  window.parent.postMessage({
    type: "smartparking:embed-height",
    page: embedPage,
    height: Math.ceil(document.documentElement.scrollHeight + 8)
  }, window.location.origin);
}

function configurarModoEmbed() {
  if (!isEmbed) return;

  document.body.classList.add("embed-mode", `embed-${embedPage}`);

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === `${embedPage}-page`);
  });

  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(notificarAlturaEmbed);
    });
    resizeObserver.observe(document.body);
  }

  window.requestAnimationFrame(notificarAlturaEmbed);
}

function mostrarLogin() {
  detenerSensoresEnVivo();

  if (isEmbed && window.parent !== window) {
    // En modo embebido no debe mostrarse otro formulario de inicio de sesión.
    // El login válido es únicamente el de la página principal.
    loginScreen.hidden = true;
    loginScreen.style.display = "none";
    appShell.hidden = false;
    configurarModoEmbed();

    window.parent.postMessage({
      type: "smartparking:session-expired"
    }, window.location.origin);
    return;
  }

  document.documentElement.classList.remove("session-boot", "embed-boot");

  appShell.hidden = true;
  loginScreen.hidden = false;
  loginScreen.style.display = "flex";
}

function mostrarAplicacion(administrador) {
  document.documentElement.classList.remove("session-boot", "embed-boot");

  loginScreen.style.display = "none";
  appShell.hidden = false;
  const nombre = administrador?.nombre || obtenerAdministrador()?.nombre || "Administrador";
  document.getElementById("user-name").textContent = nombre;
  document.getElementById("user-avatar").textContent = nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  configurarModoEmbed();
}

async function actualizarDashboard() {
  try {
    await cargarDashboard();
    notificarAlturaEmbed();
  } catch (error) {
    toast(error.message || "No se pudo actualizar el dashboard", "error");
  }
}

async function actualizarIot() {
  try {
    await cargarIot();
    notificarAlturaEmbed();
  } catch (error) {
    toast(error.message || "No se pudo actualizar IoT", "error");
  }
}

document.getElementById("login-form").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const boton = document.getElementById("btn-login");
  const error = document.getElementById("login-error");
  const usuario = document.getElementById("inp-user").value.trim();
  const contrasena = document.getElementById("inp-pass").value;

  error.hidden = true;
  boton.disabled = true;
  boton.innerHTML = '<i class="ti ti-loader-2"></i> Ingresando…';

  try {
    const admin = await iniciarSesion(usuario, contrasena);
    mostrarAplicacion(admin);
    await actualizarDashboard();
  } catch (e) {
    error.textContent = e.message;
    error.hidden = false;
  } finally {
    boton.disabled = false;
    boton.innerHTML = '<i class="ti ti-login"></i> Ingresar al sistema';
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  cerrarSesion();
  mostrarLogin();
});

document.getElementById("refresh-dashboard").addEventListener("click", actualizarDashboard);
document.getElementById("refresh-iot").addEventListener("click", actualizarIot);

document.querySelectorAll(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", async () => {
    document.querySelectorAll(".nav-tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.page).classList.add("active");

    if (tab.dataset.page === "sensors-page") {
      activarSensoresEnVivo();
      await actualizarIot();
    }
  });
});

window.addEventListener("smartparking:session-expired", () => {
  mostrarLogin();
  if (!isEmbed) {
    toast("La sesión expiró. Inicia sesión nuevamente.", "error");
  }
});

setInterval(() => {
  document.getElementById("tb-clock").textContent = new Date().toLocaleTimeString("es-PE");
}, 1000);

(async function iniciar() {
  inicializarSensoresEnVivo();

  const admin = await verificarSesion();
  if (!admin) {
    mostrarLogin();
    return;
  }

  mostrarAplicacion(admin);

  if (embedPage === "sensors") {
    activarSensoresEnVivo();
    await actualizarIot();
  } else {
    await actualizarDashboard();
  }
})();
