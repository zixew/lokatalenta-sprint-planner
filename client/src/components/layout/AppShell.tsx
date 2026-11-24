import { Menu, Moon, Sun, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ThemeMode } from '../../lib/theme.ts';
import { BrandLogo } from '../ui/BrandLogo.tsx';
import { EcosystemSwitcher } from './EcosystemSwitcher.tsx';

export function AppShell({
  theme,
  onToggleTheme,
  backlogOnline,
  gatewayConfigured,
  children,
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
  backlogOnline: boolean | null;
  gatewayConfigured: boolean;
  children: ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F6F5F1] text-[#18181B] dark:bg-[#0D1117] dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-[#E5E3DC] dark:border-zinc-800 bg-white/95 dark:bg-[#161B22]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-4">
            <BrandLogo />
            <div className="hidden lg:block h-5 w-px bg-[#E5E3DC] dark:bg-zinc-800" />
            <div className="hidden lg:block">
              <EcosystemSwitcher orientation="horizontal" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              data-testid="ecosystem-status-badge"
              className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-[#E5E3DC] dark:border-zinc-800 bg-[#F6F5F1] dark:bg-[#0D1117] px-2.5 py-1 text-xs text-[#52525B] dark:text-slate-300"
              title="Integration connectivity status"
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    backlogOnline === true
                      ? 'bg-[#059669]'
                      : backlogOnline === false
                        ? 'bg-[#D97706]'
                        : 'bg-zinc-400'
                  }`}
                />
                Backlog {backlogOnline === true ? 'Online' : backlogOnline === false ? 'Offline' : 'Checking'}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    gatewayConfigured ? 'bg-[#0F766E] dark:bg-[#14b8a6]' : 'bg-zinc-400'
                  }`}
                />
                GW {gatewayConfigured ? 'Ready' : 'Off'}
              </span>
            </div>

            <button
              type="button"
              data-testid="theme-toggle"
              aria-label="Toggle light or dark theme"
              onClick={onToggleTheme}
              className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] items-center justify-center rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white dark:bg-[#0D1117] text-[#52525B] dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14b8a6]"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-zinc-700" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              aria-label="Toggle ecosystem navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white dark:bg-[#0D1117] text-[#18181B] dark:text-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14b8a6]"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] px-4 py-3">
            <EcosystemSwitcher
              orientation="vertical"
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
