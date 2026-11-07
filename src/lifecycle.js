import { useEffect, useRef, useState } from "react";
// A waiting worker is only an update when an older worker already controls the
// page. On a first visit the new worker passes through "waiting" on its way to
// activation; that is an install, not an update.
export const pendingUpdate = (reg, controller) =>
  (controller && reg?.waiting) || null;
export function useAppLifecycle() {
  const [online, setOnline] = useState(navigator.onLine),
    [installable, setInstallable] = useState(false),
    [updateReady, setUpdateReady] = useState(false),
    prompt = useRef(null),
    worker = useRef(null),
    updateRequested = useRef(false);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false),
      before = (e) => {
        e.preventDefault();
        prompt.current = e;
        setInstallable(true);
      },
      installed = () => {
        prompt.current = null;
        setInstallable(false);
      };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", installed);
    let changed;
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      changed = () => {
        if (updateRequested.current) location.reload();
        // Another tab may accept an update. Never discard this tab's form drafts.
        else if (worker.current) setUpdateReady(true);
      };
      navigator.serviceWorker.addEventListener("controllerchange", changed);
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          const offer = () => {
            const waiting = pendingUpdate(reg, navigator.serviceWorker.controller);
            if (waiting) {
              worker.current = waiting;
              setUpdateReady(true);
            }
          };
          offer();
          reg.addEventListener("updatefound", () =>
            reg.installing?.addEventListener("statechange", offer),
          );
        })
        .catch(() => {});
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", installed);
      if (changed)
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          changed,
        );
    };
  }, []);
  async function install() {
    if (!prompt.current) return;
    await prompt.current.prompt();
    await prompt.current.userChoice;
    prompt.current = null;
    setInstallable(false);
  }
  return {
    online,
    installable,
    install,
    updateReady,
    updateApp: () => {
      updateRequested.current = true;
      if (worker.current?.state === "installed")
        worker.current.postMessage({ type: "SKIP_WAITING" });
      else location.reload();
    },
  };
}
