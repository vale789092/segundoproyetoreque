import api from "./api";

export type MantTipo = "preventivo" | "correctivo" | "calibracion" | "inspeccion" | "otro";
export type MantGroup = "equipo" | "lab";

export type MantReportParams = {
  labId?: string;      // único laboratorio
  labIdsCsv?: string;  // "id1,id2,id3"
  desde?: string;      // YYYY-MM-DD
  hasta?: string;      // YYYY-MM-DD
  tipo?: MantTipo | "";
  group?: MantGroup;   // "equipo" (default) | "lab"
};

// ------ helpers fechas (ISO rango día completo) ------
function toISOStart(d?: string) { return d ? new Date(`${d}T00:00:00.000`).toISOString() : undefined; }
function toISOEnd(d?: string)   { return d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined; }

function buildParams(p: MantReportParams) {
  return {
    lab_id : p.labId || undefined,
    lab_ids: p.labIdsCsv || undefined,
    from   : p.desde ? toISOStart(p.desde) : undefined,
    to     : p.hasta ? toISOEnd(p.hasta)   : undefined,
    tipo   : p.tipo || undefined,
    group  : p.group || "equipo",
  };
}

// -------- Tipos de respuesta --------
export type MantEquipoRow = {
  lab: { id: string; nombre: string };
  equipo: { id: string; codigo: string; nombre: string };
  mantenimientos: number;
  downtime_hours: number;
  avg_downtime_hours: number;
  primero_en_rango?: string | null;
  ultimo_en_rango?: string | null;
  period_from: string;
  period_to: string;
  tipo: MantTipo | null;
};

export type MantLabRow = {
  lab: { id: string; nombre: string };
  equipos: number;
  mantenimientos: number;
  downtime_hours: number;
  avg_downtime_hours: number;
  period_from: string;
  period_to: string;
  tipo: MantTipo | null;
};

// -------- Ver (JSON) --------
export async function getMantReport(p: MantReportParams): Promise<MantEquipoRow[] | MantLabRow[]> {
  const params = buildParams(p);
  const res = await api.get("reports/maintenance", {
    params,
    headers: { Accept: "application/json" },
  });
  return res.data;
}

// -------- Descargas (PDF/XLSX) --------
async function download(path: string, filename: string, p: MantReportParams) {
  const params = buildParams(p);
  const res = await api.get(path, { params, responseType: "blob" });

  const blob = res.data as Blob;
  const mime = blob.type || "";
  const okMime =
    mime.includes("application/pdf") ||
    mime.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ||
    mime.includes("application/octet-stream");

  // Si vino un error JSON/HTML como blob, mostrar mensaje legible
  if (!okMime) {
    const text = await blob.text().catch(() => "");
    throw new Error(text || `Descarga fallida (${res.status})`);
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportMantPdf(p: MantReportParams) {
  const name = `Mant_${p.labId || p.labIdsCsv || "labs"}_${p.desde || "na"}-a-${p.hasta || "na"}_${p.group || "equipo"}.pdf`;
  return download("reports/maintenance.pdf", name, p);
}
export function exportMantXlsx(p: MantReportParams) {
  const name = `Mant_${p.labId || p.labIdsCsv || "labs"}_${p.desde || "na"}-a-${p.hasta || "na"}_${p.group || "equipo"}.xlsx`;
  return download("reports/maintenance.xlsx", name, p);
}
