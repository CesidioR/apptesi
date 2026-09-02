// =====================================================================
//  backtest.ts — motore di backtest walk-forward (no look-ahead), ASYNC.
//  Ogni strategia riceve un CONTESTO ricco (rendimenti, candele, stato
//  del portafoglio) e ritorna i pesi. Stessa firma per classici e agente.
// =====================================================================

import {
  alignCandles,
  basketReturns,
  type CandleData,
  computeMarketVol,
  computeReturns,
  covarianceMatrix,
  inverseVolatility,
  kelly,
  type MarketRow,
  meanVector,
  type PriceRow,
  sampleStd,
  targetVolatility,
} from "./finance";
import { type PortfolioState } from "./onnxFeatures";

// Contesto passato alla strategia a ogni ribilanciamento (solo dati PASSATI).
export type StrategyContext = {
  returnsWindow: number[][]; // [asset][giorno], per i metodi classici (len = window)
  candlesWindow: CandleData[][]; // [asset][giorno], per l'agente (len = agentWindow=30)
  prevWeights: number[]; // pesi correnti
  portfolioState: PortfolioState; // per risk_state dell'agente
  marketVol: number; // vol paniere equipesato (21g)
  vix: number; // VIX più recente
};

// Una strategia può essere sincrona (classici) o async (agente ONNX).
export type Strategy = (ctx: StrategyContext) => number[] | Promise<number[]>;

export type BacktestMetrics = {
  totalReturn: number;
  annReturn: number;
  annVol: number;
  sharpe: number;
  maxDrawdown: number;
};

export type BacktestResult = {
  dates: string[];
  equity: number[];
  weights: number[][]; // [passo][asset]: composizione del portafoglio nel tempo
  tickers: string[]; // ordine degli asset (colonne di `weights`)
  metrics: BacktestMetrics;
};

export type BacktestOptions = {
  window?: number; // finestra metodi classici (default 126)
  agentWindow?: number; // finestra candele per l'agente (default 30)
  rebalanceEvery?: number; // giorni tra ribilanciamenti (default 21)
  commissionBps?: number; // costo per unità di turnover (default 10)
  initialCash?: number; // capitale iniziale (default 1)
};

export async function backtest(
  rows: PriceRow[],
  marketRows: MarketRow[],
  strategy: Strategy,
  opts: BacktestOptions = {},
): Promise<BacktestResult> {
  const {
    window = 126,
    agentWindow = 30,
    rebalanceEvery = 1,
    commissionBps = 10,
    initialCash = 1,
  } = opts;

  // Allineamento UNICO (candele con VIX) per tutte le strategie -> confronto equo.
  const { candlesByAsset, dates, tickers } = alignCandles(rows, marketRows);
  const n = candlesByAsset.length;
  const closesByAsset = candlesByAsset.map((c) => c.map((x) => x.close));
  const returnsByAsset = closesByAsset.map(computeReturns);
  const T = n > 0 ? returnsByAsset[0].length : 0; // num rendimenti
  // returnsByAsset[i][r] = rendimento del giorno r; candela al price-index r = candlesByAsset[i][r].

  const cost = commissionBps / 10000;
  const equity: number[] = [];
  const dateCurve: string[] = [];
  const weightsCurve: number[][] = []; // pesi ad ogni passo (allineati a equity/date)

  let cash = initialCash;
  let weights = new Array<number>(n).fill(0); // frazioni investite (resto = cash)
  let peak = cash;
  let daysSincePeak = 0;
  const portfolioReturns: number[] = []; // rp giornalieri (per risk_state)

  equity.push(cash);
  dateCurve.push(dates[window] ?? "");
  weightsCurve.push(weights.slice());

  for (let r = window; r < T; r++) {
    // --- ribilanciamento: la strategia vede SOLO il passato (fino a price-index r) ---
    if ((r - window) % rebalanceEvery === 0) {
      const returnsWindow = returnsByAsset.map((a) => a.slice(r - window, r));
      const candlesWindow = candlesByAsset.map((c) =>
        c.slice(r - agentWindow + 1, r + 1),
      ); // ultime `agentWindow` candele fino a r (no look-ahead)

      const marketVol = computeMarketVol(basketReturns(returnsWindow), 21);
      const vix = candlesWindow[0]?.[candlesWindow[0].length - 1]?.vix ?? 0;

      const ctx: StrategyContext = {
        returnsWindow,
        candlesWindow,
        prevWeights: weights.slice(),
        portfolioState: {
          peakValue: peak,
          currentValue: cash,
          daysSincePeak,
          portfolioReturns: portfolioReturns.slice(),
        },
        marketVol,
        vix,
      };

      const target = await strategy(ctx);
      let turnover = 0;
      for (let i = 0; i < n; i++) turnover += Math.abs(target[i] - weights[i]);
      cash *= 1 - turnover * cost;
      weights = target.slice();
    }

    // --- rendimento del portafoglio del giorno r (non visto dalla strategia) ---
    let rp = 0;
    for (let i = 0; i < n; i++) rp += weights[i] * returnsByAsset[i][r];
    cash *= 1 + rp;
    portfolioReturns.push(rp);

    // aggiorna picco / tempo sott'acqua
    if (cash > peak) {
      peak = cash;
      daysSincePeak = 0;
    } else {
      daysSincePeak++;
    }

    // drift dei pesi (buy & hold fino al prossimo ribilanciamento)
    if (1 + rp !== 0) {
      for (let i = 0; i < n; i++) {
        weights[i] = (weights[i] * (1 + returnsByAsset[i][r])) / (1 + rp);
      }
    }

    equity.push(cash);
    dateCurve.push(dates[r + 1] ?? "");
    weightsCurve.push(weights.slice());
  }

  return {
    dates: dateCurve,
    equity,
    weights: weightsCurve,
    tickers,
    metrics: computeMetrics(equity),
  };
}

function computeMetrics(equity: number[]): BacktestMetrics {
  if (equity.length < 2) {
    return {
      totalReturn: 0,
      annReturn: 0,
      annVol: 0,
      sharpe: 0,
      maxDrawdown: 0,
    };
  }
  const daily: number[] = [];
  for (let t = 1; t < equity.length; t++)
    daily.push(equity[t] / equity[t - 1] - 1);

  const totalReturn = equity[equity.length - 1] / equity[0] - 1;
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  const vol = sampleStd(daily);
  const annVol = vol * Math.sqrt(252);
  const sharpe = vol === 0 ? 0 : (mean / vol) * Math.sqrt(252); // rf = 0
  const years = daily.length / 252;
  const annReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

  let peak = equity[0];
  let maxDrawdown = 0;
  for (const e of equity) {
    if (e > peak) peak = e;
    const dd = (peak - e) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }
  return { totalReturn, annReturn, annVol, sharpe, maxDrawdown };
}

// ---- Strategie classiche (usano solo ctx.returnsWindow) ----------------

export const strategies: Record<string, Strategy> = {
  equalWeight: (ctx) => {
    const n = ctx.returnsWindow.length;
    return new Array<number>(n).fill(1 / n);
  },
  inverseVol: (ctx) => inverseVolatility(ctx.returnsWindow),
  kelly: (ctx) =>
    kelly(meanVector(ctx.returnsWindow), covarianceMatrix(ctx.returnsWindow)),
  targetVol: (ctx) => {
    const n = ctx.returnsWindow.length;
    return targetVolatility(
      new Array<number>(n).fill(1 / n),
      covarianceMatrix(ctx.returnsWindow),
    );
  },
};
