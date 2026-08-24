import { usePortfolio } from "@/src/context/PortfolioContext";
import { COLORS } from "@/src/theme";
import type { PriceRow } from "@/src/utils/finance";
import { logos } from "@/src/utils/logos";
import {
  addAsset,
  loadHoldings,
  loadPortfolios,
  loadSelectedPrices,
  type PortfolioRow,
} from "@/src/utils/portfolioMethods";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { ArrowLeftCircleIcon } from "react-native-heroicons/outline";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { G, Line, Path, Polyline, Rect } from "react-native-svg";

const GREEN = COLORS.up; // rialzo (Electric Mint)
const RED = COLORS.down; // ribasso (Neon Pink)
const CANDLES = 40; // quante candele mostrare nel grafico

/* --------------------------- Grafico a candele --------------------------- */
type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type Period = "1W" | "1M" | "1Y" | "MAX";
const PERIOD_LABEL: Record<Period, string> = {
  "1W": "1S",
  "1M": "1M",
  "1Y": "1A",
  MAX: "MAX",
};
const PERIOD_DAYS: Record<Period, number> = {
  "1W": 7,
  "1M": 30,
  "1Y": 365,
  MAX: Infinity,
};
const MAX_CANDLES = 60; // massimo di candele disegnate (oltre, si aggregano)

type ChartType = "candle" | "line"; // candele o grafico a linea

// Filtra le righe nel periodo scelto e le aggrega in ≤ MAX_CANDLES candele OHLC.
// Per i periodi lunghi (es. 1 anno) accorpa più giorni in un'unica candela.
function buildCandles(rows: PriceRow[], period: Period): Candle[] {
  if (rows.length === 0) return [];
  const days = PERIOD_DAYS[period];

  let filtered = rows;
  if (days !== Infinity) {
    const d = new Date(rows[rows.length - 1].date);
    d.setDate(d.getDate() - days);
    const cutoff = d.toISOString().slice(0, 10);
    filtered = rows.filter((r) => r.date >= cutoff);
  }
  if (filtered.length < 2) filtered = rows.slice(-2);

  // se ci sono troppe candele, le accorpo in bucket (es. candele settimanali)
  const bucketSize = Math.ceil(filtered.length / MAX_CANDLES);
  if (bucketSize <= 1) {
    return filtered.map((r, i) => ({
      date: r.date,
      open: i === 0 ? r.close : filtered[i - 1].close, // apertura ≈ close precedente
      high: r.high,
      low: r.low,
      close: r.close,
    }));
  }

  const candles: Candle[] = [];
  for (let i = 0; i < filtered.length; i += bucketSize) {
    const b = filtered.slice(i, i + bucketSize);
    candles.push({
      date: b[b.length - 1].date,
      open: b[0].close, // apertura = primo close del bucket
      high: Math.max(...b.map((x) => x.high)),
      low: Math.min(...b.map((x) => x.low)),
      close: b[b.length - 1].close, // chiusura = ultimo close del bucket
    });
  }
  return candles;
}

function CandleChart({ candles }: { candles: Candle[] }) {
  const [w, setW] = useState(320);
  const H = 160;

  if (candles.length < 2) return null;

  const max = Math.max(...candles.map((c) => c.high));
  const min = Math.min(...candles.map((c) => c.low));
  const range = max - min || 1;

  const y = (price: number) => H - ((price - min) / range) * H;
  const slot = w / candles.length;
  const bodyW = Math.max(1, slot * 0.6);

  return (
    <View
      className="w-full"
      style={{ height: H }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      <Svg width={w} height={H}>
        {candles.map((c, i) => {
          const up = c.close >= c.open;
          const color = up ? GREEN : RED;
          const cx = i * slot + slot / 2;
          const top = Math.min(y(c.open), y(c.close));
          const bodyH = Math.max(1, Math.abs(y(c.close) - y(c.open)));
          return (
            <G key={c.date}>
              {/* stoppino: dal massimo al minimo */}
              <Line
                x1={cx}
                x2={cx}
                y1={y(c.high)}
                y2={y(c.low)}
                stroke={color}
                strokeWidth={1}
              />
              {/* corpo: da open a close */}
              <Rect
                x={cx - bodyW / 2}
                y={top}
                width={bodyW}
                height={bodyH}
                rx={1}
                fill={color}
              />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

// Grafico a linea (con area sfumata) sui prezzi di chiusura.
function LineChart({ candles }: { candles: Candle[] }) {
  const [w, setW] = useState(320);
  const H = 160;

  if (candles.length < 2) return null;

  const closes = candles.map((c) => c.close);
  const max = Math.max(...closes);
  const min = Math.min(...closes);
  const range = max - min || 1;

  const x = (i: number) => (i / (closes.length - 1)) * w;
  const y = (p: number) => H - ((p - min) / range) * H;
  const up = closes[closes.length - 1] >= closes[0];
  const color = up ? GREEN : RED;

  const line = closes.map((c, i) => `${x(i).toFixed(1)},${y(c).toFixed(1)}`);
  // area = linea + discesa fino al fondo e ritorno all'inizio
  const area =
    `M ${line[0]} ` +
    closes.map((c, i) => `L ${x(i).toFixed(1)} ${y(c).toFixed(1)}`).join(" ") +
    ` L ${x(closes.length - 1).toFixed(1)} ${H} L 0 ${H} Z`;

  return (
    <View
      className="w-full"
      style={{ height: H }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      <Svg width={w} height={H}>
        <Path d={area} fill={color} opacity={0.12} />
        <Polyline
          points={line.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}

/* ----------------------------- Riga informazione ----------------------------- */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2">
      <Text className="text-muted">{label}</Text>
      <Text className="text-content font-semibold">{value}</Text>
    </View>
  );
}

/* -------------------------------- Schermata -------------------------------- */
export default function AssetDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const [rows, setRows] = useState<PriceRow[] | null>(null);
  const [amount, setAmount] = useState(""); // importo in $ scelto dall'utente

  // selettore di portafoglio per l'acquisto
  const [pickerOpen, setPickerOpen] = useState(false);
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const { refreshPortfolio } = usePortfolio();

  useEffect(() => {
    if (!ticker) return;
    loadSelectedPrices([ticker]).then((r) =>
      setRows(r.sort((a, b) => a.date.localeCompare(b.date))),
    );
  }, [ticker]);

  // metriche derivate dai prezzi reali
  const stats = useMemo(() => {
    if (!rows || rows.length < 2) return null;
    const window = rows.slice(-CANDLES);
    const last = window.at(-1)!.close;
    const first = window[0].close;
    const changeAbs = last - first;
    const changePct = first ? (changeAbs / first) * 100 : 0;
    return { last, entry: first, changeAbs, changePct, up: changeAbs >= 0 };
  }, [rows]);

  // periodo + tipo di grafico selezionati
  const [period, setPeriod] = useState<Period>("1M");
  const [chartType, setChartType] = useState<ChartType>("line");
  const candles = useMemo(
    () => (rows ? buildCandles(rows, period) : []),
    [rows, period],
  );
  // variazione % sul periodo mostrato (primo open → ultimo close)
  const periodChange = useMemo(() => {
    if (candles.length < 2) return 0;
    const f = candles[0].open;
    const l = candles[candles.length - 1].close;
    return f ? (l / f - 1) * 100 : 0;
  }, [candles]);

  // Apre il selettore di portafoglio in cui aggiungere il titolo.
  async function openAdd() {
    const list = await loadPortfolios();
    setPortfolios(list);
    setPickerOpen(true);
  }

  // Aggiunge il titolo al portafoglio scelto con peso 0: i pesi verranno
  // assegnati poi scegliendo un metodo di allocazione nella schermata Portfolios.
  // entry_price = prezzo attuale (per misurare il guadagno da questo momento).
  async function confirmAdd(pf: PortfolioRow) {
    if (!stats || !ticker) return;
    await addAsset(pf.id, ticker, 0, stats.last);
    refreshPortfolio(); // avvisa gli altri schermi di ricaricare
    setPickerOpen(false);
    Alert.alert(
      "Titolo aggiunto",
      `${ticker} aggiunto a "${pf.name}".\n` +
        `Applica un metodo di allocazione dalla scheda Portfolios per assegnare i pesi.`,
    );
  }

  if (!rows || !stats) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color={GREEN} />
      </SafeAreaView>
    );
  }

  const { last, entry, changeAbs, changePct, up } = stats;
  const badgeColor = up ? GREEN : RED;
  const amountNum = Number(amount) || 0; // importo scelto dall'utente
  const shares = last > 0 ? amountNum / last : 0; // azioni stimate con quell'importo

  return (
    <>
      {/* nascondo l'header di default: ne uso uno personalizzato */}
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={[COLORS.surface, COLORS.background, COLORS.background]}
        locations={[0, 0.35, 1]}
        style={{ flex: 1 }}
      >
        <SafeAreaView className="flex-1" edges={["top"]}>
          {/* Header: indietro + ticker */}
          <View className="flex-row items-center px-4 py-2">
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              className="w-10 h-10 rounded-full items-center justify-center"
            >
              <ArrowLeftCircleIcon color={COLORS.accent}></ArrowLeftCircleIcon>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <Text className="text-2xl font-semibold text-center w-full  text-content ml-1">
              {ticker}
            </Text>
            <View className="items-center mt-2 mb-4">
              {logos[ticker] ? (
                <Image
                  source={logos[ticker]}
                  className="w-16 h-16 rounded-full"
                  resizeMode="contain"
                />
              ) : (
                <View className="w-16 h-16 rounded-full bg-divider items-center justify-center">
                  <Text className="text-content font-bold">
                    {ticker?.slice(0, 3)}
                  </Text>
                </View>
              )}
              <Text className="text-4xl font-bold text-content mt-3">
                {last.toFixed(2)}
              </Text>
              <View
                className="rounded-full px-3 py-1 mt-2"
                style={{ backgroundColor: COLORS.surface }}
              >
                <Text style={{ color: badgeColor }} className="font-semibold">
                  {up ? "+" : ""}
                  {changeAbs.toFixed(2)} ({up ? "+" : ""}
                  {changePct.toFixed(2)}%)
                </Text>
              </View>
            </View>

            {/* Pulsanti Compra / Vendi */}
            {/* <View className="flex-row gap-3 mb-4">
              <Pressable
                onPress={openBuy}
                className="flex-1 bg-violet-600 rounded-full py-4 items-center active:opacity-80"
              >
                <Text className="text-background font-semibold">Compra ↙</Text>
              </Pressable>
              <Pressable className="flex-1 border border-slate-300 rounded-full py-4 items-center active:opacity-60">
                <Text className="text-content font-semibold">Vendi ↗</Text>
              </Pressable>
            </View> */}

            <Pressable
              onPress={openAdd}
              className="flex-1 h-10 rounded-xl mb-4 bg-accent justify-center items-center active:opacity-80"
            >
              <Text className="text-background font-bold">
                Aggiungi al portafoglio
              </Text>
            </Pressable>

            {/* Importo da investire (scelto dall'utente) */}
            {/* <View className="border border-divider rounded-2xl px-4 py-3 mb-4">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-muted text-xs">
                  Quanto vuoi investire
                </Text>
                <Text className="text-muted text-xs">
                  Prezzo: ${last.toFixed(2)}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-2xl font-bold text-content mr-1">
                  $
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(",", "."))}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                  className="flex-1 text-2xl font-bold text-content"
                />
              </View>
              <Text className="text-muted text-xs mt-1">
                ≈ {shares.toFixed(4)} azioni
              </Text>
              {/* importi rapidi 
              <View className="flex-row gap-2 mt-3">
                {[100, 500, 1000].map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setAmount(String(v))}
                    className="px-3 py-1.5 rounded-full bg-surface active:opacity-70"
                  >
                    <Text className="text-slate-700 text-xs font-semibold">
                      ${v}
                    </Text>
                  </Pressable>
                ))}
              </View> 
            </View> */}

            {/*  Informazioni 
            <View className="border border-divider rounded-2xl px-4 py-3 mb-4">
              <Text className="text-muted mb-1">Informazioni</Text>
              <InfoRow
                label="Prezzo di carico"
                value={`$${entry.toFixed(2)}`}
              />
              <InfoRow label="Azioni stimate" value={`≈ ${shares.toFixed(4)}`} />
              <InfoRow
                label="Totale ordine"
                value={`$${amountNum.toFixed(2)}`}
              />
            </View> */}

            {/* Grafico a candele con selettore di periodo */}
            <View className="border border-divider rounded-2xl p-4">
              <View className="flex-row justify-between items-center mb-3">
                {/* toggle tipo grafico: candele / linea */}
                <View className="flex-row bg-surface rounded-full p-0.5">
                  {(["candle", "line"] as ChartType[]).map((t) => {
                    const active = chartType === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setChartType(t)}
                        className={`px-3 py-1 rounded-full ${
                          active ? "bg-accent" : ""
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            active ? "text-background" : "text-muted"
                          }`}
                        >
                          {t === "candle" ? "Candele" : "Linea"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text
                  className="font-semibold"
                  style={{ color: periodChange >= 0 ? GREEN : RED }}
                >
                  {periodChange >= 0 ? "+" : ""}
                  {periodChange.toFixed(2)}%
                </Text>
              </View>

              {chartType === "candle" ? (
                <CandleChart candles={candles} />
              ) : (
                <LineChart candles={candles} />
              )}

              {/* selettore periodo: 1S / 1M / 1A / MAX */}
              <View className="flex-row bg-surface rounded-full p-1 mt-3">
                {(["1W", "1M", "1Y", "MAX"] as Period[]).map((p) => {
                  const active = period === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setPeriod(p)}
                      className={`flex-1 py-2 rounded-full items-center ${
                        active ? "bg-accent" : ""
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          active ? "text-background" : "text-muted"
                        }`}
                      >
                        {PERIOD_LABEL[p]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {candles.length > 0 && (
                <Text className="text-muted text-xs mt-2 text-center">
                  {candles[0].date} → {candles[candles.length - 1].date}
                </Text>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {/* Selettore di portafoglio: obbligatorio prima di comprare */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            className="flex-1 bg-black/40 justify-end"
            onPress={() => setPickerOpen(false)}
          >
            {/* stop propagation: i tap dentro il foglio non chiudono la modale */}
            <Pressable
              onPress={() => {}}
              className="bg-surface border-t border-divider rounded-t-3xl p-5"
            >
              <Text className="text-lg font-bold text-content mb-1">
                Scegli il portafoglio
              </Text>
              <Text className="text-muted text-xs mb-4">
                Aggiungi {ticker} — i pesi si impostano poi con un metodo
              </Text>

              {portfolios.length === 0 ? (
                <View className="items-center py-6">
                  <Text className="text-muted mb-3">
                    Nessun portafoglio disponibile.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setPickerOpen(false);
                      router.push("/");
                    }}
                    className="bg-accent rounded-full px-5 py-3 active:opacity-80"
                  >
                    <Text className="text-background font-semibold">
                      Crea un portafoglio
                    </Text>
                  </Pressable>
                </View>
              ) : (
                portfolios.map((pf) => (
                  <Pressable
                    key={pf.id}
                    onPress={() => confirmAdd(pf)}
                    className="flex-row justify-between items-center py-3 border-b border-divider active:opacity-60"
                  >
                    <View>
                      <Text className="text-content font-semibold">
                        {pf.name}
                      </Text>
                      <Text className="text-muted text-xs">
                        Capitale ${pf.cash.toLocaleString("it-IT")}
                      </Text>
                    </View>
                    <Text className="text-accent font-semibold">
                      Aggiungi →
                    </Text>
                  </Pressable>
                ))
              )}

              <Pressable
                onPress={() => setPickerOpen(false)}
                className="mt-4 py-3 items-center"
              >
                <Text className="text-muted">Annulla</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
