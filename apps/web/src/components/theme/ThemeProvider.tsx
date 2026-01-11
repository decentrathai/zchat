'use client';

import { createContext, useContext, useEffect, useState, PropsWithChildren } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>('dark'); // Default to dark
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // On first client load, check localStorage
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme);
    } else {
      // Default to dark if no stored theme
      setTheme('dark');
      localStorage.setItem('theme', 'dark');
    }
    
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Apply or remove the 'dark' class on <html> element
    const htmlElement = document.documentElement;
    
    if (theme === 'dark') {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }

    // Persist theme in localStorage
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

