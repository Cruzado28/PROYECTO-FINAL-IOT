require("dotenv").config();

const app = require("./src/app");
const initDatabase = require("./src/config/initDb");

const PORT = Number(process.env.PORT || 3000);

async function iniciarServidor() {
  try {
    await initDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`PROYECTO FINAL IOT iniciado en el puerto ${PORT}`);
      console.log(`Entorno: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor:", error.message);
    process.exit(1);
  }
}

iniciarServidor();
