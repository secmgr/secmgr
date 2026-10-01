import { Button, EmptyState, InsightRow, n, PageHeader, Select, StatTile } from "@secmgr/ui";
import { useState } from "react";
import { useStore } from "../store";
import { ProjectMissing } from "./NotFound.parts.jsx";

const SECTIONS = [
  {
    severity: "danger",
    title: "Critical",
    desc: "Exposed secrets and live credentials outside production. Fix these first.",
  },
  { severity: "warning", title: "Warnings", desc: "Drift between environments and overdue rotations." },
  { severity: "info", title: "Info", desc: "Patterns worth a look." },
];

export default function Health() {
  const { state, select } = useStore();
  const pid = state.route.params.projectId;
  if (pid && !select.projectById(pid)) return <ProjectMissing projectId={pid} />;
  return <HealthView />;
}

function HealthView() {
  const { state, actions, select } = useStore();
  const projectId = state.route.params.projectId || null;
  const project = projectId ? select.projectById(projectId) : null;
  const [proj, setProj] = useState("all");
  const d = state.data;

  const scope = project ? project.id : proj !== "all" ? proj : null;
  const all = scope ? select.insightsFor(scope).map((i) => ({ ...i, projectId: scope })) : select.allInsights();
  const envOf = (id) => select.envById(id) || { name: "deleted" };
  const projectName = (id) => select.projectById(id)?.name ?? "";
  const perProject = d.projects.map((p) => ({ p, count: select.insightsFor(p.id).length }));
  const checked = project ? 1 : scope ? 1 : d.projects.length;

  const stagedIn = (envId, key) => !!select.stagedOf(envId)[key];

  const addMissing = async (ins) => {
    const target = select.envById(ins.envs[0]);
    const key = ins.keys[0];
    if (!target) return;
    const envs = select.envsOf(ins.projectId).filter((e) => e.id !== target.id);
    const holders = envs
      .map((e) => ({ e, s: select.rawSecretsOf(e.id).find((s) => s.key === key) }))
      .filter((x) => x.s && select.canRead(x.e.id));
    holders.sort(
      (a, b) => Math.abs(a.e.order - target.order) - Math.abs(b.e.order - target.order) || a.e.order - b.e.order,
    );
    const src = holders[0];
    const count = await actions.copyToEnv(
      [
        {
          key,
          envId: src ? src.e.id : target.id,
          value: src ? undefined : "",
          sensitive: src ? src.s.sensitive : true,
        },
      ],
      target.id,
      { silent: true },
    );
    if (!count) return;
    actions.toast({
      title: `Staged ${key} for ${target.name}`,
      description: `${src ? `Value from ${src.e.name}. ` : ""}${target.protected ? `Saving asks you to type ${target.name}.` : "Save it from the changes bar."}`,
      action: {
        label: "Review",
        onClick: () => actions.navigate("secrets", { projectId: ins.projectId, envId: target.id, mode: "table" }),
      },
    });
  };

  const secretFor = (ins) => d.secrets.find((s) => s.envId === ins.envs[0] && s.key === ins.keys[0]);
  const openSecret = (ins, section) => {
    const secret = secretFor(ins);
    if (secret) actions.openSheet("secret", { secretId: secret.id, section });
    else actions.navigate("secrets", { projectId: ins.projectId, envId: ins.envs[0], mode: "table" });
  };

  const actionFor = (ins) => {
    const key = ins.keys[0];
    const writable = select.canWrite(ins.envs[0]);
    if (ins.kind === "shared") {
      const names = ins.envs.map((id) => envOf(id).name);
      return {
        label: "Review",
        iconRight: "arrow-right",
        onClick: () => actions.navigate("compare", { projectId: ins.projectId, envs: names.slice(-2), mode: "matrix" }),
      };
    }
    if (!writable) return { label: "Open", iconRight: "arrow-right", onClick: () => openSecret(ins) };
    if (ins.kind === "missing") {
      if (stagedIn(ins.envs[0], key)) {
        return {
          label: "Review staged",
          icon: "arrow-right",
          onClick: () => actions.navigate("secrets", { projectId: ins.projectId, envId: ins.envs[0], mode: "table" }),
        };
      }
      return { label: "Add to production", icon: "plus", onClick: () => addMissing(ins) };
    }
    if (ins.kind === "live-key")
      return { label: "Rotate key", icon: "rotate-cw", onClick: () => openSecret(ins, "rotation") };
    if (ins.kind === "rotation") {
      const secret = secretFor(ins);
      return {
        label: "Rotate now",
        icon: "rotate-cw",
        onClick: () => (secret ? actions.rotateNow(secret) : openSecret(ins)),
      };
    }
    if (ins.kind === "empty") return { label: "Set value", icon: "pencil", onClick: () => openSecret(ins) };
    if (ins.kind === "reference")
      return {
        label: "Open",
        iconRight: "arrow-right",
        onClick: () => actions.navigate("secrets", { projectId: ins.projectId, envId: ins.envs[0], mode: "table" }),
      };
    return { label: "Open", iconRight: "arrow-right", onClick: () => openSecret(ins) };
  };

  const dismiss = async (ins, snoozed) => {
    const ok = await actions.dismissInsight(ins.id, snoozed ? 7 : undefined);
    if (!ok) return;
    const back = new Date(Date.now() + 7 * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    actions.toast({
      title: snoozed ? "Snoozed for 7 days" : "Dismissed",
      description: snoozed
        ? `${ins.title}. It comes back on ${back}.`
        : `${ins.title}. Restore it from Health any time.`,
      action: { label: "Undo", onClick: () => actions.restoreInsight(ins.id) },
    });
  };

  const counts = { danger: 0, warning: 0, info: 0 };
  for (const i of all) counts[i.severity] = (counts[i.severity] || 0) + 1;
  const affected = [...new Set(all.map((i) => i.projectId))];
  const dismissedCount = d.dismissedInsights.length;
  const restoreAll = async () => {
    const count = dismissedCount;
    await actions.restoreAllInsights();
    actions.toast({ title: `Restored ${n(count, "finding")}` });
  };
  const scopeLabel = project ? project.name : scope ? projectName(scope) : `${n(d.projects.length, "project")}`;

  const header = (
    <PageHeader
      title="Health"
      description={
        all.length ? (
          project || scope ? (
            <>
              {n(all.length, "thing")} {all.length === 1 ? "needs" : "need"} attention in{" "}
              <code className="pg-code">{scopeLabel}</code>. Checks run again on every change.
            </>
          ) : (
            <>
              {n(all.length, "thing")} {all.length === 1 ? "needs" : "need"} attention
              {affected.length === 1 ? (
                <>
                  , all in <code className="pg-code">{projectName(affected[0])}</code>
                </>
              ) : (
                ` across ${n(affected.length, "project")}`
              )}
              . {n(d.projects.length - affected.length, "other project")}{" "}
              {d.projects.length - affected.length === 1 ? "is" : "are"} healthy.
            </>
          )
        ) : (
          <>Missing keys, shared values, live keys outside production and overdue rotations, checked on every change.</>
        )
      }
      actions={
        !project ? (
          <Select
            size="sm"
            aria-label="Project"
            value={proj}
            onValueChange={setProj}
            placement="bottom-end"
            options={[
              { value: "all", label: "All projects", description: `${n(select.allInsights().length, "issue")}` },
              ...perProject.map(({ p, count }) => ({
                value: p.id,
                label: p.name,
                icon: "folder-git-2",
                description: count ? n(count, "issue") : "Healthy",
              })),
            ]}
          />
        ) : null
      }
    />
  );

  if (!all.length) {
    return (
      <div className="pg hl">
        {header}
        <EmptyState
          variant="page"
          icon="shield-check"
          title="All clear"
          description={`${n(checked, "project")} checked. No missing keys, shared values, live keys outside production or overdue rotations.`}
          actions={
            <>
              {proj !== "all" && !project ? (
                <Button variant="secondary" onClick={() => setProj("all")}>
                  Show all projects
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  icon="history"
                  onClick={() => actions.navigate("activity", project ? { projectId: project.id } : {})}
                >
                  See recent activity
                </Button>
              )}
              {dismissedCount > 0 && (
                <Button
                  variant="ghost"
                  icon="undo-2"
                  onClick={restoreAll}
                >{`Restore ${n(dismissedCount, "dismissed finding")}`}</Button>
              )}
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="pg hl">
      {header}
      <div className="pg__body">
        <div className="hl-stats">
          <StatTile
            label="Critical"
            icon="circle-alert"
            value={counts.danger}
            delta={counts.danger ? "Exposed or live credentials" : "Nothing exposed"}
            deltaTone={counts.danger ? "danger" : "success"}
          />
          <StatTile
            label="Warnings"
            icon="triangle-alert"
            value={counts.warning}
            delta={counts.warning ? "Drift and overdue rotations" : "No drift"}
            deltaTone={counts.warning ? "warning" : "success"}
          />
          <StatTile
            label="Info"
            icon="info"
            value={counts.info}
            delta={counts.info ? "Worth a look" : "Nothing to note"}
          />
        </div>
        {SECTIONS.map((sec) => {
          const rows = all.filter((i) => i.severity === sec.severity);
          if (!rows.length) return null;
          return (
            <section key={sec.severity} className="pg__section hl-section" aria-labelledby={`hl-${sec.severity}`}>
              <div className="hl-section__head">
                <div className="pg__section-head">
                  <h2 className="pg__section-title" id={`hl-${sec.severity}`}>
                    {sec.title}
                  </h2>
                  <span className="pg__section-count">{rows.length}</span>
                </div>
                <p className="pg__section-desc">{sec.desc}</p>
              </div>
              <div className="hl-list">
                {rows.map((ins) => (
                  <InsightRow
                    key={`${ins.projectId}:${ins.id}`}
                    severity={ins.severity}
                    title={ins.title}
                    description={
                      !project && !scope ? (
                        <>
                          <code className="hl-proj">{projectName(ins.projectId)}</code>
                          {ins.description}
                        </>
                      ) : (
                        ins.description
                      )
                    }
                    keys={ins.keys}
                    envs={ins.envs.map(envOf)}
                    action={actionFor(ins)}
                    onDismiss={() => dismiss(ins, false)}
                    onSnooze={() => dismiss(ins, true)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        <p className="pg__note">
          Snoozed findings come back after 7 days. Dismissed ones stay hidden until you restore them.
        </p>
        {dismissedCount > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              icon="undo-2"
              onClick={restoreAll}
            >{`Restore ${n(dismissedCount, "dismissed finding")}`}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
