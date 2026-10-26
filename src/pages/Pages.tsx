import {
  ArrowLeft,
  ArrowDownAZ,
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FolderPlus,
  FolderOpen,
  Layers3,
  Monitor,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Shuffle,
  Sun,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, KeyboardEvent, MouseEvent, PointerEvent, ReactNode, SetStateAction, TransitionEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { CollectionDeleteDialog } from '@/components/study/CollectionDeleteDialog'
import { CollectionFormDialog, type CollectionFormValues } from '@/components/study/CollectionFormDialog'
import { EntryDeleteDialog } from '@/components/study/EntryDeleteDialog'
import { EntryFormDialog, type EntryFormValues } from '@/components/study/EntryFormDialog'
import { StudyDataActionsMenu } from '@/components/study/StudyDataActionsMenu'
import { PdfExportControl } from '@/components/study/StudyPdfExport'
import { ContextualDataTransfer, FullBackupControls } from '@/components/study/StudyDataTransfer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Notification } from '@/components/ui/notification'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createDefaultSettings, findCategory, findTopic, getEntriesForTopic, getTopicsForCategory, type Category, type Entry, type FlashcardFrontSide, type StudyMode, type Topic } from '@/lib/study-data'
import { getPomodoroAlarmOption, getPomodoroAmbienceOption, POMODORO_ALARM_OPTIONS, POMODORO_ALARM_START_EVENT, POMODORO_AMBIENCE_OPTIONS, POMODORO_SNOOZE_OPTIONS, WEB_AUTOMATIC_AUDIO_SETTINGS_VISIBLE, type PomodoroAlarmSelection, type PomodoroAmbienceSelection } from '@/lib/pomodoro-audio'
import { POMODORO_PERMISSION_SETUP_EVENT } from '@/lib/pomodoro-permissions'
import { useStudyData } from '@/lib/use-study-data'
import { cn } from '@/lib/utils'
import {
  filterAndSortCategories,
  filterAndSortEntries,
  filterAndSortTopics,
  type CategorySort,
  type EntrySort,
  type TopicSort,
} from '@/lib/study-operations'

const EMPTY_FORM_VALUES: CollectionFormValues = { name: '', description: '' }
const EMPTY_ENTRY_FORM_VALUES: EntryFormValues = { type: 'question-answer', question: '', answer: '' }

function SectionLabel({ children }: { children: string }) {
  return <p className="text-base font-medium text-muted-foreground">{children}</p>
}

function getFlashcardDefaultDescription(frontSide: FlashcardFrontSide, leftLabel: string, rightLabel: string) {
  return `Default: ${frontSide === 'left' ? leftLabel : rightLabel} first.`
}

function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

function FoundationNote() {
  return (
    <Card className="bg-secondary/35">
      <CardContent className="flex gap-3 p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <Sparkles aria-hidden="true" className="size-4" />
        </div>
        <div>
          <p className="text-base font-semibold text-secondary-foreground">Your study space is taking shape.</p>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">Categories and topics now provide a calm structure for the questions and answers that arrive next.</p>
        </div>
      </CardContent>
    </Card>
  )
}

function formatFocusMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function formatActivityDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(timestamp)
}

function DashboardStatCard({
  label,
  value,
  description,
  icon,
  to,
}: {
  label: string
  value: string | number
  description: string
  icon: ReactNode
  to?: string
}) {
  const card = (
    <Card className="h-full bg-card/80 transition-colors group-hover:bg-card">
      <CardHeader className="flex-row items-start justify-between gap-3 p-5 pb-3">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-2 text-3xl tracking-tight">{value}</CardTitle>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )

  return to ? <Link to={to} className="group rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">{card}</Link> : card
}

function SortSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const selectedOption = options.find((option) => option.value === value)

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={<Button id={id} aria-label={label} size="icon-sm" variant="ghost" />}
            />
          }
        >
          <ArrowDownAZ aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{`${label}: ${selectedOption?.label ?? ''}`}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CollectionToolbar({
  search,
  onSearchChange,
  sort,
  sortOptions,
  onSortChange,
  placeholder,
  label,
  rightControls,
}: {
  search: string
  onSearchChange: (value: string) => void
  sort: string
  sortOptions: Array<{ value: string; label: string }>
  onSortChange: (value: string) => void
  placeholder: string
  label: string
  rightControls?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card/60 p-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label={label} className="h-11 border-0 bg-background/70 pl-9" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={placeholder} />
        </div>
        <SortSelect id={`${label.toLowerCase().replaceAll(' ', '-')}-sort`} label={`Sort ${label.toLowerCase()}`} value={sort} options={sortOptions} onChange={onSortChange} />
      </div>
      {rightControls && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{rightControls}</div>}
    </div>
  )
}

function CountLabel({ count, singular, plural }: { count: number; singular: string; plural: string }) {
  return <span>{count} {count === 1 ? singular : plural}</span>
}

function EntryActions({ entry, onEdit, onDelete }: { entry: Entry; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-0" role="group" aria-label="Entry actions">
      <Button aria-label={`Edit entry: ${entry.question}`} size="icon-sm" variant="ghost" onClick={onEdit}>
        <Pencil aria-hidden="true" />
      </Button>
      <Button aria-label={`Delete entry: ${entry.question}`} size="icon-sm" variant="ghost" onClick={onDelete}>
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  )
}

function EntryEmptyState({ hasSearch, onCreate, onClearSearch }: { hasSearch: boolean; onCreate: () => void; onClearSearch: () => void }) {
  return (
    <Card className="bg-card/60">
      <Empty className="min-h-64 p-8">
        <EmptyHeader>
          <EmptyMedia variant="icon"><BookOpenCheck aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>{hasSearch ? 'No entries found' : 'No entries yet'}</EmptyTitle>
          <EmptyDescription>
            {hasSearch ? 'Try a different search term or clear the search to see every question.' : 'Add your first question and answer to start studying this topic.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {hasSearch ? <Button variant="outline" onClick={onClearSearch}>Clear search</Button> : <Button onClick={onCreate}><Plus aria-hidden="true" data-icon="inline-start" /> Create entry</Button>}
        </EmptyContent>
      </Empty>
    </Card>
  )
}

function EntryList({
  entries,
  hiddenLeft,
  hiddenRight,
  onToggleLeft,
  onToggleRight,
  onEdit,
  onDelete,
}: {
  entries: Entry[]
  hiddenLeft: Set<string>
  hiddenRight: Set<string>
  onToggleLeft: (entryId: string) => void
  onToggleRight: (entryId: string) => void
  onEdit: (entry: Entry) => void
  onDelete: (entry: Entry) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry) => {
        const leftHidden = hiddenLeft.has(entry.id)
        const rightHidden = hiddenRight.has(entry.id)
        const leftLabel = entry.type === 'term-definition' ? 'Term' : 'Question'
        const rightLabel = entry.type === 'term-definition' ? 'Definition' : 'Answer'

        return (
          <Card key={entry.id} className="relative overflow-hidden bg-transparent py-0">
            <CardContent className="p-0">
              <div className="grid gap-px bg-background/70 sm:grid-cols-2">
                <div className="min-w-0 bg-card">
                  <div className="rounded-t-2xl bg-secondary/55 px-5 py-3 text-base font-semibold text-foreground sm:rounded-tr-none">{leftLabel}</div>
                  <div className="p-5">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-20 w-full justify-start whitespace-normal rounded-xl bg-card p-5 text-left text-base font-normal leading-relaxed hover:bg-muted/20"
                      aria-expanded={!leftHidden}
                      aria-label={`${leftHidden ? 'Reveal' : 'Hide'} ${leftLabel.toLowerCase()} for ${entry.question}`}
                      onClick={() => onToggleLeft(entry.id)}
                    >
                      {leftHidden ? <span className="text-muted-foreground">{leftLabel} hidden · Reveal</span> : <span className="whitespace-pre-wrap">{entry.question}</span>}
                    </Button>
                  </div>
                </div>
                <div className="min-w-0 bg-card">
                  <div className="rounded-t-none bg-secondary/55 px-5 py-3 text-base font-semibold text-foreground sm:rounded-tl-none sm:rounded-tr-2xl">{rightLabel}</div>
                  <div className="p-5">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-20 w-full justify-start whitespace-normal rounded-xl bg-card p-5 text-left text-base font-normal leading-relaxed hover:bg-muted/20"
                      aria-expanded={!rightHidden}
                      aria-label={`${rightHidden ? 'Reveal' : 'Hide'} ${rightLabel.toLowerCase()} for ${entry.question}`}
                      onClick={() => onToggleRight(entry.id)}
                    >
                      {rightHidden ? <span className="text-muted-foreground">{rightLabel} hidden · Reveal</span> : <span className="whitespace-pre-wrap">{entry.answer}</span>}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="absolute top-2 right-4 opacity-100 sm:opacity-0 sm:transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
                <EntryActions entry={entry} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry)} />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function getFlashcardLabel(entry: Entry, side: FlashcardFrontSide) {
  if (entry.type === 'term-definition') return side === 'left' ? 'Term' : 'Definition'
  return side === 'left' ? 'Question' : 'Answer'
}

function getFlashcardText(entry: Entry, side: FlashcardFrontSide) {
  return side === 'left' ? entry.question : entry.answer
}

const FLASHCARD_SWIPE_DURATION = 800
const FLASHCARD_DRAG_INTENT_THRESHOLD = 12
const FLASHCARD_CAROUSEL_GAP = 24
type FlashcardInteractionPhase = 'idle' | 'dragging' | 'flipping' | 'returning' | 'navigating'

function FlashcardMode({
  entries,
  frontByEntryType,
}: {
  entries: Entry[]
  frontByEntryType: Record<Entry['type'], FlashcardFrontSide>
}) {
  const entryIds = useMemo(() => entries.map((entry) => entry.id), [entries])
  const entryIdentity = entryIds.join('|')
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(() => entryIds[0] ?? null)
  const [flipped, setFlipped] = useState(false)
  const [sessionOrder, setSessionOrder] = useState<string[] | null>(null)
  const [dragX, setDragX] = useState(0)
  const [incomingX, setIncomingX] = useState<number | null>(null)
  const [carouselDirection, setCarouselDirection] = useState<'next' | 'previous' | null>(null)
  const [interactionPhase, setInteractionPhaseState] = useState<FlashcardInteractionPhase>('idle')
  const previousEntryIdsRef = useRef(entryIds)
  const currentEntryIdRef = useRef(currentEntryId)
  const interactionPhaseRef = useRef<FlashcardInteractionPhase>('idle')
  const pointerStartRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const pointerAxisRef = useRef<'horizontal' | 'vertical' | null>(null)
  const didDragRef = useRef(false)
  const transitionFallbackRef = useRef<number | null>(null)
  const navigationFrameRef = useRef<number | null>(null)
  const pendingNavigationIdRef = useRef<string | null>(null)
  const carouselStageRef = useRef<HTMLDivElement | null>(null)
  currentEntryIdRef.current = currentEntryId

  function setInteractionPhase(nextPhase: FlashcardInteractionPhase) {
    interactionPhaseRef.current = nextPhase
    setInteractionPhaseState(nextPhase)
  }

  const clearTransitionFallback = () => {
    if (transitionFallbackRef.current === null) return
    window.clearTimeout(transitionFallbackRef.current)
    transitionFallbackRef.current = null
  }

  const clearNavigationFrame = () => {
    if (navigationFrameRef.current === null) return
    window.cancelAnimationFrame(navigationFrameRef.current)
    navigationFrameRef.current = null
  }

  useEffect(() => {
    const previousIndex = previousEntryIdsRef.current.indexOf(currentEntryIdRef.current ?? '')
    const nextEntryId = entryIds.includes(currentEntryIdRef.current ?? '')
      ? currentEntryIdRef.current
      : entryIds[Math.min(Math.max(previousIndex, 0), entryIds.length - 1)] ?? null

    currentEntryIdRef.current = nextEntryId
    setCurrentEntryId(nextEntryId)
    setFlipped(false)
    setSessionOrder(null)
    setDragX(0)
    setIncomingX(null)
    setCarouselDirection(null)
    pendingNavigationIdRef.current = null
    clearTransitionFallback()
    clearNavigationFrame()
    setInteractionPhase('idle')
    previousEntryIdsRef.current = entryIds
  }, [entryIdentity, entryIds])

  useEffect(() => {
    return clearTransitionFallback
  }, [])

  const orderedEntries = useMemo(() => {
    if (!sessionOrder) return entries

    const entriesById = new Map(entries.map((entry) => [entry.id, entry]))
    return sessionOrder.flatMap((entryId) => {
      const entry = entriesById.get(entryId)
      return entry ? [entry] : []
    })
  }, [entries, sessionOrder])

  const currentIndex = Math.max(0, orderedEntries.findIndex((entry) => entry.id === currentEntryId))
  const currentEntry = orderedEntries[currentIndex]

  function moveTo(index: number) {
    const nextEntry = orderedEntries[index]
    if (!nextEntry) return
    setCurrentEntryId(nextEntry.id)
    setFlipped(false)
    setDragX(0)
    setIncomingX(null)
    setCarouselDirection(null)
    setInteractionPhase('idle')
  }

  function shuffleCards() {
    if (interactionPhase !== 'idle') return
    const shuffled = entries.map((entry) => entry.id)
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1))
      const currentEntryId = shuffled[index]
      shuffled[index] = shuffled[randomIndex]
      shuffled[randomIndex] = currentEntryId
    }
    setSessionOrder(shuffled)
    setCurrentEntryId(shuffled[0] ?? null)
    setFlipped(false)
    setDragX(0)
    setIncomingX(null)
    setCarouselDirection(null)
    setInteractionPhase('idle')
  }

  function startSwipe(direction: 'next' | 'previous') {
    if (interactionPhase !== 'idle' && interactionPhase !== 'dragging') return

    const targetIndex = currentIndex + (direction === 'next' ? 1 : -1)
    const targetEntry = orderedEntries[targetIndex]
    if (!targetEntry) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const { exitX, incomingStartX } = getCarouselTravel(direction)
    pendingNavigationIdRef.current = targetEntry.id
    clearTransitionFallback()
    clearNavigationFrame()
    setCarouselDirection(direction)
    setIncomingX(incomingStartX + dragX)
    setInteractionPhase('navigating')
    if (prefersReducedMotion) {
      setDragX(exitX)
      setIncomingX(0)
    } else {
      navigationFrameRef.current = window.requestAnimationFrame(() => {
        navigationFrameRef.current = null
        if (interactionPhaseRef.current === 'navigating') {
          setDragX(exitX)
          setIncomingX(0)
        }
      })
    }
    transitionFallbackRef.current = window.setTimeout(() => {
      completeNavigation()
    }, prefersReducedMotion ? 0 : FLASHCARD_SWIPE_DURATION + 50)
  }

  function completeNavigation() {
    if (interactionPhaseRef.current !== 'navigating') return
    const targetEntryId = pendingNavigationIdRef.current
    pendingNavigationIdRef.current = null
    clearTransitionFallback()
    clearNavigationFrame()
    setIncomingX(null)
    if (!targetEntryId) {
      setDragX(0)
      setCarouselDirection(null)
      setInteractionPhase('idle')
      return
    }
    const targetIndex = orderedEntries.findIndex((entry) => entry.id === targetEntryId)
    if (targetIndex === -1) {
      setDragX(0)
      setCarouselDirection(null)
      setInteractionPhase('idle')
      return
    }
    moveTo(targetIndex)
  }

  function getCarouselTravel(direction: 'next' | 'previous') {
    const stageRect = carouselStageRef.current?.getBoundingClientRect()
    const baseLeft = stageRect?.left ?? 0
    const baseRight = stageRect?.right ?? window.innerWidth
    const leftExit = -(baseRight + FLASHCARD_CAROUSEL_GAP)
    const rightExit = window.innerWidth - baseLeft + FLASHCARD_CAROUSEL_GAP

    return {
      exitX: direction === 'next' ? leftExit : rightExit,
      incomingStartX: direction === 'next' ? rightExit : leftExit,
    }
  }

  function returnToCenter(direction: 'next' | 'previous' | null) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    clearTransitionFallback()
    clearNavigationFrame()
    setCarouselDirection(direction)
    setIncomingX(direction ? dragX + getCarouselTravel(direction).incomingStartX : null)
    setDragX(0)
    if (prefersReducedMotion) {
      setIncomingX(null)
      setCarouselDirection(null)
      setInteractionPhase('idle')
      return
    }
    setInteractionPhase('returning')
    transitionFallbackRef.current = window.setTimeout(() => {
      transitionFallbackRef.current = null
      if (interactionPhaseRef.current === 'returning') {
        setIncomingX(null)
        setCarouselDirection(null)
        setInteractionPhase('idle')
      }
    }, FLASHCARD_SWIPE_DURATION + 50)
  }

  function flipCard() {
    if (interactionPhase !== 'idle') return
    setFlipped((current) => !current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setInteractionPhase('flipping')
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      flipCard()
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      startSwipe('previous')
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      startSwipe('next')
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const phase = interactionPhaseRef.current
    if (phase === 'flipping') return
    if (phase === 'navigating') completeNavigation()
    if (phase === 'returning') {
      clearTransitionFallback()
      clearNavigationFrame()
      setDragX(0)
      setIncomingX(null)
      setCarouselDirection(null)
      setInteractionPhase('idle')
    }
    pointerStartRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    pointerAxisRef.current = null
    didDragRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    const phase = interactionPhaseRef.current
    if (!start || start.id !== event.pointerId || (phase !== 'idle' && phase !== 'dragging') || pointerAxisRef.current === 'vertical') return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (!pointerAxisRef.current && Math.hypot(deltaX, deltaY) < FLASHCARD_DRAG_INTENT_THRESHOLD) return
    if (!pointerAxisRef.current) {
      pointerAxisRef.current = Math.abs(deltaY) > Math.abs(deltaX) * 1.25 ? 'vertical' : 'horizontal'
    }
    didDragRef.current = true
    if (pointerAxisRef.current !== 'horizontal') return

    event.preventDefault()
    setIncomingX(null)
    setCarouselDirection(deltaX < 0 ? 'next' : 'previous')
    setInteractionPhase('dragging')
    const maxDrag = Math.max((carouselStageRef.current?.clientWidth ?? 640) * 0.92, 320)
    setDragX(Math.max(-maxDrag, Math.min(maxDrag, deltaX)))
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    if (!start || start.id !== event.pointerId) return

    const wasDragging = pointerAxisRef.current === 'horizontal'
    const deltaX = event.clientX - start.x
    pointerStartRef.current = null
    pointerAxisRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!wasDragging) {
      setDragX(0)
      setIncomingX(null)
      if (didDragRef.current) {
        window.setTimeout(() => {
          didDragRef.current = false
        }, 100)
      }
      setCarouselDirection(null)
      setInteractionPhase('idle')
      return
    }

    window.setTimeout(() => {
      didDragRef.current = false
    }, 100)

    const direction = deltaX < 0 ? 'next' : 'previous'
    const threshold = Math.min(128, Math.max(88, event.currentTarget.clientWidth * 0.22))
    if (Math.abs(deltaX) < threshold || !orderedEntries[currentIndex + (direction === 'next' ? 1 : -1)]) {
      returnToCenter(direction)
      return
    }

    startSwipe(direction)
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (!pointerStartRef.current || pointerStartRef.current.id !== event.pointerId) return
    const wasDragging = pointerAxisRef.current === 'horizontal'
    pointerStartRef.current = null
    pointerAxisRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    didDragRef.current = false
    if (wasDragging) returnToCenter(dragX < 0 ? 'next' : 'previous')
    else {
      setIncomingX(null)
      setCarouselDirection(null)
      setInteractionPhase('idle')
    }
  }

  function handleCardTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    if (interactionPhaseRef.current === 'navigating') {
      completeNavigation()
    } else if (interactionPhaseRef.current === 'returning') {
      clearTransitionFallback()
      setIncomingX(null)
      setCarouselDirection(null)
      setInteractionPhase('idle')
    } else if (interactionPhaseRef.current === 'flipping') {
      setInteractionPhase('idle')
    }
  }

  if (!currentEntry) return null

  const defaultFront: FlashcardFrontSide = currentEntry.type === 'term-definition' ? 'right' : 'left'
  const frontSide = frontByEntryType[currentEntry.type] ?? defaultFront
  const backSide: FlashcardFrontSide = frontSide === 'left' ? 'right' : 'left'
  const frontLabel = getFlashcardLabel(currentEntry, frontSide)
  const frontText = getFlashcardText(currentEntry, frontSide)
  const backLabel = getFlashcardLabel(currentEntry, backSide)
  const backText = getFlashcardText(currentEntry, backSide)
  const dragDirection = dragX < 0 ? 'next' : dragX > 0 ? 'previous' : null
  const previewDirection = interactionPhase === 'dragging' ? dragDirection : carouselDirection
  const previewEntry = previewDirection
    ? orderedEntries[currentIndex + (previewDirection === 'next' ? 1 : -1)]
    : undefined
  const previewFrontSide = previewEntry
    ? frontByEntryType[previewEntry.type] ?? (previewEntry.type === 'term-definition' ? 'right' : 'left')
    : null
  const previewLabel = previewEntry && previewFrontSide ? getFlashcardLabel(previewEntry, previewFrontSide) : null
  const previewText = previewEntry && previewFrontSide ? getFlashcardText(previewEntry, previewFrontSide) : null
  const previewStartX = previewDirection ? getCarouselTravel(previewDirection).incomingStartX : 0
  const previewX = incomingX ?? (dragX + previewStartX)

  function renderFace(label: string, text: string, isBack: boolean) {
    const isVisible = isBack ? flipped : !flipped

    return (
      <button
        type="button"
        className={cn(
          'flashcard-face absolute inset-0 flex min-h-64 w-full flex-col items-center justify-center gap-5 rounded-2xl bg-card px-6 py-10 text-center focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-80 sm:px-16 sm:py-12',
          isBack ? 'flashcard-face-back' : 'flashcard-face-front',
        )}
        aria-hidden={!isVisible}
        aria-label={`${isBack ? 'Show front' : 'Show back'} of ${label.toLowerCase()}`}
        aria-keyshortcuts="Space ArrowLeft ArrowRight"
        tabIndex={isVisible ? 0 : -1}
        onKeyDown={handleCardKeyDown}
      >
        <span className="text-base font-semibold uppercase tracking-[0.16em] text-primary">{label}</span>
        <span className="max-w-3xl whitespace-pre-wrap text-2xl font-semibold leading-tight text-foreground sm:text-4xl">{text}</span>
      </button>
    )
  }

  function handleCardClick(event: MouseEvent<HTMLDivElement>) {
    if (didDragRef.current) {
      event.preventDefault()
      event.stopPropagation()
      didDragRef.current = false
      return
    }
    flipCard()
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        ref={carouselStageRef}
        className="flashcard-stage relative min-h-64 touch-pan-y sm:min-h-80"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerCancel}
        onClick={handleCardClick}
      >
        <div className="flashcard-carousel-viewport absolute inset-0">
          <div
            key={`current-${currentEntry.id}`}
            className="flashcard-card-shell flashcard-depth flashcard-drag-surface absolute inset-x-0 top-0 select-none rounded-2xl bg-card"
            data-interaction-phase={interactionPhase}
            data-flipped={flipped}
            style={{ transform: `translate3d(${dragX}px, 0, 0) rotateY(${flipped ? 180 : 0}deg)` }}
            onTransitionEnd={handleCardTransitionEnd}
            onDragStart={(event) => event.preventDefault()}
          >
            {renderFace(frontLabel, frontText, false)}
            {renderFace(backLabel, backText, true)}
          </div>
          {previewEntry && previewLabel && previewText && previewDirection && (
            <div
              key={`preview-${previewEntry.id}`}
              aria-hidden="true"
              className="flashcard-card-shell flashcard-depth flashcard-drag-surface pointer-events-none absolute inset-x-0 top-0 flex select-none flex-col items-center justify-center gap-5 rounded-2xl bg-card px-6 py-10 text-center sm:px-16 sm:py-12"
              data-interaction-phase={interactionPhase}
              style={{ transform: `translate3d(${previewX}px, 0, 0)` }}
              onTransitionEnd={handleCardTransitionEnd}
            >
              <span className="text-base font-semibold uppercase tracking-[0.16em] text-primary">{previewLabel}</span>
              <span className="max-w-3xl whitespace-pre-wrap text-2xl font-semibold leading-tight text-foreground sm:text-4xl">{previewText}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <Button type="button" variant="secondary" disabled={currentIndex === 0 || interactionPhase !== 'idle'} onClick={() => startSwipe('previous')}>
            <ChevronLeft aria-hidden="true" data-icon="inline-start" /> Previous
          </Button>
          <Button type="button" variant="secondary" disabled={currentIndex === orderedEntries.length - 1 || interactionPhase !== 'idle'} onClick={() => startSwipe('next')}>
            Next <ChevronRight aria-hidden="true" data-icon="inline-end" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <p className="text-base font-medium text-muted-foreground" aria-live="polite">Card {currentIndex + 1} of {orderedEntries.length}</p>
          <Button type="button" variant="ghost" disabled={interactionPhase !== 'idle'} onClick={shuffleCards}>
            <Shuffle aria-hidden="true" data-icon="inline-start" /> Shuffle
          </Button>
          <Button type="button" variant="ghost" disabled={interactionPhase !== 'idle'} onClick={flipCard}>
            <RotateCcw aria-hidden="true" data-icon="inline-start" /> Flip
          </Button>
        </div>
      </div>
    </div>
  )
}

function CategoryCard({
  category,
  topicCount,
  entryCount,
  onOpen,
  onEdit,
  onDelete,
}: {
  category: Category
  topicCount: number
  entryCount: number
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <Card role="link" tabIndex={0} aria-label={`Open category ${category.name}`} onClick={onOpen} onKeyDown={handleCardKeyDown} className="group cursor-pointer gap-0 py-0 bg-card/80 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <CardHeader className="gap-3 p-5 pb-3 pl-7">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="truncate text-xl transition-colors group-hover:text-primary">{category.name}</CardTitle>
          </div>
          <div className="flex shrink-0 items-center gap-0">
            <Button aria-label={`Edit ${category.name}`} size="icon-sm" variant="ghost" onClick={(event) => { event.stopPropagation(); onEdit() }}>
              <Pencil aria-hidden="true" />
            </Button>
            <Button aria-label={`Delete ${category.name}`} size="icon-sm" variant="ghost" onClick={(event) => { event.stopPropagation(); onDelete() }}>
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </div>
        <CardDescription>{category.description || 'A focused place for related study topics.'}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4 p-5 pt-0 pl-7">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-base text-muted-foreground">
          <CountLabel count={topicCount} singular="topic" plural="topics" />
          <CountLabel count={entryCount} singular="entry" plural="entries" />
        </div>
      </CardContent>
    </Card>
  )
}

function TopicCard({
  topic,
  entryCount,
  onOpen,
  onEdit,
  onDelete,
}: {
  topic: Topic
  entryCount: number
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <Card role="link" tabIndex={0} aria-label={`Open topic ${topic.name}`} onClick={onOpen} onKeyDown={handleCardKeyDown} className="group cursor-pointer gap-0 py-0 bg-card/80 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <CardHeader className="gap-3 p-5 pb-3 pl-7">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="truncate text-xl transition-colors group-hover:text-primary">{topic.name}</CardTitle>
          </div>
          <div className="flex shrink-0 items-center gap-0">
            <Button aria-label={`Edit ${topic.name}`} size="icon-sm" variant="ghost" onClick={(event) => { event.stopPropagation(); onEdit() }}>
              <Pencil aria-hidden="true" />
            </Button>
            <Button aria-label={`Delete ${topic.name}`} size="icon-sm" variant="ghost" onClick={(event) => { event.stopPropagation(); onDelete() }}>
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </div>
        <CardDescription>{topic.description || 'A focused path for questions and explanations.'}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4 p-5 pt-0 pl-7 text-base text-muted-foreground">
        <CountLabel count={entryCount} singular="question" plural="questions" />
      </CardContent>
    </Card>
  )
}

function EmptyCollection({
  kind,
  hasSearch,
  onCreate,
  onClearSearch,
}: {
  kind: 'category' | 'topic'
  hasSearch: boolean
  onCreate: () => void
  onClearSearch: () => void
}) {
  const isCategory = kind === 'category'
  return (
    <Card className="bg-card/60">
      <Empty className="min-h-64 p-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {isCategory ? <FolderPlus aria-hidden="true" /> : <Layers3 aria-hidden="true" />}
          </EmptyMedia>
          <EmptyTitle>{hasSearch ? `No ${isCategory ? 'categories' : 'topics'} found` : `No ${isCategory ? 'categories' : 'topics'} yet`}</EmptyTitle>
          <EmptyDescription>
            {hasSearch ? 'Try a different search term or clear the search to see everything.' : `Create your first ${kind} to give your study library a little structure.`}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {hasSearch ? <Button variant="outline" onClick={onClearSearch}>Clear search</Button> : <Button onClick={onCreate}><Plus aria-hidden="true" data-icon="inline-start" /> Create {kind}</Button>}
        </EmptyContent>
      </Empty>
    </Card>
  )
}

export function DashboardPage() {
  const { data } = useStudyData()
  const categoryById = useMemo(() => new Map(data.categories.map((category) => [category.id, category])), [data.categories])
  const topicById = useMemo(() => new Map(data.topics.map((topic) => [topic.id, topic])), [data.topics])
  const recentItems = useMemo(() => data.activity.recentlyAccessed.flatMap((activity) => {
    if (activity.type === 'category') {
      const category = categoryById.get(activity.recordId)
      return category ? [{
        id: activity.recordId,
        name: category.name,
        kind: 'Category',
        detail: category.description || 'Category overview',
        accessedAt: activity.accessedAt,
        to: `/categories/${category.id}`,
      }] : []
    }

    const topic = topicById.get(activity.recordId)
    const category = topic ? categoryById.get(topic.categoryId) : undefined
    return topic && category ? [{
      id: activity.recordId,
      name: topic.name,
      kind: 'Topic',
      detail: category.name,
      accessedAt: activity.accessedAt,
      to: `/categories/${category.id}/topics/${topic.id}`,
    }] : []
  }), [categoryById, data.activity.recentlyAccessed, topicById])

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeading
        title="Your study space, at a glance."
        description="See the shape of your local library, return to recent study paths, and keep moving through what you want to remember."
      />

      <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardStatCard label="Categories" value={data.categories.length} description="Organized study areas" icon={<FolderOpen aria-hidden="true" />} to="/categories" />
        <DashboardStatCard label="Topics" value={data.topics.length} description="Focused paths to revisit" icon={<Layers3 aria-hidden="true" />} to="/categories" />
        <DashboardStatCard label="Study entries" value={data.entries.length} description="Questions, terms, and answers" icon={<BookOpenCheck aria-hidden="true" />} to="/categories" />
        <DashboardStatCard label="Focus sessions" value={data.activity.completedFocusSessions} description="Completed Pomodoro sessions" icon={<CheckCircle2 aria-hidden="true" />} />
        <DashboardStatCard label="Focus time" value={formatFocusMinutes(data.activity.completedFocusMinutes)} description="Recorded completed minutes" icon={<Clock3 aria-hidden="true" />} />
      </div>

      <Card className="mt-8 bg-card/80">
        <CardHeader className="flex-row items-start justify-between gap-4 p-6 pb-4">
          <div className="min-w-0">
            <CardDescription>Recent activity</CardDescription>
            <CardTitle className="mt-2 text-2xl">Return to a familiar path</CardTitle>
          </div>
          {recentItems.length > 0 && <Badge variant="secondary">{recentItems.length} recent</Badge>}
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {recentItems.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {recentItems.map((item) => (
                <Link
                  key={`${item.kind}-${item.id}`}
                  to={item.to}
                  className="group flex min-w-0 items-center justify-between gap-4 rounded-xl bg-background/70 px-4 py-3 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-foreground">{item.name}</span>
                    <span className="mt-1 block truncate text-base text-muted-foreground">{item.kind} · {item.detail}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                    <span>{formatActivityDate(item.accessedAt)}</span>
                    <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty className="min-h-56 rounded-2xl bg-background/50 p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Sparkles aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>No recent study paths yet</EmptyTitle>
                <EmptyDescription>Open a category or topic and it will appear here for an easy return.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button render={<Link to="/categories" />}>Open categories <ArrowUpRight aria-hidden="true" data-icon="inline-end" /></Button>
              </EmptyContent>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function CategoriesPage() {
  const navigate = useNavigate()
  const { data, createCategory, updateCategory, deleteCategory, openCategory } = useStudyData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<CategorySort>('alphabetical')
  const [formOpen, setFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)
  const categories = useMemo(() => filterAndSortCategories(data, search, sort), [data, search, sort])

  useEffect(() => {
    if (searchParams.get('action') !== 'create') return
    setEditingCategory(null)
    setFormOpen(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  function openCategoryPage(categoryId: string) {
    openCategory(categoryId)
    navigate(`/categories/${categoryId}`)
  }

  function showCreateForm() {
    setEditingCategory(null)
    setFormOpen(true)
  }

  function submitCategory(values: CollectionFormValues) {
    return editingCategory ? updateCategory(editingCategory.id, values) : createCategory(values)
  }

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeading title="Categories" description="Keep broad subjects together, then make each one easier to return to with focused topics." />
        <Button className="w-full sm:w-auto" onClick={showCreateForm}><Plus aria-hidden="true" data-icon="inline-start" /> New category</Button>
      </div>

      <div className="mt-9 flex flex-col gap-5">
        <CollectionToolbar search={search} onSearchChange={setSearch} sort={sort} onSortChange={(value) => setSort(value as CategorySort)} sortOptions={[{ value: 'alphabetical', label: 'Name: A–Z' }, { value: 'reverse-alphabetical', label: 'Name: Z–A' }, { value: 'recent', label: 'Most recent' }]} placeholder="Search" label="Category search" />
        {categories.length === 0 ? (
          <EmptyCollection kind="category" hasSearch={Boolean(search.trim())} onCreate={showCreateForm} onClearSearch={() => setSearch('')} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {categories.map((category) => {
              const topicCount = getTopicsForCategory(data, category.id).length
              const entryCount = getTopicsForCategory(data, category.id).reduce((total, topic) => total + getEntriesForTopic(data, topic.id).length, 0)
              return (
                <CategoryCard
                  key={category.id}
                  category={category}
                  topicCount={topicCount}
                  entryCount={entryCount}
                  onOpen={() => openCategoryPage(category.id)}
                  onEdit={() => { setEditingCategory(category); setFormOpen(true) }}
                  onDelete={() => setDeletingCategory(category)}
                />
              )
            })}
          </div>
        )}
      </div>

      <CollectionFormDialog
        kind="category"
        open={formOpen}
        initialValues={editingCategory ? { name: editingCategory.name, description: editingCategory.description } : EMPTY_FORM_VALUES}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingCategory(null) }}
        onSubmit={submitCategory}
      />
      {deletingCategory && (
        <CollectionDeleteDialog
          kind="category"
          name={deletingCategory.name}
          topicCount={getTopicsForCategory(data, deletingCategory.id).length}
          entryCount={getTopicsForCategory(data, deletingCategory.id).reduce((total, topic) => total + getEntriesForTopic(data, topic.id).length, 0)}
          open
          onOpenChange={(open) => { if (!open) setDeletingCategory(null) }}
          onConfirm={() => deleteCategory(deletingCategory.id)}
        />
      )}

      <div className="mt-5"><FoundationNote /></div>
    </div>
  )
}

export function CategoryDetailPage() {
  const { categoryId = '' } = useParams()
  const navigate = useNavigate()
  const { data, createTopic, updateTopic, deleteTopic, openCategory, openTopic, importCategory } = useStudyData()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = findCategory(data, categoryId)
  const openedCategoryId = useRef<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<TopicSort>('alphabetical')
  const [formOpen, setFormOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [deletingTopic, setDeletingTopic] = useState<Topic | null>(null)
  const topics = useMemo(() => filterAndSortTopics(data, categoryId, search, sort), [categoryId, data, search, sort])

  useEffect(() => {
    if (searchParams.get('action') !== 'create') return
    setEditingTopic(null)
    setFormOpen(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (category && openedCategoryId.current !== category.id) {
      openedCategoryId.current = category.id
      openCategory(category.id)
    }
  }, [category, openCategory])

  if (!category) return <NotFoundPage />

  function openTopicPage(topicId: string) {
    openTopic(topicId)
    navigate(`/categories/${categoryId}/topics/${topicId}`)
  }

  function showCreateForm() {
    setEditingTopic(null)
    setFormOpen(true)
  }

  function submitTopic(values: CollectionFormValues) {
    return editingTopic ? updateTopic(editingTopic.id, values) : createTopic(categoryId, values)
  }

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeading title={category.name} description={category.description || 'Organize focused study topics in this category.'} />
        <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
          <ContextualDataTransfer
            kind="category"
            data={data}
            destinationId={category.id}
            destinationName={category.name}
            existingCount={getTopicsForCategory(data, category.id).length}
            onImport={(document, mode) => importCategory(category.id, document, mode)}
            renderActions={(jsonActions) => (
              <PdfExportControl
                kind="category"
                data={data}
                categoryId={category.id}
                renderActions={(pdfActions) => (
                  <StudyDataActionsMenu
                    onImportJson={jsonActions.onImportJson}
                    onExportJson={jsonActions.onExportJson}
                    exportJsonDisabled={jsonActions.exportJsonDisabled}
                    onExportPdf={pdfActions.onExportPdf}
                    exportPdfDisabled={pdfActions.exportPdfDisabled}
                  />
                )}
              />
            )}
          />
          <Button className="min-w-0 flex-1 sm:flex-none" onClick={showCreateForm}><Plus aria-hidden="true" data-icon="inline-start" /> New topic</Button>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-5">
        <CollectionToolbar search={search} onSearchChange={setSearch} sort={sort} onSortChange={(value) => setSort(value as TopicSort)} sortOptions={[{ value: 'alphabetical', label: 'Name: A–Z' }, { value: 'reverse-alphabetical', label: 'Name: Z–A' }, { value: 'recent', label: 'Most recent' }]} placeholder="Search" label="Topic search" />
        {topics.length === 0 ? (
          <EmptyCollection kind="topic" hasSearch={Boolean(search.trim())} onCreate={showCreateForm} onClearSearch={() => setSearch('')} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                entryCount={getEntriesForTopic(data, topic.id).length}
                onOpen={() => openTopicPage(topic.id)}
                onEdit={() => { setEditingTopic(topic); setFormOpen(true) }}
                onDelete={() => setDeletingTopic(topic)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link to="/categories" className="inline-flex min-h-9 items-center gap-2 rounded-lg text-base font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><ArrowLeft aria-hidden="true" data-icon="inline-start" /> Back to categories</Link>
      </div>

      <CollectionFormDialog
        kind="topic"
        open={formOpen}
        initialValues={editingTopic ? { name: editingTopic.name, description: editingTopic.description } : EMPTY_FORM_VALUES}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingTopic(null) }}
        onSubmit={submitTopic}
      />
      {deletingTopic && (
        <CollectionDeleteDialog
          kind="topic"
          name={deletingTopic.name}
          entryCount={getEntriesForTopic(data, deletingTopic.id).length}
          open
          onOpenChange={(open) => { if (!open) setDeletingTopic(null) }}
          onConfirm={() => deleteTopic(deletingTopic.id)}
        />
      )}
    </div>
  )
}

export function TopicStudyPage() {
  const { categoryId = '', topicId = '' } = useParams()
  const { data, createEntry, updateEntry, deleteEntry, openTopic, importTopic } = useStudyData()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = findCategory(data, categoryId)
  const topic = findTopic(data, topicId)
  const openedTopicId = useRef<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<EntrySort>('newest')
  const [formOpen, setFormOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null)
  const [studyMode, setStudyMode] = useState<StudyMode>(() => data.settings.defaultStudyMode)
  const topicEntryIds = useMemo(() => getEntriesForTopic(data, topicId).map((entry) => entry.id), [data, topicId])
  const [hiddenLeft, setHiddenLeft] = useState<Set<string>>(() => data.settings.showQuestionsByDefault ? new Set() : new Set(topicEntryIds))
  const [hiddenRight, setHiddenRight] = useState<Set<string>>(() => data.settings.showAnswersByDefault ? new Set() : new Set(topicEntryIds))
  const [visibilityTopicId, setVisibilityTopicId] = useState(topicId)
  const topicEntryIdsRef = useRef(topicEntryIds)
  const studySettingsRef = useRef(data.settings)
  const previousEntryIdsRef = useRef(new Set(topicEntryIds))
  const entries = useMemo(() => filterAndSortEntries(data, topicId, search, sort), [data, search, sort, topicId])

  topicEntryIdsRef.current = topicEntryIds
  studySettingsRef.current = data.settings

  useEffect(() => {
    if (topic && topic.categoryId === categoryId && openedTopicId.current !== topic.id) {
      openedTopicId.current = topic.id
      openTopic(topic.id)
    }
  }, [categoryId, openTopic, topic])

  useEffect(() => {
    setVisibilityTopicId(topicId)
    setStudyMode(studySettingsRef.current.defaultStudyMode)
    setHiddenLeft(studySettingsRef.current.showQuestionsByDefault ? new Set() : new Set(topicEntryIdsRef.current))
    setHiddenRight(studySettingsRef.current.showAnswersByDefault ? new Set() : new Set(topicEntryIdsRef.current))
  }, [topicId])

  useEffect(() => {
    const previousEntryIds = previousEntryIdsRef.current

    setHiddenLeft((current) => new Set([...current].filter((entryId) => topicEntryIds.includes(entryId))))
    setHiddenRight((current) => {
      const next = new Set([...current].filter((entryId) => topicEntryIds.includes(entryId)))
      topicEntryIds.forEach((entryId) => {
        if (!previousEntryIds.has(entryId)) next.add(entryId)
      })
      return next
    })
    previousEntryIdsRef.current = new Set(topicEntryIds)
  }, [topicEntryIds])

  useEffect(() => {
    if (searchParams.get('action') !== 'create') return
    setEditingEntry(null)
    setFormOpen(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  if (!category || !topic || topic.categoryId !== category.id) return <NotFoundPage />
  const currentTopic = topic

  function showCreateForm() {
    setEditingEntry(null)
    setFormOpen(true)
  }

  function submitEntry(values: EntryFormValues) {
    return editingEntry ? updateEntry(editingEntry.id, values) : createEntry(currentTopic.id, values)
  }

  function toggleHiddenEntry(setHiddenEntries: Dispatch<SetStateAction<Set<string>>>, entryId: string) {
    setHiddenEntries((current) => {
      const next = new Set(current)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  function toggleAllHidden(setHiddenEntries: Dispatch<SetStateAction<Set<string>>>, hiddenEntries: Set<string>) {
    const allEntriesAreHidden = entries.length > 0 && entries.every((entry) => hiddenEntries.has(entry.id))
    setHiddenEntries(allEntriesAreHidden ? new Set() : new Set(entries.map((entry) => entry.id)))
  }

  const effectiveHiddenLeft = visibilityTopicId === topicId ? hiddenLeft : new Set<string>()
  const effectiveHiddenRight = visibilityTopicId === topicId ? hiddenRight : new Set(topicEntryIds)
  const allLeftHidden = entries.length > 0 && entries.every((entry) => effectiveHiddenLeft.has(entry.id))
  const allRightHidden = entries.length > 0 && entries.every((entry) => effectiveHiddenRight.has(entry.id))

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeading title={topic.name} description={topic.description || 'A focused review path for questions and explanations.'} />
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <ToggleGroup
            value={[studyMode]}
            onValueChange={(value) => {
              const nextMode = value[0]
              if (nextMode === 'list' || nextMode === 'flashcard') setStudyMode(nextMode)
            }}
            aria-label="Study mode"
            className="w-full justify-end sm:w-auto"
          >
            <ToggleGroupItem value="list" aria-label="List mode" className="flex-1 sm:flex-none">
              <Layers3 aria-hidden="true" data-icon="inline-start" /> List
            </ToggleGroupItem>
            <ToggleGroupItem value="flashcard" aria-label="Flashcard mode" className="flex-1 sm:flex-none">
              <BookOpenCheck aria-hidden="true" data-icon="inline-start" /> Flashcards
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="text-base text-muted-foreground sm:text-right">
            <CountLabel count={getEntriesForTopic(data, topic.id).length} singular="question" plural="questions" />
          </div>
          <div className="flex w-full items-center justify-end gap-2">
            <ContextualDataTransfer
              kind="topic"
              data={data}
              destinationId={currentTopic.id}
              destinationName={currentTopic.name}
              existingCount={getEntriesForTopic(data, currentTopic.id).length}
              onImport={(document, mode) => importTopic(currentTopic.id, document, mode)}
              renderActions={(jsonActions) => (
                <PdfExportControl
                  kind="topic"
                  data={data}
                  categoryId={category.id}
                  topicId={currentTopic.id}
                  renderActions={(pdfActions) => (
                    <StudyDataActionsMenu
                      onImportJson={jsonActions.onImportJson}
                      onExportJson={jsonActions.onExportJson}
                      exportJsonDisabled={jsonActions.exportJsonDisabled}
                      onExportPdf={pdfActions.onExportPdf}
                      exportPdfDisabled={pdfActions.exportPdfDisabled}
                    />
                  )}
                />
              )}
            />
            <Button className="min-w-0 flex-1 sm:flex-none" onClick={showCreateForm}><Plus aria-hidden="true" data-icon="inline-start" /> New entry</Button>
          </div>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-5">
        <CollectionToolbar
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={(value) => setSort(value as EntrySort)}
          sortOptions={[{ value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'alphabetical', label: 'Question: A–Z' }]}
          placeholder="Search"
          label="Entry search"
          rightControls={studyMode === 'list' ? (
            <>
              <Button type="button" size="sm" variant={allLeftHidden ? 'ghost' : 'secondary'} aria-pressed={!allLeftHidden} disabled={entries.length === 0} onClick={() => toggleAllHidden(setHiddenLeft, effectiveHiddenLeft)}>
                {allLeftHidden ? <Eye aria-hidden="true" data-icon="inline-start" /> : <EyeOff aria-hidden="true" data-icon="inline-start" />}
                {allLeftHidden ? 'Reveal Left' : 'Hide Left'}
              </Button>
              <Button type="button" size="sm" variant={allRightHidden ? 'ghost' : 'secondary'} aria-pressed={!allRightHidden} disabled={entries.length === 0} onClick={() => toggleAllHidden(setHiddenRight, effectiveHiddenRight)}>
                {allRightHidden ? <Eye aria-hidden="true" data-icon="inline-start" /> : <EyeOff aria-hidden="true" data-icon="inline-start" />}
                {allRightHidden ? 'Reveal Right' : 'Hide Right'}
              </Button>
            </>
          ) : undefined}
        />

        {entries.length === 0 ? (
          <EntryEmptyState hasSearch={Boolean(search.trim())} onCreate={showCreateForm} onClearSearch={() => setSearch('')} />
        ) : studyMode === 'list' ? (
          <EntryList
            entries={entries}
            hiddenLeft={effectiveHiddenLeft}
            hiddenRight={effectiveHiddenRight}
            onToggleLeft={(entryId) => toggleHiddenEntry(setHiddenLeft, entryId)}
            onToggleRight={(entryId) => toggleHiddenEntry(setHiddenRight, entryId)}
            onEdit={(entry) => { setEditingEntry(entry); setFormOpen(true) }}
            onDelete={setDeletingEntry}
          />
        ) : (
          <FlashcardMode
            entries={entries}
            frontByEntryType={data.settings.flashcardFrontByEntryType}
          />
        )}
      </div>

      <div className="mt-8">
        <Link to={`/categories/${category.id}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg text-base font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><ArrowLeft aria-hidden="true" data-icon="inline-start" /> Back to topics</Link>
      </div>

      <EntryFormDialog
        open={formOpen}
        initialValues={editingEntry ? { type: editingEntry.type, question: editingEntry.question, answer: editingEntry.answer } : EMPTY_ENTRY_FORM_VALUES}
        allowCopyPaste={data.settings.allowCopyPaste}
        spellcheck={data.settings.spellcheck}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingEntry(null) }}
        onSubmit={submitEntry}
      />
      {deletingEntry && (
        <EntryDeleteDialog
          question={deletingEntry.question}
          open
          onOpenChange={(open) => { if (!open) setDeletingEntry(null) }}
          onConfirm={() => deleteEntry(deletingEntry.id)}
        />
      )}
    </div>
  )
}

export function SettingsPage() {
  const location = useLocation()
  const { data, updateSettings, restoreFullBackup } = useStudyData()
  const [saveToast, setSaveToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [activePreview, setActivePreview] = useState<'alarm' | 'ambience' | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const settings = data.settings

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause()
      previewAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    const stopPreviewForAlarm = () => {
      previewAudioRef.current?.pause()
      previewAudioRef.current = null
      setActivePreview(null)
    }

    window.addEventListener(POMODORO_ALARM_START_EVENT, stopPreviewForAlarm)
    return () => window.removeEventListener(POMODORO_ALARM_START_EVENT, stopPreviewForAlarm)
  }, [])

  function savePreferences(patch: Parameters<typeof updateSettings>[0], message = 'Preference saved locally.') {
    const saved = updateSettings(patch)
    setSaveToast(saved
      ? { kind: 'success', message }
      : { kind: 'error', message: 'This preference could not be saved. Check local storage availability and try again.' })
  }

  const dismissSaveToast = useCallback(() => setSaveToast(null), [])

  function restoreDefaults() {
    stopAudioPreview()
    savePreferences(createDefaultSettings(), 'Default preferences restored.')
  }

  function restoreFlashcardDefaults() {
    savePreferences({ flashcardFrontByEntryType: createDefaultSettings().flashcardFrontByEntryType }, 'Flashcard defaults restored.')
  }

  function updatePomodoroNumber(field: 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'sessionsBeforeLongBreak', value: string) {
    const nextValue = Number(value)
    const maximum = field === 'sessionsBeforeLongBreak' ? 12 : 120
    if (!Number.isInteger(nextValue) || nextValue < 1 || nextValue > maximum) return
    savePreferences({ pomodoro: { [field]: nextValue } })
  }

  function stopAudioPreview() {
    previewAudioRef.current?.pause()
    previewAudioRef.current = null
    setActivePreview(null)
  }

  function previewAudio(kind: 'alarm' | 'ambience', source: string | null) {
    if (activePreview === kind) {
      stopAudioPreview()
      return
    }

    stopAudioPreview()
    if (!source) return

    const audio = new Audio(source)
    audio.loop = kind === 'ambience'
    previewAudioRef.current = audio
    setActivePreview(kind)
    audio.addEventListener('ended', () => {
      if (previewAudioRef.current !== audio) return
      previewAudioRef.current = null
      setActivePreview(null)
    }, { once: true })
    void audio.play().catch(() => {
      if (previewAudioRef.current !== audio) return
      previewAudioRef.current = null
      setActivePreview(null)
    })
  }

  function updatePomodoroAlarm(value: string | null) {
    if (value === null) return
    if (!POMODORO_ALARM_OPTIONS.some((option) => option.value === value)) return
    stopAudioPreview()
    savePreferences({ pomodoro: { defaultAlarm: value as PomodoroAlarmSelection } })
  }

  function updatePomodoroAmbience(value: string | null) {
    if (value === null) return
    if (!POMODORO_AMBIENCE_OPTIONS.some((option) => option.value === value)) return
    stopAudioPreview()
    savePreferences({ pomodoro: { defaultAmbience: value as PomodoroAmbienceSelection } })
  }

  const selectedAlarm = getPomodoroAlarmOption(settings.pomodoro.defaultAlarm)
  const selectedAmbience = getPomodoroAmbienceOption(settings.pomodoro.defaultAmbience)

  useEffect(() => {
    if (location.hash !== '#pomodoro-settings') return

    const frameId = window.requestAnimationFrame(() => {
      document.getElementById('pomodoro-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [location.hash])

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeading title="Settings" description="Choose how Study Reviewer looks and how new study sessions begin. Preferences stay on this device." />
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={restoreDefaults}>
          <RotateCcw aria-hidden="true" data-icon="inline-start" /> Restore defaults
        </Button>
      </div>

      <Notification notification={saveToast} onDismiss={dismissSaveToast} />

      <div className="mt-8 flex flex-col gap-5">
        <Card className="bg-card/80">
          <CardHeader className="p-6 pb-4">
            <SectionLabel>Appearance</SectionLabel>
            <CardTitle className="mt-2 text-2xl">Choose a comfortable theme</CardTitle>
            <CardDescription className="leading-relaxed">System follows your browser or operating-system preference. Changing themes does not affect your study data.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="theme-preference">Theme</FieldLabel>
                <Select value={settings.theme} onValueChange={(value) => {
                  if (value === 'light' || value === 'dark' || value === 'system') savePreferences({ theme: value })
                }}>
                  <SelectTrigger id="theme-preference" className="w-full border-0 bg-muted/45 sm:max-w-sm">
                    <SelectValue>
                      {settings.theme === 'light' && <><Sun aria-hidden="true" /> Light</>}
                      {settings.theme === 'dark' && <><Moon aria-hidden="true" /> Dark</>}
                      {settings.theme === 'system' && <><Monitor aria-hidden="true" /> System</>}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="light"><Sun aria-hidden="true" /> Light</SelectItem>
                      <SelectItem value="dark"><Moon aria-hidden="true" /> Dark</SelectItem>
                      <SelectItem value="system"><Monitor aria-hidden="true" /> System</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="bg-card/80">
          <CardHeader className="p-6 pb-4">
            <SectionLabel>Study mode</SectionLabel>
            <CardTitle className="mt-2 text-2xl">Study mode</CardTitle>
            <CardDescription className="leading-relaxed">Choose how new topic study sessions begin.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <FieldGroup>
              <Field className="flex-col items-start gap-3">
                <FieldContent>
                  <FieldTitle>Study mode</FieldTitle>
                </FieldContent>
                <ToggleGroup value={[settings.defaultStudyMode]} onValueChange={(value) => {
                  const nextMode = value[0]
                  if (nextMode === 'list' || nextMode === 'flashcard') savePreferences({ defaultStudyMode: nextMode })
                }} aria-label="Default study mode" className="w-full sm:w-fit">
                  <ToggleGroupItem value="list" className="flex-1 sm:flex-none">List</ToggleGroupItem>
                  <ToggleGroupItem value="flashcard" className="flex-1 sm:flex-none">Flashcards</ToggleGroupItem>
                </ToggleGroup>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="bg-card/80">
          <CardHeader className="p-6 pb-4">
            <SectionLabel>List Mode</SectionLabel>
            <CardTitle className="mt-2 text-2xl">Set your list visibility</CardTitle>
            <CardDescription className="leading-relaxed">Choose which sides are visible when a new list study session opens.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <FieldGroup>
              <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-xl bg-background/60 p-4">
                <FieldContent>
                  <FieldTitle>Show questions and terms by default</FieldTitle>
                  <FieldDescription>New list sessions open with the left column visible.</FieldDescription>
                </FieldContent>
                <Toggle pressed={settings.showQuestionsByDefault} onPressedChange={(pressed) => savePreferences({ showQuestionsByDefault: pressed })} aria-label="Show questions and terms by default" size="sm">
                  {settings.showQuestionsByDefault ? 'On' : 'Off'}
                </Toggle>
              </Field>

              <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-xl bg-background/60 p-4">
                <FieldContent>
                  <FieldTitle>Show answers and definitions by default</FieldTitle>
                  <FieldDescription>New list sessions open with the right column visible.</FieldDescription>
                </FieldContent>
                <Toggle pressed={settings.showAnswersByDefault} onPressedChange={(pressed) => savePreferences({ showAnswersByDefault: pressed })} aria-label="Show answers and definitions by default" size="sm">
                  {settings.showAnswersByDefault ? 'On' : 'Off'}
                </Toggle>
              </Field>

              <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-xl bg-background/60 p-4">
                <FieldContent>
                  <FieldTitle>Allow copy and paste in entry fields</FieldTitle>
                  <FieldDescription>This only affects editable question, term, answer, and definition fields. It cannot control browser or stored-data copying elsewhere.</FieldDescription>
                </FieldContent>
                <Toggle pressed={settings.allowCopyPaste} onPressedChange={(pressed) => savePreferences({ allowCopyPaste: pressed })} aria-label="Allow copy and paste in entry fields" size="sm">
                  {settings.allowCopyPaste ? 'On' : 'Off'}
                </Toggle>
              </Field>

              <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-xl bg-background/60 p-4">
                <FieldContent>
                  <FieldTitle>Use browser spellcheck</FieldTitle>
                  <FieldDescription>Spellcheck behavior is provided by your browser and operating system; Study Reviewer does not add offline autocorrection.</FieldDescription>
                </FieldContent>
                <Toggle pressed={settings.spellcheck} onPressedChange={(pressed) => savePreferences({ spellcheck: pressed })} aria-label="Use browser spellcheck" size="sm">
                  {settings.spellcheck ? 'On' : 'Off'}
                </Toggle>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="bg-card/80">
          <CardHeader className="flex flex-col gap-4 p-6 pb-4 sm:grid sm:gap-1">
            <div className="min-w-0">
              <SectionLabel>Flashcards</SectionLabel>
              <CardTitle className="mt-2 text-2xl">Choose the first side</CardTitle>
              <CardDescription className="mt-2 leading-relaxed">Each entry type has a front-side preference. The opposite side remains available after flipping.</CardDescription>
            </div>
            <CardAction className="self-start justify-self-auto sm:self-center sm:justify-self-end sm:translate-y-1">
              <Button type="button" variant="secondary" size="sm" onClick={restoreFlashcardDefaults}>Restore flashcard defaults</Button>
            </CardAction>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <FieldGroup>
              <Field>
                <FieldLabel>Question &amp; Answer</FieldLabel>
                <FieldDescription>{getFlashcardDefaultDescription(settings.flashcardFrontByEntryType['question-answer'], 'Question', 'Answer')}</FieldDescription>
                <ToggleGroup value={[settings.flashcardFrontByEntryType['question-answer']]} onValueChange={(value) => {
                  const nextSide = value[0]
                  if (nextSide === 'left' || nextSide === 'right') savePreferences({ flashcardFrontByEntryType: { 'question-answer': nextSide } })
                }} aria-label="Question and Answer front side" className="w-full sm:w-fit">
                  <ToggleGroupItem value="left" className="flex-1 sm:flex-none">Question</ToggleGroupItem>
                  <ToggleGroupItem value="right" className="flex-1 sm:flex-none">Answer</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel>Term &amp; Definition</FieldLabel>
                <FieldDescription>{getFlashcardDefaultDescription(settings.flashcardFrontByEntryType['term-definition'], 'Term', 'Definition')}</FieldDescription>
                <ToggleGroup value={[settings.flashcardFrontByEntryType['term-definition']]} onValueChange={(value) => {
                  const nextSide = value[0]
                  if (nextSide === 'left' || nextSide === 'right') savePreferences({ flashcardFrontByEntryType: { 'term-definition': nextSide } })
                }} aria-label="Term and Definition front side" className="w-full sm:w-fit">
                  <ToggleGroupItem value="right" className="flex-1 sm:flex-none">Definition</ToggleGroupItem>
                  <ToggleGroupItem value="left" className="flex-1 sm:flex-none">Term</ToggleGroupItem>
                </ToggleGroup>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card id="pomodoro-settings" className="scroll-mt-24 bg-card/80 sm:scroll-mt-28">
          <CardHeader className="p-6 pb-4">
            <SectionLabel>Pomodoro</SectionLabel>
            <CardTitle className="mt-2 text-2xl">Plan your focus rhythm</CardTitle>
            <CardDescription className="leading-relaxed">These local preferences are ready for the Pomodoro study flow. Durations are measured in minutes.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field>
                  <FieldLabel htmlFor="focus-minutes">Focus minutes</FieldLabel>
                  <Input id="focus-minutes" type="number" min={1} max={120} value={settings.pomodoro.focusMinutes} onChange={(event) => updatePomodoroNumber('focusMinutes', event.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="short-break-minutes">Short break</FieldLabel>
                  <Input id="short-break-minutes" type="number" min={1} max={120} value={settings.pomodoro.shortBreakMinutes} onChange={(event) => updatePomodoroNumber('shortBreakMinutes', event.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="long-break-minutes">Long break</FieldLabel>
                  <Input id="long-break-minutes" type="number" min={1} max={120} value={settings.pomodoro.longBreakMinutes} onChange={(event) => updatePomodoroNumber('longBreakMinutes', event.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="sessions-before-long-break">Sessions before long break</FieldLabel>
                  <Input id="sessions-before-long-break" type="number" min={1} max={12} value={settings.pomodoro.sessionsBeforeLongBreak} onChange={(event) => updatePomodoroNumber('sessionsBeforeLongBreak', event.target.value)} />
                </Field>
              </div>
              <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-xl bg-background/60 p-4">
                <FieldContent>
                  <FieldTitle>Automatically switch between sessions</FieldTitle>
                  <FieldDescription>Keep this off if you prefer to start each interval yourself.</FieldDescription>
                </FieldContent>
                <Toggle pressed={settings.pomodoro.autoSwitch} onPressedChange={(pressed) => savePreferences({ pomodoro: { autoSwitch: pressed } })} aria-label="Automatically switch between sessions" size="sm">{settings.pomodoro.autoSwitch ? 'On' : 'Off'}</Toggle>
              </Field>
              <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-xl bg-background/60 p-4">
                <FieldContent>
                  <FieldTitle>Start the next interval automatically</FieldTitle>
                  <FieldDescription>Disabled by default so each transition stays intentional.</FieldDescription>
                </FieldContent>
                <Toggle pressed={settings.pomodoro.autoStart} onPressedChange={(pressed) => savePreferences({ pomodoro: { autoStart: pressed } })} aria-label="Start the next interval automatically" size="sm">{settings.pomodoro.autoStart ? 'On' : 'Off'}</Toggle>
              </Field>
              <div className="grid gap-5 lg:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="default-ambience">Default ambience</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Select value={settings.pomodoro.defaultAmbience} onValueChange={updatePomodoroAmbience}>
                      <SelectTrigger id="default-ambience" className="min-w-0 flex-1 bg-background/60">
                        <SelectValue>{selectedAmbience.label}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {POMODORO_AMBIENCE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon-sm" disabled={!selectedAmbience.src} onClick={() => previewAudio('ambience', selectedAmbience.src)} aria-label={activePreview === 'ambience' ? 'Pause ambience preview' : 'Play ambience preview'} title={activePreview === 'ambience' ? 'Pause ambience preview' : 'Play ambience preview'}>
                      {activePreview === 'ambience' ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                    </Button>
                  </div>
                </Field>
                {WEB_AUTOMATIC_AUDIO_SETTINGS_VISIBLE && <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-xl bg-background/60 p-4 lg:h-full">
                  <FieldContent>
                    <FieldTitle>Automatically play ambience</FieldTitle>
                    <FieldDescription>Play your selected ambience when you start a Pomodoro session.</FieldDescription>
                  </FieldContent>
                  <Toggle pressed={settings.pomodoro.autoPlayAmbience} onPressedChange={(pressed) => savePreferences({ pomodoro: { autoPlayAmbience: pressed } })} aria-label="Automatically play ambience" size="sm">{settings.pomodoro.autoPlayAmbience ? 'On' : 'Off'}</Toggle>
                </Field>}
              </div>
              {WEB_AUTOMATIC_AUDIO_SETTINGS_VISIBLE && <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-xl bg-background/60 p-4">
                <FieldContent>
                  <FieldTitle>Sound alerts</FieldTitle>
                  <FieldDescription>Play your selected alarm when a Pomodoro session finishes.</FieldDescription>
                </FieldContent>
                <Toggle pressed={settings.pomodoro.soundEnabled} onPressedChange={(pressed) => savePreferences({ pomodoro: { soundEnabled: pressed } })} aria-label="Sound alerts" size="sm">{settings.pomodoro.soundEnabled ? 'On' : 'Off'}</Toggle>
              </Field>}
              <Field orientation="horizontal" className="items-start justify-between gap-4 rounded-xl bg-background/60 p-4">
                <FieldContent>
                  <FieldTitle>Browser notifications</FieldTitle>
                  <FieldDescription>Show a system notification when a Pomodoro session finishes, if permitted by your browser.</FieldDescription>
                </FieldContent>
                <Toggle pressed={settings.pomodoro.notificationsEnabled} onPressedChange={(pressed) => savePreferences({ pomodoro: { notificationsEnabled: pressed } })} aria-label="Browser notifications" size="sm">{settings.pomodoro.notificationsEnabled ? 'On' : 'Off'}</Toggle>
              </Field>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="text-2xl">Sounds &amp; Snooze</CardTitle>
                  <CardDescription className="mt-2 leading-relaxed">Choose the sounds and snooze length for future Pomodoro alerts.</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => window.dispatchEvent(new Event(POMODORO_PERMISSION_SETUP_EVENT))}>
                  Set up sound &amp; notifications
                </Button>
              </div>
              <div className="grid gap-5 pt-1 sm:grid-cols-2">
                {WEB_AUTOMATIC_AUDIO_SETTINGS_VISIBLE && <Field>
                  <FieldLabel htmlFor="default-alarm">Default alarm</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Select value={settings.pomodoro.defaultAlarm} onValueChange={updatePomodoroAlarm}>
                      <SelectTrigger id="default-alarm" className="min-w-0 flex-1 bg-background/60">
                        <SelectValue>{selectedAlarm.label}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {POMODORO_ALARM_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon-sm" disabled={!selectedAlarm.src} onClick={() => previewAudio('alarm', selectedAlarm.src)} aria-label={activePreview === 'alarm' ? 'Pause alarm preview' : 'Play alarm preview'} title={activePreview === 'alarm' ? 'Pause alarm preview' : 'Play alarm preview'}>
                      {activePreview === 'alarm' ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                    </Button>
                  </div>
                </Field>}
                <Field>
                  <FieldLabel htmlFor="default-snooze-duration">Default snooze duration</FieldLabel>
                  <Select value={String(settings.pomodoro.defaultSnoozeMinutes)} onValueChange={(value) => {
                    const minutes = Number(value)
                    if (POMODORO_SNOOZE_OPTIONS.some((option) => option === minutes)) savePreferences({ pomodoro: { defaultSnoozeMinutes: minutes as (typeof POMODORO_SNOOZE_OPTIONS)[number] } })
                  }}>
                    <SelectTrigger id="default-snooze-duration" className="w-full bg-background/60">
                      <SelectValue>{settings.pomodoro.defaultSnoozeMinutes} minutes</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {POMODORO_SNOOZE_OPTIONS.map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} minutes</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="bg-card/80">
          <CardHeader className="p-6 pb-4">
            <SectionLabel>Data management</SectionLabel>
            <CardTitle className="mt-2 text-2xl">Back up your study space</CardTitle>
            <CardDescription className="leading-relaxed">Export a complete local backup before moving browsers or restoring a previous version. Full restore is replacement-only and never merges settings or study content.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <FullBackupControls data={data} onRestore={restoreFullBackup} />
          </CardContent>
        </Card>

        <Card className="bg-secondary/35">
          <CardContent className="p-6">
            <SectionLabel>Local-first</SectionLabel>
            <CardTitle className="mt-2 text-2xl">Your study data stays in this browser</CardTitle>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">Study Reviewer stores your study library and preferences locally. No account, backend, or cloud service is required for these settings.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="max-w-xl">
      <PageHeading title="That page is not part of the study path." description="Use the navigation to return to your dashboard or library." />
      <Link to="/" className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Return home</Link>
    </div>
  )
}
