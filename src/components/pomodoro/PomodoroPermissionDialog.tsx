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
          <DialogTitle>Enable Sound &amp; Notifications</DialogTitle>
          <DialogDescription>
            For the best Pomodoro experience, allow sound and notifications to play ambience automatically and receive timer alerts. You can request permissions later through Settings, subject to your browser&apos;s permissions.
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
