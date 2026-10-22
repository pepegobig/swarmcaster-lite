import { Component, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { exposeToIframe } from "@farcaster/miniapp-host";
import { isHttps } from "./api.js";
import { AppIcon } from "./AppsPage.jsx";

const notSupported = () => Promise.reject(new Error("Not supported in Swarmcaster Lite"));
const noop = () => {};

// The visitor's injected wallet as the plain EIP-1193 object the host library expects. Wallets such as MetaMask keep
// on/removeListener on the prototype, and ox's Provider.from copies own properties only, so those methods were lost
// and the host's provider.on(...) call threw ("e.on is not a function").
function walletBridge(injected) {
  if (!injected || typeof injected.request !== "function") return undefined;
  return {
    request: (args) => injected.request(args),
    on: (event, fn) => (typeof injected.on === "function" ? injected.on(event, fn) : undefined),
    removeListener: (event, fn) => (typeof injected.removeListener === "function" ? injected.removeListener(event, fn) : undefined),
  };
}

// A failing mini app must never take the page down: errors inside the panel show a message in the panel.
class PanelBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// Hosts one mini app in a frame. Nobody signs in: the context carries a guest user (fid 0), wallet requests go to the
// visitor's own injected wallet when there is one, and Farcaster-only actions are refused (SPEC.md, "Mini apps").
export function MiniAppPanel(props) {
  return (
    <PanelBoundary fallback={<FailedPanel {...props} />}>
      <PanelInner {...props} />
    </PanelBoundary>
  );
}

function FailedPanel({ app, onClose }) {
  const home = isHttps(app.homeUrl) ? app.homeUrl : null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel panel-failed" role="dialog" aria-modal="true" aria-labelledby="panel-title">
        <div className="panel-head">
          <h2 id="panel-title" className="panel-title">{app.name}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="state">
          <h2>This app could not open here</h2>
          {home ? <a className="btn ghost" href={home} target="_blank" rel="noopener noreferrer">Open in a new tab</a> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const CloseIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);

function PanelInner({ app, onClose }) {
  const frame = useRef(null);
  const closeBtn = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const home = isHttps(app.homeUrl) ? app.homeUrl : null;

  useEffect(() => {
    const before = document.activeElement;
    closeBtn.current && closeBtn.current.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("locked");
    const t = setTimeout(() => setReady(true), 6000); // apps that never call ready() still show
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("locked");
      clearTimeout(t);
      before && before.focus && before.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (!home || !frame.current) return;
    const ethProvider = walletBridge(typeof window !== "undefined" ? window.ethereum : undefined);
    const openUrl = (url) => isHttps(url) && window.open(url, "_blank", "noopener,noreferrer");
    const sdk = {
      context: {
        client: { clientFid: 0, added: false, platformType: "web" },
        user: { fid: 0, displayName: "Guest" },
        location: { type: "launcher" },
        features: { haptics: false },
      },
      ready: () => setReady(true),
      close: onClose,
      openUrl,
      openMiniApp: ({ url }) => openUrl(url),
      getCapabilities: async () => ["actions.ready", "actions.openUrl", "actions.close", ...(ethProvider ? ["wallet.getEthereumProvider"] : [])],
      getChains: async () => (ethProvider ? ["eip155:1", "eip155:8453"] : []),
      signIn: notSupported,
      signManifest: notSupported,
      addFrame: notSupported,
      addMiniApp: notSupported,
      requestCameraAndMicrophoneAccess: notSupported,
      ethProviderRequest: notSupported,
      composeCast: async () => ({ cast: null }),
      viewCast: noop,
      viewProfile: noop,
      viewToken: noop,
      sendToken: async () => ({ success: false, reason: "rejected_by_user" }),
      swapToken: async () => ({ success: false, reason: "rejected_by_user" }),
      setPrimaryButton: noop,
      eip6963RequestProvider: noop,
      impactOccurred: noop,
      notificationOccurred: noop,
      selectionChanged: noop,
      updateBackState: noop,
    };
    try {
      const { cleanup } = exposeToIframe({ iframe: frame.current, sdk, ethProvider, miniAppOrigin: new URL(home).origin });
      return cleanup;
    } catch {
      setFailed(true); // the app still loads in the frame; only the SDK bridge is missing
      return undefined;
    }
  }, [home, onClose]);

  // Rendered into <body>: sticky columns form their own stacking contexts and would cover a panel nested in them.
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title">
        <div className="panel-head">
          <AppIcon app={app} size={28} />
          <h2 id="panel-title" className="panel-title">{app.name}</h2>
          {home ? (
            <a className="btn ghost small" href={home} target="_blank" rel="noopener noreferrer">Open in a new tab</a>
          ) : null}
          <button ref={closeBtn} type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="panel-body">
          {failed ? <p className="panel-note">This app could not connect to Swarmcaster. If it does not work here, open it in a new tab.</p> : null}
          {home ? (
            <iframe
              ref={frame}
              title={app.name}
              src={home}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              allow="clipboard-write; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <p className="state">This app has no valid address.</p>
          )}
          {!ready && home ? (
            <div className="splash" style={{ background: app.splashBackgroundColor || undefined }} aria-hidden="true">
              {app.splashImageUrl && isHttps(app.splashImageUrl) ? <img src={app.splashImageUrl} alt="" width="96" height="96" /> : <AppIcon app={app} size={72} />}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
