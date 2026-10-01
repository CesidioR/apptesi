// Elenco dei titoli nel portafoglio selezionato, con rimozione.
// Mostra TUTTI gli holdings (anche a peso 0, appena aggiunti e non ancora allocati),
// così l'utente può togliere un titolo prima o dopo aver applicato un metodo.
import { COLORS } from "@/src/theme";
import { deleteHolding, loadHoldings } from "@/src/utils/portfolioMethods";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { usePortfolio } from "../context/PortfolioContext";

type Holding = { ticker: string; weight: number };

export default function HoldingsList() {
  const { selectedPortfolioId, refreshToken, refreshPortfolio } =
    usePortfolio();
  const [holds, setHolds] = useState<Holding[]>([]);

  useEffect(() => {
    if (selectedPortfolioId == null) {
      setHolds([]);
      return;
    }
    let cancelled = false;
    loadHoldings(selectedPortfolioId).then((h) => {
      if (!cancelled) setHolds(h);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPortfolioId, refreshToken]);

  if (selectedPortfolioId == null || holds.length === 0) return null;

  function remove(ticker: string) {
    if (selectedPortfolioId == null) return;
    Alert.alert("Rimuovi titolo", `Togliere ${ticker} dal portafoglio?`, [
      { text: "Annulla", style: "cancel" },
      {
        text: "Rimuovi",
        style: "destructive",
        onPress: async () => {
          await deleteHolding(selectedPortfolioId, ticker);
          refreshPortfolio(); // aggiorna carta, pesi e backtest
        },
      },
    ]);
  }

  return (
    <View className="mt-4">
      <Text className="text-content font-semibold mb-2">
        Titoli nel portafoglio ({holds.length})
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {holds.map((h) => (
          <View
            key={h.ticker}
            className="flex-row items-center bg-surface border border-divider rounded-full pl-3 pr-2 py-1.5"
          >
            <Text className="text-content text-xs font-semibold mr-2">
              {h.ticker}
            </Text>
            <Pressable
              onPress={() => remove(h.ticker)}
              hitSlop={8}
              className="w-5 h-5 rounded-full items-center justify-center active:opacity-60"
              style={{ backgroundColor: COLORS.divider }}
            >
              <Text className="text-muted text-xs leading-none">✕</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
