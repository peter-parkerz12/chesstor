import type { ReactNode } from "react";

type Props = {
  board: ReactNode;
  side: ReactNode;
  topBar?: ReactNode;
};

export function GameLayout({ board, side, topBar }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-4 pb-28 lg:px-8 lg:pt-8 lg:pb-12">
      {topBar}
      <div className="grid min-h-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="flex min-w-0 items-start justify-center">
          <div
            className="w-full"
            style={{ maxWidth: "min(78vh, 100%)" }}
          >
            {board}
          </div>
        </div>
        <div className="min-w-0">{side}</div>
      </div>
    </div>
  );
}
