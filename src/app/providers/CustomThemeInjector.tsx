import { useEffect } from "react";
import { useUIStore } from "../../shared/stores/ui.store";

export function CustomThemeInjector() {
  const activeCustomTheme = useUIStore((s) => s.activeCustomTheme);
  const customThemes = useUIStore((s) => s.customThemes);
  const installedExtensions = useUIStore((s) => s.installedExtensions);

  useEffect(() => {
    const id = "marinara-custom-theme";
    let style = document.getElementById(id) as HTMLStyleElement | null;
    const activeTheme = customThemes.find((theme) => theme.id === activeCustomTheme) ?? null;

    if (!activeTheme) {
      style?.remove();
      return;
    }

    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = activeTheme.css;

    return () => {
      style?.remove();
    };
  }, [activeCustomTheme, customThemes]);

  useEffect(() => {
    const prefix = "marinara-ext-";

    document.querySelectorAll(`style[id^="${prefix}"]`).forEach((el) => el.remove());

    for (const ext of installedExtensions) {
      if (!ext.enabled || !ext.css) continue;
      const style = document.createElement("style");
      style.id = `${prefix}${ext.id}`;
      style.textContent = ext.css;
      document.head.appendChild(style);
    }

    return () => {
      document.querySelectorAll(`style[id^="${prefix}"]`).forEach((el) => el.remove());
    };
  }, [installedExtensions]);

  return null;
}
