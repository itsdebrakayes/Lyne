/**
 * DocumentCaptureScreen — Apple-Wallet-style document capture.
 *
 * Flow: intro (instructions + choose Scan / Upload / Type) → camera (a framed
 * cut-out sized to the document, with guidance) or file upload → review (the
 * captured image + a confirm/enter field + optional Face ID protection) → save.
 *
 * OCR note: true on-device auto-extraction isn't available in Expo Go, so the
 * captured image is sent to the backend OCR service (Tesseract, server-side)
 * when reachable; until then it falls back to confirm/type. `attemptOcr` is the
 * single integration point.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView,
  Switch, Text, TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t, inputReset } from '../../lib/theme';
import api from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Field = 'national_id' | 'trn';
interface DocConfig {
  field: Field;
  title: string;
  kind: 'card' | 'page';         // card = ID/licence outline; page = paper/passport
  allowType: boolean;
  keyboard: 'number-pad' | 'default';
  placeholder: string;
  valueLabel: string;
  scanLabel: string;             // "Scan your ID" etc.
  guide: string;                 // guidance shown by the frame
  instructions: string[];
}

const DOC_CONFIG: Record<Field, DocConfig> = {
  national_id: {
    field: 'national_id', title: 'National ID', kind: 'card', allowType: true, keyboard: 'default',
    placeholder: 'ID number', valueLabel: 'ID number', scanLabel: 'Scan your National ID',
    guide: 'Line your ID up inside the frame',
    instructions: [
      'Rest your ID on a flat, dark surface',
      'Fit the whole card inside the frame',
      'Avoid glare and shadows for a clean scan',
      'Only the agency serving you ever sees it',
    ],
  },
  trn: {
    field: 'trn', title: 'TRN', kind: 'page', allowType: true, keyboard: 'number-pad',
    placeholder: '000-000-000', valueLabel: 'TRN number', scanLabel: 'Scan your TRN letter',
    guide: 'Fit your TRN letter inside the frame',
    instructions: [
      'You can simply type your 9-digit TRN',
      'Or scan / upload the paper TRN — some agencies ask for it',
      'If scanning, keep the sheet flat and well-lit',
    ],
  },
};

// Placeholder for server-side OCR. Returns null today (Expo Go can't OCR
// on-device); wire this to POST the image to the backend OCR endpoint once the
// API is hosted, and it will pre-fill the field automatically.
async function attemptOcr(_field: Field, _uri: string): Promise<string | null> {
  return null;
}

const protectKey = (field: Field) => `lyne.doc-protected.${field}`;

export default function DocumentCaptureScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'DocumentCapture'>>();
  const { user, refreshProfile } = useAuth();
  const { width } = useWindowDimensions();
  const cfg = DOC_CONFIG[(route.params?.field as Field) || 'national_id'];
  const existing = (cfg.field === 'trn' ? user?.trn : user?.national_id) || '';

  const [mode, setMode] = useState<'intro' | 'camera' | 'review'>('intro');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [value, setValue] = useState(existing);
  const [protect, setProtect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [error, setError] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);

  // Load the saved "protected" preference for this doc.
  useEffect(() => { AsyncStorage.getItem(protectKey(cfg.field)).then(v => setProtect(v === '1')); }, [cfg.field]);

  // Frame dimensions — credit-card ratio for cards, portrait for pages.
  const frameW = Math.round(width * (cfg.kind === 'card' ? 0.84 : 0.72));
  const frameH = Math.round(cfg.kind === 'card' ? frameW / 1.586 : frameW * 1.32);

  const runOcr = async (uri: string) => {
    setOcrBusy(true);
    try { const found = await attemptOcr(cfg.field, uri); if (found) setValue(found); }
    finally { setOcrBusy(false); }
  };

  const openCamera = async () => {
    setError('');
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { setError('Camera access is needed to scan. You can upload a file instead.'); return; }
    }
    setMode('camera');
  };

  const capture = async () => {
    try {
      const photo = await camRef.current?.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) { setImageUri(photo.uri); setMode('review'); runOcr(photo.uri); }
    } catch { setError('Could not take the photo. Try again or upload a file.'); }
  };

  const pickImage = async () => {
    setError('');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]?.uri) { setImageUri(res.assets[0].uri); setMode('review'); runOcr(res.assets[0].uri); }
  };

  const pickDocument = async () => {
    setError('');
    const res = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (!res.canceled && res.assets?.[0]?.uri) {
      const a = res.assets[0];
      setImageUri(a.mimeType?.startsWith('image/') ? a.uri : null);
      setMode('review');
      if (a.mimeType?.startsWith('image/')) runOcr(a.uri);
    }
  };

  const save = async () => {
    if (!value.trim()) { setError(`Enter or confirm your ${cfg.valueLabel.toLowerCase()} to save.`); return; }
    setBusy(true); setError('');
    try {
      await api.patch('/auth/profile', { [cfg.field]: value.trim() });
      await AsyncStorage.setItem(protectKey(cfg.field), protect ? '1' : '0');
      await refreshProfile();
      navigation.goBack();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally { setBusy(false); }
  };

  // ── Camera ────────────────────────────────────────────────
  if (mode === 'camera') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={camRef} style={{ flex: 1 }} facing="back" />
        {/* frame overlay */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff', marginBottom: 18, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 }}>{cfg.guide}</Text>
          <View style={{ width: frameW, height: frameH, borderRadius: 18, borderWidth: 2.5, borderColor: colors.accent }}>
            {[[0, 0], [0, 1], [1, 0], [1, 1]].map(([r, c], i) => (
              <View key={i} style={{ position: 'absolute', [r ? 'bottom' : 'top']: -2, [c ? 'right' : 'left']: -2, width: 26, height: 26, borderColor: '#fff', borderTopWidth: r ? 0 : 4, borderBottomWidth: r ? 4 : 0, borderLeftWidth: c ? 0 : 4, borderRightWidth: c ? 4 : 0, borderTopLeftRadius: !r && !c ? 18 : 0, borderTopRightRadius: !r && c ? 18 : 0, borderBottomLeftRadius: r && !c ? 18 : 0, borderBottomRightRadius: r && c ? 18 : 0 } as any} />
            ))}
          </View>
          <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 16, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 }}>Hold steady — avoid glare and shadows</Text>
        </View>
        {/* controls */}
        <View style={{ position: 'absolute', top: 54, left: 20 }}>
          <TouchableOpacity onPress={() => setMode('intro')} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={{ position: 'absolute', bottom: 46, left: 0, right: 0, alignItems: 'center' }}>
          <TouchableOpacity onPress={capture} style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,.4)' }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Intro + Review (scrollable sheet) ─────────────────────
  return (
    <View style={t.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={t.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={t.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
            <Text style={t.h2}>{cfg.title}</Text>
          </View>

          {/* captured/uploaded preview — only once an image actually exists;
              the scan frame + guidance live in the camera view, not here */}
          {mode === 'review' && imageUri ? (
            <View style={{ alignItems: 'center', marginBottom: 22 }}>
              <View style={{ width: frameW, height: frameH, borderRadius: 18, backgroundColor: colors.surfaceAlt, overflow: 'hidden', ...shadow.card }}>
                <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </View>
            </View>
          ) : null}

          {mode === 'review' ? (
            <>
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.sub, marginBottom: 7, marginLeft: 2 }}>
                {cfg.valueLabel}{ocrBusy ? ' · reading…' : ''}
              </Text>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder={cfg.placeholder}
                placeholderTextColor={colors.faint}
                keyboardType={cfg.keyboard}
                autoCapitalize="characters"
                style={[{ backgroundColor: colors.fieldBg, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, height: 54, fontFamily: font.semibold, color: colors.ink, fontSize: 15 }, inputReset]}
              />

              {/* Face ID protection */}
              <View style={[t.card, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, marginTop: 16, ...shadow.card }]}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.accentDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.ink }}>Protect with Face ID</Text>
                  <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 1 }}>Require Face ID to view this later</Text>
                </View>
                <Switch value={protect} onValueChange={setProtect} trackColor={{ true: colors.accent, false: colors.border }} />
              </View>

              {!!error && <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.danger, marginTop: 12 }}>{error}</Text>}

              <TouchableOpacity disabled={busy} onPress={save} style={[t.primaryBtn, { marginTop: 18, minHeight: 54 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={t.primaryBtnText}>Save to profile</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setImageUri(null); setMode('intro'); }} style={{ alignItems: 'center', marginTop: 14 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: colors.muted }}>{imageUri ? 'Retake or choose again' : 'Back to options'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* instructions */}
              <View style={[t.card, { padding: 16, marginBottom: 18, ...shadow.card }]}>
                <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Before you start</Text>
                <View style={{ gap: 10 }}>
                  {cfg.instructions.map((line, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.light} style={{ marginTop: 1 }} />
                      <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 13.5, color: colors.sub, lineHeight: 19 }}>{line}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {!!error && <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.danger, marginBottom: 12 }}>{error}</Text>}

              <TouchableOpacity onPress={openCamera} style={[t.primaryBtn, { minHeight: 56 }]}>
                <Ionicons name="camera-outline" size={18} color={colors.onDark} />
                <Text style={[t.primaryBtnText, { marginLeft: 8 }]}>{cfg.scanLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImage} style={[t.ghostBtn, { minHeight: 54, marginTop: 12 }]}>
                <Ionicons name="image-outline" size={18} color={colors.ink} />
                <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, marginLeft: 8 }}>Upload a photo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickDocument} style={[t.ghostBtn, { minHeight: 54, marginTop: 12 }]}>
                <Ionicons name="document-attach-outline" size={18} color={colors.ink} />
                <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, marginLeft: 8 }}>Upload a file (PDF)</Text>
              </TouchableOpacity>
              {cfg.allowType && (
                <TouchableOpacity onPress={() => setMode('review')} style={{ alignItems: 'center', marginTop: 18 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.accentDeep }}>Type it in instead</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Gate viewing a protected document value behind Face ID / biometrics.
 * Returns true if allowed (unprotected, or auth succeeded).
 */
export async function unlockDocument(field: Field): Promise<boolean> {
  const flag = await AsyncStorage.getItem(protectKey(field));
  if (flag !== '1') return true;
  const hasHw = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHw || !enrolled) return true; // no biometrics available — don't lock the user out
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock your saved document' });
  return res.success;
}
