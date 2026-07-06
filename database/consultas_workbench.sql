-- ============================================================
-- CONSULTAS ÚTILES PARA MYSQL WORKBENCH
-- SISTEMA IOT - PROYECTO FINAL
-- Zona horaria del proyecto: Perú (-05:00)
-- ============================================================

SET time_zone = '-05:00';

-- 1. Ver todas las tablas y vistas
SHOW FULL TABLES;

-- 2. Vehículos que ingresaron hoy
SELECT
    s.id_sesion,
    v.placa,
    c.nombre_completo AS conductor,
    e.numero AS espacio,
    s.fecha_hora_ingreso,
    s.fecha_hora_pago,
    s.fecha_hora_salida,
    s.estado,
    s.monto_total_pagado
FROM sesiones_parqueo s
INNER JOIN vehiculos v
    ON v.id_vehiculo = s.vehiculo_id
INNER JOIN conductores c
    ON c.id_conductor = v.conductor_id
INNER JOIN espacios e
    ON e.id_espacio = s.espacio_id
WHERE s.fecha_hora_ingreso >= CURDATE()
  AND s.fecha_hora_ingreso < CURDATE() + INTERVAL 1 DAY
ORDER BY s.fecha_hora_ingreso DESC;

-- 3. Vehículos de una fecha específica
-- Cambie las dos fechas conservando el intervalo [inicio, día siguiente).
SELECT
    s.id_sesion,
    v.placa,
    c.nombre_completo AS conductor,
    e.numero AS espacio,
    s.fecha_hora_ingreso,
    s.fecha_hora_salida,
    s.estado,
    s.monto_total_pagado
FROM sesiones_parqueo s
INNER JOIN vehiculos v
    ON v.id_vehiculo = s.vehiculo_id
INNER JOIN conductores c
    ON c.id_conductor = v.conductor_id
INNER JOIN espacios e
    ON e.id_espacio = s.espacio_id
WHERE s.fecha_hora_ingreso >= '2026-07-05 00:00:00'
  AND s.fecha_hora_ingreso <  '2026-07-06 00:00:00'
ORDER BY s.fecha_hora_ingreso DESC;

-- 4. Total de ingresos y vehículos diferentes de hoy
SELECT
    COUNT(*) AS total_ingresos,
    COUNT(DISTINCT vehiculo_id) AS vehiculos_diferentes
FROM sesiones_parqueo
WHERE fecha_hora_ingreso >= CURDATE()
  AND fecha_hora_ingreso < CURDATE() + INTERVAL 1 DAY;

-- 5. Vehículos actualmente estacionados
SELECT *
FROM vw_vehiculos_estacionados
ORDER BY fecha_hora_ingreso DESC;

-- 6. Estado actual de espacios
SELECT *
FROM vw_estado_espacios
ORDER BY numero_espacio;

-- 7. Pagos realizados hoy
SELECT
    p.id_pago,
    v.placa,
    p.monto,
    p.metodo_pago,
    p.estado,
    p.referencia,
    p.fecha_pago
FROM pagos p
INNER JOIN sesiones_parqueo s
    ON s.id_sesion = p.sesion_id
INNER JOIN vehiculos v
    ON v.id_vehiculo = s.vehiculo_id
WHERE p.fecha_pago >= CURDATE()
  AND p.fecha_pago < CURDATE() + INTERVAL 1 DAY
ORDER BY p.fecha_pago DESC;

-- 8. Ingresos económicos agrupados por día
SELECT
    DATE(fecha_pago) AS fecha,
    COUNT(*) AS cantidad_pagos,
    SUM(monto) AS total_recaudado
FROM pagos
WHERE estado = 'Completado'
GROUP BY DATE(fecha_pago)
ORDER BY fecha DESC;

-- 9. Vehículos registrados y su rol
SELECT
    v.id_vehiculo,
    v.placa,
    v.tipo,
    v.marca,
    v.modelo,
    v.color,
    c.nombre_completo AS conductor,
    r.nombre AS rol,
    v.estado
FROM vehiculos v
INNER JOIN conductores c
    ON c.id_conductor = v.conductor_id
INNER JOIN roles r
    ON r.id_rol = v.rol_id
ORDER BY v.id_vehiculo DESC;

-- 10. Dispositivos IoT y última lectura
SELECT
    codigo,
    nombre,
    tipo_dispositivo,
    ubicacion,
    estado,
    intensidad_senal,
    latencia_ms,
    ultima_conexion,
    ultima_lectura
FROM dispositivos_iot
ORDER BY id_dispositivo;
