import {
  Button,
  Callout,
  CodeBlock,
  CopyButton,
  Dialog,
  EnvBadge,
  EnvDot,
  Field,
  Input,
  RadioGroup,
  Select,
} from "@secmgr/ui";
import { useEffect, useRef, useState } from "react";
import { toSlug, useClosable } from "../screens/NotFound.parts.jsx";
import { useStore } from "../store";

export default function CreateTokenDialog({ reveal: revealProp, onClose }) {
  const { state, actions, select } = useStore();
  const d = state.data;
  const { open, close, onOpenChange } = useClosable(onClose);
  const routeProject =
    state.route.params.projectId && select.projectById(state.route.params.projectId)
      ? state.route.params.projectId
      : d.projects[0]?.id || null;

  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(routeProject);
  const envsOf = (pid) => select.envsOf(pid);
  const pickEnv = (pid) => {
    const list = envsOf(pid);
    return (list.find((e) => e.name === "production") || list[0])?.id || null;
  };
  const [envId, setEnvId] = useState(() => pickEnv(routeProject));
  const [access, setAccess] = useState("read");
  const [expiry, setExpiry] = useState("90");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(revealProp || null);
  const copyRef = useRef(null);
  useEffect(() => {
    if (reveal && copyRef.current) setTimeout(() => copyRef.current?.focus(), 30);
  }, [!!reveal]);

  const slug = toSlug(name, { trim: true });
  const clash = d.tokens.some((t) => t.name === slug && t.envId === envId);
  const error = !slug
    ? "Name the token after where it runs, for example github-actions."
    : clash
      ? `${slug} already exists. Pick another name, or rotate the existing token.`
      : null;
  const env = select.envById(envId);
  const envs = envsOf(projectId);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setTried(true);
    if (error || !env || busy) return;
    setBusy(true);
    const res = await actions.createToken({
      name: slug,
      envId: env.id,
      access,
      expiresInDays: expiry === "never" ? null : Number(expiry),
    });
    setBusy(false);
    if (res) setReveal({ name: slug, secret: res.secret, envId: env.id, rotated: false });
  };

  if (reveal) {
    const renv = select.envById(reveal.envId);
    const snippet = `SECMGR_TOKEN=${reveal.secret} secmgr run -- ./deploy.sh`;
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        closeOnOverlay={false}
        size="md"
        title={reveal.rotated ? `${reveal.name} has a new value` : `${reveal.name} is ready`}
        description={
          renv ? (
            <>
              Scoped to <code className="pg-code">{select.projectById(renv.projectId)?.name}</code> in {renv.name}.{" "}
              {reveal.rotated ? "The old value no longer works." : ""}
            </>
          ) : null
        }
        footer={
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        }
      >
        <div className="tkd-reveal">
          <Callout tone="warning" title="You will not see this token again">
            Copy it now and store it in your CI secrets. If you lose it, rotate the token and update your jobs.
          </Callout>
          <div className="tkd-reveal__value">
            <code className="tkd-reveal__text" aria-label={`Token ${reveal.name}`}>
              {reveal.secret}
            </code>
            <CopyButton
              ref={copyRef}
              variant="text"
              appearance="secondary"
              value={reveal.secret}
              label="Copy token"
              data-autofocus
              onCopied={() => {
                actions.toast({
                  title: `Copied ${reveal.name}`,
                  description: state.prefs.clipboardClearSec
                    ? `Clipboard clears in ${state.prefs.clipboardClearSec}s.`
                    : undefined,
                });
              }}
            >
              Copy token
            </CopyButton>
          </div>
          <div className="tkd-reveal__meta">
            {renv && <EnvBadge env={renv} size="sm" />}
            <span>Run a command with it:</span>
          </div>
          <CodeBlock
            language="shell"
            copy
            prompt
            wrap
            code={snippet}
            onCopy={() =>
              actions.toast({
                title: "Copied command",
                description: "It contains the full token. Keep it out of shared logs.",
              })
            }
          />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      closeOnOverlay={false}
      size="md"
      title="New token"
      description="A service token reads one environment without a person signing in. You see its value once."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!env}>
            Create token
          </Button>
        </>
      }
    >
      <form className="dlg-form" onSubmit={submit}>
        <Field
          label="Name"
          required
          error={tried || clash ? error : null}
          hint="Where it runs. It shows in the activity log on every read."
        >
          <Input
            mono
            data-autofocus
            value={name}
            onValueChange={(v) => setName(toSlug(v))}
            placeholder="github-actions"
            autoComplete="off"
          />
        </Field>
        <div className="dlg-grid dlg-grid--even">
          <Field label="Project">
            <Select
              value={projectId}
              onValueChange={(pid) => {
                setProjectId(pid);
                setEnvId(pickEnv(pid));
              }}
              options={d.projects.map((p) => ({ value: p.id, label: p.name, icon: "folder-git-2" }))}
              mono
            />
          </Field>
          <Field label="Environment" error={!envs.length ? "This project has no environments yet." : null}>
            <Select
              value={envId}
              onValueChange={setEnvId}
              placeholder="Select environment"
              options={envs.map((e) => ({
                value: e.id,
                label: e.name,
                prefix: <EnvDot color={e.color} />,
                description: e.protected ? "Protected" : undefined,
              }))}
            />
          </Field>
        </div>
        <Field label="Access">
          <RadioGroup
            variant="cards"
            orientation="horizontal"
            value={access}
            onValueChange={setAccess}
            options={[
              {
                value: "read",
                label: "Read",
                icon: "eye",
                description: "Pull and run secrets. Right for CI and servers.",
              },
              {
                value: "write",
                label: "Read and write",
                icon: "pencil",
                description: "Also create and update secrets. For scripts that sync values.",
              },
            ]}
          />
        </Field>
        {access === "write" && env && env.protected && (
          <Callout tone="warning" title={`Writes to ${env.name} skip the typed confirmation`}>
            Tokens cannot type an environment name. Prefer Read for protected environments.
          </Callout>
        )}
        <Field
          label="Expires"
          hint={
            expiry === "never"
              ? "A token that never expires stays valid until you revoke it."
              : `On ${new Date(select.now + Number(expiry) * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. The tokens page warns you 30 days before.`
          }
        >
          <Select
            value={expiry}
            onValueChange={setExpiry}
            options={[
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days", description: "Recommended" },
              { value: "never", label: "Never" },
            ]}
          />
        </Field>
      </form>
    </Dialog>
  );
}
