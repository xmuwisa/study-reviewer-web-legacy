import { useEffect, useState } from 'react'

import { X } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export type CollectionFormValues = {
  name: string
  description: string
}

type CollectionFormDialogProps = {
  kind: 'category' | 'topic'
  open: boolean
  initialValues?: CollectionFormValues
  onOpenChange: (open: boolean) => void
  onSubmit: (values: CollectionFormValues) => boolean
}

const emptyValues: CollectionFormValues = { name: '', description: '' }

export function CollectionFormDialog({
  kind,
  open,
  initialValues = emptyValues,
  onOpenChange,
  onSubmit,
}: CollectionFormDialogProps) {
  const [values, setValues] = useState(initialValues)
  const [nameError, setNameError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const isEditing = Boolean(initialValues.name)
  const label = kind === 'category' ? 'category' : 'topic'
  const title = isEditing ? `Edit ${label}` : `Create ${label}`
  const nameId = `${kind}-name`
  const descriptionId = `${kind}-description`

  useEffect(() => {
    if (open) {
      setValues(initialValues)
      setNameError(null)
      setSaveError(null)
    }
  }, [initialValues, open])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = values.name.trim()
    if (!name) {
      setNameError(`Enter a name for this ${label}.`)
      return
    }

    setNameError(null)
    const saved = onSubmit({ name, description: values.description.trim() })
    if (!saved) {
      setSaveError('This change could not be saved. Check local storage availability and try again.')
      return
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
          className="!top-0 !left-0 !h-dvh !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none !border-0 !bg-popover overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:!top-1/2 lg:!left-1/2 lg:!h-auto lg:!max-h-[calc(100dvh-6rem)] lg:!max-w-lg lg:!-translate-x-1/2 lg:!-translate-y-1/2 lg:!rounded-xl lg:p-6"
        showCloseButton={false}
      >
        <div className="flex min-h-full w-full items-start justify-center lg:block lg:min-h-0">
          <div className="relative mx-auto my-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-8 sm:px-8 sm:py-10 md:px-8 lg:my-0 lg:max-w-none lg:gap-6 lg:px-0 lg:py-0">
            <DialogClose
              render={
                <Button
                  aria-label="Close form"
                  className="absolute top-4 right-5 rounded-full bg-muted/70 text-foreground hover:bg-muted focus-visible:ring-ring/50 sm:top-5 sm:right-8 lg:right-0"
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <X aria-hidden="true" />
            </DialogClose>
            <DialogHeader className="gap-2 pr-14 sm:pr-16 lg:gap-3 lg:pr-16">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {isEditing ? `Update the name or description for this ${label}.` : `Give your new ${label} a clear name so it is easy to find later.`}
              </DialogDescription>
            </DialogHeader>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field data-invalid={Boolean(nameError)}>
                <FieldLabel htmlFor={nameId}>{kind === 'category' ? 'Category name' : 'Topic name'}</FieldLabel>
                <Input
                  id={nameId}
                  className="border-0 bg-muted/45"
                  aria-invalid={Boolean(nameError)}
                  autoFocus
                  value={values.name}
                  onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                  placeholder={kind === 'category' ? 'e.g. Languages' : 'e.g. Everyday phrases'}
                />
                <FieldError>{nameError}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor={descriptionId}>Description <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
                <Textarea
                  id={descriptionId}
                  className="border-0 bg-muted/45"
                  value={values.description}
                  onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
                  placeholder="A short note about what belongs here"
                  rows={3}
                />
              </Field>
            </FieldGroup>

            {saveError && <FieldError>{saveError}</FieldError>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">{isEditing ? 'Save changes' : `Create ${label}`}</Button>
            </DialogFooter>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
