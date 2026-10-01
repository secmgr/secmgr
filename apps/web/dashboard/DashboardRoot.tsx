"use client";

import { Spinner } from "@secmgr/ui";
import dynamic from "next/dynamic";
import type { Snapshot } from "./api";

const App = dynamic(() => import("./App.jsx"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100dvh", color: "var(--text-tertiary)" }}>
      <Spinner size={20} label="Loading your workspace" />
    </div>
  ),
});

export function DashboardRoot({ snapshot, slug }: { snapshot: Snapshot; slug: string }) {
  return <App snapshot={snapshot} slug={slug} />;
}
