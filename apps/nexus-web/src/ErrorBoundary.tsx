import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Sentinel Nexus UI boundary", { error, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="fatal-state"><div><span>MODE DÉGRADÉ SÉCURISÉ</span><h1>Sentinel Nexus reste protégé.</h1><p>Une vue n’a pas pu être chargée. Aucune action de sécurité n’a été exécutée.</p><button onClick={() => window.location.reload()}>Recharger l’espace</button></div></main>;
  }
}
