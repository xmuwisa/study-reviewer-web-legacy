import { expect, test } from 'bun:test'

import {
  combineAudioInitializationResults,
  getAudioSetupFeedback,
  getPermissionSetupFeedback,
  getPomodoroNotificationIdentity,
} from '../src/lib/pomodoro-permissions'
import { getPomodoroDocumentTitle } from '../src/components/pomodoro/pomodoro-model'
import { getPomodoroAlarmOption } from '../src/lib/pomodoro-audio'

test('audio setup reports blocked playback before configured playback', () => {
  expect(combineAudioInitializationResults('not-configured', 'blocked')).toBe('blocked')
  expect(combineAudioInitializationResults('not-configured', 'initialized')).toBe('initialized')
  expect(combineAudioInitializationResults('not-configured', 'played')).toBe('initialized')
  expect(combineAudioInitializationResults('not-configured', 'not-configured')).toBe('not-configured')
})

test('permission feedback distinguishes disabled sound from blocked sound', () => {
  expect(getPermissionSetupFeedback('not-configured', 'granted')).toEqual({
    kind: 'success',
    message: 'Notifications are ready. Sound remains governed by your current Pomodoro preferences.',
  })
  expect(getPermissionSetupFeedback('blocked', 'granted').kind).toBe('error')
  expect(getPermissionSetupFeedback('initialized', 'granted').message).toContain('Audible playback will be checked')
})

test('saved Happy Bells selection resolves to the shipped alarm asset', () => {
  expect(getPomodoroAlarmOption('happy-bells-alarm')).toMatchObject({
    label: 'Happy Bells',
    src: '/audio/alarms/happy-bells-alarm.wav',
  })
})

test('audio setup feedback can complete before notification permission resolves', () => {
  expect(getAudioSetupFeedback('initialized')).toEqual({
    kind: 'success',
    message: 'Audio interaction was initialized. Audible playback will be checked when a sound starts.',
  })
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

test('Pomodoro document title follows the timestamp-derived controller state', () => {
  expect(getPomodoroDocumentTitle({ alarmActive: false, isRunning: true, mode: 'focus', remainingLabel: '24:35' })).toBe('🍅 24:35 · Study Reviewer')
  expect(getPomodoroDocumentTitle({ alarmActive: false, isRunning: true, mode: 'short-break', remainingLabel: '04:35' })).toBe('☕ 04:35 · Study Reviewer')
  expect(getPomodoroDocumentTitle({ alarmActive: true, isRunning: false, mode: 'focus', remainingLabel: '00:00' })).toBe('🔔 Focus Complete · Study Reviewer')
  expect(getPomodoroDocumentTitle({ alarmActive: true, isRunning: false, mode: 'long-break', remainingLabel: '00:00' })).toBe('🔔 Break Complete · Study Reviewer')
  expect(getPomodoroDocumentTitle({ alarmActive: false, isRunning: false, mode: 'focus', remainingLabel: '24:35' })).toBe('Study Reviewer')
})
