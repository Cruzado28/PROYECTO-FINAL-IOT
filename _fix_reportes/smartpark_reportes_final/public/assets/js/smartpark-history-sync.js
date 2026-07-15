(function(){
  const STORAGE_HISTORY_BY_DATE = "smartParkingHistoryByDate";
  const STORAGE_INCIDENTS_BY_DATE = "smartParkingIncidentsByDate";
  const STORAGE_SIM_DATE = "smartParkingOperationDate";
  const STORAGE_LIVE_DASHBOARD = "smartParkingLiveDashboard";
  const STORAGE_PAYMENTS_BY_DATE = "smartParkingPaymentsByDate";

  const TOTAL_SPACES = 10;

  function $(id){ return document.getElementById(id); }
  function readJson(key, fallback){
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  }
  function currentDate(){ return localStorage.getItem(STORAGE_SIM_DATE) || new Date().toISOString().slice(0,10); }
  function fmtMoney(value){ return `S/ ${Number(value || 0).toFixed(2)}`; }
  function fmtDuration(min){
    const total = Math.max(0, Number(min)||0);
    const h = Math.floor(total/60);
    const m = total%60;
    return h ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`;
  }
  function escapeHtml(v){
    return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }
  function allHistoryRows(){
    const byDate = readJson(STORAGE_HISTORY_BY_DATE, {});
    return Object.entries(byDate).flatMap(([date, rows]) => Array.isArray(rows) ? rows.map(r => ({...r, fechaISO: r.fechaISO || date})) : []);
  }
  function allIncidentRows(){
    const byDate = readJson(STORAGE_INCIDENTS_BY_DATE, {});
    return Object.entries(byDate).flatMap(([date, rows]) => Array.isArray(rows) ? rows.map(r => ({...r, fechaISO: r.fechaISO || date})) : []);
  }
  function normalizedHistoryRows(){
    return allHistoryRows().map(row => ({
      key: row.key || `${row.fechaISO}|${row.uid}|${row.espacio}`,
      date: row.fecha || row.date || formatDate(row.fechaISO),
      dateISO: row.fechaISO || isoFromLocal(row.fecha || row.date),
      in: row.ingreso || row.in || "—",
      out: row.salida || row.out || "—",
      total: row.tiempo || row.total || fmtDuration(row.tiempoMin || row.duracionMin),
      driver: row.conductor || row.driver || "Registro automático",
      plate: row.placa || row.plate || "—",
      type: row.tipoVehiculo || row.type || "Vehículo",
      status: row.estado || row.status || "Activa",
      consume: row.consumo || row.consume || fmtMoney(row.pago),
      discount: row.descuento || row.discount || "S/ 0.00",
      total_pay: row.total || row.total_pay || fmtMoney(row.pago),
      espacio: row.espacio || "—",
      uid: row.uid || "—",
      pago: Number(row.pago || 0),
      detalle: row.detalle || "Registro generado por RFID"
    })).sort((a,b)=>`${b.dateISO} ${b.in}`.localeCompare(`${a.dateISO} ${a.in}`));
  }
  function formatDate(iso){
    const parts = String(iso||"").split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : (iso || "—");
  }
  function isoFromLocal(local){
    const p = String(local||"").split("/");
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : "";
  }
  function getFilters(){
    return {
      plate: ($("h-plate")?.value || "").trim().toLowerCase(),
      driver: ($("h-driver")?.value || "").trim().toLowerCase(),
      from: $("h-from")?.value || "",
      to: $("h-to")?.value || "",
      status: $("h-status")?.value || "",
      type: $("h-type")?.value || ""
    };
  }
  function filterHistory(rows = normalizedHistoryRows()){
    const f = getFilters();
    return rows.filter(row => {
      const plateText = `${row.plate} ${row.uid} ${row.espacio}`.toLowerCase();
      const driverText = `${row.driver}`.toLowerCase();
      return (!f.plate || plateText.includes(f.plate)) &&
        (!f.driver || driverText.includes(f.driver)) &&
        (!f.from || row.dateISO >= f.from) &&
        (!f.to || row.dateISO <= f.to) &&
        (!f.status || row.status === f.status || row.status.toLowerCase().includes(f.status.toLowerCase())) &&
        (!f.type || row.type === f.type);
    });
  }
  function renderHistoryFromStorage(){
    const tbody = $("history-tbody");
    if (!tbody) return false;
    const rows = filterHistory();
    const count = document.querySelector("#page-history .table-header .badge-blue");
    if (count) count.textContent = `${rows.length} registro${rows.length === 1 ? "" : "s"}`;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="padding:28px;text-align:center;color:var(--text-muted)">No existen sesiones que coincidan con los filtros.</td></tr>`;
      renderIncidentsFromStorage();
      return true;
    }
    tbody.innerHTML = rows.map((h, i) => {
      const cls = /final/i.test(h.status) ? "badge-green" : /incid/i.test(h.status) ? "badge-red" : /pag/i.test(h.status) ? "badge-blue" : "badge-gray";
      return `<tr>
        <td>${escapeHtml(h.date)}</td>
        <td>${escapeHtml(h.in)}</td>
        <td>${escapeHtml(h.out)}</td>
        <td><span class="badge ${cls}">${escapeHtml(h.total)}</span></td>
        <td>${escapeHtml(h.driver)}</td>
        <td style="font-family:monospace;color:var(--accent);font-weight:700">${escapeHtml(h.plate)}</td>
        <td>${escapeHtml(h.consume)}</td>
        <td style="color:var(--green)">${escapeHtml(h.discount)}</td>
        <td style="font-weight:700">${escapeHtml(h.total_pay)}</td>
        <td><button class="btn btn-ghost btn-sm" type="button" data-history-detail="${i}"><i class="fa-solid fa-eye"></i> Ver</button></td>
      </tr>`;
    }).join("");
    tbody.querySelectorAll("[data-history-detail]").forEach(btn => btn.addEventListener("click", () => showHistoryDetail(rows[Number(btn.dataset.historyDetail)])));
    renderIncidentsFromStorage();
    return true;
  }
  function filterIncidents(rows = allIncidentRows()){
    const f = getFilters();
    return rows.filter(row => {
      const text = `${row.placaUid} ${row.detalle}`.toLowerCase();
      return (!f.plate || text.includes(f.plate)) && (!f.from || row.fechaISO >= f.from) && (!f.to || row.fechaISO <= f.to);
    }).sort((a,b)=>`${b.fechaISO} ${b.hora}`.localeCompare(`${a.fechaISO} ${a.hora}`));
  }
  function renderIncidentsFromStorage(){
    const tbody = $("incidencias-tbody");
    if (!tbody) return;
    const rows = filterIncidents();
    const count = $("incidencias-count");
    if (count) count.textContent = `${rows.length} incidencia${rows.length === 1 ? "" : "s"}`;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">No hay incidencias con los filtros seleccionados.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `<tr>
      <td>${escapeHtml(r.fecha || formatDate(r.fechaISO))}</td>
      <td>${escapeHtml(r.hora || "—")}</td>
      <td><span class="badge badge-red">${escapeHtml(r.tipo || "Incidencia")}</span></td>
      <td style="font-family:monospace">${escapeHtml(r.placaUid || "—")}</td>
      <td>${escapeHtml(r.detalle || "Incidencia registrada")}</td>
      <td>${escapeHtml(r.origen || "Sistema IoT")}</td>
    </tr>`).join("");
  }
  function showHistoryDetail(row){
    const msg = `Placa ${row.plate} · Espacio ${row.espacio}\nIngreso: ${row.date} ${row.in}\nSalida: ${row.out}\nTiempo: ${row.total}\nTotal: ${row.total_pay}\nEstado: ${row.status}`;
    if (typeof window.showToast === "function") window.showToast("info", msg, "fa-circle-info");
    else alert(msg);
  }
  function currentLivePayload(){ return readJson(STORAGE_LIVE_DASHBOARD, null); }
  function spacesFromLive(){
    const live = currentLivePayload();
    const spaces = Array.isArray(live?.spaces) ? live.spaces : [];
    if (spaces.length) return spaces;
    return Array.from({length: TOTAL_SPACES}, (_,i)=>({ numero:i+1, estado:"Libre", placa:"", uid:"", pago:0, duracionMin:0 }));
  }
  function liveSummary(){
    const spaces = spacesFromLive();
    const pagosByDate = readJson(STORAGE_PAYMENTS_BY_DATE, {});
    const pagos = pagosByDate[currentDate()] || { total: 0 };
    const summary = { total: TOTAL_SPACES, libres: 0, ocupados: 0, pagados: 0, incidencias: 0, activos: 0, ingreso: Number(pagos.total || 0), promedio: 0 };
    let sum = 0, n = 0;
    spaces.forEach(s => {
      const st = String(s.estado || "Libre").toLowerCase();
      const active = !st.includes("libre") && !st.includes("manten");
      if (st.includes("pag")) summary.pagados++;
      else if (st.includes("incid")) summary.incidencias++;
      else if (active) summary.ocupados++;
      else summary.libres++;
      if (active) summary.activos++;
      if (Number(s.duracionMin)>0){ sum += Number(s.duracionMin); n++; }
    });
    summary.promedio = n ? Math.round(sum/n) : 0;
    return summary;
  }
  function setKpi(label, value, sub){
    const wanted = label.toUpperCase();
    document.querySelectorAll(".kpi-card").forEach(card => {
      const l = card.querySelector(".kpi-label")?.textContent?.trim().toUpperCase();
      if (l === wanted) {
        const v = card.querySelector(".kpi-value");
        const s = card.querySelector(".kpi-sub,.kpi-trend");
        if (v) v.textContent = value;
        if (s && sub) { s.textContent = sub; s.style.display = "block"; }
      }
    });
  }
  function syncLegacyDashboard(){
    const r = liveSummary();
    setKpi("ESPACIOS TOTALES", String(r.total), "Capacidad total");
    setKpi("ESPACIOS OCUPADOS", String(r.activos), `${r.ocupados} estacionado(s), ${r.pagados} pagado(s), ${r.incidencias} incidencia(s)`);
    setKpi("ESPACIOS DISPONIBLES", String(r.libres), "Libres ahora");
    setKpi("VEHÍCULOS ACTIVOS", String(r.activos), "En el estacionamiento ahora");
    setKpi("INGRESOS DEL DÍA", fmtMoney(r.ingreso), "Pagos acumulados por RFID");
    setKpi("TIEMPO PROMEDIO", fmtDuration(r.promedio), "Promedio en vivo");
  }
  function exportRows(){ return filterHistory(); }
  function rowsForExport(){
    return exportRows().map(r => ({
      Fecha: r.date,
      Ingreso: r.in,
      Salida: r.out,
      Tiempo: r.total,
      Conductor: r.driver,
      Placa: r.plate,
      Espacio: r.espacio,
      Estado: r.status,
      Consumo: r.consume,
      Descuento: r.discount,
      Total: r.total_pay,
      Detalle: r.detalle
    }));
  }
  async function exportPdfRows(title, rows){
    if (window.jspdf?.jsPDF) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation:"landscape", unit:"pt", format:"a4" });
      doc.setFontSize(14); doc.text(title, 40, 36);
      doc.setFontSize(9); doc.text(`Fecha de operación: ${currentDate()} · Generado: ${new Date().toLocaleString("es-PE")}`, 40, 54);
      const body = rows.map(Object.values);
      const head = [Object.keys(rows[0] || { Fecha:"", Ingreso:"", Salida:"", Tiempo:"", Placa:"", Estado:"", Total:"" })];
      if (doc.autoTable) doc.autoTable({ head, body, startY: 72, styles:{fontSize:7, cellPadding:3}, headStyles:{fillColor:[20,28,53]} });
      else doc.text(JSON.stringify(rows, null, 2).slice(0, 12000), 40, 80);
      doc.save(`${title.toLowerCase().replace(/\s+/g,"-")}-${currentDate()}.pdf`);
      return;
    }
    const html = `<html><head><title>${title}</title><style>body{font-family:Arial}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#141c35;color:#fff}td,th{border:1px solid #ccc;padding:6px}</style></head><body><h2>${title}</h2><p>Fecha de operación: ${currentDate()}</p>${tableHtml(rows)}</body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html); w.document.close(); w.focus(); w.print();
  }
  function tableHtml(rows){
    if (!rows.length) return "<p>No existen registros.</p>";
    const head = Object.keys(rows[0]);
    return `<table><thead><tr>${head.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${head.map(h=>`<td>${escapeHtml(r[h])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  function exportExcelRows(title, rows){
    if (window.XLSX) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Mensaje:"No existen registros para exportar" }]);
      XLSX.utils.book_append_sheet(wb, ws, "Historial");
      XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g,"-")}-${currentDate()}.xlsx`);
      return;
    }
    const html = tableHtml(rows);
    const blob = new Blob([`<html><head><meta charset="UTF-8"></head><body>${html}</body></html>`], { type:"application/vnd.ms-excel;charset=utf-8" });
    downloadBlob(blob, `${title.toLowerCase().replace(/\s+/g,"-")}-${currentDate()}.xls`);
  }
  function downloadBlob(blob, name){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  window.exportarHistorialPDF = async function(){
    const rows = rowsForExport();
    await exportPdfRows("Historial Smart Parking", rows);
    if (typeof window.showToast === "function") window.showToast("success", "Historial exportado con datos en vivo", "fa-file-pdf");
  };
  window.exportarHistorialExcel = async function(){
    exportExcelRows("Historial Smart Parking", rowsForExport());
    if (typeof window.showToast === "function") window.showToast("success", "Historial exportado a Excel", "fa-table");
  };
  window.exportarDashboardPDF = async function(){
    const spaces = spacesFromLive().map(s => ({
      Espacio: s.numero,
      Estado: s.estado || "Libre",
      Placa: s.placa || "—",
      UID: s.uid || "—",
      Tiempo: fmtDuration(s.duracionMin),
      Pago: fmtMoney(s.pago)
    }));
    await exportPdfRows("Reporte Dashboard Smart Parking", spaces);
    if (typeof window.showToast === "function") window.showToast("success", "Dashboard exportado con datos en vivo", "fa-file-pdf");
  };
  function bindFilters(){
    ["h-plate","h-driver","h-from","h-to","h-status","h-type"].forEach(id => {
      const node = $(id);
      if (node && !node.dataset.liveHistoryBound) {
        node.dataset.liveHistoryBound = "1";
        node.addEventListener("input", renderHistoryFromStorage);
        node.addEventListener("change", renderHistoryFromStorage);
      }
    });
  }
  function setDefaultDateFilters(){
    const from = $("h-from"), to = $("h-to");
    const d = currentDate();
    // Mantiene el historial enfocado en la fecha de operación para evitar que se mezclen registros de otros días.
    if (from && !from.value) from.value = d;
    if (to && !to.value) to.value = d;
  }
  function boot(){
    bindFilters();
    setDefaultDateFilters();
    renderHistoryFromStorage();
    syncLegacyDashboard();
  }
  window.addEventListener("storage", (ev) => {
    if ([STORAGE_HISTORY_BY_DATE, STORAGE_INCIDENTS_BY_DATE, STORAGE_LIVE_DASHBOARD, STORAGE_PAYMENTS_BY_DATE, STORAGE_SIM_DATE].includes(ev.key)) {
      if (ev.key === STORAGE_SIM_DATE) {
        const from = $("h-from"), to = $("h-to");
        if (from) from.value = currentDate();
        if (to) to.value = currentDate();
      }
      renderHistoryFromStorage(); syncLegacyDashboard();
    }
  });
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "smartparking:live-dashboard") { syncLegacyDashboard(); renderHistoryFromStorage(); }
  });
  document.addEventListener("DOMContentLoaded", () => { setTimeout(boot, 400); setInterval(boot, 2000); });
})();
