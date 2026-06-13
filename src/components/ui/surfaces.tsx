import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function ClayCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("clay-card p-6", className)} {...props} />;
}

export function GlassPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-panel p-5", className)} {...props} />;
}

export function ClayInset({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("clay-inset p-4", className)} {...props} />;
}
