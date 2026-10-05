import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export const colors = { bg: '#101413', card: '#1b211e', line: '#303932', ink: '#f0eee5', muted: '#9ba59b', gold: '#d7c18b' };
export function Label({ children }: { children: React.ReactNode }) { return <Text style={s.label}>{children}</Text>; }
export function Copy({ children }: { children: React.ReactNode }) { return <Text style={s.copy}>{children}</Text>; }
export function Button({ title, onPress, disabled, secondary }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled} style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || pressed) && s.dim]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text></Pressable>;
}
export function Notice({ message, loading, retry }: { message: string; loading?: boolean; retry?: () => void }) {
  return <View style={s.card}>{loading && <ActivityIndicator color={colors.gold} />}<Copy>{message}</Copy>{retry && <Button secondary title="Try again" onPress={retry} />}</View>;
}
export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg }, content: { padding: 24, paddingBottom: 32, gap: 20 },
  label: { color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 38, fontWeight: '600', letterSpacing: -1.5 },
  subtitle: { color: colors.ink, fontSize: 22, fontWeight: '500' }, copy: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  card: { padding: 20, borderRadius: 20, backgroundColor: colors.card, gap: 12, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  button: { backgroundColor: colors.gold, padding: 16, borderRadius: 12, alignItems: 'center', minHeight: 48 },
  buttonText: { color: colors.bg, fontWeight: '700', fontSize: 15 }, secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line }, secondaryText: { color: colors.ink },
  dim: { opacity: 0.5 }, value: { color: colors.ink, fontSize: 30, fontWeight: '500', fontVariant: ['tabular-nums'] },
  input: { color: colors.ink, borderWidth: 1, borderColor: colors.line, padding: 16, borderRadius: 12, fontSize: 18 },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 12 }, tab: { flex: 1, alignItems: 'center', paddingVertical: 12, minHeight: 48 }, tabText: { color: colors.muted, fontSize: 12, fontWeight: '600' }, selected: { color: colors.gold },
  badge: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.line }, badgeText: { fontSize: 21, fontWeight: '600' }, flex: { flex: 1 }, back: { color: colors.gold, fontSize: 15 },
});
