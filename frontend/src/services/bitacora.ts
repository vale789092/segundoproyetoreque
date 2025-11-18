import api from "@/services/api"; // tu axios con baseURL y bearer

export type BitacoraRow = {
  ts: string;              // ISO en backend → aquí string
  accion: string;
  detalle: any;
  lab_id: string;
  lab_nombre: string;
  user_id?: string | null;
  user_nombre?: string | null;
  user_correo?: string | null;
};

export async function getLabHistory(labId: string): Promise<BitacoraRow[]> {
  const { data } = await api.get(`/labs/${labId}/history`);
  return data;
}

export async function downloadLabHistoryPdf(labId: string) {
  const res = await api.get(`/labs/${labId}/history.pdf`, { responseType: "blob" });
  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Bitacora_${labId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
