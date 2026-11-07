import React from "react";
export default class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="empty-state" role="alert">
        <h1>Ekran açılamadı.</h1>
        <p>
          Kaydedilmiş ayarların korunur. Sayfayı yenileyip yeniden
          deneyebilirsin.
        </p>
        <button className="primary-button" onClick={() => location.reload()}>
          Yeniden aç
        </button>
      </main>
    );
  }
}
