import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function PomodoroPermissionDialog({
  open,
  busy,
  onOpenChange,
  onEnable,
  onNotNow,
}: {
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onEnable: () => void
  onNotNow: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-5">
        <DialogHeader>
          <DialogTitle>Enable Sound</DialogTitle>
          <DialogDescription>
            For the best Pomodoro experience, enable sound to play your selected ambience and Pomodoro alarm. You can set up sound later through Settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onNotNow}>Not Now</Button>
          <Button type="button" disabled={busy} onClick={onEnable}>{busy ? 'Enabling…' : 'Enable'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
