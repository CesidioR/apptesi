import { db } from "./client";
import { market, prices } from "./schema";
import seedData from "./seed_data.json";

// Funzione helper per dividere un array in blocchi (batch) di dimensione 'size'
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function runSeed() {
  console.log("Avvio popolamento del database...");

  try {
    // Popolamento tabella market
    if (seedData.market && seedData.market.length > 0) {
      console.log(
        `Inserimento di ${seedData.market.length} righe di mercato...`,
      );
      const marketBatches = chunkArray(seedData.market, 500);

      for (const batch of marketBatches) {
        await db.insert(market).values(batch).onConflictDoNothing();
      }
      console.log("Dati di mercato inseriti con successo!");
    }

    // Popolamento tabella prices
    if (seedData.prices && seedData.prices.length > 0) {
      console.log(`Inserimento di ${seedData.prices.length} prezzi storici...`);
      // Dividiamo i prezzi storici in batch da 500 righe ciascuno
      const priceBatches = chunkArray(seedData.prices, 500);

      let processed = 0;
      for (const batch of priceBatches) {
        await db.insert(prices).values(batch).onConflictDoNothing();
        processed += batch.length;

        // Log di progresso ogni 10.000 righe per monitorare lo stato
        if (processed % 10000 === 0 || processed === seedData.prices.length) {
          console.log(
            `Progresso: ${processed} / ${seedData.prices.length} prezzi inseriti.`,
          );
        }
      }
      console.log("Prezzi storici inseriti con successo!");
    }

    console.log("Popolamento completato!");
  } catch (error) {
    console.error("Errore durante il seed del database:", error);
  }
}
