const express = require("express");
const db = require("../config/db");

const router = express.Router();

const TIPOS_REGISTRO = [
  "Consumo",
  "Tiempo"
];

const ESTADOS_ESTABLECIMIENTO = [
  "Activo",
  "Inactivo"
];

const ICONOS_CATEGORIA = {
  Restaurante: "fa-utensils",
  Supermercado: "fa-cart-shopping",
  Farmacia: "fa-pills",
  Cine: "fa-film",
  Gimnasio: "fa-dumbbell",
  Electrónica: "fa-mobile-screen",
  Ropa: "fa-shirt",
  Banco: "fa-building-columns",
  Cafetería: "fa-mug-saucer",
  Servicios: "fa-briefcase"
};

function formatearEstablecimiento(
  establecimiento
) {
  return {
    idEstablecimiento:
      establecimiento.id_establecimiento,

    nombre:
      establecimiento.nombre,

    categoria:
      establecimiento.categoria,

    icono:
      establecimiento.icono ||
      "fa-store",

    ubicacion:
      establecimiento.ubicacion,

    tipoRegistro:
      establecimiento.tipo_registro,

    estado:
      establecimiento.estado,

    descripcion:
      establecimiento.descripcion
  };
}

function validarDatosEstablecimiento(cuerpo) {
  const nombre = String(
    cuerpo.nombre || ""
  ).trim();

  const categoria = String(
    cuerpo.categoria || ""
  ).trim();

  const ubicacion = String(
    cuerpo.ubicacion || "Sin especificar"
  ).trim() || "Sin especificar";

  const tipoRegistro = String(
    cuerpo.tipoRegistro || ""
  ).trim();

  const estado = String(
    cuerpo.estado || "Activo"
  ).trim();

  const descripcion = String(
    cuerpo.descripcion || ""
  ).trim();

  let icono = String(
    cuerpo.icono ||
    ICONOS_CATEGORIA[categoria] ||
    "fa-store"
  ).trim();

  if (!nombre) {
    return {
      error:
        "El nombre del establecimiento es obligatorio"
    };
  }

  if (nombre.length > 120) {
    return {
      error:
        "El nombre no puede superar los 120 caracteres"
    };
  }

  if (!categoria) {
    return {
      error:
        "La categoría del establecimiento es obligatoria"
    };
  }

  if (categoria.length > 80) {
    return {
      error:
        "La categoría no puede superar los 80 caracteres"
    };
  }

  if (ubicacion.length > 150) {
    return {
      error:
        "La ubicación no puede superar los 150 caracteres"
    };
  }

  if (!TIPOS_REGISTRO.includes(tipoRegistro)) {
    return {
      error:
        "El tipo de registro debe ser Consumo o Tiempo"
    };
  }

  if (
    !ESTADOS_ESTABLECIMIENTO.includes(
      estado
    )
  ) {
    return {
      error:
        "El estado debe ser Activo o Inactivo"
    };
  }

  if (descripcion.length > 255) {
    return {
      error:
        "La descripción no puede superar los 255 caracteres"
    };
  }

  if (
    !/^fa-[a-z0-9-]+$/i.test(icono)
  ) {
    icono = "fa-store";
  }

  if (icono.length > 60) {
    icono = "fa-store";
  }

  return {
    datos: {
      nombre,
      categoria,
      icono,
      ubicacion,
      tipoRegistro,
      estado,
      descripcion
    }
  };
}

async function obtenerEstablecimientoPorId(
  idEstablecimiento
) {
  const [filas] = await db.query(
    `
      SELECT
        id_establecimiento,
        nombre,
        categoria,
        icono,
        ubicacion,
        tipo_registro,
        estado,
        descripcion
      FROM establecimientos
      WHERE id_establecimiento = ?
      LIMIT 1
    `,
    [idEstablecimiento]
  );

  return filas[0] || null;
}

// ============================================================
// GET /api/v2/configuracion/establecimientos
// Lista todos los establecimientos.
// ============================================================
router.get("/", async (req, res) => {
  try {
    const [filas] = await db.query(`
      SELECT
        id_establecimiento,
        nombre,
        categoria,
        icono,
        ubicacion,
        tipo_registro,
        estado,
        descripcion
      FROM establecimientos
      ORDER BY
        estado DESC,
        nombre ASC,
        id_establecimiento ASC
    `);

    return res.json({
      ok: true,
      total: filas.length,
      establecimientos:
        filas.map(formatearEstablecimiento)
    });
  } catch (error) {
    console.error(
      "Error al obtener los establecimientos:",
      error.message
    );

    return res.status(500).json({
      ok: false,
      mensaje:
        "Error al obtener los establecimientos",
      error: error.message
    });
  }
});

// ============================================================
// POST /api/v2/configuracion/establecimientos
// Crea un establecimiento.
// ============================================================
router.post("/", async (req, res) => {
  try {
    const validacion =
      validarDatosEstablecimiento(req.body);

    if (validacion.error) {
      return res.status(400).json({
        ok: false,
        mensaje: validacion.error
      });
    }

    const datos = validacion.datos;

    const [existentes] = await db.query(
      `
        SELECT id_establecimiento
        FROM establecimientos
        WHERE LOWER(nombre) = LOWER(?)
          AND LOWER(
            COALESCE(ubicacion, '')
          ) = LOWER(?)
        LIMIT 1
      `,
      [
        datos.nombre,
        datos.ubicacion
      ]
    );

    if (existentes.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje:
          "Ya existe un establecimiento con ese nombre y ubicación"
      });
    }

    const [resultado] = await db.query(
      `
        INSERT INTO establecimientos (
          nombre,
          categoria,
          icono,
          ubicacion,
          tipo_registro,
          estado,
          descripcion
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        datos.nombre,
        datos.categoria,
        datos.icono,
        datos.ubicacion,
        datos.tipoRegistro,
        datos.estado,
        datos.descripcion
      ]
    );

    const establecimiento =
      await obtenerEstablecimientoPorId(
        resultado.insertId
      );

    return res.status(201).json({
      ok: true,
      mensaje:
        "Establecimiento creado correctamente",
      establecimiento:
        formatearEstablecimiento(
          establecimiento
        )
    });
  } catch (error) {
    console.error(
      "Error al crear el establecimiento:",
      error.message
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        ok: false,
        mensaje:
          "Ya existe un establecimiento con ese nombre y ubicación"
      });
    }

    return res.status(500).json({
      ok: false,
      mensaje:
        "Error al crear el establecimiento",
      error: error.message
    });
  }
});

// ============================================================
// PUT /api/v2/configuracion/establecimientos/:id
// Actualiza un establecimiento.
// ============================================================
router.put("/:id", async (req, res) => {
  try {
    const idEstablecimiento = Number(
      req.params.id
    );

    if (
      !Number.isInteger(idEstablecimiento) ||
      idEstablecimiento <= 0
    ) {
      return res.status(400).json({
        ok: false,
        mensaje:
          "El identificador del establecimiento no es válido"
      });
    }

    const actual =
      await obtenerEstablecimientoPorId(
        idEstablecimiento
      );

    if (!actual) {
      return res.status(404).json({
        ok: false,
        mensaje:
          "El establecimiento indicado no existe"
      });
    }

    const validacion =
      validarDatosEstablecimiento(req.body);

    if (validacion.error) {
      return res.status(400).json({
        ok: false,
        mensaje: validacion.error
      });
    }

    const datos = validacion.datos;

    const [duplicados] = await db.query(
      `
        SELECT id_establecimiento
        FROM establecimientos
        WHERE LOWER(nombre) = LOWER(?)
          AND LOWER(
            COALESCE(ubicacion, '')
          ) = LOWER(?)
          AND id_establecimiento <> ?
        LIMIT 1
      `,
      [
        datos.nombre,
        datos.ubicacion,
        idEstablecimiento
      ]
    );

    if (duplicados.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje:
          "Ya existe otro establecimiento con ese nombre y ubicación"
      });
    }

    await db.query(
      `
        UPDATE establecimientos
        SET
          nombre = ?,
          categoria = ?,
          icono = ?,
          ubicacion = ?,
          tipo_registro = ?,
          estado = ?,
          descripcion = ?
        WHERE id_establecimiento = ?
      `,
      [
        datos.nombre,
        datos.categoria,
        datos.icono,
        datos.ubicacion,
        datos.tipoRegistro,
        datos.estado,
        datos.descripcion,
        idEstablecimiento
      ]
    );

    const actualizado =
      await obtenerEstablecimientoPorId(
        idEstablecimiento
      );

    return res.json({
      ok: true,
      mensaje:
        "Establecimiento actualizado correctamente",
      establecimiento:
        formatearEstablecimiento(
          actualizado
        )
    });
  } catch (error) {
    console.error(
      "Error al actualizar el establecimiento:",
      error.message
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        ok: false,
        mensaje:
          "Ya existe otro establecimiento con ese nombre y ubicación"
      });
    }

    return res.status(500).json({
      ok: false,
      mensaje:
        "Error al actualizar el establecimiento",
      error: error.message
    });
  }
});

// ============================================================
// PATCH /api/v2/configuracion/establecimientos/:id/estado
// Activa o desactiva sin borrar el historial.
// ============================================================
router.patch(
  "/:id/estado",
  async (req, res) => {
    try {
      const idEstablecimiento = Number(
        req.params.id
      );

      const estado = String(
        req.body.estado || ""
      ).trim();

      if (
        !Number.isInteger(
          idEstablecimiento
        ) ||
        idEstablecimiento <= 0
      ) {
        return res.status(400).json({
          ok: false,
          mensaje:
            "El identificador del establecimiento no es válido"
        });
      }

      if (
        !ESTADOS_ESTABLECIMIENTO.includes(
          estado
        )
      ) {
        return res.status(400).json({
          ok: false,
          mensaje:
            "El estado debe ser Activo o Inactivo"
        });
      }

      const actual =
        await obtenerEstablecimientoPorId(
          idEstablecimiento
        );

      if (!actual) {
        return res.status(404).json({
          ok: false,
          mensaje:
            "El establecimiento indicado no existe"
        });
      }

      await db.query(
        `
          UPDATE establecimientos
          SET estado = ?
          WHERE id_establecimiento = ?
        `,
        [
          estado,
          idEstablecimiento
        ]
      );

      return res.json({
        ok: true,
        mensaje:
          estado === "Activo"
            ? "Establecimiento activado correctamente"
            : "Establecimiento desactivado correctamente"
      });
    } catch (error) {
      console.error(
        "Error al cambiar el estado del establecimiento:",
        error.message
      );

      return res.status(500).json({
        ok: false,
        mensaje:
          "Error al cambiar el estado del establecimiento",
        error: error.message
      });
    }
  }
);

module.exports = router;
