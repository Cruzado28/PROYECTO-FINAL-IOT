import time
import json
import threading
from io import BytesIO
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests
from PIL import Image
import numpy as np
import cv2

import os

# La IP de la ESP32-CAM se puede fijar aqui como valor por defecto, o pasarla
# como variable de entorno ESP32_IP al desplegar (ej: en Railway > Variables).
ESP32_IP = os.environ.get("ESP32_IP", "10.252.41.118")
CAPTURE_URL = os.environ.get("ESP32_CAPTURE_URL", f"http://{ESP32_IP}/capture")
camera_lock = threading.Lock()
ARCHIVO_ZONAS = "zonas.json"

sensibilidad_lock = threading.Lock()
sensibilidad = {
    "umbral_brillo": 20.0,
    "umbral_bordes": 0.02,
    "canny_bajo": 20,
    "canny_alto": 80,
}

TIEMPO_CONFIRMACION_SEG = 1.5
INTERVALO_LECTURA = 0.4

app = Flask(__name__)
CORS(app)

estado_lock = threading.Lock()
zonas = []
clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))

def cargar_zonas():
    global zonas
    try:
        with open(ARCHIVO_ZONAS, "r") as f:
            zonas = json.load(f)
    except FileNotFoundError:
        zonas = []
    for z in zonas:
        z.setdefault("referencia", None)
        z.setdefault("referencia_bordes", None)
        z.setdefault("ocupada", False)
        z.setdefault("cambio_desde", None)

def guardar_zonas():
    with open(ARCHIVO_ZONAS, "w") as f:
        json.dump(zonas, f, indent=2)

def limpiar_url_camara(valor):
    valor = (valor or "").strip()
    if not valor:
        return ""
    if not valor.startswith(("http://", "https://")):
        valor = "http://" + valor
    valor = valor.rstrip("/")
    if not valor.endswith("/capture"):
        valor += "/capture"
    return valor

def fijar_url_camara(valor):
    global CAPTURE_URL, ESP32_IP
    nueva = limpiar_url_camara(valor)
    if not nueva:
        return CAPTURE_URL
    with camera_lock:
        CAPTURE_URL = nueva
        ESP32_IP = nueva.replace("http://", "").replace("https://", "").split("/")[0]
        return CAPTURE_URL

def obtener_foto_bytes():
    with camera_lock:
        url = CAPTURE_URL
    r = requests.get(url, timeout=3)
    r.raise_for_status()
    return r.content

def obtener_foto_gris():
    img = Image.open(BytesIO(obtener_foto_bytes())).convert("L")
    return np.array(img)

def calcular_metricas(arr, puntos):
    with sensibilidad_lock:
        canny_bajo = sensibilidad["canny_bajo"]
        canny_alto = sensibilidad["canny_alto"]

    pts = np.array(puntos, dtype=np.int32)
    x0, y0 = pts[:, 0].min(), pts[:, 1].min()
    x1, y1 = pts[:, 0].max(), pts[:, 1].max()
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(arr.shape[1], x1), min(arr.shape[0], y1)

    if x1 <= x0 or y1 <= y0:
        return 0, 0

    mascara = np.zeros(arr.shape, dtype=np.uint8)
    cv2.fillPoly(mascara, [pts], 255)

    recorte = arr[y0:y1, x0:x1]
    mascara_recorte = mascara[y0:y1, x0:x1]

    pixeles_validos = recorte[mascara_recorte == 255]
    if pixeles_validos.size == 0:
        return 0, 0

    brillo = float(pixeles_validos.mean())

    recorte_mejorado = clahe.apply(recorte)
    recorte_suave = cv2.GaussianBlur(recorte_mejorado, (3, 3), 0)
    bordes = cv2.Canny(recorte_suave, canny_bajo, canny_alto)
    bordes_validos = bordes[mascara_recorte == 255]
    densidad_bordes = float((bordes_validos > 0).mean())

    return brillo, densidad_bordes

def loop_deteccion():
    while True:
        try:
            arr = obtener_foto_gris()
            ahora = time.time()
            with sensibilidad_lock:
                umbral_brillo = sensibilidad["umbral_brillo"]
                umbral_bordes = sensibilidad["umbral_bordes"]
            with estado_lock:
                for z in zonas:
                    if not z["puntos"]:
                        continue

                    brillo, bordes = calcular_metricas(arr, z["puntos"])

                    if z["referencia"] is None:
                        z["referencia"] = brillo
                    if z["referencia_bordes"] is None:
                        z["referencia_bordes"] = bordes

                    dif_brillo = abs(brillo - z["referencia"])
                    dif_bordes = abs(bordes - z["referencia_bordes"])

                    ocupado_ahora = (dif_brillo > umbral_brillo) or (dif_bordes > umbral_bordes)

                    if ocupado_ahora != z["ocupada"]:
                        if z["cambio_desde"] is None:
                            z["cambio_desde"] = ahora
                        elif ahora - z["cambio_desde"] >= TIEMPO_CONFIRMACION_SEG:
                            z["ocupada"] = ocupado_ahora
                            z["cambio_desde"] = None
                            print(f"[{z['nombre']}] -> {'OCUPADO' if ocupado_ahora else 'LIBRE'} "
                                  f"(brillo={brillo:.1f} dif={dif_brillo:.1f}, bordes={bordes:.3f} dif={dif_bordes:.3f})")
                    else:
                        z["cambio_desde"] = None
        except Exception as e:
            print("Error en loop de deteccion:", e)
        time.sleep(INTERVALO_LECTURA)

@app.route("/api/camara", methods=["GET", "POST"])
def api_camara():
    if request.method == "POST":
        datos = request.json or {}
        valor = datos.get("capture_url") or datos.get("ip") or datos.get("url")
        fijar_url_camara(valor)
    with camera_lock:
        return jsonify({"ok": True, "capture_url": CAPTURE_URL, "ip": ESP32_IP})

@app.route("/api/captura", methods=["GET"])
def api_captura():
    try:
        foto = obtener_foto_bytes()
        return Response(foto, mimetype="image/jpeg")
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 503

@app.route("/api/estado", methods=["GET"])
def api_estado():
    with estado_lock:
        return jsonify([{"zona": z["nombre"], "ocupado": z["ocupada"]} for z in zonas])

@app.route("/api/zonas", methods=["GET"])
def api_get_zonas():
    with estado_lock:
        return jsonify(zonas)

@app.route("/api/zonas", methods=["POST"])
def api_set_zonas():
    global zonas
    nuevas = request.json
    with estado_lock:
        for nz in nuevas:
            nz.setdefault("referencia", None)
            nz.setdefault("referencia_bordes", None)
            nz.setdefault("ocupada", False)
            nz.setdefault("cambio_desde", None)
        zonas = nuevas
        guardar_zonas()
    return jsonify({"ok": True})

@app.route("/api/recalibrar", methods=["POST"])
def api_recalibrar():
    try:
        arr = obtener_foto_gris()
        with estado_lock:
            for z in zonas:
                if z["puntos"]:
                    brillo, bordes = calcular_metricas(arr, z["puntos"])
                    z["referencia"] = brillo
                    z["referencia_bordes"] = bordes
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/sensibilidad", methods=["GET"])
def api_get_sensibilidad():
    with sensibilidad_lock:
        return jsonify(sensibilidad)

@app.route("/api/sensibilidad", methods=["POST"])
def api_set_sensibilidad():
    datos = request.json
    with sensibilidad_lock:
        for clave in ["umbral_brillo", "umbral_bordes", "canny_bajo", "canny_alto"]:
            if clave in datos:
                sensibilidad[clave] = float(datos[clave]) if clave in ("umbral_brillo", "umbral_bordes") else int(float(datos[clave]))
    return jsonify({"ok": True, "sensibilidad": sensibilidad})

@app.route("/debug/<nombre_zona>")
def debug_zona(nombre_zona):
    try:
        arr = obtener_foto_gris()
        with estado_lock:
            zona = next((z for z in zonas if z["nombre"] == nombre_zona), None)
        if zona is None:
            return "Zona no encontrada", 404

        with sensibilidad_lock:
            canny_bajo = sensibilidad["canny_bajo"]
            canny_alto = sensibilidad["canny_alto"]

        pts = np.array(zona["puntos"], dtype=np.int32)
        x0, y0 = max(0, int(pts[:, 0].min())), max(0, int(pts[:, 1].min()))
        x1, y1 = min(arr.shape[1], int(pts[:, 0].max())), min(arr.shape[0], int(pts[:, 1].max()))

        recorte = arr[y0:y1, x0:x1]
        mascara = np.zeros(arr.shape, dtype=np.uint8)
        cv2.fillPoly(mascara, [pts], 255)
        mascara_recorte = mascara[y0:y1, x0:x1]

        recorte_mejorado = clahe.apply(recorte)
        recorte_suave = cv2.GaussianBlur(recorte_mejorado, (3, 3), 0)
        bordes = cv2.Canny(recorte_suave, canny_bajo, canny_alto)

        factor = 4
        recorte_grande = cv2.resize(recorte, None, fx=factor, fy=factor, interpolation=cv2.INTER_NEAREST)
        mejorado_grande = cv2.resize(recorte_mejorado, None, fx=factor, fy=factor, interpolation=cv2.INTER_NEAREST)
        bordes_grande = cv2.resize(bordes, None, fx=factor, fy=factor, interpolation=cv2.INTER_NEAREST)
        mascara_grande = cv2.resize(mascara_recorte, None, fx=factor, fy=factor, interpolation=cv2.INTER_NEAREST)

        recorte_color = cv2.cvtColor(recorte_grande, cv2.COLOR_GRAY2BGR)
        con_mascara = cv2.cvtColor(mejorado_grande, cv2.COLOR_GRAY2BGR)
        con_mascara[mascara_grande == 0] = con_mascara[mascara_grande == 0] // 4

        bordes_color = cv2.cvtColor(bordes_grande, cv2.COLOR_GRAY2BGR)
        bordes_color[bordes_grande > 0] = [0, 255, 0]

        def con_etiqueta(img, texto):
            salida = img.copy()
            cv2.putText(salida, texto, (6, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 0), 1, cv2.LINE_AA)
            return salida

        recorte_color = con_etiqueta(recorte_color, "Original")
        con_mascara = con_etiqueta(con_mascara, "Mascara + contraste")
        bordes_color = con_etiqueta(bordes_color, "Bordes detectados")

        ancho = recorte_color.shape[1]
        separador = np.full((6, ancho, 3), 40, dtype=np.uint8)
        composicion = np.vstack([recorte_color, separador, con_mascara, separador, bordes_color])

        ok, buf = cv2.imencode(".png", composicion)
        return Response(buf.tobytes(), mimetype="image/png")
    except Exception as e:
        return str(e), 500

if __name__ == "__main__":
    cargar_zonas()
    hilo = threading.Thread(target=loop_deteccion, daemon=True)
    hilo.start()
    puerto = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=puerto, debug=False)