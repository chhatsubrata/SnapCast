/**
 * Plays the bundled notification sound. The native OS notification is shown
 * silently (see main/notifications.ts); this gives one consistent tone across
 * platforms. A single reused Audio element avoids per-play allocation.
 */

import notificationSound from '@/assets/notification.mp3'

let audio: HTMLAudioElement | null = null

export function playNotificationSound(): void {
  try {
    if (!audio) audio = new Audio(notificationSound)
    audio.currentTime = 0
    void audio.play()
  } catch {
    // Autoplay can be blocked before any user gesture; ignore — it's non-critical.
  }
}
