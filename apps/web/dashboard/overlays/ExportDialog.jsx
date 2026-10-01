import { Button, Callout, CodeBlock, Dialog, EnvBadge, n, SegmentedControl, Skeleton, Switch } from "@secmgr/ui";
import { useMemo, useState } from "react";
import { formatExport, useLatch } from "../shell/format.js";
import { useEnvValues, useStore } from "../store";

const FORMATS = [
  { value: "env", label: ".env", language: "dotenv", file: ".env", copy: "Copy .env" },
  { value: "json", label: "JSON", language: "json", file: "secrets.json", copy: "Copy JSON" },
  { value: "yaml", label: "YAML", language: "yaml", file: "secrets.yaml", copy: "Copy YAML" },
  { value: "docker", label: "docker", language: "shell", file: "docker run", copy: "Copy docker command" },
  { value: "k8s", label: "Kubernetes", language: "yaml", file: "secret.yaml", copy: "Copy Kubernetes Secret" },
];

function cliFor(format, env, projectName) {
  if (format === "docker") return `secmgr run --env ${env.name} -- docker run ${projectName}:latest`;
  if (format === "json") return `secmgr pull --env ${env.name} --format json > secrets.json`;
  if (format === "yaml") return `secmgr pull --env ${env.name} --format yaml > secrets.yaml`;
  if (format === "k8s") return `secmgr pull --env ${env.name} --format k8s > secret.yaml`;
  return `secmgr pull --env ${env.name} > .env`;
}

export default function ExportDialog({ envId, keys, onClose }) {
  const { select } = useStore();
  const env = select.envById(envId);
  if (!env || !select.canRead(env.id)) return null;
  return <Export env={env} keys={keys} onClose={onClose} />;
}

function Export({ env, keys, onClose }) {
  const { state, actions, select } = useStore();
  useEnvValues([env.id]);
  const [open, close] = useLatch(onClose, 200);
  const projectName = select.projectById(env.projectId)?.name ?? "app";
  const status = select.valuesStatus(env.id);
  const ready = status === "ready";
  const [format, setFormat] = useState("env");
  const [shown, setShown] = useState(false);
  const rows = useMemo(() => {
    const all = select.secretsOf(env.id).filter((r) => r.status !== "deleted");
    return keys?.length ? all.filter((r) => keys.includes(r.key)) : all;
  }, [env.id, keys, state.data, state.staged, state.values]);
  const f = FORMATS.find((x) => x.value === format);
  const opts = { envName: env.name, projectId: projectName };
  const code = ready ? formatExport(rows, format, { ...opts, masked: !shown }) : "";
  const staged = select.stagedCount(env.id);

  const show = (v) => {
    setShown(v);
    if (v)
      actions.log({
        action: "reveal",
        projectId: env.projectId,
        envId: env.id,
        count: rows.length,
        keys: rows.length <= 2 ? rows.map((r) => r.key) : undefined,
      });
  };

  const copy = async () => {
    const ok = await actions.copyString(
      formatExport(rows, format, { ...opts, masked: false }),
      `Copied ${n(rows.length, "secret")} as ${f.label}`,
      state.prefs.clipboardClearSec
        ? `Clipboard clears in ${state.prefs.clipboardClearSec}s. The export is logged in activity.`
        : "The export is logged in activity.",
    );
    if (ok) {
      actions.log({
        action: "read",
        projectId: env.projectId,
        envId: env.id,
        count: rows.length,
        message: `Exported as ${f.label}`,
      });
      close();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
      size="lg"
      title={keys?.length ? `Export ${n(rows.length, "secret")} from ${env.name}` : `Export ${env.name}`}
      description={`${projectName}/${env.name} · ${n(rows.length, "secret")}${staged ? ", including unsaved changes" : ""}. Values stay hidden until you show them.`}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" icon="copy" disabled={!rows.length || !ready} onClick={copy}>
            {f.copy}
          </Button>
        </>
      }
    >
      <div className="app-export">
        <div className="app-export__bar">
          <SegmentedControl
            size="sm"
            options={FORMATS.map((x) => ({ value: x.value, label: x.label }))}
            value={format}
            onValueChange={setFormat}
            aria-label="Format"
          />
          <Switch size="sm" label="Show values" labelPosition="start" checked={shown} onCheckedChange={show} />
        </div>
        {status === "error" ? (
          <Callout
            tone="danger"
            title="Could not load values"
            action={
              <Button size="sm" icon="refresh-cw" onClick={() => actions.loadValues(env.id, { force: true })}>
                Try again
              </Button>
            }
          >
            {state.values[env.id]?.error}
          </Callout>
        ) : ready ? (
          <CodeBlock key={format} title={f.file} language={f.language} code={code} copy={false} maxHeight={320} />
        ) : (
          <Skeleton variant="block" width="100%" height={160} />
        )}
        <p className="app-export__hint">
          From a terminal: <code>{cliFor(format, env, projectName)}</code>
        </p>
        <div className="app-export__env">
          <EnvBadge env={{ name: env.name, color: env.color, protected: env.protected }} size="sm" />
          <span>Copying logs a read of {n(rows.length, "secret")} in activity.</span>
        </div>
      </div>
    </Dialog>
  );
}
