import { db } from "@/db/client";
import { holdings, market, portfolios, prices } from "@/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
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
import { runAgent } from "./onnxModel";

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

export async function loadSelectedPrices(
  tickers: string[],
): Promise<PriceRow[]> {
  if (tickers.length === 0) return [];
  return db
    .select({
      ticker: prices.ticker,
      date: prices.date,
      high: prices.high,
      low: prices.low,
      close: prices.close,
    })
    .from(prices)
    .where(inArray(prices.ticker, tickers))
    .orderBy(prices.date);
}

// Usata in assets
export type AssetCardData = {
  ticker: string;
  close: number[];
};

// Funzione per caricare i dati che mi serviranno per mostrare le card dei vari asset
// Usata i Asset card
export async function loadTicker(days = 90): Promise<AssetCardData[]> {
  const recent = await db
    .selectDistinct({ date: prices.date })
    .from(prices)
    .orderBy(desc(prices.date))
    .limit(days);

  if (recent.length === 0) return [];
  const cutoff = recent[recent.length - 1].date;

  const rows = await db
    .select({
      ticker: prices.ticker,
      close: prices.close,
      date: prices.date,
    })
    .from(prices)
    .where(gte(prices.date, cutoff))
    .orderBy(desc(prices.date));

  // Raggruppa per ticker, array diu close in ordine di data
  const byTicker = new Map<string, number[]>();
  for (const r of rows) {
    if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, []);
    byTicker.get(r.ticker)!.push(r.close);
  }
  return [...byTicker].map(([ticker, close]) => ({ ticker, close }));
}

export async function loadPortfolioTickers(
  portfolioId: number | null,
): Promise<string[]> {
  if (portfolioId == null) return [];

  const rows = await db
    .select({
      ticker: holdings.ticker,
    })
    .from(holdings)
    .where(eq(holdings.portfolio_id, portfolioId));

  // Estrae l'array piatto di ticker: ["AAPL", "MSFT", ...]
  return rows.map((r) => r.ticker);
}

// Restituisce ticker + peso di ogni titolo di un portafoglio.
export async function loadHoldings(
  portfolioId: number,
): Promise<{ ticker: string; weight: number }[]> {
  return db
    .select({ ticker: holdings.ticker, weight: holdings.weight })
    .from(holdings)
    .where(eq(holdings.portfolio_id, portfolioId));
}

// Metodi di allocazione dei pesi selezionabili dall'utente.
export type WeightMethod =
  | "equal"
  | "inverseVol"
  | "targetVol"
  | "kelly"
  | "agent";

export const WEIGHT_METHOD_LABEL: Record<WeightMethod, string> = {
  equal: "Equipesato",
  inverseVol: "Inverse Vol",
  targetVol: "Target Vol",
  kelly: "Kelly",
  agent: "Modello (DRL)",
};

// Calcola i pesi target col metodo scelto (NON scrive nel DB).
async function computeWeights(
  portfolioId: number,
  method: WeightMethod,
): Promise<Map<string, number>> {
  const tickers = await loadPortfolioTickers(portfolioId);
  const weightsByTicker = new Map<string, number>();
  if (tickers.length === 0) return weightsByTicker;

  if (method === "equal") {
    const w = 1 / tickers.length;
    tickers.forEach((t) => weightsByTicker.set(t, w));
  } else if (method === "agent") {
    // Pesi dal modello ONNX (DRL): inferenza one-shot sui dati correnti.
    const rows = await loadSelectedPrices(tickers);
    const marketRows = await loadMarket();
    const { tickers: aligned } = alignCandles(rows, marketRows);
    const inputs = computeFeature(rows, marketRows);
    const w = await runAgent(inputs); // pesi allineati all'ordine di alignCandles
    aligned.forEach((t, i) => weightsByTicker.set(t, Math.max(0, w[i] ?? 0)));
  } else {
    const rows = await loadSelectedPrices(tickers);
    const res = computeAllMethods(rows);
    if (!res) {
      throw new Error(
        "Dati insufficienti per calcolare i pesi (servono ≥126 giorni)",
      );
    }
    const arr =
      method === "inverseVol"
        ? res.inverseVol
        : method === "targetVol"
          ? res.targetVol
          : res.kelly;
    res.tickers.forEach((t, i) => weightsByTicker.set(t, arr[i]));
  }
  return weightsByTicker;
}

export type AllocationPlan = {
  method: WeightMethod;
  items: { ticker: string; weight: number }[]; // pesi target
  cost: number; // costo di ribilanciamento stimato
};

// Prepara (SENZA scrivere) il piano di allocazione: pesi target + costo di
// scambio = max(base_fees, turnover × capitale × commission_bps/10000).
// turnover = somma delle variazioni di peso rispetto all'allocazione attuale.
export async function computeMethodPlan(
  portfolioId: number,
  method: WeightMethod,
): Promise<AllocationPlan> {
  const [pf] = await db
    .select({
      cash: portfolios.cash,
      commission_bps: portfolios.commission_bps,
      base_fees: portfolios.base_fees,
    })
    .from(portfolios)
    .where(eq(portfolios.id, portfolioId));
  if (!pf) throw new Error("Portafoglio non trovato");

  const oldW = new Map(
    (await loadHoldings(portfolioId)).map((h) => [h.ticker, h.weight]),
  );
  const newW = await computeWeights(portfolioId, method);

  let turnover = 0;
  for (const t of newW.keys()) {
    turnover += Math.abs((newW.get(t) ?? 0) - (oldW.get(t) ?? 0));
  }

  const cost =
    turnover > 0
      ? Math.max(pf.base_fees, turnover * pf.cash * (pf.commission_bps / 10000))
      : 0;

  const items = [...newW].map(([ticker, weight]) => ({ ticker, weight }));
  return { method, items, cost };
}

// Applica DEFINITIVAMENTE un piano: salva i pesi e addebita il costo su fees_paid.
export async function commitAllocation(
  portfolioId: number,
  plan: AllocationPlan,
): Promise<void> {
  for (const it of plan.items) {
    await db
      .update(holdings)
      .set({ weight: it.weight })
      .where(
        and(
          eq(holdings.portfolio_id, portfolioId),
          eq(holdings.ticker, it.ticker),
        ),
      );
  }
  if (plan.cost > 0) {
    await db
      .update(portfolios)
      .set({ fees_paid: sql`${portfolios.fees_paid} + ${plan.cost}` })
      .where(eq(portfolios.id, portfolioId));
  }
}

// Utilizzato in portafolios
export type PortfolioRow = {
  id: number;
  name: string;
  cash: number;
  commission_bps: number;
  base_fees: number;
};

export async function deletePortfolio(portfolioId: number): Promise<void> {
  await db.delete(holdings).where(eq(holdings.portfolio_id, portfolioId));

  await db.delete(portfolios).where(eq(portfolios.id, portfolioId));
}

export async function deleteHolding(
  portfolioId: number,
  asset: string,
): Promise<void> {
  await db
    .delete(holdings)
    .where(
      and(eq(holdings.portfolio_id, portfolioId), eq(holdings.ticker, asset)),
    );
}

// Elenca tutti i portafogli salvati
// Usata in portfolios
export async function loadPortfolios(): Promise<PortfolioRow[]> {
  return db
    .select({
      id: portfolios.id,
      name: portfolios.name,
      cash: portfolios.cash,
      commission_bps: portfolios.commission_bps,
      base_fees: portfolios.base_fees,
    })
    .from(portfolios)
    .orderBy(portfolios.id);
}

// Crea un portafoglio e restituisce l'id generato dal DB,
export async function addPortfolio(
  name: string,
  commission: number,
  cash: number,
  base: number,
): Promise<number> {
  const [row] = await db
    .insert(portfolios)
    .values({
      name,
      commission_bps: commission,
      cash,
      base_fees: base,
    })
    .returning({ id: portfolios.id });
  return row.id;
}

// Aggiunge (o aggiorna) un asset in un portafoglio, salvando anche il
// prezzo di acquisto (entryPrice) per misurare il guadagno da quel momento.
export async function addAsset(
  portfolioId: number,
  asset: string,
  weight: number,
  entryPrice: number,
) {
  await db
    .insert(holdings)
    .values({
      portfolio_id: portfolioId,
      ticker: asset,
      weight,
      entry_price: entryPrice,
    })
    .onConflictDoUpdate({
      target: [holdings.portfolio_id, holdings.ticker],
      set: { weight, entry_price: entryPrice },
    });
}

export type PortfolioValue = {
  name: string;
  initialCash: number; // capitale iniziale ("quello che c'era")
  currentValue: number; // valore attuale = investimenti cresciuti + contante residuo
  generated: number; // guadagno/perdita generato dai titoli (currentValue - initialCash)
};

// Valore attuale del portafoglio con logica buy-and-hold:
// ogni titolo viene "comprato" con cash*weight al primo prezzo disponibile e
// cresce secondo il rapporto ultimoPrezzo/primoPrezzo; il capitale non investito
// (se i pesi non sommano a 1) resta come contante.
export async function loadPortfolioValue(
  portfolioId: number | null,
): Promise<PortfolioValue | null> {
  if (portfolioId == null) return null;

  const [pf] = await db
    .select({
      name: portfolios.name,
      cash: portfolios.cash,
      fees_paid: portfolios.fees_paid,
    })
    .from(portfolios)
    .where(eq(portfolios.id, portfolioId));
  if (!pf) return null;

  const hold = await db
    .select({
      ticker: holdings.ticker,
      weight: holdings.weight,
      entry_price: holdings.entry_price,
    })
    .from(holdings)
    .where(eq(holdings.portfolio_id, portfolioId));

  // portafoglio senza titoli: vale solo il contante iniziale
  if (hold.length === 0) {
    return {
      name: pf.name,
      initialCash: pf.cash,
      currentValue: pf.cash,
      generated: 0,
    };
  }

  // ultimo prezzo disponibile per ogni ticker
  const rows = await loadSelectedPrices(hold.map((h) => h.ticker));
  const lastClose = new Map<string, number>();
  for (const r of rows) lastClose.set(r.ticker, r.close);

  // Guadagno lordo dei titoli: importo (cash × peso) × (ultimoPrezzo/entry − 1).
  let gains = 0;
  for (const h of hold) {
    const amount = pf.cash * h.weight;
    const last = lastClose.get(h.ticker);
    const growth = h.entry_price > 0 && last ? last / h.entry_price : 1;
    gains += amount * (growth - 1);
  }

  // le commissioni sono quelle REALMENTE pagate nei ribilanciamenti (fees_paid)
  const generated = gains - pf.fees_paid;
  const currentValue = pf.cash + generated;

  return {
    name: pf.name,
    initialCash: pf.cash,
    currentValue,
    generated,
  };
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
