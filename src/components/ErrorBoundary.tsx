import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary capturou um erro não tratado:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    this.props.onReset?.();
  };

  private handleCopyError = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    const errorDetails = [
      `[GabariTeX Erro]: ${error?.name || 'Error'}: ${error?.message || 'Sem mensagem'}`,
      `\n[Stack]:\n${error?.stack || 'Sem stack trace'}`,
      errorInfo?.componentStack ? `\n[Component Stack]:\n${errorInfo.componentStack}` : '',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(errorDetails);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch (e) {
      console.error('Falha ao copiar detalhes do erro para a área de transferência', e);
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const { fallbackTitle = 'Ocorreu um erro inesperado nesta tela' } = this.props;
      const { error, errorInfo, copied } = this.state;

      return (
        <div className="max-w-3xl mx-auto my-8 p-6 bg-white rounded-2xl shadow-sm border border-slate-200 animate-in fade-in duration-200">
          <div className="flex items-start gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">
                {fallbackTitle}
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Um erro inesperado de execução ocorreu durante a renderização deste componente. Seus dados continuam salvos no perfil.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-mono break-words leading-relaxed">
              <span className="font-bold block mb-1">
                {error.name || 'Erro'}: {error.message}
              </span>
            </div>
          )}

          {error?.stack && (
            <details className="mb-5 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden text-xs">
              <summary className="px-4 py-2.5 font-mono font-semibold text-slate-400 hover:text-slate-200 cursor-pointer select-none transition">
                Exibir rastreamento técnico detalhado (stack trace)
              </summary>
              <div className="p-4 pt-2 border-t border-slate-800 overflow-x-auto max-h-60 text-[11px] font-mono text-rose-300 whitespace-pre-wrap leading-relaxed">
                {error.stack}
                {errorInfo?.componentStack && `\n\nComponentes:\n${errorInfo.componentStack}`}
              </div>
            </details>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={this.handleCopyError}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copiar Detalhes do Erro</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-bold rounded-lg shadow-sm transition active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar Novamente</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
