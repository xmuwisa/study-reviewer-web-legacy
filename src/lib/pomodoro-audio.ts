// Keep the audio assets, preferences, and playback integration centralized so
// the web and desktop runtimes can share the same Pomodoro audio model.
export const WEB_AUTOMATIC_ALARM_AUDIO_ENABLED = true
export const WEB_AUTOMATIC_AMBIENCE_AUDIO_ENABLED = true
export const WEB_AUTOMATIC_AUDIO_SETTINGS_VISIBLE = true

export const POMODORO_ALARM_OPTIONS = [
  { value: 'none', label: 'None', src: null },
  { value: 'classic-alarm', label: 'Classic Alarm', src: '/audio/alarms/classic-alarm.wav' },
  { value: 'happy-bells-alarm', label: 'Happy Bells', src: '/audio/alarms/happy-bells-alarm.wav' },
  { value: 'musical-alarm', label: 'Musical Alarm', src: '/audio/alarms/musical-alarm.wav' },
  { value: 'rooster-alarm', label: 'Rooster', src: '/audio/alarms/rooster-alarm.wav' },
  { value: 'slot-machine-alarm', label: 'Slot Machine', src: '/audio/alarms/slot-machine-alarm.wav' },
] as const

export const POMODORO_AMBIENCE_OPTIONS = [
  { value: 'none', label: 'None', src: null },
  { value: 'forest-birds-ambience', label: 'Forest Birds', src: '/audio/ambience/forest-birds-ambience.wav' },
  { value: 'light-rain-ambience', label: 'Light Rain', src: '/audio/ambience/light-rain-ambience.wav' },
  { value: 'louder-long-rain-ambience', label: 'Louder Long Rain', src: '/audio/ambience/louder-long-rain-ambience.wav' },
  { value: 'sea-waves-ambience', label: 'Sea Waves', src: '/audio/ambience/sea-waves-ambience.wav' },
] as const

export const POMODORO_SNOOZE_OPTIONS = [5, 10, 15] as const

export type PomodoroAlarmSelection = (typeof POMODORO_ALARM_OPTIONS)[number]['value']
export type PomodoroAmbienceSelection = (typeof POMODORO_AMBIENCE_OPTIONS)[number]['value']
export type PomodoroSnoozeMinutes = (typeof POMODORO_SNOOZE_OPTIONS)[number]
