import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { parseMandadoExport, planImport } from "../lib/imports";
import type { ImportCandidate } from "../lib/imports";
import type { AppState } from "../lib/types";
import { Segmented, formatMoney, shortDate } from "../ui";

export function MandadoImport({ state, onImport }: { state: AppState; onImport: (candidates: ImportCandidate[]) => Promise<boolean> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [method, setMethod] = useState<"credit" | "cash">("credit");
  const [error, setError] = useState("");
  let candidates: ImportCandidate[] = [];
  let parseError = "";
  if (raw) { try { candidates = parseMandadoExport(raw, method); } catch (reason) { parseError = reason instanceof Error ? reason.message : "Archivo inválido."; } }
  const plan = candidates.length ? planImport(state, candidates) : null;
  async function read(file: File) {
    setError(""); setRaw(null);
    if (file.size > 5 * 1024 * 1024) return setError("El archivo es demasiado grande.");
    try { setRaw(JSON.parse(await file.text())); } catch { setError("No se pudo leer el archivo. Exporta de nuevo desde Mandado."); }
  }
  return <>
    <section className="card stack">
      <p className="small">Aquí entra lo que <b>realmente</b> gastaste en el súper según tus tickets de la app Mandado. Cada compra cuenta contra tu presupuesto «Mandado» y, si fue con tarjeta, contra tu siguiente pago.</p>
      <p className="tiny muted">Esta app ya está lista para recibirlas; falta agregar en Mandado la opción para exportarlas (archivo .json). Cuando exista, abre ese archivo aquí. Puedes importar el mismo archivo varias veces: lo que ya estaba no se duplica, tampoco si ya venía en tu estado de cuenta.</p>
      <button className="btn primary" type="button" onClick={() => fileRef.current?.click()}><Upload size={16} />Abrir archivo de Mandado</button>
      <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void read(file); event.target.value = ""; }} />
      {error || parseError ? <p className="notice bad">{error || parseError}</p> : null}
    </section>
    {plan ? <section className="card stack">
      <p className="small">Los tickets que no dicen cómo pagaste se registran como:</p>
      <Segmented label="Medio de pago" value={method} onChange={setMethod} options={[["credit", "Tarjeta"], ["cash", "Débito o efectivo"]]} />
      <p className="small"><b>{plan.add.length}</b> compras nuevas por {formatMoney(plan.add.reduce((sum, item) => sum + item.amount, 0))}{plan.duplicates.length ? ` · ${plan.duplicates.length} ya registradas` : ""}.</p>
      <div className="list">{plan.add.slice(0, 30).map((item) => <div className="item" key={item.id}><div className="grow"><p className="title">{item.description}</p><p className="meta">{shortDate(item.date)} · {item.method === "credit" ? "Tarjeta" : "Débito"}</p></div><span className="amount">{formatMoney(item.amount)}</span></div>)}</div>
      <button className="btn primary" type="button" disabled={!plan.add.length} onClick={() => void onImport(candidates).then((saved) => { if (saved) setRaw(null); })}>Agregar {plan.add.length} compras</button>
    </section> : null}
  </>;
}
