import { Flag } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onResign: () => void;
  /** Optional confirmation copy override. */
  description?: string;
  /** Compact icon-only variant for tight toolbars. */
  compact?: boolean;
  className?: string;
};

/**
 * Premium, accessible Resign button with a confirmation dialog.
 * Visible but non-dominant; sits comfortably next to other game controls.
 */
export function ResignButton({
  onResign,
  description = "Are you sure you want to resign this game?",
  compact = false,
  className,
}: Props) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Resign game"
          className={cn(
            "gap-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10",
            className,
          )}
        >
          <Flag className="h-4 w-4" aria-hidden="true" />
          {!compact && <span>Resign</span>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Resign Game?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onResign}
            className="rounded-xl bg-danger text-white hover:bg-danger/90"
          >
            <Flag className="h-4 w-4" aria-hidden="true" /> Resign
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
