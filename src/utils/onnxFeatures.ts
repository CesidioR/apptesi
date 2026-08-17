// =====================================================================
//  onnxFeatures.ts — costruzione dei 3 input del modello dnamm.onnx
//  Funzioni PURE (ritornano {data, dims}); i Tensor si creano a valle,
//  dove si chiama session.run, cosi' questo file resta testabile.
//
//  Contratto (feature_contract.json):
//    features     [1, N, 30, 4]  GREZZO  [high, low, close, vix]
//    prev_weights [1, N]
//    risk_state   [1, 6]         gia' trasformato dall'app
// =====================================================================

import { type CandleData, sampleStd } from "./finance";

export type TensorData = { data: Float32Array; dims: number[] };

export const WINDOW_DAYS = 30;
export const RISK_VOL_WINDOW = 21;

// _log_scale del training: clip(log1p(max(x,0)), 0, cap).
export function logScale(x: number, cap = 5): number {
  return Math.min(Math.max(Math.log1p(Math.max(x, 0)), 0), cap);
}

// -------- features [1, N, 30, 4] : GREZZO [high, low, close, vix] --------
// candlesWindow[a] = candele dell'asset a per la finestra (lunghezza esatta = windowDays).
export function buildFeatures(
  candlesWindow: CandleData[][],
  windowDays = WINDOW_DAYS,
): TensorData {
  const N = candlesWindow.length;
  const F = 4;
  const data = new Float32Array(N * windowDays * F); // layout row-major [1,N,30,4]
  let k = 0;
  for (let a = 0; a < N; a++) {
    const series = candlesWindow[a];
    for (let d = 0; d < windowDays; d++) {
      const c = series[d];
      data[k++] = c.high; // col 0
      data[k++] = c.low; // col 1
      data[k++] = c.close; // col 2
      data[k++] = c.vix; // col 3 (broadcast, gia' dentro la candela)
    }
  }
  return { data, dims: [1, N, windowDays, F] };
}

// -------- prev_weights [1, N] --------
export function buildPrevWeights(weights: number[]): TensorData {
  return { data: Float32Array.from(weights), dims: [1, weights.length] };
}

// -------- risk_state [1, 6] --------
// Dipende dallo STATO del portafoglio dell'agente (equity curve).
export type PortfolioState = {
  peakValue: number; // massimo storico dell'equity
  currentValue: number; // valore attuale
  daysSincePeak: number; // giorni dall'ultimo picco
  portfolioReturns: number[]; // rendimenti semplici del portafoglio (storia)
};

// marketVol = vol annualizzata del paniere equipesato su RISK_VOL_WINDOW giorni.
// vix = VIX grezzo corrente.
export function buildRiskState(
  pf: PortfolioState,
  marketVol: number,
  vix: number,
): TensorData {
  const drawdown =
    pf.peakValue > 0 ? (pf.peakValue - pf.currentValue) / pf.peakValue : 0;

  const win = pf.portfolioReturns.slice(-RISK_VOL_WINDOW);
  const pvol = win.length >= 2 ? sampleStd(win) * Math.sqrt(252) : 0;

  const tuw = pf.daysSincePeak / 252;

  const rs = [
    Math.min(Math.max(drawdown, 0), 1), // [0] drawdown, clip [0,1]
    logScale(pvol), // [1] portfolio_vol (log-scaled)
    logScale(tuw), // [2] time_underwater (log-scaled)
    logScale(marketVol), // [3] market_vol compresso
    vix / 100, // [4] vix / 100
    Math.min(Math.max(marketVol, 0), 3), // [5] market_vol grezzo, clip [0,3]
  ];
  return { data: Float32Array.from(rs), dims: [1, 6] };
}

// -------- convenience: i 3 input insieme --------
export type ModelInputs = {
  features: TensorData;
  prev_weights: TensorData;
  risk_state: TensorData;
};

export function buildModelInputs(
  candlesWindow: CandleData[][],
  prevWeights: number[],
  pf: PortfolioState,
  marketVol: number,
  vix: number,
): ModelInputs {
  return {
    features: buildFeatures(candlesWindow),
    prev_weights: buildPrevWeights(prevWeights),
    risk_state: buildRiskState(pf, marketVol, vix),
  };
}
