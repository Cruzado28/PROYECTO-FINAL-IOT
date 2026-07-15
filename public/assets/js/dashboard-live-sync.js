(function(){
  const STORAGE_LIVE_STATE = "smartParkingLiveDashboard";
  const STORAGE_PAYMENTS = "smartParkingDailyPayments";

  function money(n){ return `S/ ${Number(n || 0).toFixed(2)}`; }
  function duration(min){
    const total = Math.max(0, Number(min)||0);
    const h = Math.floor(total/60);
    const m = total%60;
    return h ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`;
  }
  function readPayments(){
    try { return JSON.parse(localStorage.getItem(STORAGE_PAYMENTS) || "{}"); } catch { return {}; }
  }
  function readLive(){
    try { return JSON.parse(localStorage.getItem(STORAGE_LIVE_STATE) || "null"); } catch { return null; }
  }
  function findKpi(label){
    const wanted = String(label).trim().toUpperCase();
    return [...document.querySelectorAll(".kpi-card")].find(card => {
      const lbl = card.querySelector(".kpi-label")?.textContent?.trim().toUpperCase();
      return lbl === wanted;
    });
  }
  function setKpi(label, value, sub){
    const card = findKpi(label);
    if (!card) return;
    const valueNode = card.querySelector(".kpi-value");
    const subNode = card.querySelector(".kpi-sub,.kpi-trend");
    if (valueNode) valueNode.textContent = value;
    if (subNode && sub) subNode.textContent = sub;
  }
  function apply(payload){
    if (!payload || !payload.resumen) return;
    const r = payload.resumen;
    const pagos = readPayments();
    const ingresos = Number(r.ingresosDia || pagos.total || r.ingresosActuales || 0);
    setKpi("ESPACIOS TOTALES", r.total ?? 10, "Capacidad total");
    setKpi("ESPACIOS OCUPADOS", r.activos ?? 0, "En uso ahora");
    setKpi("ESPACIOS DISPONIBLES", r.libres ?? 10, "Libres ahora");
    setKpi("VEHÍCULOS ACTIVOS", r.activos ?? 0, "En el estacionamiento ahora");
    setKpi("INGRESOS DEL DÍA", money(ingresos), "Pagos acumulados por RFID");
    setKpi("TIEMPO PROMEDIO", duration(r.promedioMin || 0), "Promedio en vivo");
  }
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "smartparking:live-dashboard") apply(event.data.payload);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_LIVE_STATE || event.key === STORAGE_PAYMENTS) apply(readLive());
  });
  setInterval(() => apply(readLive()), 1500);
  document.addEventListener("DOMContentLoaded", () => apply(readLive()));
})();
