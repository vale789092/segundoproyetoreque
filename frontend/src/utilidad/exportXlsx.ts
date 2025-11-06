import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export function exportJsonToXlsx(rows: any[], filename = "historial.xlsx") {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Historial");
  const blob = new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, filename);
}
