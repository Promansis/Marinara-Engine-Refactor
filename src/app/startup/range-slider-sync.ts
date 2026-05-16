function syncRangeSliderProgress(input: HTMLInputElement) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || 0);
  const span = max - min;
  const percent = Number.isFinite(span) && span > 0 ? ((value - min) / span) * 100 : 0;
  input.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, percent))}%`);
}

export function installRangeSliderSync() {
  const syncAll = () => {
    document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(syncRangeSliderProgress);
  };
  const syncNode = (node: Node) => {
    if (node instanceof HTMLInputElement && node.type === "range") {
      syncRangeSliderProgress(node);
      return;
    }
    if (node instanceof Element) {
      node.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(syncRangeSliderProgress);
    }
  };
  const syncEventTarget = (event: Event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === "range") {
      syncRangeSliderProgress(event.target);
    }
  };

  syncAll();
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(syncNode);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("input", syncEventTarget, true);
  document.addEventListener("change", syncEventTarget, true);
  document.addEventListener("focusin", syncEventTarget, true);
  document.addEventListener("pointerover", syncEventTarget, true);

  return () => {
    observer.disconnect();
    document.removeEventListener("input", syncEventTarget, true);
    document.removeEventListener("change", syncEventTarget, true);
    document.removeEventListener("focusin", syncEventTarget, true);
    document.removeEventListener("pointerover", syncEventTarget, true);
  };
}
