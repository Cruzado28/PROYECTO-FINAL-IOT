# PROYECTO FINAL IOT

Sistema final de gestión y monitoreo de estacionamiento inteligente.

## Incluye

- Dashboard principal y Dashboard Ejecutivo responsivo.
- Cuatro gráficas organizadas en dos filas de dos.
- Eventos recientes y rankings en una sola fila.
- Sensores en vivo: ESP32, servos, láser, LDR, potenciómetro y RFID.
- Monitoreo en tiempo real con ESP32-CAM.
- Gestión de vehículos, ingresos, pagos y salidas.
- Historial y reportes con exportación PDF y Excel.
- Tarifas, roles, promociones y establecimientos.
- Configuración general y persistencia en MySQL.

## Estructura limpia

```text
PROYECTO FINAL IOT/
├── public/
│   ├── admin.html                 # Aplicación principal
│   ├── panel-iot.html             # Dashboard y sensores integrados
│   └── assets/
│       ├── css/
│       │   ├── admin.css
│       │   ├── panel-iot.css
│       │   └── sensors-live.css
│       └── js/
│           ├── admin.js
│           ├── panel-iot.js
│           ├── sensors-live.js
│           ├── dashboard.js
│           ├── iot.js
│           ├── auth.js
│           └── api.js
├── src/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   └── app.js
├── database/
│   ├── schema.sql
│   └── consultas_workbench.sql
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── server.js
```

## Inicio local

1. Copiar `.env.example` como `.env`.
2. Configurar MySQL y las credenciales del administrador.
3. Ejecutar `npm install`.
4. Ejecutar `npm start`.
5. Abrir `http://localhost:3000`.

El archivo `.env`, `node_modules`, respaldos, parches y archivos temporales no se incluyen en el proyecto.
