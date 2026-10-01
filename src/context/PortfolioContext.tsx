import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import * as cfg from "../utils/agentConfig";
import { type AgentTarget } from "../utils/agentConfig";
import {
  loadPortfolioTargets,
  setPortfolioTargets,
} from "../utils/portfolioMethods";

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
  modelTarget: AgentTarget; // target vol del modello DRL (15/20/25)
  setModelTarget: (t: AgentTarget) => void;
  methodTargetVol: number; // target vol annuo del metodo Target Volatility
  setMethodTargetVol: (v: number) => void;
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

  const [modelTarget, setModelTargetState] = useState<AgentTarget>(
    cfg.getModelTarget(),
  );
  const [methodTargetVol, setMethodTargetVolState] = useState<number>(
    cfg.getMethodTargetVol(),
  );

  // Al cambio di portafoglio: carica i SUOI target (stato UI + config module),
  // senza scrivere sul DB e senza forzare ricalcoli inutili.
  useEffect(() => {
    if (selectedPortfolioId == null) return;
    let cancelled = false;
    loadPortfolioTargets(selectedPortfolioId).then((t) => {
      if (cancelled || !t) return;
      cfg.setModelTarget(t.model);
      cfg.setMethodTargetVol(t.method);
      setModelTargetState(t.model);
      setMethodTargetVolState(t.method);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPortfolioId]);

  // Cambi dell'utente: aggiornano stato + config, PERSISTONO sul portafoglio
  // selezionato e forzano il ricalcolo di pesi e backtest.
  // Nota: si attende la scrittura su DB PRIMA di bumpare refreshToken, così
  // EquityChart (che ricarica pf dal DB) legge sempre il target aggiornato.
  const setModelTarget = async (t: AgentTarget) => {
    cfg.setModelTarget(t);
    setModelTargetState(t);
    if (selectedPortfolioId != null)
      await setPortfolioTargets(selectedPortfolioId, { model: t });
    setRefreshToken((x) => x + 1);
  };
  const setMethodTargetVol = async (v: number) => {
    cfg.setMethodTargetVol(v);
    setMethodTargetVolState(v);
    if (selectedPortfolioId != null)
      await setPortfolioTargets(selectedPortfolioId, { method: v });
    setRefreshToken((x) => x + 1);
  };

  return (
    <PortfolioContext.Provider
      value={{
        selectedPortfolioId,
        setSelectedPortfolioId,
        portfolioData,
        setPortfolioData,
        refreshToken,
        refreshPortfolio,
        modelTarget,
        setModelTarget,
        methodTargetVol,
        setMethodTargetVol,
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
