import { Suspense } from "react";
import AppShell from "@/components/app-shell";

// One mounted shell owns session and workspace state for all major sections.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <><Suspense fallback={null}><AppShell /></Suspense>{children}</>;
}
