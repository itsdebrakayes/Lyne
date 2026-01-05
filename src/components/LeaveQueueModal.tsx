import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface LeaveQueueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const LeaveQueueModal = ({ open, onOpenChange, onConfirm }: LeaveQueueModalProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass border-border/50 max-w-md">
        <AlertDialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-status-busy/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-status-busy" />
          </div>
          <AlertDialogTitle className="text-2xl text-center">
            Leave Queue?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-muted-foreground">
            You're about to leave the queue. Your position will be lost and you'll need to rejoin if you change your mind.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <AlertDialogCancel className="flex-1 border-border/50 hover:bg-muted">
            No, keep it.
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="flex-1 bg-status-busy hover:bg-status-busy/90 text-white"
          >
            Yes, Leave!
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
