import {
  Button,
  Callout,
  classifyImport,
  DropZone,
  EnvDot,
  EnvEditor,
  Icon,
  IconButton,
  ImportPreview,
  n,
  parseDotenv,
  Select,
  Sheet,
  Tabs,
} from "@secmgr/ui";
import { useEffect, useMemo, useState } from "react";
import { guessSensitive, serializeEnv, useLatch } from "../shell/format.js";
import { useEnvValues, useStore } from "../store";

const PLACEHOLDER =
  "DATABASE_URL=postgres://app:…@db.internal:5432/app\nSTRIPE_SECRET_KEY=sk_test_51N…\nLOG_LEVEL=info";

export default function ImportSheet(props) {
  const { select } = useStore();
  const start = select.envById(props.envId);
  if (!start || !select.canWrite(start.id)) return null;
  return <Import {...props} start={start} />;
}

function Import({ start, text: initialText, fileName, onClose }) {
  const { state, actions, select } = useStore();
  const [open, close] = useLatch(onClose, 220);
  const [target, setTarget] = useState(start.id);
  const env = select.envById(target) || start;
  const project = select.projectById(env.projectId);
  const envs = project ? select.envsOf(project.id).filter((e) => select.canWrite(e.id)) : [];
  const others = (project ? select.envsOf(project.id) : []).filter((e) => e.id !== env.id && select.canRead(e.id));

  const [tab, setTab] = useState("paste");
  const [text, setText] = useState(initialText || "");
  const [file, setFile] = useState(fileName || null);
  const [source, setSource] = useState(others[0] ? others[0].id : null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (initialText !== undefined) {
      setText(initialText || "");
      setFile(fileName || null);
      setTab("paste");
    }
  }, [initialText, fileName]);
  useEffect(() => {
    if (source === env.id || !envs.find((e) => e.id === source)) setSource(others[0] ? others[0].id : null);
  }, [env.id]);

  useEnvValues([env.id, tab === "env" ? source : null]);
  const targetReady = select.valuesStatus(env.id) === "ready";
  const sourceReady = !source || select.valuesStatus(source) === "ready";

  const sourceText = useMemo(
    () => (source && sourceReady ? serializeEnv(select.secretsOf(source).filter((r) => r.status !== "deleted")) : ""),
    [source, sourceReady, state.data, state.staged, state.values],
  );
  const input = !targetReady ? "" : tab === "env" ? sourceText : tab === "paste" ? text : "";

  const existing = useMemo(
    () =>
      Object.fromEntries(
        select
          .secretsOf(env.id)
          .filter((r) => r.status !== "deleted")
          .map((r) => [r.key, r.value || ""]),
      ),
    [env.id, state.data, state.staged, state.values],
  );
  const parsed = useMemo(() => parseDotenv(input), [input]);
  const rows = useMemo(() => {
    const entries = parsed.entries.map((e) => ({ line: e.line, key: e.key, value: e.value }));
    const errs = parsed.errors.map((e) => ({
      line: e.line,
      key: e.key || (e.raw || "").split("=")[0].trim() || `Line ${e.line}`,
      value: e.value || "",
      error: e.message,
    }));
    return classifyImport(
      [...entries, ...errs].sort((a, b) => a.line - b.line),
      existing,
    );
  }, [parsed, existing]);

  const signature = `${tab}|${env.id}|${input}`;
  const defaults = useMemo(
    () => rows.filter((r) => r.status === "new" || (r.status === "changed" && tab !== "env")).map((r) => r.id),
    [signature],
  );
  const [selected, setSelected] = useState(defaults);
  useEffect(() => {
    setSelected(defaults);
  }, [signature]);

  const selSet = new Set(selected);
  const chosen = rows.filter((r) => (r.status === "new" || r.status === "changed") && selSet.has(r.id));
  const overwrites = chosen.filter((r) => r.status === "changed").length;
  const invalid = rows.filter((r) => r.status === "invalid").length;

  const doImport = () => {
    if (!chosen.length) return;
    const current = new Map(select.secretsOf(env.id).map((r) => [r.key, r]));
    actions.importEntries(
      env.id,
      chosen.map((r) => {
        const prev = current.get(r.key);
        return {
          key: r.key,
          value: r.value,
          exists: !!(prev && prev.status !== "added"),
          sensitive: prev ? prev.sensitive !== false : guessSensitive(r.key, r.value),
        };
      }),
    );
    const route = state.route;
    if (!(route.name === "secrets" && route.params.envId === env.id))
      actions.navigate("secrets", { projectId: env.projectId, envId: env.id, mode: "table" });
    actions.toast({
      tone: "success",
      title: `Staged ${n(chosen.length, "secret")} for ${env.name}`,
      description: env.protected
        ? `Review them in the changes bar. Saving asks you to type ${env.name}.`
        : "Review them in the changes bar, then save.",
    });
    close();
  };

  const envOption = (e) => ({
    value: e.id,
    label: e.name,
    prefix: <EnvDot color={e.color} size={8} />,
    description: `${select.rawSecretsOf(e.id).length} secrets${e.protected ? ", protected" : ""}`,
  });

  const footer = (
    <>
      <span className="app-import__foot-note">
        {overwrites
          ? `${n(overwrites, "existing value")} will be overwritten`
          : invalid
            ? `${n(invalid, "line")} skipped`
            : ""}
      </span>
      <Button onClick={close}>Cancel</Button>
      <Button variant="primary" icon="upload" disabled={!chosen.length} onClick={doImport}>
        {chosen.length ? `Import ${n(chosen.length, "secret")} into ${env.name}` : "Import secrets"}
      </Button>
    </>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
      className="app-import-sheet"
      closeOnOverlay={false}
      title={`Import .env into ${env.name}`}
      description={project ? `${project.name} · nothing is saved until you review the changes bar` : undefined}
      footer={footer}
    >
      <div className="app-import">
        <div className="app-import__target">
          <label className="app-import__label" htmlFor="app-import-target">
            Import into
          </label>
          <Select
            id="app-import-target"
            size="sm"
            options={envs.map(envOption)}
            value={env.id}
            onValueChange={setTarget}
            noun="environment"
          />
        </div>
        {env.protected ? (
          <Callout tone="neutral" icon="lock" title={`${env.name} is protected`}>
            Importing stages the secrets. Saving them asks you to type <code>{env.name}</code>.
          </Callout>
        ) : null}
        <Tabs
          size="sm"
          label="Import source"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "paste", label: "Paste", icon: "clipboard-paste" },
            { value: "file", label: "Upload file", icon: "file-up" },
            { value: "env", label: "From environment", icon: "layers" },
          ]}
        />
        {tab === "paste" ? (
          <div className="app-import__paste">
            {file ? (
              <div className="app-import__file">
                <Icon name="file-text" size={14} />
                <span className="app-import__file-name">{file}</span>
                <span className="app-tertiary">{n(parsed.keys, "key")}</span>
                <IconButton
                  icon="x"
                  size="xs"
                  label="Clear file"
                  onClick={() => {
                    setFile(null);
                    setText("");
                  }}
                />
              </div>
            ) : null}
            <EnvEditor
              value={text}
              onValueChange={(v) => {
                setText(v);
                if (!v) setFile(null);
              }}
              env={{ name: env.name, color: env.color, protected: env.protected }}
              placeholder={PLACEHOLDER}
              minLines={6}
              maxHeight={240}
              aria-label={`Paste a .env to import into ${env.name}`}
            />
          </div>
        ) : tab === "file" ? (
          <DropZone
            variant="inline"
            env={{ name: env.name, color: env.color, protected: env.protected }}
            loading={reading}
            loadingLabel={file ? `Reading ${file}` : "Reading file"}
            onFile={(f, t) => {
              setReading(false);
              setFile(f.name);
              setText(t);
              setTab("paste");
            }}
            onText={(t) => {
              setText(t);
              setFile(null);
              setTab("paste");
            }}
            onReject={(f, reason) =>
              actions.toast({
                tone: "danger",
                title: "Could not read that file",
                description:
                  reason === "multiple"
                    ? "Drop one file at a time."
                    : reason === "size"
                      ? `${f ? f.name : "The file"} is larger than 1 MB.`
                      : `${f ? f.name : "That file"} is not a text file.`,
              })
            }
          />
        ) : (
          <div className="app-import__from">
            {others.length ? (
              <>
                <div className="app-import__target">
                  <label className="app-import__label" htmlFor="app-import-source">
                    Copy keys from
                  </label>
                  <Select
                    id="app-import-source"
                    size="sm"
                    options={others.map(envOption)}
                    value={source}
                    onValueChange={setSource}
                    noun="environment"
                  />
                </div>
                <p className="app-import__hint">
                  Every key from {select.envById(source) ? select.envById(source).name : "that environment"} is compared
                  with {env.name}. Keys missing from {env.name} are selected. Keys that already exist are skipped unless
                  you choose Overwrite.
                </p>
              </>
            ) : (
              <p className="app-import__hint">{project.name} has no other environment you can read.</p>
            )}
          </div>
        )}
        {input.trim() ? (
          <ImportPreview
            env={{ name: env.name, color: env.color, protected: env.protected }}
            rows={rows}
            selected={selected}
            onSelectedChange={setSelected}
          />
        ) : null}
      </div>
    </Sheet>
  );
}
