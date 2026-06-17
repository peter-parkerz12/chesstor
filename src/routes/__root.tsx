import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { DynamicIsland } from "@/components/nav/DynamicIsland";
import { IslandProvider } from "@/components/nav/island-context";
import { InstallButton } from "@/components/pwa/InstallButton";
import { registerPWA } from "@/lib/pwa-register";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1a1a2e" },
      { title: "Chesstor — Learn chess with instant feedback" },
      { name: "description", content: "Premium offline-first PWA to learn chess. Play vs Stockfish, get instant move feedback, and master openings — all in your browser." },
      { name: "author", content: "ChessCoach" },
      { property: "og:title", content: "Chesstor — Learn chess with instant feedback" },
      { property: "og:description", content: "Premium offline-first PWA to learn chess. Play vs Stockfish, get instant move feedback, and master openings — all in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Chesstor — Learn chess with instant feedback" },
      { name: "twitter:description", content: "Premium offline-first PWA to learn chess. Play vs Stockfish, get instant move feedback, and master openings — all in your browser." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6a8c52a6-8a72-4bf9-aa82-e5115dc9b27c/id-preview-6a7cd5d3--24a38098-4138-4ecb-90d6-d4339a664c69.lovable.app-1781501168529.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6a8c52a6-8a72-4bf9-aa82-e5115dc9b27c/id-preview-6a7cd5d3--24a38098-4138-4ecb-90d6-d4339a664c69.lovable.app-1781501168529.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `;(function(){try{var raw=localStorage.getItem('chesscoach:prefs:v1');var theme='dark';if(raw){var parsed=JSON.parse(raw);if(parsed && parsed.theme){theme=parsed.theme;}else{theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}}else{theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.add(theme);document.documentElement.classList.remove(theme==='dark'?'light':'dark');}catch(e){}})();`,
          }}
        />
        <HeadContent />
      </head>
      <body className="grain">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    registerPWA();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <IslandProvider>
        <div className="relative min-h-dvh">
          <div className="pointer-events-none fixed right-3 top-3 z-30 sm:right-5 sm:top-5">
            <div className="pointer-events-auto">
              <InstallButton />
            </div>
          </div>
          <main className="relative z-10">
            {/* Required: nested routes render here. */}
            <Outlet />
          </main>
          <DynamicIsland />
        </div>
      </IslandProvider>
    </QueryClientProvider>
  );
}
