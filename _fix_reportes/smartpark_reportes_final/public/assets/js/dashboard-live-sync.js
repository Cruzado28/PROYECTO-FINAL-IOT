(function(){
  const STORAGE_LIVE_STATE = "smartParkingLiveDashboard";
  const STORAGE_PAYMENTS = "smartParkingDailyPayments";
  const STORAGE_PAYMENTS_BY_DATE = "smartParkingPaymentsByDate";
  const STORAGE_SIM_DATE = "smartParkingOperationDate";

  function money(n){ return `S/ ${Number(n || 0).toFixed(2)}`; }
  function duration(min){
    const total = Math.max(0, Number(min)||0);
    const h = Math.floor(total/60);
    const m = total%60;
    return h ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`;
  }
  function readJson(key, fallback){ try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
  function activeDate(){ return localStorage.getItem(STORAGE_SIM_DATE) || new Date().toISOString().slice(0,10); }
  function readPayments(){
    const byDate = readJson(STORAGE_PAYMENTS_BY_DATE, {});
    if (byDate && byDate[activeDate()]) return byDate[activeDate()];
    return readJson(STORAGE_PAYMENTS, { total: 0, events: [] });
  }
  function readLive(){ return readJson(STORAGE_LIVE_STATE, null); }
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
    if (subNode && sub) { subNode.textContent = sub; subNode.style.display = "block"; }
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
    if ([STORAGE_LIVE_STATE, STORAGE_PAYMENTS, STORAGE_PAYMENTS_BY_DATE, STORAGE_SIM_DATE].includes(event.key)) apply(readLive());
  });
  setInterval(() => apply(readLive()), 1000);
  document.addEventListener("DOMContentLoaded", () => apply(readLive()));
})();
