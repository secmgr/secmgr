import {
  Button,
  Callout,
  DEFAULT_ENV_COLOR,
  Dialog,
  ENV_COLORS,
  EnvDot,
  Field,
  Input,
  n,
  RadioGroup,
  Select,
  Switch,
} from "@secmgr/ui";
import { useState } from "react";
import { toSlug, useClosable } from "../screens/NotFound.parts.jsx";
import { useStore } from "../store";

const RESERVED = new Set(["compare", "environments", "settings", "overview", "activity", "new"]);

const HUES = ENV_COLORS || ["gray", "blue", "teal", "green", "amber", "orange", "rose", "violet"];
const DEFAULTS = DEFAULT_ENV_COLOR || { development: "blue", staging: "amber", production: "rose", preview: "violet" };
const hueLabel = (c) => c.charAt(0).toUpperCase() + c.slice(1);

export default function CreateEnvironmentDialog({ projectId: projectProp, cloneFrom: cloneProp, onClose }) {
  const { state, actions, select } = useStore();
  const projectId = projectProp || state.route.params.projectId || state.data.projects[0]?.id;
  const project = select.projectById(projectId);
  const envs = project ? select.envsOf(project.id) : [];
  const readable = envs.filter((e) => select.canRead(e.id));
  const source = cloneProp ? readable.find((e) => e.id === cloneProp) : null;
  const { open, close, onOpenChange } = useClosable(onClose);

  const used = new Set(envs.map((e) => e.color));
  const freeHue = HUES.find((h) => h !== "gray" && !used.has(h)) || "gray";
  const [name, setName] = useState(source ? `${source.name}-copy` : "");
  const [color, setColor] = useState(null);
  const [mode, setMode] = useState(source ? "clone" : readable.length ? "clone" : "empty");
  const [from, setFrom] = useState(
    source ? source.id : (readable.find((e) => e.name === "staging") || readable[0])?.id || null,
  );
  const [prot, setProt] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const slug = toSlug(name, { trim: true });
  const hue = color || DEFAULTS[slug] || (source ? freeHue : freeHue);
  const isProtected = prot === null ? /^(prod|production|live)/.test(slug) : prot;
  const fromEnv = readable.find((e) => e.id === from);
  const cloneCount = fromEnv ? select.rawSecretsOf(fromEnv.id).length : 0;
  const clash = envs.some((e) => e.name === slug);
  const error = !slug
    ? "Name the environment, for example qa-eu."
    : !/^[a-z]/.test(slug)
      ? "Start the name with a letter."
      : RESERVED.has(slug)
        ? `${slug} is reserved. Pick another name.`
        : clash
          ? `${slug} already exists in ${project ? project.name : "this project"}. Pick another name.`
          : null;
  const showError = (tried && error) || (clash ? error : null);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setTried(true);
    if (error || !project || busy) return;
    setBusy(true);
    const cloning = mode === "clone" && fromEnv;
    const id = await actions.createEnvironment({
      projectId: project.id,
      name: slug,
      color: hue,
      cloneFrom: cloning ? fromEnv.id : null,
      protected: isProtected,
    });
    setBusy(false);
    if (!id) return;
    actions.toast({
      tone: "success",
      title: `Created ${slug} in ${project.name}`,
      description: cloning
        ? `Cloned ${n(cloneCount, "secret")} from ${fromEnv.name}.`
        : "It is empty. Import a .env or add secrets.",
      action: {
        label: `Open ${slug}`,
        onClick: () => actions.navigate("secrets", { projectId: project.id, envId: id, mode: "table" }),
      },
    });
    close();
  };

  if (!project) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      closeOnOverlay={false}
      size="md"
      title={source ? `Clone ${source.name}` : "New environment"}
      description={
        <>
          In <code className="pg-code">{project.name}</code>. The name is how the CLI finds it.
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {mode === "clone" && fromEnv ? `Create with ${n(cloneCount, "secret")}` : "Create environment"}
          </Button>
        </>
      }
    >
      <form className="dlg-form" onSubmit={submit}>
        <div className="dlg-grid">
          <Field
            label="Name"
            required
            error={showError}
            hint={
              <>
                Lowercase letters, digits and dashes.{" "}
                <code className="pg-code pg-cmd">{`secmgr run --env ${slug || "qa-eu"}`}</code>
              </>
            }
          >
            <Input
              mono
              data-autofocus
              prefix={`${project.name}/`}
              value={name}
              onValueChange={(v) => setName(toSlug(v))}
              placeholder="qa-eu"
              autoComplete="off"
            />
          </Field>
          <Field label="Color">
            <Select
              value={hue}
              onValueChange={setColor}
              options={HUES.map((c) => ({
                value: c,
                label: hueLabel(c),
                prefix: <EnvDot color={c} />,
                description: used.has(c)
                  ? `Used by ${envs
                      .filter((e) => e.color === c)
                      .map((e) => e.name)
                      .join(", ")}`
                  : undefined,
              }))}
            />
          </Field>
        </div>

        {readable.length > 0 && (
          <Field label="Start from">
            <RadioGroup
              variant="cards"
              orientation="horizontal"
              value={mode}
              onValueChange={setMode}
              options={[
                {
                  value: "clone",
                  label: "Clone an environment",
                  description: "Copies every key and value. Change them before you deploy.",
                },
                { value: "empty", label: "Start empty", description: "Add secrets later, or import a .env." },
              ]}
            />
          </Field>
        )}

        {mode === "clone" && readable.length > 0 && (
          <Field label="Clone from">
            <Select
              value={from}
              onValueChange={setFrom}
              options={readable.map((e) => ({
                value: e.id,
                label: e.name,
                prefix: <EnvDot color={e.color} />,
                description: `${n(select.rawSecretsOf(e.id).length, "secret")}${e.protected ? ", protected" : ""}`,
              }))}
            />
          </Field>
        )}

        {mode === "clone" && fromEnv && fromEnv.protected && (
          <Callout tone="warning" title={`Cloning ${fromEnv.name} copies live values`}>
            Everyone who can read <code>{slug || "the new environment"}</code> can reveal them. Rotate the ones that
            should stay in {fromEnv.name}.
          </Callout>
        )}

        <Switch
          labelPosition="start"
          label="Protect this environment"
          description={
            isProtected
              ? "Saving changes asks for its name. Use it for anything customers depend on."
              : "Anyone with write access can save changes without a confirmation."
          }
          checked={isProtected}
          onCheckedChange={setProt}
        />
      </form>
    </Dialog>
  );
}
