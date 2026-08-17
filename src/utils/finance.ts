// Deviazione standard campionaria (divide per n-1). Ritorna 0 se n < 2.
export function sampleStd(values: number[]): number {
  const n: number = values.length;
  if (n < 2) return 0;
  const somma: number = values.reduce((acc, x) => acc + x, 0);
  const mean = somma / n;
  const sumSq: number = values.reduce(
    (acc, x) => acc + Math.pow(x - mean, 2),
    0,
  );
  return Math.sqrt(sumSq / (n - 1)); // n-1, NON n
}

// Rendimenti semplici di una serie di prezzi (ordinata per data crescente).
export function computeReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    r.push(closes[i] / closes[i - 1] - 1);
  }
  return r;
}

// Rendimento del paniere equipesato: per ogni giorno, media dei rendimenti
// degli asset. Richiede una matrice [asset][giorno] gia' allineata per data.
export function basketReturns(returnsByAsset: number[][]): number[] {
  const numAsset = returnsByAsset.length;
  if (numAsset === 0) return [];
  const numDays = returnsByAsset[0].length;
  const medie: number[] = [];
  for (let i = 0; i < numDays; i++) {
    let somma = 0;
    for (let j = 0; j < numAsset; j++) somma += returnsByAsset[j][i];
    medie.push(somma / numAsset);
  }
  return medie;
}

// Volatilita' di mercato annualizzata sugli ultimi `window` giorni.
export function computeMarketVol(basket: number[], window = 21): number {
  const w = basket.slice(-window); // ultimi `window`
  if (w.length < 2) return 0;
  return sampleStd(w) * Math.sqrt(252);
}

export type PriceRow = {
  ticker: string;
  date: string;
  high: number;
  low: number;
  close: number;
};

export type MarketRow = {
  vix: number;
  date: string;
};

export interface CandleData {
  high: number;
  low: number;
  close: number;
  vix: number;
}
// Allinea i CLOSE dei vari ticker sulle SOLE date comuni a tutti (intersezione),
// ordinate crescenti. Usato da tutta la logica numerica (rendimenti, metodi).
export function alignCloses(rows: PriceRow[]): {
  dates: string[];
  closesByAsset: number[][];
  tickers: string[];
} {
  // ticker -> (date -> close)
  const byTicker = new Map<string, Map<string, number>>();
  for (const { ticker, date, close } of rows) {
    if (!byTicker.has(ticker)) byTicker.set(ticker, new Map());
    byTicker.get(ticker)!.set(date, close);
  }

  const tickers = [...byTicker.keys()];
  if (tickers.length === 0)
    return { dates: [], closesByAsset: [], tickers: [] };

  // intersezione delle date (presenti in ogni ticker)
  const [first, ...rest] = tickers;
  let common = [...byTicker.get(first)!.keys()];
  for (const tk of rest) {
    const m = byTicker.get(tk)!;
    common = common.filter((d) => m.has(d));
  }
  common.sort(); // stringhe ISO 'YYYY-MM-DD' -> ordine cronologico

  const closesByAsset = tickers.map((tk) => {
    const m = byTicker.get(tk)!;
    return common.map((d) => m.get(d)!);
  });

  return { dates: common, closesByAsset, tickers };
}

// Allinea OHLC + VIX per il MODELLO ONNX. Il VIX (market-level) e' preso dalla
// tabella market e "broadcast" su ogni asset (col 3 delle feature).
// candlesByAsset[i][d] = candela {high, low, close, vix} dell'asset i nel giorno d.
export function alignCandles(
  priceRows: PriceRow[],
  marketRows: MarketRow[],
): { dates: string[]; candlesByAsset: CandleData[][]; tickers: string[] } {
  // ticker -> (date -> {high, low, close})
  const byTicker = new Map<
    string,
    Map<string, { high: number; low: number; close: number }>
  >();
  for (const { ticker, date, high, low, close } of priceRows) {
    if (!byTicker.has(ticker)) byTicker.set(ticker, new Map());
    byTicker.get(ticker)!.set(date, { high, low, close });
  }

  // date -> vix (market-level)
  const vixByDate = new Map<string, number>();
  for (const { date, vix } of marketRows) vixByDate.set(date, vix);

  const tickers = [...byTicker.keys()];
  if (tickers.length === 0)
    return { dates: [], candlesByAsset: [], tickers: [] };

  // intersezione: date presenti in OGNI ticker E con VIX disponibile
  const [first, ...rest] = tickers;
  let common = [...byTicker.get(first)!.keys()];
  for (const tk of rest) {
    const m = byTicker.get(tk)!;
    common = common.filter((d) => m.has(d));
  }
  common = common.filter((d) => vixByDate.has(d)); // solo date con VIX
  common.sort();

  const candlesByAsset = tickers.map((tk) => {
    const m = byTicker.get(tk)!;
    return common.map<CandleData>((d) => {
      const c = m.get(d)!;
      const vix = vixByDate.get(d)!; // stesso VIX per ogni asset (broadcast)
      return { high: c.high, low: c.low, close: c.close, vix };
    });
  });

  return { dates: common, candlesByAsset, tickers };
}

// Dai prezzi grezzi (righe da SQLite) direttamente a sigma_mkt.
export function marketVolFromPrices(rows: PriceRow[], window = 21): number {
  const { closesByAsset } = alignCloses(rows);
  const returnsByAsset = closesByAsset.map(computeReturns);
  const basket = basketReturns(returnsByAsset);
  return computeMarketVol(basket, window);
}

export function meanVector(returnsByAsset: number[][]): number[] {
  const numAssets = returnsByAsset.length;
  const numDays = returnsByAsset[0].length;
  const meanVector: number[] = [];
  for (let i = 0; i < numAssets; i++) {
    let somma: number = 0;
    for (let j = 0; j < numDays; j++) {
      somma += returnsByAsset[i][j];
    }
    meanVector.push(somma / numDays);
  }

  return meanVector;
}

export function covarianceMatrix(returnsByAsset: number[][]): number[][] {
  const mu = meanVector(returnsByAsset);
  const numAssets = returnsByAsset.length;
  const numDays = returnsByAsset[0].length;
  const covMatrix: number[][] = [];
  for (let i = 0; i < numAssets; i++) {
    covMatrix[i] = [];
    for (let j = 0; j < numAssets; j++) {
      let prod = 0;
      for (let z = 0; z < numDays; z++) {
        const first = returnsByAsset[i][z] - mu[i];
        const second = returnsByAsset[j][z] - mu[j];
        prod += first * second;
      }
      covMatrix[i][j] = prod / (numDays - 1);
    }
  }
  return covMatrix;
}

export function matVec(M: number[][], v: number[]): number[] {
  const vec: number[] = [];
  for (let i = 0; i < M.length; i++) {
    vec[i] = 0;
    for (let j = 0; j < v.length; j++) {
      vec[i] += M[i][j] * v[j];
    }
  }
  return vec;
}

export function quadForm(v: number[], M: number[][]): number {
  const mv = matVec(M, v);
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * mv[i]; // vᵀ·(M·v)
  return s;
}

// Inversione via Gauss-Jordan con pivoting parziale. Lancia se singolare.
export function invertMatrix(A: number[][]): number[][] {
  const n = A.length;
  // matrice aumentata [A | I]
  const M: number[][] = A.map((row, i) => [
    ...row,
    // crea un array di n elementi da agigungere come colonna avrà 1 sulla diagonale
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    // pivoting parziale: riga col valore assoluto massimo nella colonna (stabilita')
    let pivot = col;
    // Cerca nella colonna corrente la riga che contiene il valore assoluto più grande.
    // Scambia la riga corrente con la riga contenente il pivot massimo.
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) {
      throw new Error(
        "Matrice singolare: impossibile invertire (serve shrinkage)",
      );
    }
    [M[col], M[pivot]] = [M[pivot], M[col]]; // scambia righe

    // normalizza la riga pivot
    const d = M[col][col];
    // Divide tutti gli elementi della riga per il pivot d, portando il valore della diagonale principale a 1
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d;

    // azzera la colonna 'col' in tutte le altre righe
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= factor * M[col][j];
    }
  }

  return M.map((row) => row.slice(n)); // meta' destra = A⁻¹
}

// ---- Metodi di position sizing ----------------------------------------

// Inverse Volatility: w_i = (1/σ_i) / Σ_j(1/σ_j). Sempre pienamente investito.
export function inverseVolatility(returnsByAsset: number[][]): number[] {
  const inv = returnsByAsset.map((r) => {
    const s = sampleStd(r); // calcola la deviazione standard
    return s === 0 ? 0 : 1 / s; // guard divisione per zero e calcolo reciprocità
  });
  const tot = inv.reduce((a, b) => a + b, 0); // somma tutti i valori nell'array
  if (tot === 0) return inv.map(() => 0);
  return inv.map((x) => x / tot); // normalizza a somma 1
}

// Kelly multiasset: f* = Σ⁻¹ μ, con shrinkage, half-Kelly, long-only, cap leva.
export function kelly(
  mu: number[],
  cov: number[][],
  opts: { shrink?: number; halfKelly?: boolean; maxLeverage?: number } = {},
): number[] {
  const { shrink = 0.15, halfKelly = true, maxLeverage = 2 } = opts;
  // Regolarizzazione della matrice
  // Σ_shrunk = (1-δ)Σ + δ·diag(Σ): diagonale invariata, fuori-diagonale × (1-δ)
  const shrunk = cov.map((row, i) =>
    row.map((v, j) => (i === j ? v : (1 - shrink) * v)),
  );
  const covInv = invertMatrix(shrunk);
  let f = matVec(covInv, mu); // f* = Σ⁻¹ μ
  f = f.map((x) => Math.max(0, x)); // long-only
  const gross = f.reduce((a, b) => a + b, 0);
  if (gross > maxLeverage) f = f.map((x) => (x * maxLeverage) / gross); // cap
  if (halfKelly) f = f.map((x) => x / 2); // half-Kelly  il cap
  return f;
}

// Target Volatility di PORTAFOGLIO: scala wBase per avvicinarsi al target,
// senza superare il 100% (nessuna leva). σ_target di default 9.7% annuo.
export function targetVolatility(
  wBase: number[],
  cov: number[][],
  sigmaTargetAnnual = 0.097, // 2.8% mensile ~ 9.7% annuo
): number[] {
  const sigmaDaily = Math.sqrt(quadForm(wBase, cov)); // σ_port giornaliera
  const sigmaAnnual = sigmaDaily * Math.sqrt(252); // annualizza
  const scale =
    sigmaAnnual === 0 ? 1 : Math.min(1, sigmaTargetAnnual / sigmaAnnual);
  return wBase.map((w) => w * scale); // resto -> cash
}
