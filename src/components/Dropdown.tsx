// Dropdown in stile "select" web: un box mostra il valore corrente con una
// freccetta; al tocco si apre una lista di opzioni in una piccola modale.
// Stilizzato col tema scuro dell'app, senza dipendenze native.
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

export type Option<T> = { label: string; value: T };

export default function Dropdown<T>({
  label,
  value,
  options,
  onChange,
  placeholder = "Seleziona…",
}: {
  label?: string;
  value: T | null;
  options: Option<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <View>
      {label ? <Text className="text-muted text-xs mb-1">{label}</Text> : null}

      {/* Box chiuso */}
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between bg-surface border border-divider rounded-xl px-4 py-3 active:opacity-80"
      >
        <Text
          className={
            current
              ? "text-content text-sm font-semibold"
              : "text-muted text-sm"
          }
        >
          {current ? current.label : placeholder}
        </Text>
        <Text className="text-muted ml-2">▾</Text>
      </Pressable>

      {/* Lista aperta */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-center px-8"
          onPress={() => setOpen(false)}
        >
          {/* stop propagation: i tocchi dentro il foglio non lo chiudono */}
          <Pressable
            onPress={() => {}}
            className="bg-surface border border-divider rounded-2xl overflow-hidden"
          >
            {label ? (
              <Text className="text-muted text-xs px-4 pt-3 pb-1">{label}</Text>
            ) : null}
            {options.map((o, i) => {
              const active = o.value === value;
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`px-4 py-3 active:opacity-70 ${
                    active ? "bg-accent/15" : ""
                  } ${i > 0 ? "border-t border-divider" : ""}`}
                >
                  <Text
                    className={`text-sm ${
                      active ? "text-accent font-semibold" : "text-content"
                    }`}
                  >
                    {active ? "✓  " : ""}
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
