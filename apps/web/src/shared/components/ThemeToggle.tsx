import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'ts-sm-theme';

function readInitialTheme(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    // localStorage puede no existir (SSR, jsdom sin flag, modo privado) — dark es el default de siempre.
    return 'dark';
  }
}

/** Alterna entre el dark de siempre y un light/sepia cálido (tokens.css `[data-theme='light']`). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ver readInitialTheme — sin persistencia, el toggle sigue funcionando en memoria.
    }
  }, [theme]);

  const isLight = theme === 'light';

  return (
    <button
      type="button"
      aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      title={isLight ? 'Modo oscuro' : 'Modo claro'}
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-border-mid bg-surface-2 text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
    >
      {isLight ? <Moon size={16} strokeWidth={1.7} /> : <Sun size={16} strokeWidth={1.7} />}
    </button>
  );
}
