import { Button, Dialog, EnvDot, Field, Input, RadioGroup } from "@secmgr/ui";
import { useState } from "react";
import { toSlug, useClosable } from "../screens/NotFound.parts.jsx";
import { useStore } from "../store";

const RESERVED = new Set(["activity", "health", "tokens", "members", "settings", "new", "projects", "api"]);

const TEMPLATES = {
  standard: ["development", "staging", "production"],
  pair: ["development", "production"],
  empty: [],
};
const DOT = { development: "blue", staging: "amber", production: "rose" };

function Dots({ names }) {
  return (
    <span className="dlg-dots" aria-hidden="true">
      {names.map((nm) => (
        <EnvDot key={nm} color={DOT[nm]} />
      ))}
    </span>
  );
}

export default function CreateProjectDialog({ onClose }) {
  const { state, actions } = useStore();
  const { open, close, onOpenChange } = useClosable(onClose);
  const ws = state.data.workspace;
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [template, setTemplate] = useState("standard");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const slug = toSlug(name, { trim: true });
  const repoValue = repo
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "");
  const clash = state.data.projects.some((p) => p.name === slug);
  const error = !slug
    ? "Name the project, for example web or billing-worker."
    : !/^[a-z]/.test(slug)
      ? "Start the name with a letter."
      : RESERVED.has(slug)
        ? `${slug} is reserved. Pick another name.`
        : clash
          ? `${slug} already exists in ${ws.name}. Pick another name.`
          : null;
  const repoError =
    repoValue && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoValue)
      ? "Link a repository as owner/name, like acme/web."
      : null;

  const submit = async (e) => {
    if (e) e.preventDefault();
    setTried(true);
    if (error || repoError || busy) return;
    setBusy(true);
    const envNames = TEMPLATES[template];
    const created = await actions.createProject({ name: slug, repo: repoValue, envNames });
    setBusy(false);
    if (!created) return;
    const first = created.environments.find((e) => e.name === envNames[0]);
    actions.toast({
      tone: "success",
      title: `Created ${slug}`,
      description: envNames.length
        ? `Import a .env or add secrets to ${envNames[0]}.`
        : "Add an environment to start storing secrets.",
    });
    close();
    if (first) actions.navigate("secrets", { projectId: created.id, envId: first.id, mode: "table" });
    else actions.navigate("environments", { projectId: created.id });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      closeOnOverlay={false}
      size="md"
      title="Create project"
      description="A project is one repository and the environments it deploys to."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            Create project
          </Button>
        </>
      }
    >
      <form
        className="dlg-form"
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target.tagName === "INPUT") {
            e.preventDefault();
            submit();
          }
        }}
      >
        <Field
          label="Name"
          required
          error={tried || clash ? error : null}
          hint={
            <>
              Lowercase letters, digits and dashes.{" "}
              <code className="pg-code pg-cmd">{`secmgr link ${slug || "web"}`}</code>
            </>
          }
        >
          <Input
            mono
            data-autofocus
            value={name}
            onValueChange={(v) => setName(toSlug(v))}
            placeholder="web"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Repository"
          optional
          error={tried ? repoError : null}
          hint="The GitHub repository this project deploys, as owner/name."
        >
          <Input
            mono
            icon="folder-git-2"
            value={repo}
            onValueChange={(v) => setRepo(v.replace(/\s+/g, ""))}
            placeholder="acme/web"
            autoComplete="off"
          />
        </Field>
        <Field label="Environments">
          <RadioGroup
            variant="cards"
            value={template}
            onValueChange={setTemplate}
            options={[
              {
                value: "standard",
                label: (
                  <>
                    Development, staging, production
                    <Dots names={TEMPLATES.standard} />
                  </>
                ),
                description: "3 environments. production is protected and asks for its name before a save.",
              },
              {
                value: "pair",
                label: (
                  <>
                    Development and production
                    <Dots names={TEMPLATES.pair} />
                  </>
                ),
                description: "2 environments, for sites and tools without a review stage.",
              },
              {
                value: "empty",
                label: "Empty",
                description: "Add environments yourself, with your own names and colors.",
              },
            ]}
          />
        </Field>
      </form>
    </Dialog>
  );
}
