export const POMODORO_PERMISSION_SETUP_EVENT = 'pomodoro-permission-setup-requested'

export type PomodoroPermissionSetupStatus = 'pending' | 'enabled' | 'dismissed'
export type AudioInitializationResult = 'initialized' | 'not-configured' | 'blocked'
export type AudioPlaybackResult = 'played' | 'not-configured' | 'blocked'
export type AudioOperationResult = AudioInitializationResult | AudioPlaybackResult
export type NotificationPermissionResult = 'granted' | 'denied' | 'default' | 'unsupported' | 'failed'

export function getNotificationPermission(): Exclude<NotificationPermissionResult, 'failed'> {
  if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return 'unsupported'
  return window.Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  const currentPermission = getNotificationPermission()
  if (currentPermission !== 'default') return currentPermission

  try {
    const permission = await window.Notification.requestPermission()
    return permission
  } catch {
    return 'failed'
  }
}

export function showPomodoroNotification(title: string, body: string, tag: string) {
  if (getNotificationPermission() !== 'granted') return false

  try {
    new window.Notification(title, { body, tag })
    return true
  } catch {
    return false
  }
}

export function getPomodoroNotificationIdentity(session: {
  mode: string
  startedAt: number
  endsAt: number | null
  completedAt: number | null
}) {
  return `${session.mode}:${session.startedAt}:${session.endsAt ?? session.completedAt ?? 'unknown'}`
}

export function combineAudioInitializationResults(
  ...results: AudioOperationResult[]
): AudioInitializationResult {
  if (results.some((result) => result === 'blocked')) return 'blocked'
  if (results.some((result) => result === 'initialized' || result === 'played')) return 'initialized'
  return 'not-configured'
}

export function getPermissionSetupFeedback(
  audio: AudioInitializationResult,
  notifications: NotificationPermissionResult,
) {
  const audioBlocked = audio === 'blocked'
  const audioNotConfigured = audio === 'not-configured'
  const notificationsUnavailable = notifications !== 'granted'

  if (!audioBlocked && !notificationsUnavailable && !audioNotConfigured) {
    return { kind: 'success' as const, message: 'Sound interaction and notifications are enabled. Audible playback will be checked when a sound starts.' }
  }

  if (!audioBlocked && !notificationsUnavailable && audioNotConfigured) {
    return { kind: 'success' as const, message: 'Notifications are ready. Sound remains governed by your current Pomodoro preferences.' }
  }

  if (audioBlocked && !notificationsUnavailable) {
    return { kind: 'error' as const, message: 'Notifications are ready, but browser audio is blocked. Use Enable sound when it appears or check the browser site sound setting.' }
  }

  if (!audioBlocked && notificationsUnavailable) {
    return { kind: 'error' as const, message: 'Sound interaction was initialized, but browser notifications are unavailable or denied. Your current Pomodoro preferences were preserved.' }
  }

  return { kind: 'error' as const, message: 'Some sound and notification capabilities remain unavailable. Your current Pomodoro preferences were preserved.' }
}

export function getAudioSetupFeedback(audio: AudioInitializationResult) {
  if (audio === 'blocked') {
    return { kind: 'error' as const, message: 'Browser audio is blocked. Check the browser site sound setting and try Enable sound again.' }
  }

  if (audio === 'not-configured') {
    return { kind: 'success' as const, message: 'Browser audio setup completed. Your current sound preferences were preserved.' }
  }

  return { kind: 'success' as const, message: 'Audio interaction was initialized. Audible playback will be checked when a sound starts.' }
}

export function getAudioRetryFeedback(audio: AudioOperationResult) {
  if (audio === 'blocked') {
    return { kind: 'error' as const, message: 'Browser audio is still blocked. Check the browser site sound setting and try again.' }
  }

  if (audio === 'not-configured') {
    return { kind: 'success' as const, message: 'No audio was started because your current sound preferences are disabled or no sound is selected.' }
  }

  if (audio === 'played') {
    return { kind: 'success' as const, message: 'Browser audio played successfully. Your current sound preferences were preserved.' }
  }

  return { kind: 'success' as const, message: 'Audio interaction was initialized. Your current sound preferences were preserved.' }
}
