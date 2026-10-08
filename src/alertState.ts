/** Notify only on the move from over the limit to within it, so a steady state never repeats. */
export function nextAlertState(alert: { band: number; within: boolean }, differenceBps: number) {
  const within = differenceBps <= alert.band;
  return { within, notify: within && !alert.within };
}
