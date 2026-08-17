import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

// Apre (o crea) il file del database SQLite sul dispositivo
export const expoDb = openDatabaseSync("apptesi.db");

// Abilita le foreign key
expoDb.execSync("PRAGMA foreign_keys = ON;");

// Inizializza Drizzle ORM passandogli la connessione di Expo e lo schema
export const db = drizzle(expoDb, { schema });
