export const POMODORO_AUDIO_SETUP_EVENT = 'pomodoro-audio-setup-requested'

export type PomodoroPermissionSetupStatus = 'pending' | 'enabled' | 'dismissed'
export type AudioInitializationResult = 'initialized' | 'not-configured' | 'blocked'
export type AudioPlaybackResult = 'played' | 'not-configured' | 'blocked'
export type AudioOperationResult = AudioInitializationResult | AudioPlaybackResult

export function combineAudioInitializationResults(
  ...results: AudioOperationResult[]
): AudioInitializationResult {
  if (results.some((result) => result === 'blocked')) return 'blocked'
  if (results.some((result) => result === 'initialized' || result === 'played')) return 'initialized'
  return 'not-configured'
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
