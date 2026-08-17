// =====================================================================
//  onnxModel.ts — caricamento e inferenza del modello dnamm.onnx
//  Singleton di modulo: il modello si carica UNA volta e resta
//  accessibile da qualunque parte (anche fuori da React).
// =====================================================================

import { Asset } from "expo-asset";
import { InferenceSession, Tensor } from "onnxruntime-react-native";
import { type ModelInputs, type TensorData } from "./onnxFeatures";

let session: InferenceSession | null = null;
let loadingPromise: Promise<InferenceSession> | null = null;

// Carica il modello una sola volta (idempotente). Chiamalo all'avvio dell'app.
export async function loadModel(): Promise<InferenceSession> {
  if (session) return session;
  if (loadingPromise) return loadingPromise; // evita caricamenti concorrenti

  loadingPromise = (async () => {
    const asset = Asset.fromModule(require("../../assets/dnamm.onnx"));
    await asset.downloadAsync(); // rende disponibile il file in locale
    if (!asset.localUri)
      throw new Error("Asset ONNX non trovato (localUri null)");
    session = await InferenceSession.create(asset.localUri);
    return session;
  })();

  return loadingPromise;
}

export function getSession(): InferenceSession | null {
  return session;
}

function toTensor(t: TensorData): Tensor {
  return new Tensor("float32", t.data, t.dims);
}

// Esegue l'agente: dai 3 input costruiti -> pesi del portafoglio (number[]).
// Usato in agentStrategy,
export async function runAgent(inputs: ModelInputs): Promise<number[]> {
  const s = session ?? (await loadModel());

  const feeds: Record<string, Tensor> = {
    features: toTensor(inputs.features),
    prev_weights: toTensor(inputs.prev_weights),
    risk_state: toTensor(inputs.risk_state),
  };

  const out = await s.run(feeds);
  const w = out.portfolio_weights.data as Float32Array;
  return Array.from(w);
}
