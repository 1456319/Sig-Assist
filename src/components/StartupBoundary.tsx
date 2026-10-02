import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';

declare global {
  interface Window {
    sigAssistStartup?: {
      ready: (buildId: string) => void;
      failed: (kind: string, error: unknown, extra?: Record<string, unknown>) => void;
      report: () => Record<string, unknown>;
    };
  }
}

export class StartupBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    window.sigAssistStartup?.failed('react-render', error, { componentStack: info.componentStack });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function StartupReady() {
  useEffect(() => { window.sigAssistStartup?.ready(__SIG_ASSIST_BUILD__); }, []);
  return null;
}
