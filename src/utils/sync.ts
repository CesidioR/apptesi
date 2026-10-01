// Scarica i prezzi freschi dal repo GitHub (aggiornato ogni giorno dal workflow)
// e li inserisce in SQLite.
//  - THROTTLE: si sincronizza al massimo UNA volta al giorno (tabella `meta`).
//  - FINESTRA MOBILE: dopo l'upsert elimina le date piu' vecchie della data
//    minima del JSON (il JSON e' sempre "ultimi 3 anni"), cosi' i giorni piu'
//    lontani escono man mano che entrano quelli nuovi.
import { db, expoDb } from "@/db/client";
import { market, prices } from "@/db/schema";
import { lt, sql } from "drizzle-orm";
import { gunzipSync, strFromU8 } from "fflate";

const URL =
  "https://raw.githubusercontent.com/CesidioR/apptesi/main/data/prices.json.gz";

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

export async function syncPrices() {
  await expoDb.execAsync(
    `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);`,
  );

  // Data locale in formato YYYY-MM-DD per evitare disallineamenti UTC
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const today = `${year}-${month}-${day}`;

  const last = await expoDb.getFirstAsync<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'lastSync'`,
  );
  if (last?.value === today) {
    console.log("Sync saltata: gia' fatta oggi");
    return;
  }

  // --- Download ---
  const res = await fetch(URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`sync HTTP ${res.status}`);

  // --- Decompressione e parsing gestiti per ridurre la memoria ---
  const rawBuffer = await res.arrayBuffer();
  let decompressed: Uint8Array | null = gunzipSync(new Uint8Array(rawBuffer));
  let jsonString: string | null = strFromU8(decompressed);

  // Rilascia i byte grezzi prima del parsing
  decompressed = null;

  const data = JSON.parse(jsonString) as {
    prices: (typeof prices.$inferInsert)[];
    market: (typeof market.$inferInsert)[];
  };

  // Rilascia la stringa JSON per liberare memoria JS
  jsonString = null;

  if (!data.prices || data.prices.length === 0) {
    throw new Error("JSON prezzi vuoto o malformato");
  }

  // --- Calcolo minDate lineare rapido ---
  let minDate = data.prices[0].date;
  for (let i = 1; i < data.prices.length; i++) {
    if (data.prices[i].date < minDate) {
      minDate = data.prices[i].date;
    }
  }

  // Scrittura Atomica
  // Inserimenti, eliminazioni e aggiornamento meta avvengono insieme
  await db.transaction(async (tx) => {
    // Upsert market: sovrascrive il VIX se la data esiste gia'
    for (const b of chunk(data.market, 500)) {
      await tx
        .insert(market)
        .values(b)
        .onConflictDoUpdate({
          target: market.date,
          set: { vix: sql`excluded.vix` },
        });
    }

    // Upsert prezzi: sovrascrive high/low/close se (ticker,date) esiste gia'.
    // Necessario perche' con auto_adjust=True yfinance ri-aggiusta l'intera
    // serie storica a ogni dividendo/split: i prezzi passati vanno aggiornati.
    for (const b of chunk(data.prices, 500)) {
      await tx
        .insert(prices)
        .values(b)
        .onConflictDoUpdate({
          target: [prices.ticker, prices.date],
          set: {
            high: sql`excluded.high`,
            low: sql`excluded.low`,
            close: sql`excluded.close`,
          },
        });
    }

    // Finestra mobile: elimina storico antecedente
    await tx.delete(prices).where(lt(prices.date, minDate));
    if (data.market.length > 0) {
      await tx.delete(market).where(lt(market.date, minDate));
    }

    // Segna sincronizzazione completata
    await tx.run(
      sql`INSERT OR REPLACE INTO meta (key, value) VALUES ('lastSync', ${today})`,
    );
  });

  console.log(
    `Sync OK: ${data.prices.length} prezzi (finestra da ${minDate}), ${data.market.length} market`,
  );
}
