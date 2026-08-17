import { db } from "@/db/client";
import { market, prices } from "@/db/schema";
import {
  alignCandles,
  alignCloses,
  basketReturns,
  computeMarketVol,
  computeReturns,
  covarianceMatrix,
  inverseVolatility,
  kelly,
  MarketRow,
  marketVolFromPrices,
  meanVector,
  PriceRow,
  targetVolatility,
} from "./finance";
import { buildModelInputs, ModelInputs } from "./onnxFeatures";

export async function loadPrices(): Promise<PriceRow[]> {
  return db
    .select({
      ticker: prices.ticker,
      date: prices.date,
      high: prices.high,
      low: prices.low,
      close: prices.close,
    })
    .from(prices)
    .orderBy(prices.date);
}

export async function loadMarket(): Promise<MarketRow[]> {
  return db
    .select({ vix: market.vix, date: market.date })
    .from(market)
    .orderBy(market.date);
}
export type MethodsResult = {
  tickers: string[];
  sigmaMkt: number;
  inverseVol: number[];
  kelly: number[];
  targetVol: number[];
};

export function computeAllMethods(rows: PriceRow[]): MethodsResult | null {
  const { closesByAsset, tickers } = alignCloses(rows);
  const returnsFull = closesByAsset.map(computeReturns);
  if (returnsFull.length === 0 || returnsFull[0].length < 126) {
    console.log("Dati insufficienti");
    return null;
  }
  const returns126 = returnsFull.map((r) => r.slice(-126));
  const mu = meanVector(returns126);
  const cov = covarianceMatrix(returns126);
  const inverseVol = inverseVolatility(returns126);
  const kel = kelly(mu, cov);
  const n = tickers.length;
  const wEq = Array(n).fill(1 / n);
  const targetVol = targetVolatility(wEq, cov);
  const sigmaMkt = computeMarketVol(basketReturns(returnsFull), 21);
  return { tickers, sigmaMkt, inverseVol, kelly: kel, targetVol };
}

// Costruisce i 3 input del modello per una previsione "one-shot" (giorno corrente).
// prevWeights opzionale: se assente, si assume equipesato.
export function computeFeature(
  priceRows: PriceRow[],
  marketRows: MarketRow[],
  prevWeights?: number[],
): ModelInputs {
  const { candlesByAsset } = alignCandles(priceRows, marketRows);
  const n = candlesByAsset.length;
  if (n === 0 || candlesByAsset[0].length < 30) {
    throw new Error("Dati insufficienti: servono almeno 30 candele per asset");
  }

  // ultimi 30 candle per asset (finestra del modello)
  const window = candlesByAsset.map((c) => c.slice(-30));
  // se prevWeights non c'è si parte da un paniere equipesato
  const prev = prevWeights ?? new Array<number>(n).fill(1 / n);

  // stato portafoglio neutro per una previsione one-shot (nessuna posizione pregressa)
  const pf = {
    peakValue: 1,
    currentValue: 1,
    daysSincePeak: 0,
    portfolioReturns: [] as number[],
  };

  const marketVol = marketVolFromPrices(priceRows, 21);
  const vix = window[0][window[0].length - 1].vix; // VIX più recente (broadcast)

  return buildModelInputs(window, prev, pf, marketVol, vix);
}
