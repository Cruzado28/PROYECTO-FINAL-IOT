#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <ESP32Servo.h>

// ============================================================
// SMART PARK - ESP32 FINAL SIN SALDO / PAGO POR TIEMPO
// ============================================================
// Cambios aplicados:
// - 1 RFID de ACCESO: entrada + salida + incidencias.
// - 1 RFID de PAGO: solo calcula y marca el pago por tiempo.
// - NO requiere registrar/escribir manualmente la tarjeta ni manejar saldos.
// - Al ingresar, la placa se genera con los 3 ultimos caracteres del UID.
// - Los espacios cambian en vivo: Libre, Estacionado, Pagado, Incidencia.
// - El pago usa la tarifa editable de la pagina y NO descuenta saldo.
// - Funciona directamente en FUNCIONAMIENTO OPERATIVO, sin modo prueba.
// - Sin ESP32-CAM, sin potenciometro, sin laser, sin LDR, sin segundo servo.
// - El tiempo empieza en el lector de acceso cuando ingresa y termina al salir.
//
// CAMBIAR SOLO WIFI_SSID Y WIFI_PASSWORD.
// ============================================================

// ===============================
// CAMBIA SOLO ESTO
// ===============================
const char* WIFI_SSID     = "TU_WIFI";
const char* WIFI_PASSWORD = "TU_PASSWORD_WIFI";

// ===============================
// RAILWAY / WEBSOCKET
// En la pagina se usa:
// wss://proyecto-final-iot-production.up.railway.app/iot-ws?client=panel
// El ESP32 debe entrar como dispositivo:
// ===============================
const char* WSS_HOST = "proyecto-final-iot-production.up.railway.app";
const uint16_t WSS_PORT = 443;
const char* WSS_PATH = "/iot-ws?client=esp32";

WebSocketsClient wsClient;
bool wsConectado = false;

// ===============================
// LECTORES RC522
// Pines confirmados por tu maqueta
// ===============================
#define NUM_LECTORES 2

const uint8_t SS_PINS[NUM_LECTORES]  = { 5, 17 };
const uint8_t RST_PINS[NUM_LECTORES] = { 4, 16 };

MFRC522 mfrc522[NUM_LECTORES] = {
  MFRC522(SS_PINS[0], RST_PINS[0]),
  MFRC522(SS_PINS[1], RST_PINS[1])
};

// INVERTIDO SEGUN TU MAQUETA:
// Lector SS=17/RST=16 -> ACCESO.
// Lector SS=5/RST=4   -> PAGO.
#define LECTOR_PAGO   0
#define LECTOR_ACCESO 1

#define SPI_SCK   18
#define SPI_MISO  19
#define SPI_MOSI  23

#define MAX_UID_SIZE 10
uint8_t lastUID[NUM_LECTORES][MAX_UID_SIZE] = { 0 };
uint8_t lastUIDSize[NUM_LECTORES] = { 0 };
unsigned long lastReadTime[NUM_LECTORES] = { 0 };
const unsigned long DEBOUNCE_TIME = 2200;
uint8_t currentReader = 0;

// ===============================
// OLED directo, sin MUX
// ===============================
U8G2_SH1106_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);

// ===============================
// SERVOMOTOR UNICO
// Reposo 90 grados. Evento 0 grados por 4 segundos.
// ===============================
#define PIN_SERVO 25
Servo servoBarrera;
const int ANGULO_REPOSO = 90;
const int ANGULO_EVENTO = 0;
const unsigned long TIEMPO_EVENTO_MS = 4000;
int anguloServoActual = ANGULO_REPOSO;

// ===============================
// ESPACIOS
// ===============================
#define TOTAL_ESPACIOS 10

struct Espacio {
  String uid;
  String placa;
  uint8_t estado; // 0 libre, 1 estacionado/sin pago, 2 pagado/listo para salir, 3 incidencia
  unsigned long ingresoMin;
  unsigned long pagoMin;
  unsigned long limiteSalidaMin;
  float pago;
  String fechaOperacion;
};

Espacio espacios[TOTAL_ESPACIOS];

// ===============================
// OPERACION
// ===============================
String modoOperacion = "live";
bool liveMode = true;
String fechaOperacion = "2026-07-15";

String ultimoUID = "----";
String ultimoLector = "ninguno";
String ultimaPlaca = "---";
int ultimoEspacio = 0;
String ultimoEstadoSesion = "Sin lectura";
float ultimoPago = 0.0;
unsigned long ultimaDuracionMin = 0;

String msgLinea1 = "SMART PARK";
String msgLinea2 = "Iniciando...";
unsigned long msgHasta = 0;

// ===============================
// TARIFAS EDITABLES DESDE LA PAGINA
// Valores de respaldo para la prueba del profesor:
// 1 minuto real = S/ 1.00
// ===============================
float tarifaHora = 60.00;
float tarifaMinuto = 1.0000;
unsigned long tiempoGraciaMin = 0;
unsigned long tiempoSalidaPostPagoMin = 10;
float tarifaMaximaDiaria = 1440.00;
unsigned long ultimoFetchTarifa = 0;
const unsigned long TARIFA_REFRESH_MS = 60000;


// Prototipos
void broadcastEstado();

// Timers
unsigned long ultimoWS = 0;
unsigned long ultimoEstadoSerial = 0;
unsigned long ultimoRFIDCheck = 0;

// ============================================================
// JSON / TEXTO
// ============================================================
String jsonEscape(String s) {
  s.replace("\\", "\\\\");
  s.replace("\"", "\\\"");
  s.replace("\n", "\\n");
  s.replace("\r", "\\r");
  s.replace("\t", "\\t");
  return s;
}

void enviarWS(const String& mensaje) {
  if (wsConectado) wsClient.sendTXT(mensaje);
}

String extraerCampo(const String& json, const String& key) {
  String pattern = "\"" + key + "\":\"";
  int idx = json.indexOf(pattern);
  if (idx < 0) return "";
  idx += pattern.length();
  String out = "";
  bool esc = false;
  for (int i = idx; i < (int)json.length(); i++) {
    char c = json[i];
    if (esc) {
      out += c;
      esc = false;
    } else if (c == '\\') {
      esc = true;
    } else if (c == '"') {
      break;
    } else {
      out += c;
    }
  }
  return out;
}

float extraerNumeroJson(const String& json, const String& key, float def) {
  String pattern = "\"" + key + "\":";
  int idx = json.indexOf(pattern);
  if (idx < 0) return def;
  idx += pattern.length();
  while (idx < (int)json.length() && (json[idx] == ' ' || json[idx] == '\t')) idx++;
  int end = idx;
  while (end < (int)json.length()) {
    char c = json[end];
    if ((c >= '0' && c <= '9') || c == '.' || c == '-' || c == '+') end++;
    else break;
  }
  if (end <= idx) return def;
  return json.substring(idx, end).toFloat();
}

unsigned long extraerULongJson(const String& json, const String& key, unsigned long def) {
  float valor = extraerNumeroJson(json, key, (float)def);
  if (valor < 0) return def;
  return (unsigned long)(valor + 0.5);
}

String uidToString(byte* buffer, byte bufferSize) {
  String uid = "";
  for (byte i = 0; i < bufferSize; i++) {
    if (buffer[i] < 0x10) uid += "0";
    uid += String(buffer[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

String placaDesdeUID(const String& uid) {
  String clean = "";
  for (uint16_t i = 0; i < uid.length(); i++) {
    char c = uid[i];
    if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) clean += c;
  }
  clean.toUpperCase();
  if (clean.length() <= 3) return clean.length() ? clean : "---";
  return clean.substring(clean.length() - 3);
}

unsigned long minutoActualReal() {
  // 1 minuto real = 1 minuto de estacionamiento.
  return millis() / 60000UL;
}

String horaOperacionTexto() {
  unsigned long totalSeconds = (millis() / 1000UL) % 86400UL;
  unsigned int hh = totalSeconds / 3600UL;
  unsigned int mm = (totalSeconds % 3600UL) / 60UL;
  unsigned int ss = totalSeconds % 60UL;
  char buf[12];
  snprintf(buf, sizeof(buf), "%02u:%02u:%02u", hh, mm, ss);
  return String(buf);
}

String fechaHoraOperacionTexto() {
  return fechaOperacion + " " + horaOperacionTexto();
}

// ============================================================
// TARIFAS DESDE RAILWAY
// ============================================================
void aplicarTarifaDesdeJson(const String& json) {
  float nuevaHora = extraerNumeroJson(json, "tarifaHora", tarifaHora);
  float nuevaMinuto = extraerNumeroJson(json, "tarifaMinuto", tarifaMinuto);
  unsigned long nuevaGracia = extraerULongJson(json, "tiempoGraciaMinutos", tiempoGraciaMin);
  nuevaGracia = extraerULongJson(json, "tiempoGraciaMin", nuevaGracia);
  unsigned long nuevaSalida = extraerULongJson(json, "tiempoSalidaDespuesPagoMinutos", tiempoSalidaPostPagoMin);
  nuevaSalida = extraerULongJson(json, "tiempoSalidaPostPagoMin", nuevaSalida);
  float nuevaMaxima = extraerNumeroJson(json, "tarifaMaximaDiaria", tarifaMaximaDiaria);

  if (nuevaHora >= 0) tarifaHora = nuevaHora;
  if (nuevaMinuto >= 0) tarifaMinuto = nuevaMinuto;
  else if (tarifaHora > 0) tarifaMinuto = tarifaHora / 60.0;
  if (nuevaGracia < 10080UL) tiempoGraciaMin = nuevaGracia;
  if (nuevaSalida < 10080UL) tiempoSalidaPostPagoMin = nuevaSalida;
  if (nuevaMaxima >= 0) tarifaMaximaDiaria = nuevaMaxima;

  Serial.println("[TARIFA] Configuracion aplicada desde Railway/pagina");
  Serial.print("  Tarifa minuto: S/ "); Serial.println(tarifaMinuto, 4);
  Serial.print("  Tarifa hora  : S/ "); Serial.println(tarifaHora, 2);
  Serial.print("  Gracia       : "); Serial.print(tiempoGraciaMin); Serial.println(" min");
  Serial.print("  Salida post pago: "); Serial.print(tiempoSalidaPostPagoMin); Serial.println(" min");
  Serial.print("  Maxima diaria: S/ "); Serial.println(tarifaMaximaDiaria, 2);
}

void actualizarTarifaDesdeWeb(bool forzar = false) {
  if (WiFi.status() != WL_CONNECTED) return;
  unsigned long ahora = millis();
  if (!forzar && ultimoFetchTarifa > 0 && ahora - ultimoFetchTarifa < TARIFA_REFRESH_MS) return;
  ultimoFetchTarifa = ahora;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = "https://" + String(WSS_HOST) + "/api/v2/configuracion/tarifa";

  Serial.print("[TARIFA] Consultando: ");
  Serial.println(url);

  if (!http.begin(client, url)) {
    Serial.println("[TARIFA] No se pudo iniciar HTTPClient");
    return;
  }

  int code = http.GET();
  if (code == 200) {
    String payload = http.getString();
    aplicarTarifaDesdeJson(payload);
    enviarWS("{\"tarifaStatus\":\"updated\",\"message\":\"Tarifa actualizada desde Railway\"}");
  } else {
    Serial.print("[TARIFA] Error HTTP: ");
    Serial.println(code);
  }
  http.end();
}

float calcularPagoEstacionamiento(unsigned long duracionMin) {
  if (duracionMin <= tiempoGraciaMin) return 0.0;
  unsigned long minutosCobrables = duracionMin - tiempoGraciaMin;
  unsigned long diasCompletos = minutosCobrables / 1440UL;
  unsigned long minutosRestantes = minutosCobrables % 1440UL;

  float pago = diasCompletos * tarifaMaximaDiaria;
  float pagoRestante = minutosRestantes * tarifaMinuto;
  if (tarifaMaximaDiaria > 0 && pagoRestante > tarifaMaximaDiaria) pagoRestante = tarifaMaximaDiaria;
  pago += pagoRestante;
  if (pago < 0) pago = 0;
  return pago;
}

// ============================================================
// ESPACIOS
// ============================================================
void resetEspacios() {
  for (uint8_t i = 0; i < TOTAL_ESPACIOS; i++) {
    espacios[i].uid = "";
    espacios[i].placa = "";
    espacios[i].estado = 0;
    espacios[i].ingresoMin = 0;
    espacios[i].pagoMin = 0;
    espacios[i].limiteSalidaMin = 0;
    espacios[i].pago = 0.0;
    espacios[i].fechaOperacion = "";
  }
}

int buscarEspacioPorUID(const String& uid) {
  for (uint8_t i = 0; i < TOTAL_ESPACIOS; i++) {
    if (espacios[i].estado != 0 && espacios[i].uid == uid) return i;
  }
  return -1;
}

int buscarUnicoVehiculoPendientePago() {
  // Ayuda para la demo: si solo hay un vehículo pendiente de pago,
  // el lector de pago puede aplicar el cobro aunque la lectura UID falle
  // o se use otra tarjeta por error. Si hay varios vehículos, exige UID correcto.
  int encontrado = -1;
  uint8_t contador = 0;
  for (uint8_t i = 0; i < TOTAL_ESPACIOS; i++) {
    if (espacios[i].estado == 1 || espacios[i].estado == 3) {
      encontrado = i;
      contador++;
    }
  }
  return contador == 1 ? encontrado : -1;
}

int buscarEspacioLibre() {
  for (uint8_t i = 0; i < TOTAL_ESPACIOS; i++) {
    if (espacios[i].estado == 0) return i;
  }
  return -1;
}

uint8_t contarDisponibles() {
  uint8_t libres = 0;
  for (uint8_t i = 0; i < TOTAL_ESPACIOS; i++) if (espacios[i].estado == 0) libres++;
  return libres;
}

const char* estadoEspacioTexto(uint8_t estado) {
  if (estado == 1) return "Estacionado";
  if (estado == 2) return "Pagado";
  if (estado == 3) return "Incidencia";
  return "Libre";
}

String estadoSesionPorIndice(int idx) {
  if (idx < 0 || idx >= TOTAL_ESPACIOS) return "Sin lectura";
  if (espacios[idx].estado == 1) return "Estacionado, pendiente de pago";
  if (espacios[idx].estado == 2) return "Pagado, listo para salir";
  if (espacios[idx].estado == 3) return "Incidencia: salida sin pago";
  return "Libre";
}

void mostrarMensaje(const String& l1, const String& l2, unsigned long duracionMs) {
  msgLinea1 = l1;
  msgLinea2 = l2;
  msgHasta = millis() + duracionMs;
  Serial.print("[OLED] "); Serial.print(l1); Serial.print(" | "); Serial.println(l2);
}

void abrirBarrera() {
  servoBarrera.write(ANGULO_EVENTO);
  anguloServoActual = ANGULO_EVENTO;
  broadcastEstado();
  delay(TIEMPO_EVENTO_MS);
  servoBarrera.write(ANGULO_REPOSO);
  anguloServoActual = ANGULO_REPOSO;
  broadcastEstado();
}

void mostrarOLED() {
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x12_tf);

  if (millis() < msgHasta) {
    oled.setCursor(0, 12); oled.print(msgLinea1.substring(0, 21));
    oled.setCursor(0, 30); oled.print(msgLinea2.substring(0, 21));
    oled.setCursor(0, 50); oled.print("Modo: OPERATIVO");
  } else {
    oled.setCursor(0, 10); oled.print("SMART PARK");
    oled.setCursor(0, 25); oled.print("FUNCIONAMIENTO");
    oled.setCursor(0, 40); oled.print("Libres: "); oled.print(contarDisponibles()); oled.print("/"); oled.print(TOTAL_ESPACIOS);
    oled.setCursor(0, 56); oled.print("Esperando tarjeta...");
  }
  oled.sendBuffer();
}

// ============================================================
// EVENTOS A LA PAGINA
// ============================================================
String cardDataJson(int idx, const String& uid, const String& lector) {
  String placa = idx >= 0 ? espacios[idx].placa : placaDesdeUID(uid);
  String estado = idx >= 0 ? estadoSesionPorIndice(idx) : "Lectura sin sesión";
  int espacio = idx >= 0 ? idx + 1 : 0;
  float pago = idx >= 0 ? espacios[idx].pago : 0.0;
  unsigned long duracion = 0;
  if (idx >= 0 && espacios[idx].ingresoMin > 0) {
    unsigned long ahora = minutoActualReal();
    duracion = ahora >= espacios[idx].ingresoMin ? ahora - espacios[idx].ingresoMin : 0;
  }

  String json = "{\"hasData\":1,";
  json += "\"placa\":\"" + jsonEscape(placa) + "\",";
  json += "\"espacio\":\"" + String(espacio) + "\",";
  json += "\"estadoSesion\":\"" + jsonEscape(estado) + "\",";
  json += "\"pago\":" + String(pago, 2) + ",";
  json += "\"duracionMin\":" + String(duracion) + ",";
  json += "\"lector\":\"" + jsonEscape(lector) + "\"";
  json += "}";
  return json;
}

void actualizarUltimaLectura(const String& uid, const String& lector, int idx) {
  ultimoUID = uid;
  ultimoLector = lector;
  ultimoEspacio = idx >= 0 ? idx + 1 : 0;
  ultimaPlaca = idx >= 0 ? espacios[idx].placa : placaDesdeUID(uid);
  ultimoEstadoSesion = idx >= 0 ? estadoSesionPorIndice(idx) : "Lectura sin sesión";
  ultimoPago = idx >= 0 ? espacios[idx].pago : 0.0;
  ultimaDuracionMin = 0;
  if (idx >= 0 && espacios[idx].ingresoMin > 0) {
    unsigned long ahora = minutoActualReal();
    ultimaDuracionMin = ahora >= espacios[idx].ingresoMin ? ahora - espacios[idx].ingresoMin : 0;
  }
}

void enviarEventoAcceso(const String& status, const String& uid, const String& msg, const String& tipoAccion, int espacioNum = 0) {
  int idx = espacioNum > 0 ? espacioNum - 1 : buscarEspacioPorUID(uid);
  String json = "{";
  json += "\"accessStatus\":\"" + status + "\",";
  json += "\"tipoAcceso\":\"" + jsonEscape(tipoAccion) + "\",";
  json += "\"uid\":\"" + jsonEscape(uid) + "\",";
  json += "\"lastReader\":\"acceso\",";
  json += "\"placa\":\"" + jsonEscape(idx >= 0 ? espacios[idx].placa : placaDesdeUID(uid)) + "\",";
  json += "\"fechaOperacion\":\"" + jsonEscape(fechaOperacion) + "\",";
  json += "\"fechaHoraOperacion\":\"" + jsonEscape(fechaHoraOperacionTexto()) + "\",";
  json += "\"espacio\":" + String(espacioNum) + ",";
  json += "\"message\":\"" + jsonEscape(msg) + "\",";
  json += "\"cardData\":" + cardDataJson(idx, uid, "acceso");
  json += "}";
  enviarWS(json);
}

void enviarEventoIncidencia(const String& uid, const String& msg, int idx) {
  String json = "{";
  json += "\"incidentStatus\":\"warning\",";
  json += "\"tipoIncidencia\":\"salida_sin_pago\",";
  json += "\"uid\":\"" + jsonEscape(uid) + "\",";
  json += "\"lastReader\":\"acceso\",";
  json += "\"placa\":\"" + jsonEscape(idx >= 0 ? espacios[idx].placa : placaDesdeUID(uid)) + "\",";
  json += "\"fechaOperacion\":\"" + jsonEscape(fechaOperacion) + "\",";
  json += "\"fechaHoraOperacion\":\"" + jsonEscape(fechaHoraOperacionTexto()) + "\",";
  json += "\"espacio\":" + String(idx >= 0 ? idx + 1 : 0) + ",";
  json += "\"message\":\"" + jsonEscape(msg) + "\",";
  json += "\"cardData\":" + cardDataJson(idx, uid, "acceso");
  json += "}";
  enviarWS(json);
}

void enviarEventoPago(const String& status, const String& uid, const String& msg, float pago, unsigned long duracionMin, int idx) {
  String json = "{";
  json += "\"paymentStatus\":\"" + status + "\",";
  json += "\"uid\":\"" + jsonEscape(uid) + "\",";
  json += "\"lastReader\":\"pago\",";
  json += "\"placa\":\"" + jsonEscape(idx >= 0 ? espacios[idx].placa : placaDesdeUID(uid)) + "\",";
  json += "\"fechaOperacion\":\"" + jsonEscape(fechaOperacion) + "\",";
  json += "\"fechaHoraOperacion\":\"" + jsonEscape(fechaHoraOperacionTexto()) + "\",";
  json += "\"espacio\":" + String(idx >= 0 ? idx + 1 : 0) + ",";
  json += "\"message\":\"" + jsonEscape(msg) + "\",";
  json += "\"pago\":" + String(pago, 2) + ",";
  json += "\"duracionMin\":" + String(duracionMin) + ",";
  json += "\"cardData\":" + cardDataJson(idx, uid, "pago");
  json += "}";
  enviarWS(json);
}


// ============================================================
// LOGICA DE ESTACIONAMIENTO
// ============================================================
void procesarAcceso(const String& uid) {
  int idx = buscarEspacioPorUID(uid);
  unsigned long ahoraMin = minutoActualReal();

  if (idx < 0) {
    // ENTRADA: no requiere tarjeta registrada.
    int libre = buscarEspacioLibre();
    if (libre < 0) {
      actualizarUltimaLectura(uid, "acceso", -1);
      enviarEventoAcceso("error", uid, "Entrada denegada: no hay espacios disponibles.", "entrada", 0);
      mostrarMensaje("ENTRADA DENEG.", "Sin espacios", 2500);
      return;
    }

    espacios[libre].uid = uid;
    espacios[libre].placa = placaDesdeUID(uid);
    espacios[libre].estado = 1;
    espacios[libre].ingresoMin = ahoraMin;
    espacios[libre].pagoMin = 0;
    espacios[libre].limiteSalidaMin = 0;
    espacios[libre].pago = 0.0;
    espacios[libre].fechaOperacion = fechaOperacion;

    actualizarUltimaLectura(uid, "acceso", libre);
    enviarEventoAcceso("success", uid, "Ingreso registrado automaticamente. Placa generada con UID: " + espacios[libre].placa, "entrada", libre + 1);
    mostrarMensaje("ENTRADA OK", "Placa " + espacios[libre].placa, 2500);
    abrirBarrera();
    return;
  }

  actualizarUltimaLectura(uid, "acceso", idx);

  if (espacios[idx].estado == 1) {
    // Ya esta dentro y no pago: no abre, registra incidencia.
    espacios[idx].estado = 3;
    String mensaje = "Salida rechazada: debe pagar primero. Incidencia registrada.";
    enviarEventoIncidencia(uid, mensaje, idx);
    enviarEventoAcceso("error", uid, mensaje, "salida_sin_pago", idx + 1);
    mostrarMensaje("SALIDA DENEGADA", "Debe pagar", 3000);
    return;
  }

  if (espacios[idx].estado == 3) {
    String mensaje = "Vehiculo con incidencia pendiente. Debe pagar para habilitar la salida.";
    enviarEventoIncidencia(uid, mensaje, idx);
    enviarEventoAcceso("error", uid, mensaje, "incidencia_pendiente", idx + 1);
    mostrarMensaje("INCIDENCIA", "Pagar primero", 3000);
    return;
  }

  if (espacios[idx].estado == 2) {
    unsigned long limite = espacios[idx].limiteSalidaMin;
    if (limite > 0 && ahoraMin > limite) {
      espacios[idx].estado = 1;
      espacios[idx].pago = 0.0;
      actualizarUltimaLectura(uid, "acceso", idx);
      String mensaje = "Tiempo para salir despues del pago vencido. Debe volver a pagar.";
      enviarEventoIncidencia(uid, mensaje, idx);
      enviarEventoAcceso("error", uid, mensaje, "salida_vencida", idx + 1);
      mostrarMensaje("SALIDA VENCIDA", "Volver a pagar", 3000);
      return;
    }

    int espacioLiberado = idx + 1;
    String placa = espacios[idx].placa;
    enviarEventoAcceso("success", uid, "Salida autorizada. Espacio liberado.", "salida", espacioLiberado);
    mostrarMensaje("SALIDA OK", "Placa " + placa, 2500);
    abrirBarrera();

    espacios[idx].uid = "";
    espacios[idx].placa = "";
    espacios[idx].estado = 0;
    espacios[idx].ingresoMin = 0;
    espacios[idx].pagoMin = 0;
    espacios[idx].limiteSalidaMin = 0;
    espacios[idx].pago = 0.0;
    espacios[idx].fechaOperacion = "";
    actualizarUltimaLectura(uid, "acceso", -1);
    return;
  }
}

void procesarPago(const String& uidLeido) {
  // El RFID de pago NO lee ni escribe saldo. Solo usa el UID para buscar
  // el vehículo que ya ingresó y calcula el cobro por tiempo transcurrido.
  int idx = buscarEspacioPorUID(uidLeido);

  if (idx < 0) {
    int unico = buscarUnicoVehiculoPendientePago();
    if (unico >= 0) {
      // Respaldo útil para la exposición cuando solo se está probando un carro.
      idx = unico;
      Serial.println("[PAGO] UID no coincidió, pero hay un único vehículo pendiente. Se aplicará pago a ese espacio.");
    } else {
      actualizarUltimaLectura(uidLeido, "pago", -1);
      enviarEventoPago("error", uidLeido, "Pago rechazado: no hay ingreso activo con esta tarjeta. Primero debe ingresar por el RFID de acceso.", 0.0, 0, -1);
      mostrarMensaje("PAGO DENEGADO", "Sin ingreso activo", 2500);
      return;
    }
  }

  String uidSesion = espacios[idx].uid;
  unsigned long ahoraMin = minutoActualReal();
  unsigned long ingresoMin = espacios[idx].ingresoMin;
  if (ingresoMin > ahoraMin) ingresoMin = ahoraMin;
  unsigned long duracionMin = ahoraMin - ingresoMin;
  if (duracionMin == 0) duracionMin = 1;

  if (espacios[idx].estado == 2) {
    actualizarUltimaLectura(uidSesion, "pago", idx);
    enviarEventoPago("success", uidSesion, "Este vehículo ya está pagado. Puede salir por el RFID de acceso.", espacios[idx].pago, duracionMin, idx);
    mostrarMensaje("YA PAGADO", "Puede salir", 2500);
    return;
  }

  // Si venía con incidencia por intentar salir sin pagar, el pago la corrige.
  // No se maneja saldo por tarjeta: solo se calcula y se marca como pagado.
  float pago = calcularPagoEstacionamiento(duracionMin);
  espacios[idx].estado = 2;
  espacios[idx].pago = pago;
  espacios[idx].pagoMin = ahoraMin;
  espacios[idx].limiteSalidaMin = ahoraMin + tiempoSalidaPostPagoMin;
  actualizarUltimaLectura(uidSesion, "pago", idx);

  enviarEventoPago("success", uidSesion, "Pago calculado por tiempo y marcado como pagado. Ahora puede salir por el RFID de acceso.", pago, duracionMin, idx);
  mostrarMensaje("PAGO OK", "S/ " + String(pago, 2), 3000);
}

// ============================================================
// RFID
// ============================================================
void guardarUltimoUID(uint8_t readerIndex) {
  lastUIDSize[readerIndex] = mfrc522[readerIndex].uid.size;
  for (uint8_t i = 0; i < MAX_UID_SIZE; i++) {
    lastUID[readerIndex][i] = i < mfrc522[readerIndex].uid.size ? mfrc522[readerIndex].uid.uidByte[i] : 0;
  }
}

bool isSameUID(uint8_t readerIndex) {
  if (mfrc522[readerIndex].uid.size != lastUIDSize[readerIndex]) return false;
  for (uint8_t i = 0; i < mfrc522[readerIndex].uid.size; i++) {
    if (mfrc522[readerIndex].uid.uidByte[i] != lastUID[readerIndex][i]) return false;
  }
  return true;
}

const char* nombreLector(uint8_t readerIndex) {
  if (readerIndex == LECTOR_ACCESO) return "ACCESO";
  return "PAGO";
}

void reviewReader(uint8_t readerIndex) {
  if (!mfrc522[readerIndex].PICC_IsNewCardPresent()) return;
  delay(10);
  if (!mfrc522[readerIndex].PICC_ReadCardSerial()) {
    mfrc522[readerIndex].PCD_StopCrypto1();
    return;
  }

  if (isSameUID(readerIndex) && (millis() - lastReadTime[readerIndex] < DEBOUNCE_TIME)) {
    mfrc522[readerIndex].PICC_HaltA();
    mfrc522[readerIndex].PCD_StopCrypto1();
    return;
  }

  lastReadTime[readerIndex] = millis();
  guardarUltimoUID(readerIndex);

  String uid = uidToString(mfrc522[readerIndex].uid.uidByte, mfrc522[readerIndex].uid.size);
  MFRC522::PICC_Type tipo = mfrc522[readerIndex].PICC_GetType(mfrc522[readerIndex].uid.sak);

  Serial.println("\n====================================");
  Serial.print(">> TARJETA DETECTADA EN: "); Serial.println(nombreLector(readerIndex));
  Serial.print("UID  : "); Serial.println(uid);
  Serial.print("Placa: "); Serial.println(placaDesdeUID(uid));
  Serial.print("Tipo : "); Serial.println(mfrc522[readerIndex].PICC_GetTypeName(tipo));
  Serial.println("====================================\n");

  if (readerIndex == LECTOR_ACCESO) procesarAcceso(uid);
  else procesarPago(uid);

  mfrc522[readerIndex].PICC_HaltA();
  mfrc522[readerIndex].PCD_StopCrypto1();
  delay(100);
}

bool lectorResponde(uint8_t i) {
  byte version = mfrc522[i].PCD_ReadRegister(MFRC522::VersionReg);
  return !(version == 0x00 || version == 0xFF);
}

void revisarRFID() {
  for (uint8_t i = 0; i < NUM_LECTORES; i++) {
    if (!lectorResponde(i)) {
      Serial.print("[RFID] Lector "); Serial.print(nombreLector(i)); Serial.println(" no responde por SPI");
      mfrc522[i].PCD_Init();
      delay(10);
    }
  }
}

// ============================================================
// WEBSOCKET
// ============================================================
void wsEvent(WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    wsConectado = true;
    Serial.println("[WSS] Conectado al gateway de Railway como ESP32");
    actualizarTarifaDesdeWeb(true);
    enviarWS("{\"mode\":\"live\",\"message\":\"ESP32 conectado en funcionamiento operativo\"}");
  }
  else if (type == WStype_DISCONNECTED) {
    wsConectado = false;
    Serial.println("[WSS] Desconectado del gateway de Railway");
  }
  else if (type == WStype_TEXT) {
    String msg = "";
    for (size_t i = 0; i < length; i++) msg += (char)payload[i];
    Serial.print("[Comando WSS] "); Serial.println(msg);

    if (msg.indexOf("\"gateway\":true") >= 0) return;

    if (msg.indexOf("\"cmd\":\"mode\"") >= 0) {
      // El proyecto ya no usa modo prueba. Siempre queda operativo.
      liveMode = true;
      modoOperacion = "live";
      enviarWS("{\"mode\":\"live\",\"message\":\"Funcionamiento operativo activo\"}");
    }
    else if (msg.indexOf("\"cmd\":\"simulationDate\"") >= 0) {
      String nuevaFecha = extraerCampo(msg, "date");
      if (nuevaFecha.length() == 10) {
        fechaOperacion = nuevaFecha;
        mostrarMensaje("Fecha operacion", fechaOperacion, 2500);
        enviarWS(String("{\"fechaOperacion\":\"") + jsonEscape(fechaOperacion) + "\",\"message\":\"Fecha de operacion aplicada\"}");
      }
    }
    else if (msg.indexOf("\"cmd\":\"refreshTarifa\"") >= 0 || msg.indexOf("\"cmd\":\"tarifa\"") >= 0 || msg.indexOf("\"cmd\":\"tariff\"") >= 0) {
      if (msg.indexOf("tarifaHora") >= 0 || msg.indexOf("tarifaMinuto") >= 0) aplicarTarifaDesdeJson(msg);
      else actualizarTarifaDesdeWeb(true);
      enviarWS("{\"tarifaStatus\":\"updated\"}");
    }
    else if (msg.indexOf("\"cmd\":\"servo\"") >= 0) {
      enviarWS("{\"cmdStatus\":\"blocked\",\"message\":\"La barrera funciona automaticamente por RFID de acceso\"}");
    }
  }
}

// ============================================================
// ESTADO EN TIEMPO REAL A LA PAGINA
// ============================================================
void broadcastEstado() {
  bool accesoOk = lectorResponde(LECTOR_ACCESO);
  bool pagoOk = lectorResponde(LECTOR_PAGO);

  String json = "{";
  json += "\"mode\":\"" + modoOperacion + "\",";
  json += "\"servoAcceso\":" + String(anguloServoActual) + ",";
  json += "\"servoEntrada\":" + String(anguloServoActual) + ",";
  json += "\"rfidAcceso\":" + String(accesoOk ? 1 : 0) + ",";
  json += "\"rfidPago\":" + String(pagoOk ? 1 : 0) + ",";
  json += "\"rfidEntrada\":" + String(accesoOk ? 1 : 0) + ",";
  json += "\"rfidSalida\":" + String(pagoOk ? 1 : 0) + ",";
  json += "\"uid\":\"" + jsonEscape(ultimoUID) + "\",";
  json += "\"lastReader\":\"" + jsonEscape(ultimoLector) + "\",";
  json += "\"placa\":\"" + jsonEscape(ultimaPlaca) + "\",";
  json += "\"fechaOperacion\":\"" + jsonEscape(fechaOperacion) + "\",";
  json += "\"fechaHoraOperacion\":\"" + jsonEscape(fechaHoraOperacionTexto()) + "\",";
  json += "\"espaciosDisponibles\":" + String(contarDisponibles()) + ",";
  json += "\"espaciosTotales\":" + String(TOTAL_ESPACIOS) + ",";
  json += "\"tarifaHora\":" + String(tarifaHora, 2) + ",";
  json += "\"tarifaMinuto\":" + String(tarifaMinuto, 4) + ",";
  json += "\"tiempoGraciaMin\":" + String(tiempoGraciaMin) + ",";
  json += "\"tiempoSalidaPostPagoMin\":" + String(tiempoSalidaPostPagoMin) + ",";
  json += "\"tarifaMaximaDiaria\":" + String(tarifaMaximaDiaria, 2) + ",";

  json += "\"cardData\":{\"hasData\":1,";
  json += "\"placa\":\"" + jsonEscape(ultimaPlaca) + "\",";
  json += "\"espacio\":\"" + String(ultimoEspacio) + "\",";
  json += "\"estadoSesion\":\"" + jsonEscape(ultimoEstadoSesion) + "\",";
  json += "\"pago\":" + String(ultimoPago, 2) + ",";
  json += "\"duracionMin\":" + String(ultimaDuracionMin);
  json += "},";

  json += "\"spaces\":[";
  for (uint8_t i = 0; i < TOTAL_ESPACIOS; i++) {
    if (i > 0) json += ",";
    unsigned long duracion = 0;
    if (espacios[i].estado != 0 && espacios[i].ingresoMin > 0) {
      unsigned long ahora = minutoActualReal();
      duracion = ahora >= espacios[i].ingresoMin ? ahora - espacios[i].ingresoMin : 0;
    }
    json += "{";
    json += "\"numero\":" + String(i + 1) + ",";
    json += "\"estado\":\"" + String(estadoEspacioTexto(espacios[i].estado)) + "\",";
    json += "\"uid\":\"" + jsonEscape(espacios[i].uid) + "\",";
    json += "\"placa\":\"" + jsonEscape(espacios[i].placa) + "\",";
    json += "\"pago\":" + String(espacios[i].pago, 2) + ",";
    json += "\"duracionMin\":" + String(duracion) + ",";
    json += "\"fechaOperacion\":\"" + jsonEscape(espacios[i].fechaOperacion) + "\"";
    json += "}";
  }
  json += "]";
  json += "}";
  enviarWS(json);
}

void imprimirEstadoSerial() {
  Serial.println("------------------------------------");
  Serial.print("Modo            : "); Serial.println("FUNCIONAMIENTO");
  Serial.print("Fecha operacion : "); Serial.println(fechaOperacion);
  Serial.print("Servo barrera   : "); Serial.print(anguloServoActual); Serial.println(" grados");
  Serial.print("RFID ACCESO     : "); Serial.println(lectorResponde(LECTOR_ACCESO) ? "OK" : "ERROR");
  Serial.print("RFID PAGO       : "); Serial.println(lectorResponde(LECTOR_PAGO) ? "OK" : "ERROR");
  Serial.print("Libres          : "); Serial.print(contarDisponibles()); Serial.print("/"); Serial.println(TOTAL_ESPACIOS);
  Serial.print("Tarifa minuto   : S/ "); Serial.println(tarifaMinuto, 4);
  Serial.print("Gateway WSS     : "); Serial.println(wsConectado ? "CONECTADO" : "DESCONECTADO");
}

// ============================================================
// SETUP / LOOP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n========================================");
  Serial.println(" SMART PARK - ACCESO/SALIDA + PAGO");
  Serial.println(" RFID ACCESO: SS=17 RST=16");
  Serial.println(" RFID PAGO  : SS=5  RST=4");
  Serial.println(" Placa automatica = ultimos 3 caracteres UID | Pago por tiempo sin saldo | Modo operativo");
  Serial.println("========================================");

  Wire.begin(21, 22);
  oled.begin();
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x12_tf);
  oled.setCursor(0, 20); oled.print("SMART PARK");
  oled.setCursor(0, 40); oled.print("Iniciando...");
  oled.sendBuffer();

  servoBarrera.attach(PIN_SERVO);
  servoBarrera.write(ANGULO_REPOSO);
  anguloServoActual = ANGULO_REPOSO;

  resetEspacios();

  for (uint8_t i = 0; i < NUM_LECTORES; i++) {
    pinMode(SS_PINS[i], OUTPUT);
    digitalWrite(SS_PINS[i], HIGH);
  }

  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI);
  delay(50);

  Serial.println("Inicializando lectores RC522...");
  for (uint8_t i = 0; i < NUM_LECTORES; i++) {
    Serial.print("-> Iniciando "); Serial.print(nombreLector(i));
    Serial.print(" SS=GPIO"); Serial.print(SS_PINS[i]);
    Serial.print(" RST=GPIO"); Serial.println(RST_PINS[i]);

    mfrc522[i].PCD_Init();
    delay(50);
    byte version = mfrc522[i].PCD_ReadRegister(mfrc522[i].VersionReg);
    Serial.print("   Version register: 0x"); Serial.println(version, HEX);
    if (version == 0 || version == 0xFF) {
      Serial.print("   "); Serial.print(nombreLector(i)); Serial.println(" ERROR - revisar cableado/soldadura");
    } else {
      Serial.print("   "); Serial.print(nombreLector(i)); Serial.println(" OK");
      mfrc522[i].PCD_AntennaOn();
      mfrc522[i].PCD_SetAntennaGain(mfrc522[i].RxGain_max);
    }
  }

  Serial.println("Conectando WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    mostrarOLED();
  }

  Serial.println("\nWiFi conectado");
  Serial.print("SSID: "); Serial.println(WIFI_SSID);
  Serial.print("IP  : "); Serial.println(WiFi.localIP());
  mostrarMensaje("WiFi conectado", WiFi.localIP().toString(), 2500);

  actualizarTarifaDesdeWeb(true);

  wsClient.beginSSL(WSS_HOST, WSS_PORT, WSS_PATH);
  wsClient.onEvent(wsEvent);
  wsClient.setReconnectInterval(5000);
  wsClient.enableHeartbeat(15000, 3000, 2);

  Serial.print("Conectando WSS: wss://");
  Serial.print(WSS_HOST);
  Serial.println(WSS_PATH);
  mostrarMensaje("SMART PARK", "Listo", 2000);
}

void loop() {
  wsClient.loop();

  if (WiFi.status() != WL_CONNECTED) {
    wsConectado = false;
    WiFi.reconnect();
    delay(500);
    return;
  }

  actualizarTarifaDesdeWeb(false);

  if (millis() - ultimoRFIDCheck > 3000) {
    ultimoRFIDCheck = millis();
    revisarRFID();
  }

  reviewReader(currentReader);
  currentReader++;
  if (currentReader >= NUM_LECTORES) currentReader = 0;

  mostrarOLED();

  if (millis() - ultimoWS > 700) {
    ultimoWS = millis();
    broadcastEstado();
  }

  if (millis() - ultimoEstadoSerial > 5000) {
    ultimoEstadoSerial = millis();
    imprimirEstadoSerial();
  }

  delay(10);
}
