import { useUIStore } from "../../shared/stores/ui.store";

export function ModalRenderer() {
  const modal = useUIStore((s) => s.modal);

  if (!modal) return null;
  return null;
}
