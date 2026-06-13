import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-2"
      onClick={async () => {
        await deferred.prompt();
        const r = await deferred.userChoice;
        if (r.outcome === "accepted") setDeferred(null);
      }}
    >
      <Download className="h-4 w-4" /> Install
    </Button>
  );
}
