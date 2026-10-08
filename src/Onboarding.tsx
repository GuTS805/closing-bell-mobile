import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Copy, Label, s } from './ui';

const steps = [
  { label: '01 / THE GAP', title: 'Same token, different prices.', body: "xStocks like SPYx trade in Solana pools. The price Jupiter fills you at can sit above xStocks' own price for the same token, and the swap screen doesn't tell you." },
  { label: '02 / YOUR LIMIT', title: 'Decide what you will pay.', body: "Pick how far above xStocks' price you'll accept. Closing Bell checks the live Jupiter route for your exact amount against that limit." },
  { label: '03 / PROTECTION', title: 'Let the chain enforce it.', body: "When the route is inside your limit, we turn it into Jupiter settings that cancel the swap on-chain if the price runs past your limit. We never sign or move your funds." },
];

export function Onboarding({ done }: { done: () => void }) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const last = step === steps.length - 1;
  return <SafeAreaView style={[s.root, s.onboarding]}>
    <View style={s.row}><Text style={s.brand}>Closing <Text style={s.brandGold}>Bell.</Text></Text>
      <Pressable accessibilityRole="button" onPress={done}><Text style={s.back}>Skip</Text></Pressable></View>
    <View style={s.onboardingBody}>
      <Label>{current.label}</Label>
      <Text style={s.title}>{current.title}</Text>
      <Copy>{current.body}</Copy>
    </View>
    <View style={s.dots}>{steps.map((_, index) => <View key={index} style={[s.dot, index === step && s.dotActive]} />)}</View>
    <Button title={last ? 'Start checking' : 'Next'} onPress={() => last ? done() : setStep(step + 1)} />
  </SafeAreaView>;
}
