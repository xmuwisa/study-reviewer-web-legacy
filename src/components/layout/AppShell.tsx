import { ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'

import { getPageTitle } from '@/app/routes'
import { MobileNav, PrimaryNav } from '@/components/navigation/PrimaryNav'
import { PomodoroPermissionDialog } from '@/components/pomodoro/PomodoroPermissionDialog'
import { PomodoroLauncher, PomodoroTimer } from '@/components/pomodoro/PomodoroTimer'
import { useAmbienceController } from '@/components/pomodoro/use-ambience-controller'
import { usePomodoroController } from '@/components/pomodoro/use-pomodoro-controller'
import { Button } from '@/components/ui/button'
import { Notification, type NotificationState } from '@/components/ui/notification'
import { findCategory, findTopic, type StudyData } from '@/lib/study-data'
import type { StorageNotice } from '@/lib/study-context'
import {
  combineAudioInitializationResults,
  getAudioRetryFeedback,
  getPermissionSetupFeedback,
  POMODORO_PERMISSION_SETUP_EVENT,
  requestNotificationPermission,
} from '@/lib/pomodoro-permissions'
import { cn } from '@/lib/utils'
import { useStudyData } from '@/lib/use-study-data'

function Brand() {
  return (
    <Link
      to="/"
      className="group flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label="Study Reviewer home"
    >
      <img
        src="/branding/logo-light.png"
        alt="Study Reviewer"
        className="block h-auto w-24 max-w-full object-contain transition-transform group-hover:-rotate-1 dark:hidden sm:w-32"
      />
      <img
        src="/branding/logo-dark.png"
        alt=""
        aria-hidden="true"
        className="hidden h-auto w-24 max-w-full object-contain transition-transform group-hover:-rotate-1 dark:block sm:w-32"
      />
    </Link>
  )
}

function Breadcrumbs({ pathname, data }: { pathname: string; data: StudyData }) {
  const title = getPageTitle(pathname)
  const { categoryId = '', topicId = '' } = useParams()
  const category = findCategory(data, categoryId)
  const topic = findTopic(data, topicId)
  const isTopicStudy = Boolean(category && topic && topic.categoryId === category.id)
  const isCategoryDetail = Boolean(category && pathname.startsWith('/categories/'))
  const categoryName = category?.name ?? title
  const categoryHref = category ? `/categories/${category.id}` : '/categories'
  const topicName = topic?.name ?? title

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-base">
      <Link className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/">
        Home
      </Link>
      <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground/50" />
      {title === 'Dashboard' ? (
        <span aria-current="page" className="font-medium text-primary">Dashboard</span>
      ) : (
        <>
          {isTopicStudy ? (
            <>
              <Link className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/categories">
                Categories
              </Link>
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground/50" />
              <Link className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={categoryHref}>
                {categoryName}
              </Link>
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground/50" />
              <span aria-current="page" className="font-medium text-primary">{topicName}</span>
            </>
          ) : isCategoryDetail ? (
            <>
              <Link className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/categories">
                Categories
              </Link>
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground/50" />
              <span aria-current="page" className="font-medium text-primary">{categoryName}</span>
            </>
          ) : (
            <span aria-current="page" className="font-medium text-primary">{title}</span>
          )}
        </>
      )}
    </nav>
  )
}

function StorageNotice({ storageNotice, clearStorageNotice }: { storageNotice: StorageNotice | null; clearStorageNotice: () => void }) {
  if (!storageNotice) return null

  return (
    <div
      className="mt-5 flex items-start gap-3 rounded-2xl bg-destructive/10 px-4 py-3 text-base text-destructive"
      role={storageNotice.kind === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <p className="min-w-0 flex-1 leading-relaxed">{storageNotice.message} Changes stay in this session only until storage is available.</p>
      <Button aria-label="Dismiss storage notice" className="-mr-2 -mt-1 shrink-0" size="icon-sm" variant="ghost" onClick={clearStorageNotice}>
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data, storageNotice, clearStorageNotice, updateSettings } = useStudyData()
  const pomodoro = usePomodoroController()
  const ambience = useAmbienceController()
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false)
  const [isPermissionSetupOpen, setIsPermissionSetupOpen] = useState(() => data.settings.pomodoro.permissionSetupStatus === 'pending')
  const [isPermissionSetupBusy, setIsPermissionSetupBusy] = useState(false)
  const [permissionSetupFeedback, setPermissionSetupFeedback] = useState<NotificationState | null>(null)
  const permissionSetupClosingRef = useRef(false)
  const pomodoroPanelRef = useRef<HTMLDivElement>(null)

  const closePermissionSetup = useCallback(() => {
    permissionSetupClosingRef.current = true
    setIsPermissionSetupOpen(false)
  }, [])

  const handlePermissionSetupDismiss = useCallback(() => {
    if (isPermissionSetupBusy) return

    closePermissionSetup()
    const saved = updateSettings({ pomodoro: { permissionSetupStatus: 'dismissed' } })
    setPermissionSetupFeedback(saved ? null : { kind: 'error', message: 'This setup choice could not be saved locally.' })
  }, [closePermissionSetup, isPermissionSetupBusy, updateSettings])

  const handlePermissionSetupEnable = useCallback(async () => {
    if (isPermissionSetupBusy) return

    setIsPermissionSetupBusy(true)
    const [audioResults, notificationResult] = await Promise.all([
      Promise.all([pomodoro.initializeAudio(), ambience.initializeAudio()]),
      requestNotificationPermission(),
    ])
    const audioResult = combineAudioInitializationResults(...audioResults)
    const saved = updateSettings({ pomodoro: { permissionSetupStatus: 'enabled' } })

    closePermissionSetup()
    setIsPermissionSetupBusy(false)
    setPermissionSetupFeedback(saved
      ? getPermissionSetupFeedback(audioResult, notificationResult)
      : { kind: 'error', message: 'Setup finished, but the setup choice could not be saved locally.' })
  }, [ambience, closePermissionSetup, isPermissionSetupBusy, pomodoro, updateSettings])

  const handleEnableSound = useCallback(async () => {
    const audioResults = await Promise.all([pomodoro.initializeAudio(), ambience.initializeAudio()])
    setPermissionSetupFeedback(getAudioRetryFeedback(combineAudioInitializationResults(...audioResults)))
  }, [ambience, pomodoro])

  const handlePermissionSetupOpenChange = useCallback((open: boolean) => {
    if (open) {
      permissionSetupClosingRef.current = false
      setIsPermissionSetupOpen(true)
      return
    }

    if (permissionSetupClosingRef.current) {
      permissionSetupClosingRef.current = false
      setIsPermissionSetupOpen(false)
      return
    }

    handlePermissionSetupDismiss()
  }, [handlePermissionSetupDismiss])

  useEffect(() => {
    if (data.settings.pomodoro.permissionSetupStatus === 'pending') setIsPermissionSetupOpen(true)
  }, [data.settings.pomodoro.permissionSetupStatus])

  useEffect(() => {
    const openPermissionSetup = () => {
      permissionSetupClosingRef.current = false
      setIsPermissionSetupOpen(true)
    }

    window.addEventListener(POMODORO_PERMISSION_SETUP_EVENT, openPermissionSetup)
    return () => window.removeEventListener(POMODORO_PERMISSION_SETUP_EVENT, openPermissionSetup)
  }, [])

  useEffect(() => {
    if (!isPomodoroOpen) return

    function handleOutsidePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Element)) return
      if (event.target.closest('[data-pomodoro-launcher]')) return
      if (event.target.closest('[data-ambience-toggle]')) return
      if (pomodoroPanelRef.current?.contains(event.target)) return
      setIsPomodoroOpen(false)
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown)
  }, [isPomodoroOpen])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-7 lg:px-10">
          <div className="flex items-center justify-between gap-6 py-3 sm:py-4">
            <Brand />
            <div className="flex min-w-0 flex-1 justify-end">
              <div className="hidden sm:block">
                <PrimaryNav />
              </div>
              <div className="sm:hidden">
                <MobileNav />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pt-8 pb-12 outline-none sm:px-7 sm:py-10 lg:px-10 lg:py-14 lg:pb-16">
        <div className="mb-6">
          <Breadcrumbs pathname={pathname} data={data} />
          <StorageNotice storageNotice={storageNotice} clearStorageNotice={clearStorageNotice} />
        </div>
        <Outlet />
      </main>
      <PomodoroLauncher
        controller={pomodoro}
        ambience={ambience}
        open={isPomodoroOpen}
        onClick={() => setIsPomodoroOpen((open) => !open)}
        onEnableSound={handleEnableSound}
      />
      <div
        ref={pomodoroPanelRef}
        aria-hidden={!isPomodoroOpen}
        className={cn(
          'fixed inset-0 z-50 min-h-0 overflow-x-hidden overflow-y-auto bg-[var(--pomodoro-panel)] p-4 sm:p-6 lg:inset-x-2 lg:top-1/2 lg:right-7 lg:bottom-auto lg:left-auto lg:flex lg:max-h-[calc(100dvh-6rem)] lg:w-[min(48rem,calc(100vw-3.5rem))] lg:-translate-y-1/2 lg:flex-col lg:overflow-hidden lg:bg-transparent lg:p-0',
          !isPomodoroOpen && 'pointer-events-none invisible',
        )}
      >
          <div className="flex min-h-full w-full items-start justify-center lg:block lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto lg:rounded-[2rem]">
            <PomodoroTimer controller={pomodoro} onClose={() => setIsPomodoroOpen(false)} onOpenSettings={() => {
              setIsPomodoroOpen(false)
              navigate('/settings#pomodoro-settings')
            }} />
          </div>
      </div>
      <PomodoroPermissionDialog
        open={isPermissionSetupOpen}
        busy={isPermissionSetupBusy}
        onOpenChange={handlePermissionSetupOpenChange}
        onEnable={handlePermissionSetupEnable}
        onNotNow={handlePermissionSetupDismiss}
      />
      <Notification notification={permissionSetupFeedback} onDismiss={() => setPermissionSetupFeedback(null)} />
    </div>
  )
}
