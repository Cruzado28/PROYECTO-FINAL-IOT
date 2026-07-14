#include <WiFi.h>
#include <WebSocketsClient.h>
#include "esp_camera.h"
#include "mbedtls/base64.h"
#include "board_config.h"

// ============================================================
// SMART PARK - ESP32-CAM por WSS directo a Railway
// La cámara NO calcula pago ni tiempo.
// El tiempo se cuenta con RFID de entrada y RFID de salida.
// La cámara solo transmite imagen para ver/calibrar espacios.
// ============================================================

// ==================== CONFIGURA SOLO ESTO ====================
const char* WIFI_SSID     = "TU_WIFI";
const char* WIFI_PASSWORD = "TU_PASSWORD_WIFI";

// Dominio de Railway SIN https:// y SIN / al final
const char* WSS_HOST = "proyecto-final-iot-production.up.railway.app";
const uint16_t WSS_PORT = 443;
const char* WSS_PATH = "/iot-ws?client=camera";

// Cada cuánto manda una imagen al panel. Para exposición va bien 900-1200 ms.
const unsigned long FRAME_INTERVAL_MS = 1000;

// Flash integrado en ESP32-CAM AI Thinker
#define LED_PIN 4

WebSocketsClient wsClient;
bool wsConectado = false;
unsigned long ultimoFrame = 0;
unsigned long ultimoStatus = 0;
unsigned long contadorFrame = 0;

camera_config_t configActual;
int calidadJpeg = 14;
int brillo = 0;
int contraste = 0;
int saturacion = 0;
int ledNivel = 0;

// ==================== HELPERS ====================
String jsonEscape(String s) {
  s.replace("\\", "\\\\");
  s.replace("\"", "\\\"");
  s.replace("\n", "\\n");
  s.replace("\r", "\\r");
  return s;
}

int extraerEntero(const String& msg, const String& key, int def) {
  int idx = msg.indexOf("\"" + key + "\":");
  if (idx < 0) return def;
  idx += key.length() + 3;
  while (idx < (int)msg.length() && (msg[idx] == ' ' || msg[idx] == '\t')) idx++;
  return msg.substring(idx).toInt();
}

String extraerCampo(const String& msg, const String& key) {
  int idx = msg.indexOf("\"" + key + "\"");
  if (idx < 0) return "";
  idx = msg.indexOf(':', idx);
  if (idx < 0) return "";
  idx++;
  while (idx < (int)msg.length() && (msg[idx] == ' ' || msg[idx] == '\t')) idx++;

  if (idx < (int)msg.length() && msg[idx] == '\"') {
    idx++;
    int end = msg.indexOf('\"', idx);
    if (end < 0) return "";
    return msg.substring(idx, end);
  }

  int end = idx;
  while (end < (int)msg.length() && msg[end] != ',' && msg[end] != '}') end++;
  return msg.substring(idx, end);
}

void enviarWS(const String& json) {
  if (wsConectado) {
    wsClient.sendTXT(json);
  }
}

String ipLocalTexto() {
  return WiFi.localIP().toString();
}

void enviarStatus(const char* estado) {
  String json = "{";
  json += "\"type\":\"camera_status\",";
  json += "\"status\":\"" + String(estado) + "\",";
  json += "\"ip\":\"" + ipLocalTexto() + "\",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"quality\":" + String(calidadJpeg) + ",";
  json += "\"brightness\":" + String(brillo) + ",";
  json += "\"contrast\":" + String(contraste) + ",";
  json += "\"saturation\":" + String(saturacion) + ",";
  json += "\"led\":" + String(ledNivel) + ",";
  json += "\"timestamp\":" + String(millis());
  json += "}";
  enviarWS(json);
}

void enviarAck(const String& cmd, const String& msg = "OK") {
  String json = "{";
  json += "\"type\":\"camera_ack\",";
  json += "\"cmd\":\"" + jsonEscape(cmd) + "\",";
  json += "\"message\":\"" + jsonEscape(msg) + "\",";
  json += "\"timestamp\":" + String(millis());
  json += "}";
  enviarWS(json);
}

// ==================== CÁMARA ====================
bool iniciarCamara() {
  configActual.ledc_channel = LEDC_CHANNEL_0;
  configActual.ledc_timer = LEDC_TIMER_0;
  configActual.pin_d0 = Y2_GPIO_NUM;
  configActual.pin_d1 = Y3_GPIO_NUM;
  configActual.pin_d2 = Y4_GPIO_NUM;
  configActual.pin_d3 = Y5_GPIO_NUM;
  configActual.pin_d4 = Y6_GPIO_NUM;
  configActual.pin_d5 = Y7_GPIO_NUM;
  configActual.pin_d6 = Y8_GPIO_NUM;
  configActual.pin_d7 = Y9_GPIO_NUM;
  configActual.pin_xclk = XCLK_GPIO_NUM;
  configActual.pin_pclk = PCLK_GPIO_NUM;
  configActual.pin_vsync = VSYNC_GPIO_NUM;
  configActual.pin_href = HREF_GPIO_NUM;
  configActual.pin_sccb_sda = SIOD_GPIO_NUM;
  configActual.pin_sccb_scl = SIOC_GPIO_NUM;
  configActual.pin_pwdn = PWDN_GPIO_NUM;
  configActual.pin_reset = RESET_GPIO_NUM;
  configActual.xclk_freq_hz = 20000000;
  configActual.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    configActual.frame_size = FRAMESIZE_QVGA;     // 320x240, estable para WSS
    configActual.jpeg_quality = calidadJpeg;      // menor número = más calidad
    configActual.fb_count = 2;
    configActual.fb_location = CAMERA_FB_IN_PSRAM;
    configActual.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    configActual.frame_size = FRAMESIZE_QQVGA;    // 160x120 si no hay PSRAM
    configActual.jpeg_quality = 16;
    configActual.fb_count = 1;
    configActual.fb_location = CAMERA_FB_IN_DRAM;
    configActual.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  }

  esp_err_t err = esp_camera_init(&configActual);
  if (err != ESP_OK) {
    Serial.printf("[CAM] Error al iniciar cámara: 0x%x\n", err);
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    s->set_vflip(s, 1);
    s->set_quality(s, calidadJpeg);
    s->set_brightness(s, brillo);
    s->set_contrast(s, contraste);
    s->set_saturation(s, saturacion);
  }

  Serial.println("[CAM] Cámara inicializada correctamente");
  return true;
}

void aplicarConfiguracionSensor(const String& param, int value) {
  sensor_t *s = esp_camera_sensor_get();
  if (!s) return;

  if (param == "quality") {
    calidadJpeg = constrain(value, 8, 30);
    s->set_quality(s, calidadJpeg);
    enviarAck("quality", "Calidad JPEG actualizada");
  } else if (param == "brightness") {
    brillo = constrain(value, -2, 2);
    s->set_brightness(s, brillo);
    enviarAck("brightness", "Brillo actualizado");
  } else if (param == "contrast") {
    contraste = constrain(value, -2, 2);
    s->set_contrast(s, contraste);
    enviarAck("contrast", "Contraste actualizado");
  } else if (param == "saturation") {
    saturacion = constrain(value, -2, 2);
    s->set_saturation(s, saturacion);
    enviarAck("saturation", "Saturación actualizada");
  }
}

void reiniciarXclk(int mhz) {
  mhz = constrain(mhz, 6, 20);
  Serial.printf("[CAM] Reiniciando XCLK a %d MHz\n", mhz);
  esp_camera_deinit();
  configActual.xclk_freq_hz = mhz * 1000000;
  esp_err_t err = esp_camera_init(&configActual);
  if (err == ESP_OK) {
    sensor_t *s = esp_camera_sensor_get();
    if (s) {
      s->set_vflip(s, 1);
      s->set_quality(s, calidadJpeg);
      s->set_brightness(s, brillo);
      s->set_contrast(s, contraste);
      s->set_saturation(s, saturacion);
    }
    enviarAck("xclk", "XCLK actualizado");
  } else {
    enviarAck("xclk", "No se pudo reiniciar la cámara");
  }
}

void enviarFrame() {
  if (!wsConectado) return;

  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[CAM] Error capturando frame");
    enviarAck("frame", "Error capturando imagen");
    return;
  }

  size_t base64Len = 4 * ((fb->len + 2) / 3);
  unsigned char *base64Buf = (unsigned char*) malloc(base64Len + 1);

  if (!base64Buf) {
    Serial.println("[CAM] Sin memoria para base64");
    esp_camera_fb_return(fb);
    return;
  }

  size_t encodedLen = 0;
  int rc = mbedtls_base64_encode(base64Buf, base64Len + 1, &encodedLen, fb->buf, fb->len);
  esp_camera_fb_return(fb);

  if (rc != 0) {
    Serial.println("[CAM] Error codificando base64");
    free(base64Buf);
    return;
  }

  base64Buf[encodedLen] = '\0';
  contadorFrame++;

  String json;
  json.reserve(encodedLen + 260);
  json += "{";
  json += "\"type\":\"camera_frame\",";
  json += "\"contentType\":\"image/jpeg\",";
  json += "\"frame\":" + String(contadorFrame) + ",";
  json += "\"length\":" + String(encodedLen) + ",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"freeHeap\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"timestampMs\":" + String(millis()) + ",";
  json += "\"data\":\"";
  json += (const char*)base64Buf;
  json += "\"}";

  wsClient.sendTXT(json);
  free(base64Buf);

  Serial.printf("[CAM] Frame #%lu enviado (%u bytes base64)\n", contadorFrame, (unsigned)encodedLen);
}

// ==================== COMANDOS WSS ====================
void procesarComando(const String& msg) {
  if (msg.indexOf("\"gateway\":true") >= 0) return;
  if (msg.indexOf("camera_subscribe") >= 0) {
    enviarStatus("online");
    return;
  }
  if (msg.indexOf("camera_cmd") < 0) return;

  String cmd = extraerCampo(msg, "cmd");

  if (cmd == "led") {
    ledNivel = constrain(extraerEntero(msg, "value", 0), 0, 255);
    ledcWrite(LED_PIN, ledNivel);
    enviarAck("led", "LED actualizado");
  } else if (cmd == "config") {
    String param = extraerCampo(msg, "param");
    int value = extraerEntero(msg, "value", 0);
    aplicarConfiguracionSensor(param, value);
  } else if (cmd == "xclk") {
    int value = extraerEntero(msg, "value", 20);
    reiniciarXclk(value);
  }
}

void wsEvent(WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    wsConectado = true;
    Serial.println("[WSS] ESP32-CAM conectada al gateway de Railway");
    enviarStatus("online");
  } else if (type == WStype_DISCONNECTED) {
    wsConectado = false;
    Serial.println("[WSS] ESP32-CAM desconectada");
  } else if (type == WStype_TEXT) {
    String msg = String((char*)payload);
    procesarComando(msg);
  }
}

// ==================== SETUP / LOOP ====================
void setup() {
  Serial.begin(115200);
  delay(600);
  Serial.println();
  Serial.println("============================================");
  Serial.println(" SMART PARK - ESP32-CAM WSS RAILWAY");
  Serial.println("============================================");

  ledcAttach(LED_PIN, 5000, 8);
  ledcWrite(LED_PIN, 0);

  if (!iniciarCamara()) {
    Serial.println("[CAM] Revisa el modelo de cámara en board_config.h");
  }

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("[WiFi] Conectando");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("[WiFi] Conectado a: ");
  Serial.println(WIFI_SSID);
  Serial.print("[WiFi] IP local: ");
  Serial.println(WiFi.localIP());

  wsClient.beginSSL(WSS_HOST, WSS_PORT, WSS_PATH);
  wsClient.onEvent(wsEvent);
  wsClient.setReconnectInterval(5000);
  wsClient.enableHeartbeat(15000, 3000, 2);

  Serial.print("[WSS] Conectando a wss://");
  Serial.print(WSS_HOST);
  Serial.println(WSS_PATH);
}

void loop() {
  wsClient.loop();

  if (WiFi.status() != WL_CONNECTED) {
    wsConectado = false;
    WiFi.reconnect();
    delay(500);
    return;
  }

  unsigned long ahora = millis();

  if (wsConectado && ahora - ultimoFrame >= FRAME_INTERVAL_MS) {
    ultimoFrame = ahora;
    enviarFrame();
  }

  if (wsConectado && ahora - ultimoStatus >= 10000) {
    ultimoStatus = ahora;
    enviarStatus("online");
  }
}
