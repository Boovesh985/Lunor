/**
 * react-native-web implements Alert.alert as a no-op, and has no
 * ActionSheetIOS / ToastAndroid. These shims render native-looking overlays
 * inside the preview so confirmations and toasts behave like on a device.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native-web';

export interface AlertButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
}

type Overlay =
  | { kind: 'alert'; id: number; title: string; message?: string; buttons: AlertButton[]; prompt?: { placeholder?: string; secure?: boolean; defaultValue?: string } }
  | { kind: 'sheet'; id: number; title?: string; message?: string; options: string[]; cancelIndex?: number; destructiveIndexes: number[]; onSelect: (index: number) => void };

let platform: 'ios' | 'android' = 'ios';
let queue: Overlay[] = [];
let toast: { id: number; message: string } | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setOverlayPlatform(p: 'ios' | 'android') {
  platform = p;
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    queue = [...queue, { kind: 'alert', id: nextId++, title: String(title ?? ''), message: message ? String(message) : undefined, buttons: buttons?.length ? buttons : [{ text: 'OK' }] }];
    emit();
  },
  prompt(title: string, message?: string, callbackOrButtons?: ((text: string) => void) | AlertButton[], type?: string, defaultValue?: string) {
    const buttons: AlertButton[] =
      typeof callbackOrButtons === 'function'
        ? [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', onPress: (v) => callbackOrButtons(v ?? '') }]
        : callbackOrButtons?.length
          ? callbackOrButtons
          : [{ text: 'Cancel', style: 'cancel' }, { text: 'OK' }];
    queue = [...queue, { kind: 'alert', id: nextId++, title, message, buttons, prompt: { secure: type === 'secure-text', defaultValue } }];
    emit();
  },
};

export const ActionSheetIOS = {
  showActionSheetWithOptions(
    opts: { options: string[]; cancelButtonIndex?: number; destructiveButtonIndex?: number | number[]; title?: string; message?: string },
    callback: (index: number) => void,
  ) {
    const destructive = opts.destructiveButtonIndex;
    queue = [
      ...queue,
      {
        kind: 'sheet',
        id: nextId++,
        title: opts.title,
        message: opts.message,
        options: opts.options ?? [],
        cancelIndex: opts.cancelButtonIndex,
        destructiveIndexes: Array.isArray(destructive) ? destructive : destructive != null ? [destructive] : [],
        onSelect: callback,
      },
    ];
    emit();
  },
  showShareActionSheetWithOptions() {
    console.warn('ActionSheetIOS.showShareActionSheetWithOptions is not available in the preview.');
  },
};

export const ToastAndroid = {
  SHORT: 2000,
  LONG: 3500,
  TOP: 0,
  BOTTOM: 1,
  CENTER: 2,
  show(message: string, duration = 2000) {
    const id = nextId++;
    toast = { id, message: String(message) };
    emit();
    setTimeout(() => {
      if (toast?.id === id) {
        toast = null;
        emit();
      }
    }, duration);
  },
  showWithGravity(message: string, duration: number) {
    ToastAndroid.show(message, duration);
  },
};

function dismiss(id: number) {
  queue = queue.filter((o) => o.id !== id);
  emit();
}

export function OverlayHost() {
  const [, force] = useState(0);
  const [promptValue, setPromptValue] = useState('');
  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);

  const current = queue[0];
  useEffect(() => {
    if (current?.kind === 'alert') setPromptValue(current.prompt?.defaultValue ?? '');
  }, [current?.id]);

  return (
    <>
      {current?.kind === 'alert' && (
        <View style={styles.backdrop}>
          <View style={[styles.alert, platform === 'android' && styles.alertAndroid]}>
            <Text style={[styles.alertTitle, platform === 'android' && styles.alertTitleAndroid]}>{current.title}</Text>
            {!!current.message && <Text style={[styles.alertMessage, platform === 'android' && styles.alertMessageAndroid]}>{current.message}</Text>}
            {current.prompt && (
              <TextInput
                autoFocus
                value={promptValue}
                onChangeText={setPromptValue}
                secureTextEntry={current.prompt.secure}
                style={styles.promptInput}
              />
            )}
            <View style={[current.buttons.length > 2 ? styles.buttonsColumn : styles.buttonsRow, platform === 'android' && styles.buttonsAndroid]}>
              {current.buttons.map((button, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    dismiss(current.id);
                    button.onPress?.(current.prompt ? promptValue : undefined);
                  }}
                  style={({ pressed }: { pressed: boolean }) => [
                    platform === 'android' ? styles.buttonAndroid : styles.button,
                    platform !== 'android' && current.buttons.length <= 2 && i > 0 && styles.buttonDivider,
                    pressed && { backgroundColor: 'rgba(0,0,0,0.06)' },
                  ]}
                >
                  <Text
                    style={[
                      platform === 'android' ? styles.buttonTextAndroid : styles.buttonText,
                      button.style === 'cancel' && platform !== 'android' && { fontWeight: '600' },
                      button.style === 'destructive' && { color: '#FF3B30' },
                    ]}
                  >
                    {platform === 'android' ? (button.text ?? 'OK').toUpperCase() : (button.text ?? 'OK')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
      {current?.kind === 'sheet' && (
        <Pressable style={[styles.backdrop, styles.sheetBackdrop]} onPress={() => { dismiss(current.id); if (current.cancelIndex != null) current.onSelect(current.cancelIndex); }}>
          <View style={styles.sheet}>
            <View style={styles.sheetGroup}>
              {(!!current.title || !!current.message) && (
                <View style={styles.sheetHeader}>
                  {!!current.title && <Text style={styles.sheetTitle}>{current.title}</Text>}
                  {!!current.message && <Text style={styles.sheetMessage}>{current.message}</Text>}
                </View>
              )}
              {current.options.map((option, i) =>
                i === current.cancelIndex ? null : (
                  <Pressable key={i} style={styles.sheetButton} onPress={() => { dismiss(current.id); current.onSelect(i); }}>
                    <Text style={[styles.sheetButtonText, current.destructiveIndexes.includes(i) && { color: '#FF3B30' }]}>{option}</Text>
                  </Pressable>
                ),
              )}
            </View>
            {current.cancelIndex != null && (
              <Pressable style={[styles.sheetGroup, styles.sheetButton, { marginTop: 8 }]} onPress={() => { dismiss(current.id); current.onSelect(current.cancelIndex!); }}>
                <Text style={[styles.sheetButtonText, { fontWeight: '600' }]}>{current.options[current.cancelIndex] ?? 'Cancel'}</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      )}
      {toast && (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  alert: { width: 270, borderRadius: 14, backgroundColor: 'rgba(250,250,250,0.98)', overflow: 'hidden', alignItems: 'stretch' },
  alertAndroid: { width: 300, borderRadius: 28, backgroundColor: '#ECE6F0', padding: 24, paddingBottom: 12 },
  alertTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center', color: '#000', paddingTop: 18, paddingHorizontal: 16 },
  alertTitleAndroid: { textAlign: 'left', fontSize: 22, fontWeight: '400', paddingTop: 0, paddingHorizontal: 0, color: '#1D1B20' },
  alertMessage: { fontSize: 13, textAlign: 'center', color: '#000', marginTop: 4, paddingHorizontal: 16, lineHeight: 18 },
  alertMessageAndroid: { textAlign: 'left', fontSize: 14, color: '#49454F', marginTop: 14, paddingHorizontal: 0, lineHeight: 20 },
  promptInput: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, backgroundColor: '#fff' },
  buttonsRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.29)', marginTop: 18 },
  buttonsColumn: { flexDirection: 'column', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.29)', marginTop: 18 },
  buttonsAndroid: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 0, marginTop: 20, gap: 8 },
  button: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderTopWidth: 0 },
  buttonDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(60,60,67,0.29)' },
  buttonAndroid: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20 },
  buttonText: { fontSize: 17, color: '#007AFF' },
  buttonTextAndroid: { fontSize: 14, fontWeight: '600', color: '#6750A4', letterSpacing: 0.5 },
  sheetBackdrop: { justifyContent: 'flex-end', paddingBottom: 8 },
  sheet: { width: '100%', paddingHorizontal: 8 },
  sheetGroup: { backgroundColor: 'rgba(250,250,250,0.98)', borderRadius: 13, overflow: 'hidden' },
  sheetHeader: { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.29)' },
  sheetTitle: { fontSize: 13, fontWeight: '600', color: '#8a8a8e' },
  sheetMessage: { fontSize: 13, color: '#8a8a8e', marginTop: 2, textAlign: 'center' },
  sheetButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.29)' },
  sheetButtonText: { fontSize: 20, color: '#007AFF' },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 48, alignItems: 'center', zIndex: 9999 },
  toast: { backgroundColor: 'rgba(40,40,40,0.92)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxWidth: '80%' },
  toastText: { color: '#fff', fontSize: 14 },
});
