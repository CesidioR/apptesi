// Scarica i prezzi freschi dal repo GitHub (aggiornato ogni giorno dal workflow)
// e li inserisce in SQLite.
//  - THROTTLE: si sincronizza al massimo UNA volta al giorno (tabella `meta`).
//  - FINESTRA MOBILE: dopo l'upsert elimina le date piu' vecchie della data
//    minima del JSON (il JSON e' sempre "ultimi 3 anni"), cosi' i giorni piu'
//    lontani escono man mano che entrano quelli nuovi.
import { db, expoDb } from "@/db/client";
import { market, prices } from "@/db/schema";
import { lt } from "drizzle-orm";

const URL =
  "https://raw.githubusercontent.com/CesidioR/apptesi/main/data/prices.json";

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

export async function syncPrices() {
  // --- throttle: max 1 volta al giorno ---
  await expoDb.execAsync(
    `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);`,
  );
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const last = await expoDb.getFirstAsync<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'lastSync'`,
  );
  if (last?.value === today) {
    console.log("Sync saltata: gia' fatta oggi");
    return;
  }

  // --- scarica ---
  const res = await fetch(URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`sync HTTP ${res.status}`);
  const data = (await res.json()) as {
    prices: (typeof prices.$inferInsert)[];
    market: (typeof market.$inferInsert)[];
  };
  if (data.prices.length === 0) throw new Error("JSON prezzi vuoto");

  // --- upsert (idempotente) ---
  for (const b of chunk(data.market, 500))
    await db.insert(market).values(b).onConflictDoNothing();
  for (const b of chunk(data.prices, 500))
    await db.insert(prices).values(b).onConflictDoNothing();

  // --- finestra mobile: elimina i giorni piu' vecchi del JSON ---
  const minDate = data.prices.reduce(
    (m, p) => (p.date < m ? p.date : m),
    data.prices[0].date,
  );
  await db.delete(prices).where(lt(prices.date, minDate));
  await db.delete(market).where(lt(market.date, minDate));

  // --- segna la sync di oggi ---
  await expoDb.runAsync(
    `INSERT OR REPLACE INTO meta (key, value) VALUES ('lastSync', ?)`,
    today,
  );

  console.log(
    `Sync OK: ${data.prices.length} prezzi (finestra da ${minDate}), ${data.market.length} market`,
  );
}
