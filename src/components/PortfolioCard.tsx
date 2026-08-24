import {
  deletePortfolio,
  loadPortfolioValue,
  type PortfolioValue,
} from "@/src/utils/portfolioMethods";
import { COLORS } from "@/src/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { usePortfolio } from "../context/PortfolioContext";

const fmt = (n: number) =>
  n.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function PortfolioCard({
  onDeleted,
}: {
  onDeleted?: () => void; // chiamata dopo l'eliminazione, per far aggiornare il genitore
}) {
  const { selectedPortfolioId, refreshToken } = usePortfolio();
  const [value, setValue] = useState<PortfolioValue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadPortfolioValue(selectedPortfolioId)
      .then(setValue)
      .finally(() => setLoading(false));
  }, [selectedPortfolioId, refreshToken]);

  // Se value.generated non è null usa quello altrimenti usa 0 di default
  const up = (value?.generated ?? 0) >= 0;
  const pct =
    value && value.initialCash > 0
      ? (value.generated / value.initialCash) * 100
      : 0;

  // Elimina con conferma, poi avvisa il genitore.
  function handleDelete() {
    if (selectedPortfolioId == null) return;
    Alert.alert(
      "Elimina portafoglio",
      `Vuoi eliminare "${value?.name ?? "questo portafoglio"}"? L'operazione è irreversibile.`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            await deletePortfolio(selectedPortfolioId);
            onDeleted?.();
          },
        },
      ],
    );
  }

  return (
    <LinearGradient
      colors={[COLORS.surface, COLORS.surface, COLORS.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24 }}
      className="w-full p-5 border border-divider"
    >
      {/* Valore protagonista: investimenti + contante */}
      <View className="mt-4">
        <Text className="text-muted text-xs">Valore del portafoglio</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.content} className="my-2 self-start" />
        ) : (
          <Text className="text-content text-3xl font-bold mt-1">
            ${value ? fmt(value.currentValue) : "0,00"}
          </Text>
        )}
        {value && (
          <Text
            className="text-sm font-semibold mt-1"
            style={{ color: up ? COLORS.up : COLORS.down }}
          >
            {up ? "+" : ""}${fmt(value.generated)} ({up ? "+" : ""}
            {pct.toFixed(2)}%)
          </Text>
        )}
      </View>
      {/* Pulsante elimina (solo se c'è un portafoglio selezionato) */}
      {selectedPortfolioId != null && (
        <View className="flex-row justify-end mt-4">
          <Pressable
            onPress={handleDelete}
            className="bg-down/90 px-4 py-2 rounded-lg active:opacity-70"
          >
            <Text className="text-content text-xs font-semibold">Elimina</Text>
          </Pressable>
        </View>
      )}
    </LinearGradient>
  );
}
