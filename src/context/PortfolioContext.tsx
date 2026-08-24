import React, { createContext, ReactNode, useContext, useState } from "react";

export type Holding = {
  ticker: string;
  weight: number;
};

export type Portfolio = {
  id: number;
  holdings: Holding[];
  cash: number;
  commission_bps: number;
};

interface PortfolioContextType {
  selectedPortfolioId: number | null;
  setSelectedPortfolioId: React.Dispatch<React.SetStateAction<number | null>>;
  portfolioData: Portfolio | null;
  setPortfolioData: React.Dispatch<React.SetStateAction<Portfolio | null>>;
  refreshToken: number; // cambia ad ogni mutazione: i consumer lo mettono nelle deps
  refreshPortfolio: () => void; // segnala "ricarica i dati del portafoglio"
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
  const [portfolioData, setPortfolioData] = useState<Portfolio | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const refreshPortfolio = () => setRefreshToken((t) => t + 1);

  return (
    <PortfolioContext.Provider
      value={{
        selectedPortfolioId,
        setSelectedPortfolioId,
        portfolioData,
        setPortfolioData,
        refreshToken,
        refreshPortfolio,
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
