// Configurazione runtime dei target di volatilita', condivisa tra allocazione
// live e backtest. La UI (via PortfolioContext) la aggiorna; le funzioni foglia
// (runAgent, volatilityTargeting) la leggono senza bisogno di prop-drilling.

export type AgentTarget = 15 | 20 | 25; // target vol % del modello DRL

let modelTarget: AgentTarget = 25; // modello DRL selezionato (default 25%)
let methodTargetVol = 0.1; // target annuo del metodo Target Volatility (default 10%)

export function getModelTarget(): AgentTarget {
  return modelTarget;
}
export function setModelTarget(t: AgentTarget): void {
  modelTarget = t;
}
export function getMethodTargetVol(): number {
  return methodTargetVol;
}
export function setMethodTargetVol(v: number): void {
  methodTargetVol = v;
}
