import "./dashboard.css";
import { Toaster } from "@secmgr/ui";
import { useEffect } from "react";
import { SCREENS, TITLES } from "./screens/index.js";
import { Overlays } from "./shell/Overlays.jsx";
import { Shell } from "./shell/Shell.jsx";
import { StoreProvider, useStore } from "./store";

function Screens() {
  const { state, select } = useStore();
  const route = state.route;
  const p = route.params || {};
  const Screen = SCREENS[route.name] || SCREENS.notfound;
  useEffect(() => {
    const project = p.projectId ? select.projectById(p.projectId) : null;
    const env = p.envId ? select.envById(p.envId) : null;
    const where = [
      env && project ? `${project.name}/${env.name}` : project ? project.name : null,
      TITLES[route.name],
    ].filter(Boolean);
    document.title = `${where.join(" · ")} · ${state.data.workspace.name} · secmgr`;
  });
  return (
    <Shell>
      <Screen key={`${route.name}:${p.projectId || ""}:${p.envId || ""}`} />
    </Shell>
  );
}

export default function App({ snapshot, slug }) {
  return (
    <StoreProvider snapshot={snapshot} slug={slug}>
      <Screens />
      <Overlays />
      <Toaster />
    </StoreProvider>
  );
}
