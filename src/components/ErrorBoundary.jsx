import React from "react";

function isChunkError(error) {
  if (!error) return false;
  const name = String(error.name || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    name.toLowerCase().includes("chunk") ||
    msg.includes("dynamically imported module") ||
    msg.includes("failed to fetch dynamically imported") ||
    msg.includes("loading chunk") ||
    msg.includes("importing a module script failed") ||
    msg.includes("loading failed for the")
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  handleReload = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          await reg.update().catch(() => {});
        }
      }
    } catch (_) {}
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const isChunk = isChunkError(this.state.error);
    const isView = this.props.view;

    const card = {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "14px",
      textAlign: "center",
      padding: "40px 20px",
      color: "var(--text)",
      fontFamily: "var(--font-body)",
    };
    const rootStyle = isView
      ? card
      : { ...card, flex: 1, minHeight: 0, background: "var(--bg)" };

    return (
      <div style={rootStyle}>
        <span
          style={{
            fontSize: isChunk ? "30px" : "32px",
            color: "var(--accent)",
            animation: isChunk ? "aimerSpin 2.4s linear infinite" : undefined,
          }}
        >
          ✦
        </span>
        <style>{`@keyframes aimerSpin { to { transform: rotate(360deg); } }`}</style>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
          {isChunk ? "Actualización disponible" : (this.props.title || "Algo salió mal")}
        </h2>
        <p style={{ margin: 0, fontSize: "13.5px", maxWidth: "340px", color: "var(--text-muted)", lineHeight: 1.5 }}>
          {isChunk
            ? "Se desplegó una versión nueva de Aimer. Recarga la página para cargar los últimos cambios."
            : (this.props.message ||
              "Ocurrió un error inesperado. Tus datos están guardados; recarga la página para continuar.")}
        </p>
        {isChunk && (
          <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
            Tus datos están a salvo: solo se actualiza la interfaz.
          </p>
        )}
        <div style={{ display: "flex", gap: "10px", marginTop: "6px", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={this.handleReload}
            style={{
              padding: "10px 20px",
              borderRadius: "10px",
              border: "none",
              background: "var(--accent)",
              color: "var(--text)",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            {isChunk ? "Recargar ahora" : "Recargar"}
          </button>
          {isChunk && (
            <button
              onClick={this.handleDismiss}
              style={{
                padding: "10px 20px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Ahora no
            </button>
          )}
        </div>
      </div>
    );
  }
}
