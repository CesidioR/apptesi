import { db } from "@/db/client";
import { prices } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { COLORS } from "@/src/theme";
import { loadModel } from "@/src/utils/onnxModel";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import migrations from "../../drizzle/migrations";
import { PortfolioProvider } from "../context/PortfolioContext";
import "../styles/global.css";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);

  // Carica il modello ONNX una volta all'avvio (in background, non blocca la UI).
  // La sessione resta nel singleton onnxModel ed e' accessibile da tutta l'app.
  useEffect(() => {
    loadModel()
      .then(() => console.log("Modello ONNX caricato con successo!"))
      .catch((e) => console.error("Errore caricamento modello ONNX:", e));
  }, []);

  // Popola il DB una sola volta, dopo che le migrazioni sono riuscite.
  useEffect(() => {
    if (!success) return;
    (async () => {
      const existing = await db.select().from(prices).limit(1); // basta la prima riga
      if (existing.length === 0) {
        await runSeed(); // seed iniziale (bundled) solo se la tabella è vuota
      }
      // TEMPORANEO: forza la ri-sincronizzazione oggi (togli dopo)
      /* await expoDb.runAsync("DELETE FROM meta WHERE key = 'lastSync'");
      try {
        await syncPrices(); // dati freschi da GitHub (offline -> salta, usa quelli locali)
      } catch (e) {
        console.warn("Sync saltata (offline?):", e);
      } */
      setSeeded(true);
    })();
  }, [success]);

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Text className="text-down font-bold">
          Errore Database: {error.message}
        </Text>
      </View>
    );
  }

  // Mentre crea le tabelle (migrazioni) o popola i dati (seed)
  if (!success || !seeded) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color={COLORS.up} />
        <Text className="text-muted mt-2">
          Inizializzazione database...
        </Text>
      </View>
    );
  }

  return (
    <PortfolioProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </PortfolioProvider>
  );
}
