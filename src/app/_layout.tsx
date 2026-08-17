import { db } from "@/db/client";
import { prices } from "@/db/schema";
import { runSeed } from "@/db/seed";
import { loadModel } from "@/src/utils/onnxModel";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import migrations from "../../drizzle/migrations";
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
        await runSeed(); // esegue solo se la tabella è vuota
      }
      setSeeded(true);
    })();
  }, [success]);

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-950">
        <Text className="text-red-500 font-bold">
          Errore Database: {error.message}
        </Text>
      </View>
    );
  }

  // Mentre crea le tabelle (migrazioni) o popola i dati (seed)
  if (!success || !seeded) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-950">
        <ActivityIndicator size="large" color="#22c55e" />
        <Text className="text-slate-400 mt-2">Inizializzazione database...</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0022ff" },
      }}
    >
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
