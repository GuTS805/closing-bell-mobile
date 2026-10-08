import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export const colors = {
  bg: '#0b0e10', card: '#14181b', sunk: '#07090b', line: '#272c30', lineBright: '#3d4349',
  ink: '#f5f6f7', muted: '#bac0c8', faint: '#939da8', gold: '#f2c84b', goldBright: '#ffdb78',
  green: '#32db8a', red: '#f07870', blue: '#91b5e2',
};
const font = { display: 'Manrope_700Bold', regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' };

export function Label({ children }: { children: React.ReactNode }) { return <Text style={s.label}>{children}</Text>; }
export function Copy({ children }: { children: React.ReactNode }) { return <Text style={s.copy}>{children}</Text>; }

export function Button({ title, onPress, disabled, secondary }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled}
    style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || pressed) && s.dim]}>
    <Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text>
    {!secondary && <Text style={s.buttonArrow}>→</Text>}
  </Pressable>;
}

export function Pill({ title, tone = 'gold' }: { title: string; tone?: 'gold' | 'green' | 'red' | 'muted' }) {
  const color = tone === 'green' ? colors.green : tone === 'red' ? colors.red : tone === 'muted' ? colors.faint : colors.gold;
  return <View style={[s.pill, { borderColor: `${color}44` }]}><View style={[s.pillDot, { backgroundColor: color }]} /><Text style={[s.pillText, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{title}</Text></View>;
}

export function DataRow({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return <View style={s.dataRow}><View style={s.flex}><Text style={s.dataLabel}>{label}</Text>{hint && <Text style={s.dataHint}>{hint}</Text>}</View><Text style={[s.dataValue, accent && { color: colors.goldBright }]} numberOfLines={1}>{value}</Text></View>;
}

export function Notice({ message, loading, retry }: { message: string; loading?: boolean; retry?: () => void }) {
  return <View style={s.notice}>{loading && <ActivityIndicator color={colors.gold} />}<Copy>{message}</Copy>{retry && <Button secondary title="Try again" onPress={retry} />}</View>;
}

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 18 },
  label: { color: colors.gold, fontSize: 10, fontFamily: font.bold, letterSpacing: 1.8, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 36, lineHeight: 40, fontFamily: font.display, letterSpacing: -1.5 },
  subtitle: { color: colors.ink, fontSize: 18, lineHeight: 24, fontFamily: font.display, letterSpacing: -0.4 },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 20, fontFamily: font.regular },
  faint: { color: colors.faint, fontSize: 11, lineHeight: 16, fontFamily: font.medium },
  card: { padding: 18, borderRadius: 10, backgroundColor: colors.card, gap: 12, borderWidth: 1, borderColor: colors.line },
  notice: { padding: 15, borderRadius: 9, backgroundColor: colors.sunk, gap: 10, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  logo: { width: 38, height: 38 },
  brand: { color: colors.ink, fontSize: 20, fontFamily: font.display, letterSpacing: -0.8 },
  brandGold: { color: colors.goldBright },
  hero: { paddingVertical: 10, gap: 13 },
  compactHero: { paddingVertical: 4, gap: 7 },
  heroTitle: { color: colors.ink, fontSize: 41, lineHeight: 44, fontFamily: font.display, letterSpacing: -2 },
  sectionHeading: { color: colors.ink, fontSize: 22, fontFamily: font.display, letterSpacing: -0.8 },
  button: { backgroundColor: colors.ink, borderWidth: 1, borderColor: '#ffe191', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 8, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row', minHeight: 50 },
  buttonText: { color: colors.bg, fontFamily: font.bold, fontSize: 13 },
  buttonArrow: { color: colors.bg, fontFamily: font.bold, fontSize: 19, lineHeight: 20 },
  secondary: { backgroundColor: colors.sunk, borderColor: colors.lineBright, justifyContent: 'center' },
  secondaryText: { color: colors.ink },
  dim: { opacity: 0.48 },
  value: { color: colors.ink, fontSize: 34, lineHeight: 39, fontFamily: font.display, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  marketPrice: { color: colors.ink, fontSize: 26, lineHeight: 30, fontFamily: font.display, letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  input: { color: colors.ink, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.lineBright, paddingHorizontal: 15, paddingVertical: 13, borderRadius: 8, fontSize: 18, fontFamily: font.medium, fontVariant: ['tabular-nums'] },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg, paddingHorizontal: 8, paddingBottom: 6 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, minHeight: 48, borderTopWidth: 2, borderTopColor: 'transparent' },
  activeTab: { borderTopColor: colors.gold },
  tabText: { color: colors.faint, fontSize: 11, fontFamily: font.bold },
  selected: { color: colors.goldBright },
  badge: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f2c84b14' },
  badgeText: { fontSize: 21, fontFamily: font.display },
  flex: { flex: 1 },
  back: { color: colors.goldBright, fontSize: 13, fontFamily: font.bold },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.sunk },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, fontFamily: font.bold },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  dataLabel: { color: colors.ink, fontSize: 12, fontFamily: font.semibold },
  dataHint: { color: colors.faint, fontSize: 10, lineHeight: 15, marginTop: 3, fontFamily: font.regular },
  dataValue: { color: colors.ink, fontSize: 15, fontFamily: font.bold, fontVariant: ['tabular-nums'] },
  bandOption: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineBright, borderRadius: 7, backgroundColor: colors.sunk },
  bandSelected: { borderColor: colors.gold, backgroundColor: '#f2c84b13' },
  bandText: { color: colors.muted, fontSize: 12, fontFamily: font.bold },
  resultCard: { borderColor: '#f2c84b55' },
  resultGreen: { borderColor: '#32db8a66' },
  resultRed: { borderColor: '#f0787066' },
});
