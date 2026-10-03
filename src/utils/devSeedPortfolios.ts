// SEED DI TEST (temporaneo): crea tre portafogli di prova per sviluppo/demo.
//  - "Test — oggi":      titoli con prezzo di carico = oggi (P&L ~ 0)
//  - "Test — vuoto":     nessun titolo
//  - "Test — 1 mese fa": prezzo di carico ~1 mese fa (mostra il P&L del mese)
// Idempotente: se esistono gia' portafogli "Test — ..." non fa nulla.
// RIMUOVERE la chiamata (in _layout) e questo file quando non serve piu'.
import { db } from "@/db/client";
import { prices } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { addAsset, addPortfolio, loadPortfolios } from "./portfolioMethods";

const CASH = 10000; // capitale iniziale dei portafogli di test

export async function seedTestPortfolios(): Promise<void> {
  const existing = await loadPortfolios();
  if (existing.some((p) => p.name.startsWith("Test —"))) return; // gia' creati

  // 4 ticker effettivamente presenti nel DB
  const tks = (
    await db.selectDistinct({ t: prices.ticker }).from(prices).limit(4)
  ).map((r) => r.t);
  if (tks.length === 0) return; // nessun dato: niente da fare

  // date disponibili in ordine decrescente (la prima e' "oggi")
  const dates = (
    await db
      .selectDistinct({ d: prices.date })
      .from(prices)
      .orderBy(desc(prices.date))
      .limit(40)
  ).map((r) => r.d);
  const today = dates[0];
  const monthAgo = dates[Math.min(21, dates.length - 1)]; // ~1 mese di borsa

  // prezzo di chiusura dei ticker a una certa data
  const closeAt = async (date: string) => {
    const rows = await db
      .select({ ticker: prices.ticker, close: prices.close })
      .from(prices)
      .where(and(eq(prices.date, date), inArray(prices.ticker, tks)));
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.ticker, r.close);
    return m;
  };
  const todayClose = await closeAt(today);
  const monthClose = await closeAt(monthAgo);
  const w = 1 / tks.length; // equipesato

  // 1) comprati oggi: entry = prezzo di oggi -> nessun guadagno ancora
  const idToday = await addPortfolio("Test — oggi", 0, CASH, 0);
  for (const t of tks) await addAsset(idToday, t, w, todayClose.get(t) ?? 0);

  // 2) vuoto: nessun titolo
  await addPortfolio("Test — vuoto", 0, CASH, 0);

  // 3) comprati ~1 mese fa: entry = prezzo di un mese fa -> mostra il P&L
  const idMonth = await addPortfolio("Test — 1 mese fa", 0, CASH, 0);
  for (const t of tks) await addAsset(idMonth, t, w, monthClose.get(t) ?? 0);

  console.log("Seed portafogli di test creato:", tks.join(", "));
}
