import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import Logger from '../utils/logger';
import {
  attemptDynamicImportRecovery,
  isDynamicImportError,
  recoverFromDynamicImportError,
} from '../utils/dynamicImportRecovery';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Logger.error('React Error Boundary caught an error', {
      error: error.toString(),
      componentStack: errorInfo.componentStack
    });

    this.setState({
      error,
      errorInfo
    });

    if (isDynamicImportError(error)) {
      void attemptDynamicImportRecovery(error, 'error-boundary');
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = async () => {
    if (isDynamicImportError(this.state.error)) {
      await recoverFromDynamicImportError();
      return;
    }

    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950 p-8">
          <div className="max-w-2xl w-full bg-slate-900 border border-red-500/20 rounded-2xl p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-red-500/10 rounded-xl">
                <AlertCircle className="text-red-500" size={32} />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white mb-2">
                  Ocorreu um erro inesperado
                </h1>
                <p className="text-slate-400">
                  A aplicação encontrou uma falha e precisa se recuperar.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="mb-6 p-4 bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-sm text-red-400 font-mono mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                      Pilha de componentes
                    </summary>
                    <pre className="mt-2 text-xs text-slate-600 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 px-6 rounded-xl font-bold transition-colors"
              >
                Tentar Novamente
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 px-6 rounded-xl font-bold transition-colors"
              >
                Recarregar Página
              </button>
            </div>

            <div className="mt-6 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500">
                Se o problema persistir, tente limpar o cache do navegador ou contate o suporte.
                Os detalhes do erro foram registrados para diagnóstico.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
