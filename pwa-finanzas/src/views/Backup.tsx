import { useRef, useState } from "react";
import { Download, RefreshCw, Upload } from "lucide-react";
import type { PwaUpdateStatus } from "../lib/pwa";
import type { AppState, SyncSettings } from "../lib/types";
import { Field } from "../ui";

const PWA_LABELS: Record<PwaUpdateStatus, string> = { unsupported: "No disponible", checking: "Buscando…", current: "Actualizada", available: "Actualización lista", activating: "Activando…", reloading: "Recargando…", error: "Error al buscar" };

export function Backup({ state, pwaStatus, canInstall, onExportJson, onExportCsv, onImportJson, onSync, onCheckUpdate, onApplyUpdate, onInstall }: {
  state: AppState; pwaStatus: PwaUpdateStatus; canInstall: boolean;
  onExportJson: () => void; onExportCsv: () => void; onImportJson: (file: File) => void;
  onSync: (action: "save" | "test" | "push" | "pull", sync: SyncSettings, passphrase: string, confirm: string) => void;
  onCheckUpdate: () => void; onApplyUpdate: () => void; onInstall: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sync, setSync] = useState<SyncSettings>(state.sync);
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const busy = pwaStatus === "checking" || pwaStatus === "activating" || pwaStatus === "reloading";
  return <>
    <section className="card stack">
      <div><p className="eyebrow">Respaldo</p><p className="small muted" style={{ marginTop: "0.3rem" }}>Tus datos viven solo en este dispositivo. Descarga un respaldo de vez en cuando y antes de cambios grandes.</p></div>
      <div className="actions">
        <button className="btn primary" type="button" onClick={onExportJson}><Download size={16} />Descargar respaldo</button>
        <button className="btn" type="button" onClick={() => fileRef.current?.click()}><Upload size={16} />Restaurar respaldo</button>
        <button className="btn" type="button" onClick={onExportCsv}><Download size={16} />Movimientos a Excel (CSV)</button>
      </div>
      <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportJson(file); event.target.value = ""; }} />
      <p className="tiny muted">Restaurar reemplaza el plan de este dispositivo; antes se descarga una copia del actual.</p>
    </section>

    <details className="card">
      <summary className="row between"><span><span className="eyebrow">Opcional</span><b className="small" style={{ display: "block", marginTop: "0.2rem" }}>Sincronización cifrada entre dispositivos</b></span><span className="disclosure">Configurar</span></summary>
      <div className="stack" style={{ marginTop: "1rem" }}>
        <p className="tiny muted">Tus datos se cifran en este dispositivo con tu contraseña antes de subirse; el servidor solo guarda texto cifrado. La contraseña no se guarda: si la olvidas no hay forma de recuperar la copia remota.</p>
        <div className="grid-2">
          <Field label="Servidor"><input className="input" value={sync.endpoint} onChange={(event) => setSync({ ...sync, endpoint: event.target.value })} /></Field>
          <Field label="ID de sincronización"><input className="input" value={sync.syncId} placeholder="mi-plan" onChange={(event) => setSync({ ...sync, syncId: event.target.value })} /></Field>
          <Field label="Contraseña"><input className="input" type="password" autoComplete="new-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /></Field>
          <Field label="Confirmar contraseña"><input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></Field>
        </div>
        <div className="actions">
          <button className="btn" type="button" onClick={() => onSync("save", sync, passphrase, confirm)}>Guardar</button>
          <button className="btn" type="button" onClick={() => onSync("test", sync, passphrase, confirm)}>Probar conexión</button>
          <button className="btn primary" type="button" onClick={() => onSync("push", sync, passphrase, confirm)}>Subir</button>
          <button className="btn" type="button" onClick={() => onSync("pull", sync, passphrase, confirm)}>Bajar</button>
        </div>
      </div>
    </details>

    <section className="card stack">
      <div className="row between"><p className="eyebrow">App</p><span className="pill" aria-live="polite">{PWA_LABELS[pwaStatus]}</span></div>
      <p className="tiny muted">Actualizar no borra tus datos.</p>
      <div className="actions">
        <button className="btn" type="button" disabled={busy} onClick={onCheckUpdate}><RefreshCw size={16} />Buscar actualización</button>
        {pwaStatus === "available" ? <button className="btn primary" type="button" onClick={onApplyUpdate}>Actualizar ahora</button> : null}
        {canInstall ? <button className="btn" type="button" onClick={onInstall}>Instalar en este dispositivo</button> : null}
      </div>
    </section>
  </>;
}
