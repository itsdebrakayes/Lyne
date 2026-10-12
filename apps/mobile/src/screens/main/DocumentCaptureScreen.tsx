/**
 * DocumentCaptureScreen — Apple-Wallet-style document capture.
 *
 * Flow: intro (instructions + choose Scan / Upload / Type) → camera (a framed
 * cut-out sized to the document, with guidance) or file upload → review (the
 * captured image + a confirm/enter field + optional Face ID protection) → save.
 *
 * A number already saved opens on "on file" instead: masked, revealed only
 * after Face ID or the device passcode when protection is on, then editable or
 * removable. It used to open the same scan flow as a first-timer.
 *
 * Reading the number happens on the phone (modules/text-reader: Apple Vision,
 * Google ML Kit), for photos and PDFs alike, and lib/trn.ts picks the TRN out
 * of the text. When nothing convincing is found the field turns red and says
 * so, with a retake, instead of silently staying empty.
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
import { clearDocument, getDocument, isProtected, setDocument, setProtected } from '../../lib/documentVault';
import { readImageText, readPdfText } from '../../../modules/text-reader/src';
import { extractTrn, formatTrn, isValidTrn } from '../../lib/trn';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useNavBarLift } from '../../lib/insets';

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
      'Or scan the paper TRN. Some agencies ask for it',
      'If scanning, keep the sheet flat and well-lit',
    ],
  },
};

type Source = 'camera' | 'photo' | 'file';

const READ_FAILED = "We couldn't read a TRN from this image. Retake the photo or type it in.";
const READ_FAILED_PDF = "We couldn't read a TRN from this file. Choose another file or type it in.";

/** "•••-•••-789": enough to recognise your own number, not enough to copy it. */
function masked(value: string): string {
  const d = value.replace(/\D/g, '');
  return d.length >= 3 ? `•••-•••-${d.slice(-3)}` : '•••';
}

const protectKey = (field: Field) => `lyne.doc-protected.${field}`;

export default function DocumentCaptureScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'DocumentCapture'>>();
  const { user, refreshProfile } = useAuth();
  const { width } = useWindowDimensions();
  const lift = useNavBarLift();
  const cfg = DOC_CONFIG[(route.params?.field as Field) || 'national_id'];

  const [mode, setMode] = useState<'loading' | 'onfile' | 'intro' | 'camera' | 'review'>('loading');
  const [saved, setSaved] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [readFailed, setReadFailed] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  /* Loaded from the keychain below rather than read off the server profile.
     user.trn / user.national_id are always empty — the API refuses those
     fields on purpose (see routes/auth.js) — so seeding from them showed an
     empty box to somebody who had already saved a number. */
  const [value, setValue] = useState('');
  const [protect, setProtect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [error, setError] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);

  // Load the saved "protected" preference for this doc.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [saved, prot] = await Promise.all([getDocument(cfg.field), isProtected(cfg.field)]);
      if (cancelled) return;
      setProtect(prot);
      if (saved) { setSaved(saved); setValue(saved); setMode('onfile'); } else setMode('intro');
    })();
    return () => { cancelled = true; };
  }, [cfg.field]);

  // Frame dimensions — credit-card ratio for cards, portrait for pages.
  const frameW = Math.round(width * (cfg.kind === 'card' ? 0.84 : 0.72));
  const frameH = Math.round(cfg.kind === 'card' ? frameW / 1.586 : frameW * 1.32);

  /* Only a TRN is read automatically: its shape is known (nine digits) and
     lib/trn.ts can tell a real one from noise. A National ID scan keeps the
     picture and leaves the number to be typed. */
  const runOcr = async (uri: string, kind: 'image' | 'pdf') => {
    setReadFailed(null);
    if (cfg.field !== 'trn') return;
    setOcrBusy(true);
    try {
      const lines = kind === 'pdf' ? await readPdfText(uri) : await readImageText(uri);
      const found = extractTrn(lines);
      if (found) setValue(found);
      else setReadFailed(kind === 'pdf' ? READ_FAILED_PDF : READ_FAILED);
    } catch {
      setReadFailed(kind === 'pdf' ? READ_FAILED_PDF : READ_FAILED);
    } finally {
      setOcrBusy(false);
    }
  };

  const retake = () => {
    if (source === 'camera') openCamera();
    else if (source === 'photo') pickImage();
    else if (source === 'file') pickDocument();
    else setMode('intro');
  };

  const reveal = async () => {
    if (await unlockDocument(cfg.field)) setRevealed(true);
  };

  const editSaved = () => {
    setValue(saved || ''); setImageUri(null); setFileName(null); setSource(null); setReadFailed(null);
    setMode('review');
  };

  const removeSaved = async () => {
    await clearDocument(cfg.field);
    setSaved(null); setValue(''); setRevealed(false); setConfirmRemove(false); setProtect(false);
    setMode('intro');
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
      if (photo?.uri) { setSource('camera'); setFileName(null); setValue(''); setImageUri(photo.uri); setMode('review'); runOcr(photo.uri, 'image'); }
    } catch { setError('Could not take the photo. Try again or upload a file.'); }
  };

  const pickImage = async () => {
    setError('');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled && res.assets[0]?.uri) { setSource('photo'); setFileName(null); setValue(''); setImageUri(res.assets[0].uri); setMode('review'); runOcr(res.assets[0].uri, 'image'); }
  };

  const pickDocument = async () => {
    setError('');
    const res = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (!res.canceled && res.assets?.[0]?.uri) {
      const a = res.assets[0];
      const isImage = !!a.mimeType?.startsWith('image/');
      setSource('file'); setValue('');
      setImageUri(isImage ? a.uri : null);
      setFileName(isImage ? null : a.name || 'Document.pdf');
      setMode('review');
      runOcr(a.uri, isImage ? 'image' : 'pdf');
    }
  };

  const save = async () => {
    if (!value.trim()) { setError(`Enter or confirm your ${cfg.valueLabel.toLowerCase()} to save.`); return; }
    if (cfg.field === 'trn' && !isValidTrn(value)) { setError('A TRN is nine digits, like 123-456-789.'); return; }
    setBusy(true); setError('');
    try {
      /* The keychain, not the API.
         This used to PATCH /auth/profile, which destructures only full_name,
         phone and date_of_birth — so the number was sent over the network and
         then silently dropped. Nothing stored it, and the Profile row still
         read "Add TRN" afterwards. The vault is where the privacy policy says
         this lives, and now it actually does. */
      await setDocument(cfg.field, cfg.field === 'trn' ? formatTrn(value.trim()) : value.trim());
      await setProtected(cfg.field, protect);
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
          <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 16, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 4 }}>Hold steady. Avoid glare and shadows</Text>
        </View>
        {/* controls */}
        <View style={{ position: 'absolute', top: 54, left: 20 }}>
          <TouchableOpacity onPress={() => setMode('intro')} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={{ position: 'absolute', bottom: 46 + lift, left: 0, right: 0, alignItems: 'center' }}>
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
          {mode === 'review' && fileName ? (
            <View style={[t.card, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, marginBottom: 18, ...shadow.card }]}>
              <Ionicons name="document-text-outline" size={22} color={colors.accentDeep} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, color: colors.ink }}>{fileName}</Text>
            </View>
          ) : null}

          {mode === 'loading' ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
          ) : mode === 'onfile' ? (
            <>
              <View style={[t.card, { padding: 18, ...shadow.card }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.light} />
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: colors.ink }}>{cfg.title} on file</Text>
                  {protect && <Ionicons name="lock-closed" size={14} color={colors.muted} style={{ marginLeft: 'auto' }} />}
                </View>
                <Text
                  selectable={revealed}
                  accessibilityLabel={revealed ? `${cfg.title} ${saved}` : `${cfg.title} hidden`}
                  style={{ fontFamily: font.extra, fontSize: 24, letterSpacing: 1.5, color: colors.ink, marginTop: 14 }}
                >
                  {revealed ? saved : masked(saved || '')}
                </Text>
                <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 6 }}>
                  Kept on this phone only. Never uploaded.
                </Text>
              </View>
              {!revealed ? (
                <TouchableOpacity onPress={reveal} style={[t.primaryBtn, { minHeight: 54, marginTop: 18 }]} accessibilityRole="button">
                  <Ionicons name={protect ? 'lock-open-outline' : 'eye-outline'} size={18} color={colors.onDark} />
                  <Text style={[t.primaryBtnText, { marginLeft: 8 }]}>Show {cfg.title}</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                  <TouchableOpacity onPress={editSaved} style={[t.ghostBtn, { flex: 1, minHeight: 54 }]} accessibilityRole="button">
                    <Ionicons name="create-outline" size={18} color={colors.ink} />
                    <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, marginLeft: 8 }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setConfirmRemove(true)} style={[t.ghostBtn, { flex: 1, minHeight: 54 }]} accessibilityRole="button">
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.danger, marginLeft: 8 }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : mode === 'review' ? (
            <>
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.sub, marginBottom: 7, marginLeft: 2 }}>
                {cfg.valueLabel}{ocrBusy ? ' · reading…' : ''}
              </Text>
              <TextInput
                value={value}
                onChangeText={(v) => { setValue(v); if (readFailed) setReadFailed(null); if (error) setError(''); }}
                placeholder={cfg.placeholder}
                placeholderTextColor={colors.faint}
                keyboardType={cfg.keyboard}
                autoCapitalize="characters"
                accessibilityLabel={cfg.valueLabel}
                accessibilityHint={readFailed || undefined}
                style={[{ backgroundColor: colors.fieldBg, borderWidth: 1.5, borderColor: readFailed ? colors.danger : colors.border, borderRadius: 16, paddingHorizontal: 16, height: 54, fontFamily: font.semibold, color: colors.ink, fontSize: 15 }, inputReset]}
              />
              {readFailed && (
                <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14, marginTop: 10, gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Ionicons name="alert-circle" size={17} color={colors.danger} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>{readFailed}</Text>
                  </View>
                  <TouchableOpacity onPress={retake} accessibilityRole="button" style={{ alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.danger, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={source === 'file' ? 'document-attach-outline' : 'camera-outline'} size={16} color={colors.danger} />
                    <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.danger }}>{source === 'file' ? 'Choose another file' : 'Retake'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Face ID protection */}
              <View style={[t.card, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, marginTop: 16, ...shadow.card }]}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.accentDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.ink }}>{Platform.OS === 'ios' ? 'Protect with Face ID' : 'Protect with your fingerprint'}</Text>
                  <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 1 }}>Ask for it, or your passcode, before showing this</Text>
                </View>
                <Switch value={protect} onValueChange={setProtect} trackColor={{ true: colors.accent, false: colors.border }} />
              </View>

              {!!error && <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.danger, marginTop: 12 }}>{error}</Text>}

              <TouchableOpacity disabled={busy} onPress={save} style={[t.primaryBtn, { marginTop: 18, minHeight: 54 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={t.primaryBtnText}>Save to profile</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setImageUri(null); setFileName(null); setReadFailed(null); setMode(saved ? 'onfile' : 'intro'); }} style={{ alignItems: 'center', marginTop: 14 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: colors.muted }}>{saved ? 'Cancel' : imageUri || fileName ? 'Retake or choose again' : 'Back to options'}</Text>
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
              {/* Typing is the likely path for a TRN, not the consolation
                  prize — most people know theirs and no scan beats nine digits
                  from memory. It was a 14pt line of text under two 54pt
                  buttons, which made the easiest route the hardest to see. It
                  is a real target now, and quieter than the two above only in
                  weight, not in size. */}
              {cfg.allowType && (
                <TouchableOpacity
                  onPress={() => setMode('review')}
                  accessibilityRole="button"
                  style={{ minHeight: 54, borderRadius: 16, marginTop: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}
                >
                  <Text style={{ fontFamily: font.extra, fontSize: 15.5, color: colors.accentDeep }}>Type it in instead</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmSheet
        visible={confirmRemove}
        title={`Remove your ${cfg.title}?`}
        message={`It is deleted from this phone. You can add it again any time.`}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        icon="trash-outline"
        onConfirm={removeSaved}
        onCancel={() => setConfirmRemove(false)}
      />
    </View>
  );
}

/**
 * Gate viewing a protected document value behind Face ID / biometrics.
 * Returns true if allowed (unprotected, or auth succeeded).
 */
export async function unlockDocument(field: Field): Promise<boolean> {
  if (!(await isProtected(field))) return true;
  /* Biometrics where enrolled, otherwise the device passcode. A phone with no
     lock at all has nothing to ask for, and locking the owner out of their own
     number would be worse than showing it. */
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) return true;
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock your saved document',
    fallbackLabel: 'Use passcode',
    disableDeviceFallback: false,
  });
  return res.success;
}
