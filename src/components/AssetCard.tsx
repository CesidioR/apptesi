import { COLORS } from "@/src/theme";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { logos } from "../utils/logos";
import { type AssetCardData } from "../utils/portfolioMethods";

const W = 80;
const H = 32;

// Costruisce i punti della sparkline normalizzando i close nel box W×H.
function sparklinePoints(close: number[]): string {
  if (close.length < 2) return "";
  const min = Math.min(...close);
  const max = Math.max(...close);
  const range = max - min || 1; // evita divisione per 0
  return close
    .map((c, i) => {
      const x = (i / (close.length - 1)) * W;
      const y = H - ((c - min) / range) * H; // y invertita: in SVG cresce verso il basso
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function AssetCard({ data }: { data: AssetCardData }) {
  const router = useRouter();
  const navigating = useRef(false); // anti doppio-tap: evita di aprire due schermate
  const { ticker, close } = data;
  const last = close.at(-1) ?? 0;
  const first = close[0] ?? last;
  const changePct = first ? (last / first - 1) * 100 : 0;
  const up = changePct >= 0;
  const color = up ? COLORS.up : COLORS.down;

  const openDetail = () => {
    if (navigating.current) return; // ignora tap ravvicinati
    navigating.current = true;
    router.push(`/asset/${ticker}`);
    setTimeout(() => (navigating.current = false), 800); // sblocca dopo la navigazione
  };

  return (
    <Pressable
      onPress={openDetail}
      className="flex-row items-center bg-surface border border-divider rounded-md justify-between px-4 py-3 active:opacity-70"
    >
      <View className="flex-row items-center w-28">
        {logos[ticker] ? (
          <Image
            source={logos[ticker]}
            className="w-8 h-8 rounded-full mr-2"
            resizeMode="contain"
          />
        ) : (
          <View className="w-8 h-8 rounded-full mr-2 bg-divider justify-center items-center">
            <Text className="text-content text-[10px]">
              {ticker.slice(0, 3)}
            </Text>
          </View>
        )}
        <View>
          <Text className="font-bold text-content">{ticker}</Text>
          <Text className="text-muted text-xs">${last.toFixed(2)}</Text>
        </View>
      </View>

      <Svg width={W} height={H}>
        <Polyline
          points={sparklinePoints(close)}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
        />
      </Svg>

      <Text className="w-16 text-right text-md font-semibold" style={{ color }}>
        {up ? "+" : ""}
        {changePct.toFixed(1)}%
      </Text>
    </Pressable>
  );
}
