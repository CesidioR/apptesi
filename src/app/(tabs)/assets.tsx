import AssetCard from "@/src/components/AssetCard";
import { COLORS } from "@/src/theme";
import { loadTicker, type AssetCardData } from "@/src/utils/portfolioMethods";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
} from "react-native";
import { MagnifyingGlassIcon } from "react-native-heroicons/outline";
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
      <SafeAreaView className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color={COLORS.up} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 px-2 bg-background">
      {/* Barra di ricerca */}
      <View className="flex-row items-center rounded-xl bg-surface border border-divider px-4 py-1 my-3">
        <MagnifyingGlassIcon color={COLORS.muted} size={15}></MagnifyingGlassIcon>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cerca titolo (es. AAPL)"
          placeholderTextColor={COLORS.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          className="flex-1 text-content"
        />
        {query.length > 0 && (
          <Text className="text-muted px-1" onPress={() => setQuery("")}>
            ✕
          </Text>
        )}
      </View>

      {/* Lista filtrata */}
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.ticker}
        renderItem={({ item }) => <AssetCard data={item} />}
        ItemSeparatorComponent={() => (
          <View className="items-center py-1">
            {/* Alone esterno di luce */}
            <View className="h-[6px] w-11/12 bg-accent/10 rounded-full items-center justify-center">
              {/* Linea interna centrale luminosa */}
              <View className="h-[1px] w-full px-3 rounded-md bg-accent/50" />
            </View>
          </View>
        )}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text className="text-muted text-center mt-8">
            Nessun titolo trovato
          </Text>
        }
      />
    </SafeAreaView>
  );
}
