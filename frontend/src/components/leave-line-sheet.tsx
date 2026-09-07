import React from "react";
import { Modal, Pressable, Text, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight } from "lucide-react-native";
import { type as t } from "../theme";
import { LEAVE_REASONS } from "../data/mock";

export function LeaveLineSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (reason: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          testID="leave-sheet-backdrop"
          onPress={onClose}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(4,10,20,0.55)" }}
        />
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            maxHeight: "86%",
          }}
        >
          <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#D7DDE6", marginBottom: 18 }} />
          <Text style={[t.title2, { color: "#0B192C" }]}>You've left the line</Text>
          <Text style={[t.callout, { color: "#64748B", marginTop: 8, marginBottom: 18 }]}>
            If you tell us why, the branch sees it. It is the only way they find out a line is losing people and not just moving slowly.
          </Text>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {LEAVE_REASONS.map((r, i) => (
              <Pressable
                key={r}
                testID={`leave-reason-${i}`}
                onPress={() => onSelect(r)}
                style={({ pressed }) => ({
                  minHeight: 54,
                  borderRadius: 16,
                  backgroundColor: pressed ? "#E9EDF3" : "#F3F5F9",
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                })}
              >
                <Text style={[t.headline, { color: "#0B192C" }]}>{r}</Text>
                <ChevronRight size={18} color="#94A3B8" />
              </Pressable>
            ))}
            <Pressable testID="leave-skip" onPress={() => onSelect("")} style={{ alignItems: "center", paddingVertical: 14 }}>
              <Text style={{ color: "#64748B", fontWeight: "600", fontSize: 14 }}>Skip</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
