function vibrate(pattern: number | number[]) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // vibration not supported — silent
  }
}

export const hapticBid     = () => vibrate(50);
export const hapticSuccess = () => vibrate([30, 40, 80]);
export const hapticError   = () => vibrate([80, 30, 80]);
export const hapticLeading = () => vibrate([20, 20, 20]);
export const hapticBooster = () => vibrate([40, 60, 40, 60, 120]);
