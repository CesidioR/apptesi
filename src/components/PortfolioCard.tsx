import {
  deletePortfolio,
  loadPortfolioValue,
  type PortfolioValue,
} from "@/src/utils/portfolioMethods";
import { COLORS } from "@/src/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { usePortfolio } from "../context/PortfolioContext";

const fmt = (n: number) =>
  n.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Chip EMV stilizzato (rettangolo chiaro con griglia).
function Chip() {
  return (
    <Svg width={42} height={32} viewBox="0 0 42 32">
      <Rect
        x={1}
        y={1}
        width={40}
        height={30}
        rx={5}
        fill={COLORS.content}
        opacity={0.85}
      />
      <Line x1={15} y1={1} x2={15} y2={31} stroke={COLORS.surface} strokeWidth={1.5} />
      <Line x1={27} y1={1} x2={27} y2={31} stroke={COLORS.surface} strokeWidth={1.5} />
      <Line x1={1} y1={16} x2={41} y2={16} stroke={COLORS.surface} strokeWidth={1.5} />
    </Svg>
  );
}

// Logo circolare a due cerchi sovrapposti (stile network).
function CardLogo() {
  return (
    <View className="flex-row items-center">
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: COLORS.accent,
        }}
      />
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: COLORS.content,
          opacity: 0.5,
          marginLeft: -11,
        }}
      />
    </View>
  );
}

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

  const up = (value?.generated ?? 0) >= 0;
  const pct =
    value && value.initialCash > 0
      ? (value.generated / value.initialCash) * 100
      : 0;

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
    <View className="w-full">
      <LinearGradient
        colors={[COLORS.accent, COLORS.surface, COLORS.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 20, aspectRatio: 1.6 }}
        className="w-full p-5 justify-between border border-divider"
      >
        {/* Riga alta: etichetta + brand (nome portafoglio) */}
        <View className="flex-row justify-between items-start">
          <Text className="text-content text-xs" style={{ opacity: 0.75 }}>
            Portafoglio
          </Text>
          <Text className="text-content font-extrabold tracking-widest">
            {(value?.name ?? "APPTESI").toUpperCase()}
          </Text>
        </View>

        {/* Chip */}
        <Chip />

        {/* Valore protagonista */}
        <View>
          <Text className="text-content text-xs" style={{ opacity: 0.75 }}>
            Valore del portafoglio
          </Text>
          {loading ? (
            <ActivityIndicator
              color={COLORS.content}
              className="my-1 self-start"
            />
          ) : (
            <Text className="text-content text-3xl font-bold mt-0.5">
              ${value ? fmt(value.currentValue) : "0,00"}
            </Text>
          )}
          {value && (
            <Text
              className="text-sm font-semibold mt-0.5"
              style={{ color: up ? COLORS.up : COLORS.down }}
            >
              {up ? "+" : ""}${fmt(value.generated)} ({up ? "+" : ""}
              {pct.toFixed(2)}%)
            </Text>
          )}
        </View>

        {/* Riga bassa: etichetta + logo */}
        <View className="flex-row justify-between items-end">
          <Text
            className="text-content text-[10px] tracking-widest"
            style={{ opacity: 0.6 }}
          >
            CONTO SIMULATO
          </Text>
          <CardLogo />
        </View>
      </LinearGradient>

      {/* Elimina (discreto, sotto la carta) */}
      {selectedPortfolioId != null && (
        <View className="flex-row justify-end mt-2">
          <Pressable onPress={handleDelete} hitSlop={8} className="active:opacity-60">
            <Text className="text-down text-xs font-semibold">
              Elimina portafoglio
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
