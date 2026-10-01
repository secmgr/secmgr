"use client";

import {
  Button,
  Callout,
  CodeBlock,
  classifyImport,
  EnvBadge,
  Field,
  ImportPreview,
  Input,
  n,
  Progress,
  parseDotenv,
  SegmentedControl,
  Textarea,
  toast,
  Wordmark,
} from "@secmgr/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/dashboard/api";
import { authClient } from "@/lib/auth-client";
import { slugProblem, toSlug } from "@/lib/slug";

const STEPS = ["Workspace", "Project", "Secrets", "CLI"];
const PROJECT_RESERVED = new Set(["activity", "health", "tokens", "members", "settings", "new", "projects", "api"]);
const TAKEN = new Set(["ORGANIZATION_ALREADY_EXISTS", "ORGANIZATION_SLUG_ALREADY_TAKEN"]);
const ENVIRONMENTS = [
  { name: "development", color: "blue" },
  { name: "staging", color: "amber" },
  { name: "production", color: "rose", protected: true },
];

const SAMPLE = [
  "# web, local development",
  "DATABASE_URL=postgres://app:app@localhost:5432/app_dev",
  "DATABASE_POOL_SIZE=10",
  "REDIS_URL=redis://localhost:6379",
  "LOG_LEVEL=debug",
  "API_BASE_URL=http://localhost:8080",
  "MAX_UPLOAD_MB=25",
  "FEATURE_NEW_CHECKOUT=true",
  'SESSION_SECRET="k4Tq9vLx2Rb7Nc1Wd8Hs3"',
  "LOG_LEVEL=info",
  "2FA_ISSUER=Acme",
].join("\n");

function projectSlug(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[\s_./]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40);
}

function toEntries(text) {
  if (!text.trim()) return [];
  const parsed = parseDotenv(text);
  const ok = parsed.entries.map((e) => ({ line: e.line, key: e.key, value: e.value }));
  const bad = parsed.errors.map((e) => ({
    line: e.line,
    key:
      e.key ||
      String(e.raw || "")
        .trim()
        .split(/[\s=]/)[0] ||
      "",
    value: e.value || "",
    error: e.message ? e.message.charAt(0).toLowerCase() + e.message.slice(1) : "this line could not be parsed",
  }));
  return ok.concat(bad).sort((a, b) => a.line - b.line);
}

export function Onboarding({ email, host, back }) {
  const [step, setStep] = useState(0);
  const [wsName, setWsName] = useState("");
  const [customSlug, setCustomSlug] = useState(null);
  const [projName, setProjName] = useState("web");
  const [repo, setRepo] = useState("");
  const [bring, setBring] = useState("paste");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState({});
  const [created, setCreated] = useState({ workspace: null, project: null, envId: null });
  const titleRef = useRef(null);
  const firstRef = useRef(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (step === 0 && !mounted.current) {
      mounted.current = true;
      firstRef.current?.focus();
      return;
    }
    titleRef.current?.focus();
  }, [step]);

  const wsSlug = customSlug ?? toSlug(wsName);
  const projSlug = projectSlug(projName).replace(/-+$/, "");
  const repoValue = repo
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "");
  const envName = "development";

  const rows = useMemo(() => classifyImport(toEntries(text), {}), [text]);
  const defaultSel = rows.filter((r) => r.status === "new" || r.status === "changed").map((r) => r.id);
  const chosen = selected || defaultSel;
  const picks =
    bring === "paste"
      ? rows.filter((r) => chosen.includes(r.id) && (r.status === "new" || r.status === "changed"))
      : [];
  const invalid = rows.filter((r) => r.status === "invalid").length;

  const errors = {
    0: !wsName.trim()
      ? "Name your workspace, for example your company."
      : wsName.trim().length > 60
        ? "Use at most 60 characters."
        : slugProblem(wsSlug)
          ? `${slugProblem(wsSlug)}.`
          : serverError.slug || null,
    1: !projSlug
      ? "Name the project after its repository, for example web."
      : !/^[a-z]/.test(projSlug)
        ? "Start the name with a letter."
        : PROJECT_RESERVED.has(projSlug)
          ? `${projSlug} is reserved. Pick another name.`
          : repoValue && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoValue)
            ? "Link the repository as owner/name, like acme/web."
            : serverError.project || null,
    2: null,
    3: null,
  };

  const finish = async () => {
    setBusy(true);
    setServerError({});
    let workspace = created.workspace;
    let project = created.project;
    let envId = created.envId;
    try {
      if (!workspace) {
        const result = await authClient.organization.create({ name: wsName.trim(), slug: wsSlug });
        if (result.error) {
          if (TAKEN.has(result.error.code ?? "")) {
            setServerError({ slug: `${host}/${wsSlug} is taken. Pick another URL.` });
            setStep(0);
            return;
          }
          throw new Error(result.error.message || "The workspace could not be created");
        }
        workspace = result.data.slug;
        setCreated((c) => ({ ...c, workspace }));
      }
      if (!project) {
        const result = await api.createProject(workspace, {
          name: projSlug,
          repo: repoValue || null,
          environments: ENVIRONMENTS.map((e) => ({ name: e.name, color: e.color, protected: !!e.protected })),
        });
        project = result.project.name;
        envId = result.environments.find((e) => e.name === envName)?.id ?? null;
        setCreated((c) => ({ ...c, project, envId }));
      }
      if (picks.length && envId) {
        await api.saveChanges(envId, {
          changes: picks.map((r) => ({ op: "add", key: r.key, value: r.value })),
          source: "import",
          message: "Imported during setup",
        });
      }
      window.location.href = `/${workspace}/${project}/${envName}`;
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).replace(/\.$/, "");
      if (workspace && !project) {
        setServerError({ project: `${message}.` });
        setStep(1);
        return;
      }
      toast({ tone: "danger", title: "Setup did not finish", description: `${message}. Try again.` });
    } finally {
      setBusy(false);
    }
  };

  const next = (e) => {
    if (e) e.preventDefault();
    setTried(true);
    if (errors[step]) return;
    setTried(false);
    if (step < 3) setStep(step + 1);
    else finish();
  };
  const goBack = () => {
    setTried(false);
    setStep(Math.max(0, step - 1));
  };
  const skipSecrets = () => {
    setBring("skip");
    setTried(false);
    setStep(3);
  };

  const titles = ["Name your workspace", "Create your first project", "Bring your secrets", "Install the CLI"];
  const ledes = [
    "A workspace holds your team, its projects and their audit log. You can rename it later.",
    "A project is one repository and the environments it deploys to: development, staging and production.",
    <>
      Paste the .env you already have. Every line is checked before anything is saved to{" "}
      <code className="onb__code">{`${projSlug || "project"}/${envName}`}</code>.
    </>,
    "Run your app with secrets injected. Nothing is written to disk.",
  ];

  const cta =
    step === 3
      ? `Open ${projSlug || "project"}`
      : step === 2 && bring === "paste" && picks.length
        ? `Import ${n(picks.length, "secret")}`
        : "Continue";

  return (
    <main className="onb">
      <header className="onb__top">
        <Wordmark size={18} />
        {back ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.location.href = back;
            }}
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            icon="log-out"
            onClick={async () => {
              await authClient.signOut();
              window.location.href = "/sign-in";
            }}
          >
            {`Sign out ${email}`}
          </Button>
        )}
      </header>
      <div className="onb__column">
        <Progress
          className="onb__progress"
          value={step + 1}
          max={4}
          label={STEPS[step]}
          valueLabel={`Step ${step + 1} of 4`}
        />
        <form className="onb__step" onSubmit={next} noValidate>
          <div className="onb__head">
            <h1 className="onb__title" tabIndex={-1} ref={titleRef}>
              {titles[step]}
            </h1>
            <p className="onb__lede">{ledes[step]}</p>
          </div>

          {step === 0 && (
            <div className="onb__fields">
              <Field label="Workspace name" error={tried || serverError.slug ? errors[0] : null}>
                <Input
                  size="lg"
                  ref={firstRef}
                  value={wsName}
                  onValueChange={(v) => {
                    setWsName(v);
                    setServerError({});
                  }}
                  placeholder="Acme"
                  autoComplete="organization"
                  disabled={!!created.workspace}
                />
              </Field>
              <Field label="URL" hint="Lowercase letters, digits and dashes.">
                <Input
                  size="lg"
                  mono
                  prefix={`${host}/`}
                  value={wsSlug}
                  onValueChange={(v) => {
                    setCustomSlug(v.toLowerCase());
                    setServerError({});
                  }}
                  placeholder="acme"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!!created.workspace}
                />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="onb__fields">
              <Field
                label="Project name"
                error={tried || serverError.project ? errors[1] : null}
                hint={
                  <>
                    The CLI links to it with{" "}
                    <code className="onb__code pg-cmd">{`secmgr link ${projSlug || "web"}`}</code>
                  </>
                }
              >
                <Input
                  size="lg"
                  mono
                  value={projName}
                  onValueChange={(v) => {
                    setProjName(projectSlug(v));
                    setServerError({});
                  }}
                  placeholder="web"
                  autoComplete="off"
                  disabled={!!created.project}
                />
              </Field>
              <Field label="Repository" optional hint="The GitHub repository this project deploys, as owner/name.">
                <Input
                  size="lg"
                  mono
                  icon="folder-git-2"
                  value={repo}
                  onValueChange={(v) => setRepo(v.replace(/\s+/g, ""))}
                  placeholder="acme/web"
                  autoComplete="off"
                  disabled={!!created.project}
                />
              </Field>
              <div className="onb__envs">
                <span className="onb__envs-label">Starts with</span>
                {ENVIRONMENTS.map((e) => (
                  <EnvBadge key={e.name} env={e} size="sm" />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onb__fields">
              <SegmentedControl
                aria-label="How to bring secrets"
                value={bring}
                onValueChange={setBring}
                options={[
                  { value: "paste", label: "Paste a .env", icon: "clipboard-paste" },
                  { value: "skip", label: "Start empty", icon: "circle-dashed" },
                ]}
              />
              {bring === "paste" ? (
                <>
                  <Field
                    label={`.env for ${envName}`}
                    hint={
                      text.trim() ? null : (
                        <>
                          Or{" "}
                          <button
                            type="button"
                            className="onb__link"
                            onClick={() => {
                              setText(SAMPLE);
                              setSelected(null);
                            }}
                          >
                            paste an example
                          </button>{" "}
                          to see how the preview works.
                        </>
                      )
                    }
                  >
                    <Textarea
                      mono
                      autoGrow
                      minRows={6}
                      maxRows={14}
                      value={text}
                      onValueChange={(v) => {
                        setText(v);
                        setSelected(null);
                      }}
                      placeholder={"DATABASE_URL=postgres://app:…@db.internal:5432/app\nSTRIPE_SECRET_KEY=sk_test_51N…"}
                      spellCheck={false}
                    />
                  </Field>
                  {text.trim() && (
                    <ImportPreview
                      env={{ name: envName, color: "blue" }}
                      rows={rows}
                      selected={chosen}
                      onSelectedChange={setSelected}
                    />
                  )}
                  {invalid > 0 && (
                    <p className="onb__note">{`${n(invalid, "line")} ${invalid === 1 ? "is" : "are"} skipped. Fix ${invalid === 1 ? "it" : "them"} above to include ${invalid === 1 ? "it" : "them"}.`}</p>
                  )}
                </>
              ) : (
                <Callout tone="neutral" icon="circle-dashed" title={`${envName} starts empty`}>
                  Add secrets one by one, or paste a .env anywhere on the secrets page later.
                </Callout>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="onb__fields">
              <div className="onb__cli">
                <span className="onb__cli-step">1</span>
                <div className="onb__cli-body">
                  <p className="onb__cli-title">Install</p>
                  <CodeBlock
                    language="shell"
                    copy
                    prompt
                    code="npm i -g secmgr"
                    onCopy={() => toast({ title: "Copied install command" })}
                  />
                </div>
              </div>
              <div className="onb__cli">
                <span className="onb__cli-step">2</span>
                <div className="onb__cli-body">
                  <p className="onb__cli-title">Sign in and link this folder</p>
                  <CodeBlock
                    language="shell"
                    copy
                    code={`$ secmgr login\n$ secmgr link ${projSlug || "web"}`}
                    onCopy={() => toast({ title: "Copied commands" })}
                  />
                </div>
              </div>
              <div className="onb__cli">
                <span className="onb__cli-step">3</span>
                <div className="onb__cli-body">
                  <p className="onb__cli-title">Run with secrets</p>
                  <CodeBlock
                    language="shell"
                    copy
                    code={`$ secmgr run --env ${envName} -- npm run dev\nInjected ${n(picks.length, "secret")} from ${projSlug || "web"}/${envName}`}
                    onCopy={() => toast({ title: "Copied command" })}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="onb__nav">
            {step > 0 ? (
              <Button variant="ghost" size="lg" icon="arrow-left" onClick={goBack} disabled={busy}>
                Back
              </Button>
            ) : (
              <span />
            )}
            <div className="onb__nav-end">
              {step === 2 && bring === "paste" && (
                <Button variant="secondary" size="lg" onClick={skipSecrets} disabled={busy}>
                  Skip
                </Button>
              )}
              <Button type="submit" variant="primary" size="lg" iconRight="arrow-right" loading={busy}>
                {cta}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
