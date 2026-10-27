import { useEffect, useState, type ClipboardEvent } from 'react'

import { Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { EntryOption, EntryType } from '@/lib/study-data'

export type EntryFormValues = {
  type: EntryType
  question: string
  answer: string
  options: EntryOption[]
  explanation: string
}

type EntryFormDialogProps = {
  open: boolean
  initialValues?: EntryFormValues
  allowCopyPaste?: boolean
  spellcheck?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: EntryFormValues) => boolean
}

const EMPTY_ENTRY_VALUES: EntryFormValues = {
  type: 'question-answer',
  question: '',
  answer: '',
  options: [
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
  explanation: '',
}

export function EntryFormDialog({
  open,
  initialValues = EMPTY_ENTRY_VALUES,
  allowCopyPaste = true,
  spellcheck = true,
  onOpenChange,
  onSubmit,
}: EntryFormDialogProps) {
  const [values, setValues] = useState(initialValues)
  const [questionError, setQuestionError] = useState<string | null>(null)
  const [answerError, setAnswerError] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const isEditing = Boolean(initialValues.question || initialValues.answer)
  const isTermDefinition = values.type === 'term-definition'
  const isQuestionOptions = values.type === 'question-options'
  const leftLabel = isTermDefinition ? 'Term' : 'Question'
  const rightLabel = isTermDefinition ? 'Definition' : 'Answer'
  const entryTypeLabel = isTermDefinition ? 'term and definition' : isQuestionOptions ? 'question and options' : 'question and answer'

  function preventClipboardAction(event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!allowCopyPaste) event.preventDefault()
  }

  useEffect(() => {
    if (open) {
      setValues(initialValues)
      setQuestionError(null)
      setAnswerError(null)
      setOptionsError(null)
      setSaveError(null)
    }
  }, [initialValues, open])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = values.question.trim()
    const answer = values.answer.trim()
    const nextQuestionError = question ? null : 'Enter a question or term.'
    const nextAnswerError = isQuestionOptions ? null : answer ? null : 'Enter an answer or explanation.'
    const options = values.options.map((option) => ({ text: option.text.trim(), isCorrect: option.isCorrect }))
    const nextOptionsError = isQuestionOptions
      ? options.length < 2 || options.length > 6
        ? 'Add between 2 and 6 options.'
        : options.some((option) => !option.text)
          ? 'Enter text for every option.'
          : options.every((option) => !option.isCorrect)
            ? 'Mark at least one option as correct.'
            : null
      : null

    setQuestionError(nextQuestionError)
    setAnswerError(nextAnswerError)
    setOptionsError(nextOptionsError)
    if (nextQuestionError || nextAnswerError || nextOptionsError) return

    const saved = onSubmit({ type: values.type, question, answer, options, explanation: values.explanation.trim() })
    if (!saved) {
      setSaveError('This entry could not be saved. Check local storage availability and try again.')
      return
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-0 !left-0 !h-dvh !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none !border-0 !bg-background overflow-x-hidden overflow-y-auto p-4 lg:!top-1/2 lg:!left-1/2 lg:!h-auto lg:!max-h-[calc(100dvh-6rem)] lg:!max-w-lg lg:!-translate-x-1/2 lg:!-translate-y-1/2 lg:!rounded-xl lg:!bg-popover lg:p-6"
        showCloseButton={false}
      >
        <div className="flex min-h-full w-full items-start justify-center lg:block lg:min-h-0">
          <div className="relative mx-auto my-auto flex w-full max-w-2xl flex-col gap-4 md:px-8 lg:my-0 lg:max-w-none lg:gap-6 lg:px-0">
            <DialogClose
              render={
                <Button
                  aria-label="Close form"
                  className="absolute top-4 right-4 rounded-full bg-muted/70 text-foreground hover:bg-muted focus-visible:ring-ring/50 sm:top-5 sm:right-5"
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <X aria-hidden="true" />
            </DialogClose>
            <DialogHeader className="gap-2 lg:gap-3">
              <DialogTitle>{isEditing ? 'Edit entry' : 'Create entry'}</DialogTitle>
              <DialogDescription>
                {isEditing ? `Update the ${entryTypeLabel} without changing this entry’s place in the topic.` : `Add a ${entryTypeLabel} to build this topic’s study list.`}
              </DialogDescription>
            </DialogHeader>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="entry-type">Entry type</FieldLabel>
                <Select
                  value={values.type}
                  onValueChange={(value) => {
                    if (value === 'question-answer' || value === 'term-definition' || value === 'question-options') {
                      setValues((current) => ({ ...current, type: value }))
                    }
                  }}
                >
                  <SelectTrigger id="entry-type" className="w-full border-0 bg-muted/45">
                    <SelectValue>{isTermDefinition ? 'Term & Definition' : 'Question & Answer'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="question-answer">Question &amp; Answer</SelectItem>
                      <SelectItem value="term-definition">Term &amp; Definition</SelectItem>
                      <SelectItem value="question-options">Question &amp; Options</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={Boolean(questionError)}>
                <FieldLabel htmlFor="entry-question">{leftLabel}</FieldLabel>
                <Textarea
                  id="entry-question"
                  className="border-0 bg-muted/45"
                  aria-invalid={Boolean(questionError)}
                  autoFocus
                  spellCheck={spellcheck}
                  onCopy={preventClipboardAction}
                  onCut={preventClipboardAction}
                  onPaste={preventClipboardAction}
                  value={values.question}
                  onChange={(event) => setValues((current) => ({ ...current, question: event.target.value }))}
                  placeholder={isTermDefinition ? 'e.g. Spaced repetition' : 'e.g. What is spaced repetition?'}
                  rows={3}
                />
                <FieldError>{questionError}</FieldError>
              </Field>

              {isQuestionOptions ? (
                <>
                  <Field data-invalid={Boolean(optionsError)}>
                    <FieldLabel>Options</FieldLabel>
                    <div className="flex flex-col gap-3">
                      {values.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Checkbox
                            checked={option.isCorrect}
                            onCheckedChange={(checked) => setValues((current) => ({
                              ...current,
                              options: current.options.map((currentOption, currentIndex) => currentIndex === index ? { ...currentOption, isCorrect: checked === true } : currentOption),
                            }))}
                            aria-label={`Mark option ${index + 1} as correct`}
                          />
                          <Input
                            className="min-w-0 flex-1 border-0 bg-muted/45"
                            aria-label={`Option ${index + 1}`}
                            aria-invalid={Boolean(optionsError && !option.text.trim())}
                            spellCheck={spellcheck}
                            onCopy={preventClipboardAction}
                            onCut={preventClipboardAction}
                            onPaste={preventClipboardAction}
                            value={option.text}
                            onChange={(event) => setValues((current) => ({
                              ...current,
                              options: current.options.map((currentOption, currentIndex) => currentIndex === index ? { ...currentOption, text: event.target.value } : currentOption),
                            }))}
                            placeholder={`Option ${index + 1}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove option ${index + 1}`}
                            className="shrink-0"
                            disabled={values.options.length <= 2}
                            onClick={() => setValues((current) => ({ ...current, options: current.options.filter((_, currentIndex) => currentIndex !== index) }))}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        size="sm"
                        disabled={values.options.length >= 6}
                        onClick={() => setValues((current) => ({ ...current, options: [...current.options, { text: '', isCorrect: false }] }))}
                      >
                        <Plus aria-hidden="true" data-icon="inline-start" /> Add option
                      </Button>
                      <FieldError>{optionsError}</FieldError>
                    </div>
                  </Field>
                  <Field className="pt-2">
                    <FieldLabel htmlFor="entry-explanation">Explanation <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
                    <Textarea
                      id="entry-explanation"
                      className="border-0 bg-muted/45"
                      spellCheck={spellcheck}
                      onCopy={preventClipboardAction}
                      onCut={preventClipboardAction}
                      onPaste={preventClipboardAction}
                      value={values.explanation}
                      onChange={(event) => setValues((current) => ({ ...current, explanation: event.target.value }))}
                      placeholder="Optional explanation"
                      rows={3}
                    />
                  </Field>
                </>
              ) : (
                <Field data-invalid={Boolean(answerError)}>
                  <FieldLabel htmlFor="entry-answer">{rightLabel}</FieldLabel>
                  <Textarea
                    id="entry-answer"
                    className="border-0 bg-muted/45"
                    aria-invalid={Boolean(answerError)}
                    spellCheck={spellcheck}
                    onCopy={preventClipboardAction}
                    onCut={preventClipboardAction}
                    onPaste={preventClipboardAction}
                    value={values.answer}
                    onChange={(event) => setValues((current) => ({ ...current, answer: event.target.value }))}
                    placeholder={isTermDefinition ? 'Write the definition you want to remember' : 'Write the explanation you want to remember'}
                    rows={5}
                  />
                  <FieldError>{answerError}</FieldError>
                </Field>
              )}
            </FieldGroup>

            {saveError && <FieldError>{saveError}</FieldError>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">{isEditing ? 'Save changes' : 'Create entry'}</Button>
            </DialogFooter>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
