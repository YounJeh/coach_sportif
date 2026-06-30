import { type ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}

export function AppShell({ children, title, action }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto flex flex-col">
      {title && (
        <header className="flex items-center justify-between px-5 pt-12 pb-4 sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {action && <div>{action}</div>}
        </header>
      )}
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
