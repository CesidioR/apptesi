import AssetCard from "@/src/components/AssetCard";
import { loadTicker, type AssetCardData } from "@/src/utils/portfolioMethods";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AssetsScreen() {
  const [cards, setCards] = useState<AssetCardData[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadTicker().then(setCards);
  }, []);

  // filtro per ticker (ricalcolato solo quando cambiano cards o query)
  const filtered = useMemo(() => {
    if (!cards) return [];
    const q = query.trim().toUpperCase();
    if (!q) return cards;
    return cards.filter((c) => c.ticker.includes(q));
  }, [cards, query]);

  if (!cards) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-slate-950">
        <ActivityIndicator size="large" color="#22c55e" />
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient
      colors={["#001287", "#002759", "#040A17"]}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1 px-2">
        {/* Barra di ricerca */}
        <View className="flex-row items-center bg-slate-800/70 rounded-full px-4 py-2 my-3">
          <Text className="text-slate-400 mr-2">🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cerca titolo (es. AAPL)"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
            autoCorrect={false}
            className="flex-1 text-white"
          />
          {query.length > 0 && (
            <Text className="text-slate-400 px-1" onPress={() => setQuery("")}>
              ✕
            </Text>
          )}
        </View>

        {/* Lista filtrata */}
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.ticker}
          renderItem={({ item }) => <AssetCard data={item} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text className="text-slate-500 text-center mt-8">
              Nessun titolo trovato
            </Text>
          }
        />
      </SafeAreaView>
    </LinearGradient>
  );
}
