const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const vehiculoRoutes = require("./routes/vehiculoRoutes");
const estacionamientoRoutes = require("./routes/estacionamientoRoutes");
const historialRoutes = require("./routes/historialRoutes");
const configuracionRoutes = require("./routes/configuracionRoutes");
const rolesRoutes = require("./routes/rolesRoutes");
const promocionesRoutes = require("./routes/promocionesRoutes");
const establecimientosRoutes = require("./routes/establecimientosRoutes");
const iotRoutes = require("./routes/iotRoutes");
const verificarToken = require("./middleware/authMiddleware");

const app = express();
const publicPath = path.join(__dirname, "..", "public");

app.disable("x-powered-by");

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicPath, { index: false }));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "admin.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicPath, "admin.html"));
});

app.get("/api/status", (req, res) => {
  res.status(200).json({
    ok: true,
    estado: "OK",
    mensaje: "PROYECTO FINAL IOT funcionando correctamente",
    entorno: process.env.NODE_ENV || "development",
    fechaHora: new Date().toISOString()
  });
});

app.use("/api/v2/auth", authRoutes);
app.use("/api/v2/dashboard", verificarToken, dashboardRoutes);
app.use("/api/v2/vehiculos", verificarToken, vehiculoRoutes);
app.use("/api/v2/estacionamiento", verificarToken, estacionamientoRoutes);
app.use("/api/v2/historial", verificarToken, historialRoutes);
app.use("/api/v2/configuracion/roles", verificarToken, rolesRoutes);
app.use("/api/v2/configuracion/promociones", verificarToken, promocionesRoutes);
app.use("/api/v2/configuracion/establecimientos", verificarToken, establecimientosRoutes);
app.use("/api/v2/configuracion", verificarToken, configuracionRoutes);
app.use("/api/v2/iot", verificarToken, iotRoutes);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    mensaje: "Ruta no encontrada"
  });
});

app.use((error, req, res, next) => {
  console.error("Error general del servidor:", error);
  res.status(500).json({
    ok: false,
    mensaje: "Ocurrió un error interno en el servidor"
  });
});

module.exports = app;
