// ============================================================
// MONITOREO POR ESP32-CAM VIA WSS RAILWAY
// No usa IP local ni servidor Python.
// La ESP32-CAM se conecta al mismo /iot-ws que usa el ESP32 principal.
// El tiempo de estacionamiento se calcula SOLO por RFID:
// entrada RFID = inicio, salida RFID = fin y cobro.
// La cámara solo ayuda a visualizar/calibrar espacios ocupados.
// ============================================================
(function () {
  const TOTAL_ESPACIOS = 10;
  const STORAGE_ZONAS = 'smartpark_camera_zonas_wss';
  const STORAGE_BG = 'smartpark_camera_bg_wss';
  const STORAGE_WS = 'smartpark_camera_ws';
  const STORAGE_MODE = 'smartpark_camera_mode';
  const STORAGE_SENS = 'smartpark_camera_sensibilidad_wss';

  const DEFAULT_SENS = {
    umbral_brillo: 24,
    umbral_bordes: 0.02,
    canny_bajo: 20,
    canny_alto: 80
  };

  const cam = window.smartparkCamera = {
    mode: localStorage.getItem(STORAGE_MODE) || 'prueba',
    serverUrl: localStorage.getItem(STORAGE_WS) || getDefaultWsUrl(),
    cameraUrl: '',
    ws: null,
    connected: false,
    cameraOnline: false,
    zonas: [],
    ocupacion: {},
    puntosActuales: [],
    modoNuevaZona: false,
    numeroPendiente: null,
    zonaEditando: null,
    zonaDebugActual: null,
    intervalDebug: null,
    reconnectTimer: null,
    ultimaLectura: null,
    ultimaLatencia: 0,
    ultimoFrameTs: 0,
    ultimoFrameId: 0,
    backgroundDataUrl: localStorage.getItem(STORAGE_BG) || '',
    bgImage: null,
    bgReady: false,
    sensibilidad: cargarSensibilidadLocal()
  };

  function el(id) {
    return document.getElementById(id);
  }

  function toast(tipo, mensaje, icono) {
    if (typeof showToast === 'function') {
      showToast(tipo, mensaje, icono || 'fa-circle-info');
    } else {
      console.log(`[${tipo}] ${mensaje}`);
    }
  }

  function getDefaultWsUrl() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/iot-ws?client=panel&camera=1`;
  }

  function normalizarWs(valor) {
    let url = String(valor || '').trim();
    if (!url) return getDefaultWsUrl();

    url = url.replace(/\/$/, '');

    if (/^https:\/\//i.test(url)) {
      url = url.replace(/^https:\/\//i, 'wss://');
    } else if (/^http:\/\//i.test(url)) {
      url = url.replace(/^http:\/\//i, 'ws://');
    } else if (!/^wss?:\/\//i.test(url)) {
      url = `wss://${url}`;
    }

    if (!/\/iot-ws(\?|$)/i.test(url)) {
      url += '/iot-ws?client=panel&camera=1';
    } else if (!/[?&]client=/i.test(url)) {
      url += url.includes('?') ? '&client=panel&camera=1' : '?client=panel&camera=1';
    }

    return url;
  }

  function wsHostDesdeUrl(url) {
    try {
      return new URL(url).host;
    } catch {
      return window.location.host;
    }
  }

  function setTexto(id, valor) {
    const nodo = el(id);
    if (nodo) nodo.textContent = valor;
  }

  function setEstadoCamara(estado, texto) {
    const badge = el('cam-conn-badge');
    if (badge) {
      badge.className = `cam-conn-badge ${estado}`;
      badge.innerHTML = `<span class="dot"></span>${texto}`;
    }

    const estadoCam = el('monitor-camera-status');
    if (estadoCam) {
      estadoCam.textContent = texto;
      estadoCam.className = estado === 'online'
        ? 'badge badge-green'
        : estado === 'connecting'
          ? 'badge badge-amber'
          : 'badge badge-red';
    }

    const rec = el('monitor-camera-rec');
    if (rec) {
      rec.innerHTML = `<span class="dot"></span>${estado === 'online' ? 'CONECTADA' : estado === 'connecting' ? 'CONECTANDO' : 'SIN SEÑAL'}`;
      rec.classList.toggle('online', estado === 'online');
    }

    const btn = el('monitor-capture-btn');
    if (btn) {
      btn.disabled = estado !== 'online';
      btn.innerHTML = estado === 'online'
        ? '<i class="fa-solid fa-camera"></i> Capturar vista'
        : '<i class="fa-solid fa-camera"></i> Captura no disponible';
      btn.title = estado === 'online' ? 'Abrir captura actual de la ESP32-CAM' : 'Disponible cuando llegue imagen por WSS';
    }

    setTexto('monitor-camera-device-state', estado === 'online' ? 'Operativo' : texto);
    const sistema = el('monitor-system-status');
    if (sistema) {
      sistema.textContent = estado === 'online' ? 'Sistema conectado' : texto;
      sistema.style.color = estado === 'online' ? 'var(--green)' : estado === 'connecting' ? 'var(--amber)' : 'var(--red)';
    }
  }

  function actualizarResumenCamara() {
    const ocupados = Object.values(cam.ocupacion).filter(Boolean).length;
    const libres = TOTAL_ESPACIOS - ocupados;

    setTexto('cam-detectados', `Detectados: ${ocupados} / ${TOTAL_ESPACIOS}`);
    setTexto('cam-stat-ocupados', ocupados);
    setTexto('cam-stat-libres', libres);
    setTexto('cam-spaces-sub', `${ocupados} ocupados · ${libres} libres`);
    setTexto('monitor-camera-latency', cam.ultimaLatencia ? `${cam.ultimaLatencia} ms` : 'Sin dato');
    setTexto('monitor-camera-last', cam.ultimaLectura ? cam.ultimaLectura.toLocaleTimeString('es-PE') : 'Sin registro');
    setTexto('cam-ts', cam.ultimaLectura ? `Último frame ${cam.ultimaLectura.toLocaleTimeString('es-PE')}` : 'Esperando lectura');

    const activos = typeof vehiclesData !== 'undefined'
      ? vehiclesData.filter((vehiculo) => vehiculo.inside).length
      : 0;
    setTexto('monitor-detected-count', `${activos} activo${activos === 1 ? '' : 's'}`);
  }

  function cargarSensibilidadLocal() {
    try {
      return { ...DEFAULT_SENS, ...JSON.parse(localStorage.getItem(STORAGE_SENS) || '{}') };
    } catch {
      return { ...DEFAULT_SENS };
    }
  }

  function guardarSensibilidadLocal() {
    localStorage.setItem(STORAGE_SENS, JSON.stringify(cam.sensibilidad));
  }

  function cargarBackground() {
    cam.bgReady = false;
    cam.bgImage = null;
    if (!cam.backgroundDataUrl) return;

    const img = new Image();
    img.onload = () => {
      cam.bgReady = true;
      cam.bgImage = img;
      detectarOcupacionCliente();
    };
    img.onerror = () => {
      cam.bgReady = false;
      cam.bgImage = null;
    };
    img.src = cam.backgroundDataUrl;
  }

  function cargarZonasDesdeLocal() {
    try {
      const zonas = JSON.parse(localStorage.getItem(STORAGE_ZONAS) || '[]');
      cam.zonas = Array.isArray(zonas)
        ? zonas.map((z) => ({ nombre: String(z.nombre), puntos: z.puntos || [], ocupada: !!z.ocupada }))
        : [];
    } catch {
      cam.zonas = [];
    }

    cam.ocupacion = {};
    cam.zonas.forEach((zona) => {
      cam.ocupacion[String(zona.nombre)] = !!zona.ocupada;
    });
  }

  function guardarZonasLocal() {
    localStorage.setItem(STORAGE_ZONAS, JSON.stringify(cam.zonas));
  }

  window.renderMonitorParkingStrip = function renderMonitorParkingStripCamara() {
    const strip = el('monitor-parking-strip');
    if (!strip) return;

    let html = '';
    for (let i = 1; i <= TOTAL_ESPACIOS; i++) {
      const clave = String(i);
      const tieneDatoCamara = Object.prototype.hasOwnProperty.call(cam.ocupacion, clave);
      let cls = 'spot-free';
      let label = 'Libre';

      if (tieneDatoCamara) {
        cls = cam.ocupacion[clave] ? 'spot-occupied' : 'spot-free';
        label = cam.ocupacion[clave] ? 'Ocupado por cámara' : 'Libre por cámara';
      } else if (typeof SPOT_STATE !== 'undefined') {
        cls = SPOT_STATE[i] || 'spot-free';
        label = cls === 'spot-occupied' ? 'Ocupado' : cls === 'spot-reserved' ? 'Reservado' : cls === 'spot-maintenance' ? 'Mantenimiento' : 'Libre';
      }

      const calibrada = cam.zonas.some((z) => String(z.nombre) === clave);
      html += `
        <button
          type="button"
          class="parking-spot ${cls} cam-space-mini ${calibrada ? 'calibrated' : 'not-calibrated'}"
          title="Espacio ${i} · ${label}${calibrada ? ' · zona calibrada' : ' · sin zona calibrada'}"
          onclick="camSeleccionarZonaDebug('${i}')"
        >
          <span>${i}</span>
          <i class="fa-solid ${calibrada ? 'fa-eye' : 'fa-pen'}"></i>
        </button>`;
    }
    strip.innerHTML = html;
  };

  function sincronizarEstadoConMapa() {
    for (let i = 1; i <= TOTAL_ESPACIOS; i++) {
      const clave = String(i);
      if (Object.prototype.hasOwnProperty.call(cam.ocupacion, clave)) {
        try {
          if (typeof SPOT_STATE !== 'undefined') {
            SPOT_STATE[i] = cam.ocupacion[clave] ? 'spot-occupied' : 'spot-free';
          }
        } catch (_) {}
      }
    }

    if (typeof renderParkingMap === 'function') {
      renderParkingMap();
    } else {
      window.renderMonitorParkingStrip();
    }
  }

  function actualizarVistaConectada() {
    setEstadoCamara('online', 'Online');
    cam.connected = true;
    cam.cameraOnline = true;
    setTexto('monitor-camera-name', 'ESP32-CAM WSS');
    setTexto('monitor-camera-address', wsHostDesdeUrl(cam.serverUrl));
    const empty = el('cam-empty-state');
    if (empty) empty.style.display = 'none';
    actualizarResumenCamara();
  }

  function ajustarOverlay() {
    const img = el('cam-live-img');
    const canvas = el('cam-overlay-canvas');
    if (!img || !canvas || !img.clientWidth || !img.clientHeight) return;

    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    canvas.style.left = `${img.offsetLeft}px`;
    canvas.style.top = `${img.offsetTop}px`;
    cam.ultimaLatencia = cam.ultimoFrameTs ? Math.max(1, Date.now() - cam.ultimoFrameTs) : 0;
    cam.ultimaLectura = new Date();
    actualizarVistaConectada();
    redibujarZonas();
  }

  function puntoPantallaAReal(evento) {
    const img = el('cam-live-img');
    const canvas = el('cam-overlay-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = evento.clientX - rect.left;
    const y = evento.clientY - rect.top;
    return [
      Math.round(x * (img.naturalWidth / canvas.width)),
      Math.round(y * (img.naturalHeight / canvas.height))
    ];
  }

  function puntoRealAPantalla(punto) {
    const img = el('cam-live-img');
    const canvas = el('cam-overlay-canvas');
    if (!img || !canvas || !img.naturalWidth || !img.naturalHeight) return [0, 0];
    return [
      punto[0] * (canvas.width / img.naturalWidth),
      punto[1] * (canvas.height / img.naturalHeight)
    ];
  }

  function puntoDentroPoligono(punto, poligono) {
    let dentro = false;
    for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
      const xi = poligono[i][0], yi = poligono[i][1];
      const xj = poligono[j][0], yj = poligono[j][1];
      const interseca = ((yi > punto[1]) !== (yj > punto[1])) &&
        (punto[0] < (xj - xi) * (punto[1] - yi) / ((yj - yi) || 1) + xi);
      if (interseca) dentro = !dentro;
    }
    return dentro;
  }

  function redibujarZonas() {
    const canvas = el('cam-overlay-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.font = '700 13px Inter, Segoe UI, sans-serif';

    const puntosPantalla = cam.puntosActuales.map(puntoRealAPantalla);
    ctx.fillStyle = '#4f8ef7';
    puntosPantalla.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4, 0, Math.PI * 2);
      ctx.fill();
    });

    if (puntosPantalla.length > 1) {
      ctx.strokeStyle = '#4f8ef7';
      ctx.beginPath();
      ctx.moveTo(puntosPantalla[0][0], puntosPantalla[0][1]);
      puntosPantalla.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
      ctx.stroke();
    }

    cam.zonas.forEach((zona) => {
      if (!zona.puntos || !zona.puntos.length) return;
      const pts = zona.puntos.map(puntoRealAPantalla);
      const ocupada = !!zona.ocupada;
      ctx.strokeStyle = ocupada ? '#ef4444' : '#22c55e';
      ctx.fillStyle = ocupada ? 'rgba(239,68,68,.16)' : 'rgba(34,197,94,.12)';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      ctx.fillStyle = ocupada ? '#ef4444' : '#22c55e';
      ctx.fillText(`#${zona.nombre}`, cx - 12, cy);
    });
  }

  function crearCanvasImagen(img) {
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { canvas, ctx };
  }

  function cajaDePoligono(puntos, width, height) {
    const xs = puntos.map((p) => p[0]);
    const ys = puntos.map((p) => p[1]);
    return {
      minX: Math.max(0, Math.floor(Math.min(...xs))),
      maxX: Math.min(width - 1, Math.ceil(Math.max(...xs))),
      minY: Math.max(0, Math.floor(Math.min(...ys))),
      maxY: Math.min(height - 1, Math.ceil(Math.max(...ys)))
    };
  }

  function promedioDiferenciaZona(zona, actualCtx, fondoCtx, width, height) {
    const puntos = zona.puntos || [];
    if (puntos.length < 3) return 0;

    const box = cajaDePoligono(puntos, width, height);
    const step = Math.max(3, Math.floor(Math.max(box.maxX - box.minX, box.maxY - box.minY) / 28));
    let suma = 0;
    let muestras = 0;

    for (let y = box.minY; y <= box.maxY; y += step) {
      for (let x = box.minX; x <= box.maxX; x += step) {
        if (!puntoDentroPoligono([x, y], puntos)) continue;
        const a = actualCtx.getImageData(x, y, 1, 1).data;
        const b = fondoCtx.getImageData(x, y, 1, 1).data;
        suma += (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
        muestras += 1;
      }
    }

    return muestras ? suma / muestras : 0;
  }

  function detectarOcupacionCliente() {
    const img = el('cam-live-img');
    if (!img || !img.complete || !img.naturalWidth || !cam.zonas.length || !cam.bgReady || !cam.bgImage) {
      return;
    }

    const actual = crearCanvasImagen(img);
    const fondoCanvas = document.createElement('canvas');
    fondoCanvas.width = img.naturalWidth;
    fondoCanvas.height = img.naturalHeight;
    const fondoCtx = fondoCanvas.getContext('2d', { willReadFrequently: true });
    fondoCtx.drawImage(cam.bgImage, 0, 0, fondoCanvas.width, fondoCanvas.height);

    if (!actual) return;

    const umbral = Number(cam.sensibilidad.umbral_brillo) || DEFAULT_SENS.umbral_brillo;
    let cambio = false;

    cam.zonas.forEach((zona) => {
      const diff = promedioDiferenciaZona(zona, actual.ctx, fondoCtx, actual.canvas.width, actual.canvas.height);
      zona.diff = diff;
      const ocupada = diff >= umbral;
      if (zona.ocupada !== ocupada) cambio = true;
      zona.ocupada = ocupada;
      cam.ocupacion[String(zona.nombre)] = ocupada;
    });

    if (cambio) guardarZonasLocal();
    redibujarZonas();
    sincronizarEstadoConMapa();
    actualizarResumenCamara();
    actualizarDebugZona();
  }

  function manejarMensajeCamara(data) {
    if (!data || typeof data !== 'object') return;

    if (data.gateway && data.type === 'status') {
      if (Number(data.cameras || 0) > 0 && !cam.cameraOnline) {
        setEstadoCamara('connecting', 'ESP32-CAM enlazada');
      }
      return;
    }

    if (data.gateway && data.type === 'warning' && data.target === 'camera') {
      setEstadoCamara('offline', 'Sin ESP32-CAM');
      return;
    }

    if (data.type === 'camera_status') {
      if (data.status === 'online') {
        setEstadoCamara('connecting', 'Esperando imagen');
        setTexto('monitor-camera-address', data.ip || wsHostDesdeUrl(cam.serverUrl));
      }
      return;
    }

    if (data.type === 'camera_ack') {
      return;
    }

    if (data.type !== 'camera_frame' || !data.data) {
      return;
    }

    const img = el('cam-live-img');
    const empty = el('cam-empty-state');
    if (!img) return;

    cam.ultimoFrameTs = Number(data.timestampMs || Date.now());
    cam.ultimoFrameId = Number(data.frame || cam.ultimoFrameId + 1);
    img.src = `data:${data.contentType || 'image/jpeg'};base64,${data.data}`;
    if (empty) empty.style.display = 'none';
  }

  function abrirWsCamara() {
    const url = cam.serverUrl;

    if (cam.ws && (cam.ws.readyState === WebSocket.OPEN || cam.ws.readyState === WebSocket.CONNECTING)) {
      cam.ws.close();
    }

    setEstadoCamara('connecting', 'Conectando WSS');
    setTexto('monitor-camera-address', wsHostDesdeUrl(url));

    try {
      cam.ws = new WebSocket(url);
    } catch (err) {
      setEstadoCamara('offline', 'URL WSS inválida');
      toast('error', 'La URL WSS de cámara no es válida.', 'fa-triangle-exclamation');
      return;
    }

    cam.ws.onopen = () => {
      cam.connected = true;
      setEstadoCamara('connecting', 'Esperando ESP32-CAM');
      enviarComandoCamara({ type: 'camera_subscribe' }, false);
    };

    cam.ws.onmessage = (evento) => {
      try {
        manejarMensajeCamara(JSON.parse(evento.data));
      } catch (_) {
        // Ignora telemetría de otros dispositivos que no sea JSON de cámara.
      }
    };

    cam.ws.onerror = () => {
      setEstadoCamara('offline', 'Error WSS');
    };

    cam.ws.onclose = () => {
      cam.connected = false;
      cam.cameraOnline = false;
      if (cam.reconnectTimer) clearTimeout(cam.reconnectTimer);
      setEstadoCamara('offline', 'Reconectando');
      cam.reconnectTimer = setTimeout(() => {
        if (cam.serverUrl) abrirWsCamara();
      }, 3000);
    };
  }

  function enviarComandoCamara(data, avisarSiNoConectado = true) {
    if (!cam.ws || cam.ws.readyState !== WebSocket.OPEN) {
      if (avisarSiNoConectado) toast('warning', 'Primero conecta el visor WSS de cámara.', 'fa-plug-circle-exclamation');
      return false;
    }

    cam.ws.send(JSON.stringify({ target: 'camera', ...data }));
    return true;
  }

  window.abrirModalCamSettings = function abrirModalCamSettings() {
    const inputCam = el('cfg-ip-camara');
    const inputServer = el('cfg-ip-servidor');
    if (inputCam) inputCam.value = wsHostDesdeUrl(cam.serverUrl || getDefaultWsUrl());
    if (inputServer) inputServer.value = cam.serverUrl || getDefaultWsUrl();

    const modal = el('modal-cam-settings');
    if (modal) modal.classList.add('open');
  };

  window.cerrarModalCamSettings = function cerrarModalCamSettings() {
    const modal = el('modal-cam-settings');
    if (modal) modal.classList.remove('open');
  };

  window.conectarCamara = function conectarCamara() {
    const inputServer = el('cfg-ip-servidor');
    const wsUrl = normalizarWs(inputServer ? inputServer.value : cam.serverUrl);

    cam.serverUrl = wsUrl;
    localStorage.setItem(STORAGE_WS, cam.serverUrl);
    abrirWsCamara();

    window.cerrarModalCamSettings();
    toast('success', 'Visor WSS listo. Cuando la ESP32-CAM se conecte aparecerá la imagen.', 'fa-camera');
  };

  window.setCamMode = function setCamMode(modo) {
    cam.mode = modo === 'funcionamiento' ? 'funcionamiento' : 'prueba';
    localStorage.setItem(STORAGE_MODE, cam.mode);

    const btnPrueba = el('cam-mode-btn-prueba');
    const btnFunc = el('cam-mode-btn-funcionamiento');
    const sub = el('cam-mode-switch-sub');
    const banner = el('cam-mode-banner');

    if (btnPrueba) btnPrueba.classList.toggle('active', cam.mode === 'prueba');
    if (btnFunc) btnFunc.classList.toggle('active', cam.mode === 'funcionamiento');

    document.body.classList.toggle('cam-locked', cam.mode === 'funcionamiento');

    if (sub) {
      sub.textContent = cam.mode === 'prueba'
        ? 'Modo prueba — calibración de zonas habilitada'
        : 'En funcionamiento — calibración bloqueada, detección activa';
    }

    if (banner) {
      banner.className = `camera-mode-banner ${cam.mode}`;
      banner.innerHTML = cam.mode === 'prueba'
        ? '<i class="fa-solid fa-circle-info"></i> Modo prueba activo: calibra las zonas sobre la imagen de la cámara.'
        : '<i class="fa-solid fa-lock"></i> En funcionamiento: la cámara solo marca espacios ocupados. El tiempo y el cobro se calculan por RFID.';
    }
  };

  window.toggleModoNuevaZona = function toggleModoNuevaZona() {
    if (cam.mode !== 'prueba') {
      toast('warning', 'Cambia a modo prueba para calibrar zonas.', 'fa-lock');
      return;
    }
    if (!cam.cameraOnline) {
      toast('warning', 'Espera a recibir imagen de la ESP32-CAM.', 'fa-video-slash');
      return;
    }
    cam.modoNuevaZona = !cam.modoNuevaZona;
    cam.numeroPendiente = null;
    cam.puntosActuales = [];
    const btn = el('btn-cam-nueva-zona');
    if (btn) btn.classList.toggle('active', cam.modoNuevaZona);
    setTexto('cam-toolbar-hint', cam.modoNuevaZona ? 'Marca 4 puntos sobre el video para crear una zona.' : '');
    redibujarZonas();
  };

  window.camEditarEspacio = function camEditarEspacio(numero) {
    if (cam.mode !== 'prueba') {
      toast('warning', 'La edición está bloqueada en funcionamiento.', 'fa-lock');
      return;
    }
    const zona = cam.zonas.find((z) => String(z.nombre) === String(numero));
    if (zona) {
      abrirModalZona(zona.nombre);
      return;
    }
    if (!cam.cameraOnline) {
      toast('warning', 'Espera a recibir imagen de la ESP32-CAM.', 'fa-video-slash');
      return;
    }
    cam.numeroPendiente = String(numero);
    cam.modoNuevaZona = true;
    cam.puntosActuales = [];
    const btn = el('btn-cam-nueva-zona');
    if (btn) btn.classList.add('active');
    setTexto('cam-toolbar-hint', `Dibuja el espacio #${numero} sobre el video con 4 puntos.`);
    redibujarZonas();
  };

  function abrirModalZona(nombre) {
    cam.zonaEditando = String(nombre);
    const input = el('zona-numero-input');
    if (input) input.value = cam.zonaEditando;

    const info = el('zona-estado-actual');
    const zona = cam.zonas.find((z) => String(z.nombre) === cam.zonaEditando);
    if (info && zona) {
      info.innerHTML = `Estado actual: <b style="color:${zona.ocupada ? 'var(--red)' : 'var(--green)'}">${zona.ocupada ? 'OCUPADO' : 'LIBRE'}</b> · diferencia visual: ${Number(zona.diff || 0).toFixed(1)}`;
    }

    const modal = el('modal-zona');
    if (modal) modal.classList.add('open');
  }

  window.cerrarModalZona = function cerrarModalZona() {
    const modal = el('modal-zona');
    if (modal) modal.classList.remove('open');
    cam.zonaEditando = null;
  };

  window.guardarNumeroZona = function guardarNumeroZona() {
    const input = el('zona-numero-input');
    const nuevo = input ? input.value.trim() : '';
    if (!nuevo) {
      toast('warning', 'Escribe un número de espacio válido.', 'fa-triangle-exclamation');
      return;
    }
    const zona = cam.zonas.find((z) => String(z.nombre) === String(cam.zonaEditando));
    if (zona) zona.nombre = nuevo;
    window.cerrarModalZona();
    guardarZonasLocal();
    window.renderMonitorParkingStrip();
    detectarOcupacionCliente();
  };

  window.eliminarZonaActual = function eliminarZonaActual() {
    if (!cam.zonaEditando) return;
    cam.zonas = cam.zonas.filter((z) => String(z.nombre) !== String(cam.zonaEditando));
    delete cam.ocupacion[String(cam.zonaEditando)];
    window.cerrarModalZona();
    guardarZonasLocal();
    redibujarZonas();
    window.renderMonitorParkingStrip();
    actualizarResumenCamara();
  };

  window.guardarZonasCam = function guardarZonasCam() {
    guardarZonasLocal();
    toast('success', 'Zonas guardadas en el navegador. Recalibra con el estacionamiento vacío.', 'fa-floppy-disk');
  };

  window.recalibrarZonas = function recalibrarZonas() {
    if (cam.mode !== 'prueba') {
      toast('warning', 'Cambia a modo prueba para recalibrar.', 'fa-lock');
      return;
    }
    const img = el('cam-live-img');
    if (!img || !img.src || !img.naturalWidth) {
      toast('warning', 'Primero espera una imagen de la ESP32-CAM.', 'fa-video-slash');
      return;
    }

    cam.backgroundDataUrl = img.src;
    localStorage.setItem(STORAGE_BG, cam.backgroundDataUrl);
    cargarBackground();
    toast('success', 'Referencia guardada. Haz esto con los espacios vacíos.', 'fa-crosshairs');
  };

  window.camBorrarTodasLasZonas = function camBorrarTodasLasZonas() {
    if (cam.mode !== 'prueba') {
      toast('warning', 'Cambia a modo prueba para borrar zonas.', 'fa-lock');
      return;
    }
    if (!confirm(`Esto eliminará las ${cam.zonas.length} zonas calibradas. ¿Continuar?`)) return;
    cam.zonas = [];
    cam.ocupacion = {};
    cam.puntosActuales = [];
    guardarZonasLocal();
    redibujarZonas();
    window.renderMonitorParkingStrip();
    actualizarResumenCamara();
  };

  window.camSeleccionarZonaDebug = function camSeleccionarZonaDebug(numero) {
    cam.zonaDebugActual = String(numero);
    const wrap = el('cam-debug-imgwrap');
    const tag = el('cam-debug-zona-tag');

    document.querySelectorAll('.cam-space-mini').forEach((n) => n.classList.remove('selected'));
    const boton = Array.from(document.querySelectorAll('.cam-space-mini')).find((n) => n.textContent.trim().startsWith(String(numero)));
    if (boton) boton.classList.add('selected');

    if (!wrap || !tag) return;
    const zonaExiste = cam.zonas.some((z) => String(z.nombre) === String(numero));
    if (!zonaExiste) {
      wrap.innerHTML = `<div class="cam-debug-empty">El espacio #${numero} aún no tiene zona calibrada. Usa Nueva zona.</div>`;
      tag.style.display = 'none';
      return;
    }

    tag.textContent = `#${numero}`;
    tag.style.display = 'inline-block';
    actualizarDebugZona();
    if (cam.intervalDebug) clearInterval(cam.intervalDebug);
    cam.intervalDebug = setInterval(actualizarDebugZona, 1200);
  };

  function actualizarDebugZona() {
    if (!cam.zonaDebugActual) return;
    const wrap = el('cam-debug-imgwrap');
    const img = el('cam-live-img');
    if (!wrap || !img || !img.naturalWidth) return;

    const zona = cam.zonas.find((z) => String(z.nombre) === String(cam.zonaDebugActual));
    if (!zona) return;

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = Math.max(160, Math.round(320 * (img.naturalHeight / img.naturalWidth)));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const sx = canvas.width / img.naturalWidth;
    const sy = canvas.height / img.naturalHeight;
    const pts = zona.puntos.map((p) => [p[0] * sx, p[1] * sy]);
    if (pts.length) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = zona.ocupada ? '#ef4444' : '#22c55e';
      ctx.fillStyle = zona.ocupada ? 'rgba(239,68,68,.22)' : 'rgba(34,197,94,.18)';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px Inter, Arial, sans-serif';
    ctx.fillText(`#${zona.nombre} · ${zona.ocupada ? 'OCUPADO' : 'LIBRE'} · diff ${Number(zona.diff || 0).toFixed(1)}`, 10, 22);

    wrap.innerHTML = '';
    const preview = document.createElement('img');
    preview.alt = `Depuración zona ${zona.nombre}`;
    preview.src = canvas.toDataURL('image/jpeg', 0.85);
    wrap.appendChild(preview);
  }

  window.camSetLed = function camSetLed(valor) {
    setTexto('cfg-led-val', valor);
    enviarComandoCamara({ type: 'camera_cmd', cmd: 'led', value: Number(valor) }, false);
  };

  window.camSetConfig = function camSetConfig(param, valor) {
    setTexto(`cfg-${param}-val`, valor);
    enviarComandoCamara({ type: 'camera_cmd', cmd: 'config', param, value: Number(valor) }, false);
  };

  window.camSetXclk = function camSetXclk(valor) {
    setTexto('cfg-xclk-val', valor);
    enviarComandoCamara({ type: 'camera_cmd', cmd: 'xclk', value: Number(valor) }, false);
  };

  function cargarSensibilidadCamara() {
    const mapa = {
      umbral_brillo: ['cfg-sens-brillo', 'cfg-sens-brillo-val'],
      umbral_bordes: ['cfg-sens-bordes', 'cfg-sens-bordes-val'],
      canny_bajo: ['cfg-sens-canny-bajo', 'cfg-sens-canny-bajo-val'],
      canny_alto: ['cfg-sens-canny-alto', 'cfg-sens-canny-alto-val']
    };
    Object.entries(mapa).forEach(([clave, ids]) => {
      const input = el(ids[0]);
      const span = el(ids[1]);
      if (input) input.value = cam.sensibilidad[clave];
      if (span) span.textContent = cam.sensibilidad[clave];
    });
  }

  window.camSetSensibilidad = function camSetSensibilidad(clave, valor) {
    const ids = {
      umbral_brillo: 'cfg-sens-brillo-val',
      umbral_bordes: 'cfg-sens-bordes-val',
      canny_bajo: 'cfg-sens-canny-bajo-val',
      canny_alto: 'cfg-sens-canny-alto-val'
    };
    cam.sensibilidad[clave] = Number(valor);
    setTexto(ids[clave], valor);
    guardarSensibilidadLocal();
    detectarOcupacionCliente();
  };

  window.capturarCamaraMonitor = function capturarCamaraMonitor() {
    const img = el('cam-live-img');
    if (!img || !img.src || !cam.cameraOnline) {
      toast('warning', 'Aún no hay imagen de la ESP32-CAM.', 'fa-camera');
      return;
    }
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<title>Captura ESP32-CAM</title><img src="${img.src}" style="max-width:100%;height:auto">`);
      w.document.close();
    }
  };

  function inicializarCamaraMonitor() {
    cargarZonasDesdeLocal();
    cargarBackground();

    const inputCam = el('cfg-ip-camara');
    const inputServer = el('cfg-ip-servidor');
    if (inputCam) inputCam.value = wsHostDesdeUrl(cam.serverUrl || getDefaultWsUrl());
    if (inputServer) inputServer.value = cam.serverUrl || getDefaultWsUrl();

    const img = el('cam-live-img');
    if (img) {
      img.onload = () => {
        ajustarOverlay();
        detectarOcupacionCliente();
      };
      img.onerror = () => {
        setEstadoCamara('offline', 'Error de imagen');
        const empty = el('cam-empty-state');
        if (empty) empty.style.display = 'flex';
      };
    }

    const canvas = el('cam-overlay-canvas');
    if (canvas) {
      canvas.addEventListener('click', (evento) => {
        if (cam.mode !== 'prueba') return;
        const imgLive = el('cam-live-img');
        if (!imgLive || !imgLive.naturalWidth) return;
        const punto = puntoPantallaAReal(evento);

        if (!cam.modoNuevaZona) {
          const zona = cam.zonas.find((z) => z.puntos && puntoDentroPoligono(punto, z.puntos));
          if (zona) abrirModalZona(zona.nombre);
          return;
        }

        cam.puntosActuales.push(punto);
        redibujarZonas();

        if (cam.puntosActuales.length === 4) {
          const nombre = cam.numeroPendiente || String(cam.zonas.length + 1);
          cam.zonas.push({ nombre, puntos: cam.puntosActuales, ocupada: false, diff: 0 });
          cam.ocupacion[String(nombre)] = false;
          cam.puntosActuales = [];
          cam.modoNuevaZona = false;
          cam.numeroPendiente = null;
          const btn = el('btn-cam-nueva-zona');
          if (btn) btn.classList.remove('active');
          setTexto('cam-toolbar-hint', 'Zona creada. Guarda y recalibra con el estacionamiento vacío.');
          guardarZonasLocal();
          redibujarZonas();
          window.renderMonitorParkingStrip();
          abrirModalZona(nombre);
        }
      });
    }

    window.setCamMode(cam.mode);
    window.renderMonitorParkingStrip();
    cargarSensibilidadCamara();
    actualizarResumenCamara();
    setTexto('monitor-camera-address', wsHostDesdeUrl(cam.serverUrl || getDefaultWsUrl()));

    // Se conecta solo al visor WSS. Si la ESP32-CAM no está encendida,
    // quedará esperando hasta que el dispositivo se conecte a Railway.
    abrirWsCamara();
  }

  document.addEventListener('DOMContentLoaded', inicializarCamaraMonitor);
})();
