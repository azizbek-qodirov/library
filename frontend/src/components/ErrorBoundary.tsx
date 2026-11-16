import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '5px',
          margin: '20px'
        }}>
          <h2>Xatolik yuz berdi</h2>
          <p>Uzr, kutilmagan xatolik yuz berdi.</p>
          <details style={{ marginTop: '10px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer' }}>Texnik ma'lumotlar</summary>
            <pre style={{
              background: '#fff',
              padding: '10px',
              borderRadius: '3px',
              overflow: 'auto',
              marginTop: '10px'
            }}>
              {this.state.error?.toString()}
            </pre>
          </details>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: '15px',
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Qayta urinish
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
