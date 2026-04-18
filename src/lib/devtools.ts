import { invoke } from "@tauri-apps/api/core";
import type { MenuItem } from "../components/ContextMenu";

export async function openDevtools(): Promise<void> {
  try {
    await invoke("open_devtools");
  } catch (e) {
    console.warn("open_devtools failed:", e);
  }
}

export function devMenuItems(): (MenuItem | "sep")[] {
  return [
    "sep",
    {
      label: "Reload",
      onClick: () => location.reload(),
    },
    {
      label: "Inspect element",
      onClick: () => {
        void openDevtools();
      },
    },
  ];
}
