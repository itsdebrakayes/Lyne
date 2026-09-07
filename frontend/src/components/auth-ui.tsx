import React, { useState } from "react";
import { Pressable, Text, TextInput, TextInputProps, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { type as t } from "../theme";

export function AuthField({
  label,
  secure,
  right,
  testID,
  ...props
}: TextInputProps & { label?: string; secure?: boolean; right?: React.ReactNode; testID?: string }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={{ gap: 8 }}>
      {label ? <Text style={[t.callout, { color: "#334155", fontWeight: "600" }]}>{label}</Text> : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 56,
          borderRadius: 16,
          backgroundColor: "#F3F5F9",
          borderWidth: 1.5,
          borderColor: focused ? "#1D4ED8" : "#E6EAF0",
          paddingHorizontal: 16,
          gap: 10,
        }}
      >
        <TextInput
          testID={testID}
          placeholderTextColor="#94A3B8"
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex: 1, fontSize: 15, color: "#0B192C", paddingVertical: 0 }}
          {...props}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
            {hidden ? <Eye size={18} color="#94A3B8" /> : <EyeOff size={18} color="#94A3B8" />}
          </Pressable>
        ) : (
          right
        )}
      </View>
    </View>
  );
}

export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: "#0B192C",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
      }}
    >
      <Text style={{ color: "#3B82F6", fontSize: size * 0.46, fontWeight: "800", letterSpacing: -1 }}>L</Text>
    </View>
  );
}
