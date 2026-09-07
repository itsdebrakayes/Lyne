import React from "react";
import { Modal, Pressable, Text, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { type as t } from "../theme";

export type Option = { id: string; label: string; sub?: string; disabled?: boolean };

/** Light bottom sheet with a single-select list. */
export function OptionSheet({
  visible,
  title,
  options,
  selectedId,
  onClose,
  onSelect,
  testID,
}: {
  visible: boolean;
  title: string;
  options: Option[];
  selectedId?: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(4,10,20,0.55)" }} />
        <View
          testID={testID}
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            maxHeight: "80%",
          }}
        >
          <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#D7DDE6", marginBottom: 18 }} />
          <Text style={[t.title2, { color: "#0B192C", marginBottom: 16 }]}>{title}</Text>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {options.map((o) => {
              const active = o.id === selectedId;
              return (
                <Pressable
                  key={o.id}
                  testID={`option-${o.id}`}
                  disabled={o.disabled}
                  onPress={() => onSelect(o.id)}
                  style={({ pressed }) => ({
                    minHeight: 60,
                    borderRadius: 16,
                    backgroundColor: pressed ? "#E9EDF3" : active ? "#E1EFFE" : "#F3F5F9",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    opacity: o.disabled ? 0.45 : 1,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[t.headline, { color: "#0B192C" }]}>{o.label}</Text>
                    {o.sub ? <Text style={[t.footnote, { color: "#64748B", marginTop: 2 }]}>{o.sub}</Text> : null}
                  </View>
                  {active && (
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#1D4ED8", alignItems: "center", justifyContent: "center" }}>
                      <Check size={14} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
