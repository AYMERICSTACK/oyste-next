"use client";

import { useState } from "react";
import type { ApprovedStockmanSelection } from "@/lib/suppliers/stockman/global-import/approved-selection";

const api = "/api/admin/suppliers/stockman/global-import";

async function responseJson<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Requête refusée (${response.status}).`);
  return result as T;
}

export default function StockmanQaImport() {
  const [file, setFile] = useState<File | null>(null);
  const [selection, setSelection] = useState<ApprovedStockmanSelection>([]);
  const [runId, setRunId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Sélectionnez la capture approuvée.");

  async function prepare() {
    if (!file) return;
    setBusy(true);
    try {
      const result = await responseJson<{selection:ApprovedStockmanSelection;seeded:number;alreadySeeded:number;referenceReplacements:number}>(
        await fetch(api + "/qa-capture", {method:"POST",headers:{"Content-Type":"application/json"},body:await file.text()}),
      );
      setSelection(result.selection);
      setRunId("");
      setMessage(`Capture vérifiée. ${result.selection.length} familles. ${result.seeded} tarifs de test initialisés, ${result.alreadySeeded} déjà identiques. ${result.referenceReplacements} anciens codes protégés.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Préparation en échec.");
    } finally {
      setBusy(false);
    }
  }

  async function run(resume: boolean) {
    if (!selection.length) return;
    setBusy(true);
    const post = async <T,>(data: object) => responseJson<T>(await fetch(api, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({...data,confirmation:"APPLY_DRAFTS_V297"}),
    }));
    try {
      const id = resume ? runId : (await post<{runId:string}>({action:"start",selection})).runId;
      setRunId(id);
      let created = 0;
      let blocked = 0;
      for (let i = 0; i <= selection.length; i++) {
        const result = await post<{done?:boolean;created?:string;blocked?:string}>({action:"step",runId:id});
        if (result.done) break;
        if (result.created) created++;
        if (result.blocked) blocked++;
        setMessage(`Lot ${id} · ${created} familles créées, ${blocked} bloquées pendant cette exécution.`);
      }
      setMessage(`Lot ${id} terminé. ${created} familles créées, ${blocked} bloquées pendant cette exécution.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import en échec.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="space-y-5 p-6">
    <h1 className="text-xl font-bold">Import STOCKMAN en recette isolée</h1>
    <p>Les données capturées servent à tester les brouillons. Les tarifs existants sont comparés et conservés.</p>
    <label className="block">Capture autorisée <input type="file" accept=".json,application/json" disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={!file || busy} className="rounded border px-3 py-2 disabled:opacity-50" onClick={() => void prepare()}>Vérifier et préparer la capture</button>
      <button type="button" disabled={!selection.length || busy} className="rounded border px-3 py-2 disabled:opacity-50" onClick={() => void run(false)}>Créer les brouillons du périmètre</button>
      <button type="button" disabled={!runId || busy} className="rounded border px-3 py-2 disabled:opacity-50" onClick={() => void run(true)}>Rejouer le même lot</button>
    </div>
    <p role="status">{message}</p>
  </main>;
}
