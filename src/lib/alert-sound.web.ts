let audio: AudioContext | undefined;
export async function primeAlertSound() {
  if (typeof window === "undefined") return;
  audio ||= new AudioContext();
  await audio.resume();
}
export async function playAlertSound() {
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;
  for (const [frequency, delay] of [
    [659, 0],
    [880, 0.18],
  ]) {
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.12, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + 0.32);
  }
}
