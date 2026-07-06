const TOKEN_KEY = "smartParkingToken";
const ADMIN_KEY = "smartParkingAdmin";

export function obtenerToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function guardarSesion(token, administrador) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_KEY, JSON.stringify(administrador));
}

export function obtenerAdministrador() {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_KEY) || "null");
  } catch {
    return null;
  }
}

export function limpiarSesion() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_KEY);
}

export async function apiFetch(url, opciones = {}) {
  const headers = new Headers(opciones.headers || {});
  const token = obtenerToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (opciones.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const respuesta = await fetch(url, { ...opciones, headers });

  if (respuesta.status === 401 && !url.includes("/auth/login")) {
    limpiarSesion();
    window.dispatchEvent(new CustomEvent("smartparking:session-expired"));
  }

  return respuesta;
}

export async function leerJson(respuesta) {
  try {
    return await respuesta.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta no válida");
  }
}
