import { apiFetch, leerJson, guardarSesion, limpiarSesion, obtenerToken } from "./api.js";

export async function iniciarSesion(usuario, contrasena) {
  const respuesta = await apiFetch("/api/v2/auth/login", {
    method: "POST",
    body: JSON.stringify({ usuario, contrasena })
  });
  const datos = await leerJson(respuesta);

  if (!respuesta.ok || !datos.ok) {
    throw new Error(datos.mensaje || "No se pudo iniciar sesión");
  }

  guardarSesion(datos.token, datos.administrador);
  return datos.administrador;
}

export async function verificarSesion() {
  if (!obtenerToken()) return null;

  const respuesta = await apiFetch("/api/v2/auth/verificar");
  const datos = await leerJson(respuesta);

  if (!respuesta.ok || !datos.ok) {
    limpiarSesion();
    return null;
  }

  return datos.administrador;
}

export function cerrarSesion() {
  limpiarSesion();
}
