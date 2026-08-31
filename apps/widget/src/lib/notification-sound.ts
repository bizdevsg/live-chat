const NOTIFICATION_SOUND_SRC = "/sound-notif/universfield-new-notification-056-494256.mp3";

let unlocked = false;
let pendingPlayback = false;
let cachedAudio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;

  if (!cachedAudio) {
    cachedAudio = new Audio(NOTIFICATION_SOUND_SRC);
    cachedAudio.preload = "auto";
  }

  return cachedAudio;
}

export function prepareNotificationSound() {
  if (typeof window === "undefined") return () => undefined;

  const audio = getAudio();
  if (audio) {
    try {
      audio.load();
    } catch {
      // Ignore preload errors until playback is attempted.
    }
  }

  const unlockAudio = () => {
    const currentAudio = getAudio();
    if (!currentAudio || unlocked) return;

    currentAudio.muted = true;
    void currentAudio.play()
      .then(() => {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.muted = false;
        unlocked = true;

        if (!pendingPlayback) return;
        pendingPlayback = false;
        playNotificationSound();
      })
      .catch(() => {
        currentAudio.muted = false;
      });
  };

  const handleInteraction = () => {
    if (unlocked) return;
    unlockAudio();
  };

  window.addEventListener("pointerdown", handleInteraction, { passive: true });
  window.addEventListener("keydown", handleInteraction);

  return () => {
    window.removeEventListener("pointerdown", handleInteraction);
    window.removeEventListener("keydown", handleInteraction);
  };
}

export function playNotificationSound() {
  const audio = getAudio();
  if (!audio || !unlocked) {
    pendingPlayback = true;
    return;
  }

  audio.muted = false;
  audio.pause();
  audio.currentTime = 0;
  void audio.play().catch(() => {
    pendingPlayback = true;
  });
}
