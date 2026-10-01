// =====================================================================
//  onnxModel.ts — caricamento e inferenza dei modelli DRL.
//  Un modello ONNX per ciascun target di volatilita' (15/20/25%).
//  Ogni sessione si carica UNA volta (lazy) e resta in cache.
// =====================================================================

import { Asset } from "expo-asset";
import { InferenceSession, Tensor } from "onnxruntime-react-native";
import { type AgentTarget, getModelTarget } from "./agentConfig";
import { type ModelInputs, type TensorData } from "./onnxFeatures";

// Un file per target. require() statico: Metro non fa require dinamici.
const MODEL_MODULES: Record<AgentTarget, number> = {
  15: require("../../assets/dnamm_tv15.onnx"),
  20: require("../../assets/dnamm_tv20.onnx"),
  25: require("../../assets/dnamm_tv25.onnx"),
};

const sessions: Partial<Record<AgentTarget, InferenceSession>> = {};
const loading: Partial<Record<AgentTarget, Promise<InferenceSession>>> = {};

// Carica (una sola volta per target) il modello richiesto. Chiamalo all'avvio
// per pre-caricare il default; gli altri target si caricano alla prima inferenza.
export async function loadModel(
  target: AgentTarget = getModelTarget(),
): Promise<InferenceSession> {
  const cached = sessions[target];
  if (cached) return cached;
  const inflight = loading[target];
  if (inflight) return inflight; // evita caricamenti concorrenti dello stesso modello

  const p = (async () => {
    const asset = Asset.fromModule(MODEL_MODULES[target]);
    await asset.downloadAsync(); // rende disponibile il file in locale
    if (!asset.localUri)
      throw new Error(`Asset ONNX non trovato (target ${target}, localUri null)`);
    const created = await InferenceSession.create(asset.localUri);
    sessions[target] = created;
    return created;
  })();

  loading[target] = p;
  return p;
}

function toTensor(t: TensorData): Tensor {
  return new Tensor("float32", t.data, t.dims);
}

// Esegue l'agente col modello del target corrente (o quello passato).
// Usato in agentStrategy e nel ramo agent di computeWeights.
export async function runAgent(
  inputs: ModelInputs,
  target: AgentTarget = getModelTarget(),
): Promise<number[]> {
  const s = sessions[target] ?? (await loadModel(target));

  const feeds: Record<string, Tensor> = {
    features: toTensor(inputs.features),
    prev_weights: toTensor(inputs.prev_weights),
    risk_state: toTensor(inputs.risk_state),
  };

  const out = await s.run(feeds);
  const w = out.portfolio_weights.data as Float32Array;
  return Array.from(w);
}
