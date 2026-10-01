import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={nextLabel} title={nextLabel}>
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export default ThemeToggle;
