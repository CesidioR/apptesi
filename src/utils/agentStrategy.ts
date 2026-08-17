// Strategia dell'agente ONNX: stessa firma delle strategie classiche.
// Costruisce i 3 input dal contesto del backtest e chiama il modello on-device.
//
// IMPORTANTE: il modello è addestrato con CASH come asset. Aggiungiamo quindi
// un asset cash sintetico (prezzo piatto -> rendimento 0) all'input. Il modello
// lo riconosce come rifugio e ci alloca sotto stress = de-leva vero.
import { type Strategy } from "./backtest";
import { type CandleData } from "./finance";
import { buildModelInputs } from "./onnxFeatures";
import { runAgent } from "./onnxModel";

const DEBUG = false; // metti true per stampare i pesi dell'agente a ogni ribilanciamento

export const agentStrategy: Strategy = async (ctx) => {
  const nReal = ctx.candlesWindow.length;

  // Asset CASH: prezzo costante (ratio-normalizzato = 1 su tutti i 30 giorni),
  // stesso VIX per-giorno degli altri (broadcast). Rendimento implicito = 0.
  const cashCandles: CandleData[] = ctx.candlesWindow[0].map((c) => ({
    high: 1,
    low: 1,
    close: 1,
    vix: c.vix,
  }));

  const candlesWithCash = [...ctx.candlesWindow, cashCandles];
  const prevCash = 1 - ctx.prevWeights.reduce((a, b) => a + b, 0);
  const prevWithCash = [...ctx.prevWeights, Math.max(0, prevCash)];

  const inputs = buildModelInputs(
    candlesWithCash,
    prevWithCash,
    ctx.portfolioState,
    ctx.marketVol,
    ctx.vix,
  );

  const wAll = await runAgent(inputs); // N+1 pesi (ultimo = cash)
  const wReal = wAll.slice(0, nReal); // pesi sui titoli veri
  const cash = wAll[nReal] ?? 0;

  // --- LOG di debug (spento di default) ---
  if (DEBUG) {
    const dd = ctx.portfolioState.peakValue
      ? (ctx.portfolioState.peakValue - ctx.portfolioState.currentValue) /
        ctx.portfolioState.peakValue
      : 0;
    const invest = wReal.reduce((a, b) => a + b, 0);
    console.log(
      `[agent] invest=${(invest * 100).toFixed(0)}%  cash=${(cash * 100).toFixed(0)}%  ` +
        `dd=${(dd * 100).toFixed(1)}%  mktVol=${(ctx.marketVol * 100).toFixed(1)}%  ` +
        `vix=${ctx.vix.toFixed(1)}  pesi=[${wReal
          .map((w) => (w * 100).toFixed(0))
          .join(",")}]`,
    );
  }

  // somma < 1 -> il backtest mette il resto (= cash) a rendimento 0
  return wReal;
};
