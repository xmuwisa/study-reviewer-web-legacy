import { expect, test } from 'bun:test'

import { removeLegacyAutomaticAmbiencePreference } from '../src/lib/pomodoro-audio'
import { PomodoroAudioManager } from '../src/lib/pomodoro-audio-controller'

class FakeAudio {
  readonly source: string
  loop = false
  muted = false
  preload = ''
  currentTime = 0
  paused = true
  ended = false
  playCalls = 0
  rejectNextPlay = false
  private readonly listeners = new Map<string, Set<() => void>>()

  constructor(source: string) {
    this.source = source
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set<() => void>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener)
  }

  load() {}

  pause() {
    this.paused = true
  }

  play() {
    this.playCalls += 1
    if (this.rejectNextPlay) {
      this.rejectNextPlay = false
      return Promise.reject(new Error('NotAllowedError'))
    }

    this.paused = false
    return Promise.resolve()
  }

  emitError() {
    this.listeners.get('error')?.forEach((listener) => listener())
  }

  emitEnded() {
    this.ended = true
    this.paused = true
    this.listeners.get('ended')?.forEach((listener) => listener())
  }
}

function createManager() {
  const audios: FakeAudio[] = []
  const manager = new PomodoroAudioManager((source) => {
    const audio = new FakeAudio(source)
    audios.push(audio)
    return audio as unknown as HTMLAudioElement
  })
  return { audios, manager }
}

test('legacy automatic ambience preference is removed without changing other ambience preferences', () => {
  const migrated = removeLegacyAutomaticAmbiencePreference({
    autoPlayAmbience: true,
    defaultAmbience: 'forest-birds-ambience',
    ambienceMuted: true,
  })

  expect(migrated).toEqual({
    defaultAmbience: 'forest-birds-ambience',
    ambienceMuted: true,
  })
})

test('failed ambience playback is visible and succeeds on an explicit retry', async () => {
  const { manager } = createManager()
  const failedAudio = new FakeAudio('/audio/ambience/forest-birds-ambience.wav')
  const retryManager = new PomodoroAudioManager(() => failedAudio as unknown as HTMLAudioElement)

  failedAudio.rejectNextPlay = true
  expect(await retryManager.startAmbience('/audio/ambience/forest-birds-ambience.wav', false)).toBe('blocked')
  expect(retryManager.getSnapshot().ambience.blocked).toBe(true)

  expect(await retryManager.retryAmbience('/audio/ambience/forest-birds-ambience.wav', false)).toBe('ready')
  expect(retryManager.getSnapshot().ambience.isPlaying).toBe(true)
  expect(manager.getSnapshot().ambience.source).toBeNull()
})

test('consecutive alarms reuse the persistent alarm element without priming', async () => {
  const { audios, manager } = createManager()

  expect(manager.prepareAlarmAudio('/audio/alarms/happy-bells-alarm.wav')).toBe(true)
  expect(audios[0]?.playCalls).toBe(0)

  await manager.beginAlarm('/audio/alarms/happy-bells-alarm.wav')
  manager.endAlarm()
  await manager.beginAlarm('/audio/alarms/happy-bells-alarm.wav')

  expect(audios).toHaveLength(1)
  expect(audios[0]?.playCalls).toBe(2)
  expect(manager.getSnapshot().alarm.isPlaying).toBe(true)
})

test('a blocked alarm can be retried without losing ambience restoration', async () => {
  const { audios, manager } = createManager()

  await manager.startAmbience('/audio/ambience/forest-birds-ambience.wav', false)
  const alarmAudio = new FakeAudio('/audio/alarms/happy-bells-alarm.wav')
  const retryManager = new PomodoroAudioManager((source) => {
    if (source.includes('/audio/alarms/')) return alarmAudio as unknown as HTMLAudioElement
    const audio = new FakeAudio(source)
    audios.push(audio)
    return audio as unknown as HTMLAudioElement
  })
  await retryManager.startAmbience('/audio/ambience/forest-birds-ambience.wav', false)
  alarmAudio.rejectNextPlay = true

  expect(await retryManager.beginAlarm('/audio/alarms/happy-bells-alarm.wav')).toBe('blocked')
  expect(await retryManager.retryAlarm('/audio/alarms/happy-bells-alarm.wav')).toBe('ready')
  retryManager.endAlarm()
  await Promise.resolve()

  expect(retryManager.getSnapshot().ambience.isPlaying).toBe(true)
})

test('switching ambience stops the previous source before playing the next one', async () => {
  const { audios, manager } = createManager()

  await manager.startAmbience('/audio/ambience/forest-birds-ambience.wav', false)
  const firstAudio = audios[0]
  manager.syncAmbienceSource('/audio/ambience/light-rain-ambience.wav', false)

  expect(firstAudio?.paused).toBe(true)
  expect(audios).toHaveLength(2)
  expect(audios[1]?.source).toContain('light-rain')
  expect(manager.getSnapshot().ambience.source).toContain('light-rain')
})

test('alarm ordering pauses ambience and restores its previous state after ending', async () => {
  const { audios, manager } = createManager()

  await manager.startAmbience('/audio/ambience/sea-waves-ambience.wav', true)
  const ambienceAudio = audios[0]
  await manager.beginAlarm('/audio/alarms/classic-alarm.wav')

  expect(ambienceAudio?.paused).toBe(true)
  expect(audios[1]?.source).toContain('classic-alarm')
  expect(manager.getSnapshot().alarm.isPlaying).toBe(true)

  manager.endAlarm()
  await Promise.resolve()

  expect(ambienceAudio?.paused).toBe(false)
  expect(ambienceAudio?.muted).toBe(true)
  expect(manager.getSnapshot().ambience.isPlaying).toBe(true)
})

test('settings previews share the owner and restore ambience without overlap', async () => {
  const { audios, manager } = createManager()

  await manager.startAmbience('/audio/ambience/forest-birds-ambience.wav', false)
  const ambienceAudio = audios[0]
  await manager.startPreview('alarm', '/audio/alarms/musical-alarm.wav')

  expect(ambienceAudio?.paused).toBe(true)
  expect(manager.getSnapshot().preview.kind).toBe('alarm')

  manager.stopPreview()
  await Promise.resolve()

  expect(manager.getSnapshot().preview.kind).toBeNull()
  expect(ambienceAudio?.paused).toBe(false)
})

test('finite alarm previews release ownership when playback ends', async () => {
  const { audios, manager } = createManager()

  await manager.startPreview('alarm', '/audio/alarms/musical-alarm.wav')
  audios[0]?.emitEnded()

  expect(manager.getSnapshot().preview.kind).toBeNull()
})

test('media errors mark the active source blocked', async () => {
  const { audios, manager } = createManager()

  await manager.startAmbience('/audio/ambience/light-rain-ambience.wav', false)
  audios[0]?.emitError()

  expect(manager.getSnapshot().ambience.blocked).toBe(true)
  expect(manager.getSnapshot().ambience.isPlaying).toBe(false)
})
