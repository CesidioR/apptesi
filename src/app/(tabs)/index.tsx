import EquityChart from "@/src/components/EquityChart";
import PortfolioCard from "@/src/components/PortfolioCard";
import WeightsBreakdown from "@/src/components/WeightsBreakdown";
import { usePortfolio } from "@/src/context/PortfolioContext";
import { COLORS } from "@/src/theme";
import {
  addPortfolio,
  commitAllocation,
  computeMethodPlan,
  loadPortfolios,
  WEIGHT_METHOD_LABEL,
  type PortfolioRow,
  type WeightMethod,
} from "@/src/utils/portfolioMethods";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { selectedPortfolioId, setSelectedPortfolioId, refreshPortfolio } =
    usePortfolio();
  const [list, setList] = useState<PortfolioRow[] | null>(null);
  const [applying, setApplying] = useState<WeightMethod | null>(null);

  // campi del form di creazione
  const [name, setName] = useState("");
  const [cash, setCash] = useState("");
  const [commission, setCommission] = useState("");
  const [saving, setSaving] = useState<boolean>(false);
  const [form, setForm] = useState<boolean>(false);
  const [base, setBase] = useState("");

  // valori animati per l'entrata del form (scala + opacità)
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const refresh = useCallback(async () => {
    const rows = await loadPortfolios();
    setList(rows);
    // se non c'è nessun portafoglio selezionato, seleziona il primo
    setSelectedPortfolioId((cur) =>
      cur == null && rows.length > 0 ? rows[0].id : cur,
    );
  }, [setSelectedPortfolioId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // anima il form all'apertura (pop-in), lo resetta alla chiusura
  useEffect(() => {
    if (form) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.9);
      opacity.setValue(0);
    }
  }, [form, scale, opacity]);

  // Chiude il form svuotando SEMPRE i campi
  const closeForm = () => {
    setForm(false);
    setName("");
    setCash("");
    setCommission("");
    setBase("");
  };

  // Controllo per i dati nel form (obbligatorio nome e cash > 0)
  const canCreate = name.trim().length > 0 && Number(cash) > 0;

  async function handleCreate() {
    if (!canCreate || saving) return;
    setSaving(true);
    try {
      const id = await addPortfolio(
        name.trim(),
        Number(commission) || 0,
        Number(cash),
        Number(base) || 0,
      );
      await refresh();
      setSelectedPortfolioId(id); // seleziona subito il nuovo portafoglio
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  // Calcola il piano col metodo scelto, mostra il COSTO e chiede conferma.
  // Solo alla conferma i pesi vengono salvati e il costo addebitato.
  async function handleApplyMethod(method: WeightMethod) {
    if (selectedPortfolioId == null || applying) return;
    const pid = selectedPortfolioId;
    setApplying(method);
    try {
      const plan = await computeMethodPlan(pid, method);
      Alert.alert(
        `Applicare "${WEIGHT_METHOD_LABEL[method]}"?`,
        plan.cost > 0
          ? `Costo di ribilanciamento: $${plan.cost.toFixed(2)} (addebitato al portafoglio).`
          : "Nessun costo: l'allocazione non cambia.",
        [
          { text: "Annulla", style: "cancel" },
          {
            text: "Conferma",
            onPress: async () => {
              try {
                await commitAllocation(pid, plan);
                refreshPortfolio(); // aggiorna la carta col nuovo valore
              } catch (e) {
                Alert.alert("Errore", (e as Error).message);
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert("Impossibile calcolare i pesi", (e as Error).message);
    } finally {
      setApplying(null);
    }
  }

  return (
    <LinearGradient
      colors={[COLORS.surface, COLORS.background, COLORS.background]}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1" edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header: titolo + crea portafoglio */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-content text-2xl font-bold">Dashboard</Text>
            <Pressable
              onPress={() => (form ? closeForm() : setForm(true))}
              className="w-8 h-8 bg-accent rounded-full items-center justify-center active:opacity-80"
            >
              <Text className="text-background font-bold text-lg">+</Text>
            </Pressable>
          </View>

          {/* Selettore compatto dei portafogli */}
          {list === null ? (
            <ActivityIndicator color={COLORS.up} className="my-2 self-start" />
          ) : list.length === 0 ? (
            <Text className="text-muted mb-4">
              Nessun portafoglio. Creane uno con il pulsante +
            </Text>
          ) : (
            <View className="flex-row flex-wrap gap-2 mb-4">
              {list.map((p) => {
                const sel = p.id === selectedPortfolioId;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelectedPortfolioId(p.id)}
                    className={`px-3 py-1.5 rounded-full border ${
                      sel
                        ? "bg-accent/20 border-accent"
                        : "bg-surface border-divider"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        sel ? "text-content" : "text-muted"
                      }`}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Carta del portafoglio selezionato */}
          <PortfolioCard
            onDeleted={() => {
              setSelectedPortfolioId(null);
              refresh();
            }}
          />

          {/* Metodo di allocazione dei pesi */}
          {selectedPortfolioId != null && (
            <View className="mt-4">
              <Text className="text-content font-semibold mb-2">
                Metodo di allocazione
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {(
                  [
                    "equal",
                    "inverseVol",
                    "targetVol",
                    "kelly",
                    "agent",
                  ] as WeightMethod[]
                ).map((m) => {
                  const busy = applying === m;
                  return (
                    <Pressable
                      key={m}
                      disabled={applying != null}
                      onPress={() => handleApplyMethod(m)}
                      className="px-4 py-2 rounded-full border border-divider bg-surface active:opacity-70"
                    >
                      {busy ? (
                        <ActivityIndicator color={COLORS.accent} />
                      ) : (
                        <Text className="text-content text-xs font-semibold">
                          {WEIGHT_METHOD_LABEL[m]}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Text className="text-muted text-xs mt-2">
                Calcola i pesi dei titoli del portafoglio e li applica.
              </Text>
            </View>
          )}

          {/* Pesi attuali + pesi per ogni metodo */}
          <WeightsBreakdown />

          {/* Confronto strategie (backtest) */}

          <EquityChart />
        </ScrollView>

        {/* Form di creazione: finestra centrale, staccata, con animazione pop-in */}
        <Modal
          visible={form}
          transparent
          animationType="fade"
          onRequestClose={closeForm}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <Pressable
              className="flex-1 bg-black/50 justify-center items-center px-6"
              onPress={closeForm}
            >
              <Animated.View
                style={{ transform: [{ scale }], opacity, width: "100%" }}
              >
                <Pressable
                  onPress={() => {}}
                  className="bg-surface border border-divider rounded-2xl p-5"
                >
                  <View className="flex-row justify-between items-center mb-4">
                    <Text className="font-extrabold text-lg text-content">
                      Crea nuovo portafoglio
                    </Text>
                  </View>

                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Nome"
                    placeholderTextColor={COLORS.muted}
                    className="bg-background border border-divider rounded-lg px-3 py-2 mb-3 text-content"
                  />
                  <TextInput
                    value={cash}
                    onChangeText={setCash}
                    placeholder="Capitale iniziale"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="numeric"
                    className="bg-background border border-divider rounded-lg px-3 py-2 mb-3 text-content"
                  />
                  <TextInput
                    value={commission}
                    onChangeText={setCommission}
                    placeholder="Commissione (bps) — opzionale"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="numeric"
                    className="bg-background border border-divider rounded-lg px-3 py-2 mb-4 text-content"
                  />
                  <TextInput
                    value={base}
                    onChangeText={setBase}
                    placeholder="Costo base — opzionale"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="numeric"
                    className="bg-background border border-divider rounded-lg px-3 py-2 mb-4 text-content"
                  />

                  <Pressable
                    onPress={handleCreate}
                    disabled={!canCreate || saving}
                    className={`rounded-md py-3 items-center ${
                      canCreate && !saving
                        ? "bg-accent active:opacity-80"
                        : "bg-muted"
                    }`}
                  >
                    {saving ? (
                      <ActivityIndicator color={COLORS.background} />
                    ) : (
                      <Text className="text-background font-semibold">
                        Crea portafoglio
                      </Text>
                    )}
                  </Pressable>
                </Pressable>
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}
