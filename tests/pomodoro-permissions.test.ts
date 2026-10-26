import { expect, test } from 'bun:test'

import {
  combineAudioInitializationResults,
  getPermissionSetupFeedback,
  getPomodoroNotificationIdentity,
} from '../src/lib/pomodoro-permissions'

test('audio setup reports blocked playback before configured playback', () => {
  expect(combineAudioInitializationResults('not-configured', 'blocked')).toBe('blocked')
  expect(combineAudioInitializationResults('not-configured', 'ready')).toBe('ready')
  expect(combineAudioInitializationResults('not-configured', 'not-configured')).toBe('not-configured')
})

test('permission feedback distinguishes disabled sound from blocked sound', () => {
  expect(getPermissionSetupFeedback('not-configured', 'granted')).toEqual({
    kind: 'success',
    message: 'Notifications are ready. Sound remains governed by your current Pomodoro preferences.',
  })
  expect(getPermissionSetupFeedback('blocked', 'granted').kind).toBe('error')
})

test('notification identity stays stable for one completed session', () => {
  const session = {
    mode: 'focus',
    startedAt: 100,
    endsAt: 200,
    completedAt: 200,
  }

  expect(getPomodoroNotificationIdentity(session)).toBe('focus:100:200')
  expect(getPomodoroNotificationIdentity({ ...session })).toBe('focus:100:200')
  expect(getPomodoroNotificationIdentity({ ...session, completedAt: 300 })).toBe('focus:100:200')
})
