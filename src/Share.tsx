import React, { RefObject, useState } from 'react';
import { Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Button, s } from './ui';

/** Shares a rendered card as an image, so the numbers travel with their context. */
export function ShareButton({ target, title }: { target: RefObject<View | null>; title: string }) {
  const [message, setMessage] = useState('');
  async function share() {
    setMessage('');
    try {
      if (!(await Sharing.isAvailableAsync())) { setMessage('Sharing is not available on this device.'); return; }
      const uri = await captureRef(target, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title });
    } catch { setMessage('Could not create the image to share.'); }
  }
  return <>
    <Button secondary title="Share this check" onPress={() => { void share(); }} />
    {message !== '' && <Text style={s.faint}>{message}</Text>}
  </>;
}
