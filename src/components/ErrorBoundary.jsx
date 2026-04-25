import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', flexDirection: 'column', gap: 14,
          background: '#f0f4f8', padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 44 }}>💥</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#991b1b' }}>
            Error en la aplicación
          </div>
          <pre style={{
            background: '#fff', border: '1px solid #fca5a5', borderRadius: 8,
            padding: '12px 16px', fontSize: 12, color: '#7f1d1d',
            maxWidth: 600, textAlign: 'left', overflowX: 'auto', whiteSpace: 'pre-wrap',
          }}>
            {this.state.error?.message}
            {'\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            style={{ padding: '8px 20px', background: '#1e3a5f', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 14 }}
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
