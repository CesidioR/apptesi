import React, { createContext, ReactNode, useContext, useState } from "react";

interface PortfolioContextType {
  selectedPortfolioId: number | null;
  setSelectedPortfolioId: (id: number | null) => void;
  tickers: string[];
  setTickers: (tickers: string[]) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(
  undefined,
);

interface PortfolioProviderProps {
  children: ReactNode;
}

export function PortfolioProvider({ children }: PortfolioProviderProps) {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(
    null,
  );
  const [tickers, setTickers] = useState<string[]>([]);

  return (
    <PortfolioContext.Provider
      value={{
        selectedPortfolioId,
        setSelectedPortfolioId,
        tickers,
        setTickers,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

// 4. Custom Hook per consumare il Context in sicurezza
export function usePortfolio(): PortfolioContextType {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error(
      "usePortfolio deve essere usato all'interno di un PortfolioProvider",
    );
  }
  return context;
}
