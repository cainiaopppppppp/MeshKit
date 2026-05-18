import { createContext, useContext, useState, type ReactNode } from 'react';

interface AppChromeContextValue {
  isBrandHeaderHidden: boolean;
  setBrandHeaderHidden: (hidden: boolean) => void;
}

const AppChromeContext = createContext<AppChromeContextValue | null>(null);

export function AppChromeProvider({ children }: { children: ReactNode }) {
  const [isBrandHeaderHidden, setBrandHeaderHidden] = useState(false);

  return (
    <AppChromeContext.Provider value={{ isBrandHeaderHidden, setBrandHeaderHidden }}>
      {children}
    </AppChromeContext.Provider>
  );
}

export function useAppChrome() {
  const context = useContext(AppChromeContext);

  if (!context) {
    throw new Error('useAppChrome must be used within AppChromeProvider');
  }

  return context;
}
