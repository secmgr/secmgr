import {
  AppIcon,
  Avatar,
  Badge,
  Button,
  Callout,
  CopyButton,
  Dialog,
  EmptyState,
  Field,
  Icon,
  Input,
  NavItem,
  n,
  PageHeader,
  SegmentedControl,
  Select,
  SettingRow,
  SettingsGroup,
  Table,
  Tooltip,
} from "@secmgr/ui";
import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { api } from "../api";
import QrCode from "../shell/QrCode.jsx";
import { useStore } from "../store";
import { formatWhen, liveNow, toSlug, useConfirm } from "./NotFound.parts.jsx";

const SECTIONS = [
  { value: "profile", label: "Profile", icon: "user" },
  { value: "security", label: "Security", icon: "shield-check" },
  { value: "appearance", label: "Appearance", icon: "sun-moon" },
  { value: "workspace", label: "Workspace", icon: "building-2" },
  { value: "danger", label: "Danger zone", icon: "triangle-alert" },
];

async function unwrap(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message || error.statusText || "Something went wrong");
  return data;
}

function describeIp(ip) {
  if (!ip || /^[0:.]+$/.test(ip)) return null;
  if (/^(::1|127\.|::ffff:127\.)/.test(ip) || /^(0{1,4}:){7}0{0,3}1$/.test(ip)) return "This computer";
  return ip.replace(/(^|:)0{1,3}(?=[0-9a-f])/gi, "$1");
}

function describeAgent(ua) {
  const agent = ua || "";
  if (/secmgr/i.test(agent)) return { device: "secmgr CLI", icon: "terminal" };
  const browser = /Vivaldi/.test(agent)
    ? "Vivaldi"
    : /Edg\//.test(agent)
      ? "Edge"
      : /OPR\//.test(agent)
        ? "Opera"
        : /Firefox\//.test(agent)
          ? "Firefox"
          : /Chrome\//.test(agent)
            ? "Chrome"
            : /Safari\//.test(agent)
              ? "Safari"
              : "Browser";
  const os = /iPhone|iPad/.test(agent)
    ? "iOS"
    : /Android/.test(agent)
      ? "Android"
      : /Mac OS X/.test(agent)
        ? "macOS"
        : /Windows/.test(agent)
          ? "Windows"
          : /Linux/.test(agent)
            ? "Linux"
            : null;
  const mobile = /iPhone|Android.*Mobile/.test(agent);
  return { device: os ? `${browser} on ${os}` : browser, icon: mobile ? "smartphone" : "laptop" };
}

export default function Settings() {
  const { state, actions } = useStore();
  const section = SECTIONS.some((s) => s.value === state.route.params.section) ? state.route.params.section : "profile";
  const go = (s) => actions.navigate("settings", { section: s });

  return (
    <div className="pg set">
      <PageHeader title="Settings" description={`Your account and the ${state.data.workspace.name} workspace.`} />
      <div className="pg__body set-layout">
        <nav className="set-nav" aria-label="Settings sections">
          <span className="set-nav__label">Account</span>
          {SECTIONS.slice(0, 3).map((s) => (
            <NavItem
              key={s.value}
              icon={s.icon}
              label={s.label}
              active={section === s.value}
              onClick={() => go(s.value)}
            />
          ))}
          <span className="set-nav__label">Workspace</span>
          <NavItem icon="building-2" label="General" active={section === "workspace"} onClick={() => go("workspace")} />
          <NavItem
            icon="users"
            label="Members"
            count={state.data.members.length}
            onClick={() => actions.navigate("members")}
          />
          <NavItem
            icon="bot"
            label="Access tokens"
            count={state.data.tokens.length}
            onClick={() => actions.navigate("tokens")}
          />
          <NavItem
            icon="triangle-alert"
            label="Danger zone"
            active={section === "danger"}
            onClick={() => go("danger")}
          />
        </nav>
        <div className="set-content">
          {section === "profile" && <Profile />}
          {section === "security" && <Security />}
          {section === "appearance" && <Appearance />}
          {section === "workspace" && <Workspace />}
          {section === "danger" && <Danger />}
        </div>
      </div>
    </div>
  );
}

function Profile() {
  const { state, actions, select } = useStore();
  const me = select.me;
  const [name, setName] = useState(me.name);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const dirty = name.trim() !== me.name;
  const nameError = !name.trim()
    ? "Enter the name your team knows you by."
    : name.trim().length > 80
      ? "Keep your name under 80 characters."
      : null;

  const save = async (e) => {
    if (e) e.preventDefault();
    setTried(true);
    if (nameError || !dirty) return;
    setBusy(true);
    try {
      await unwrap(authClient.updateUser({ name: name.trim() }));
      await actions.refresh();
      actions.toast({ tone: "success", title: "Saved your profile" });
    } catch (error) {
      actions.fail(error, "Could not save your profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="set-stack" onSubmit={save}>
      <SettingsGroup title="Profile" description="How you appear in the activity log, on versions and in reviews.">
        <SettingRow
          label="Photo"
          description="Initials on a color picked from your name. It stays the same on every screen."
        >
          <span className="set-avatar">
            <Avatar name={name.trim() || me.name} size={32} title={null} />
          </span>
        </SettingRow>
        <SettingRow label="Name" htmlFor="set-name">
          <Field error={tried ? nameError : null} className="set-field">
            <Input id="set-name" value={name} onValueChange={setName} autoComplete="name" />
          </Field>
        </SettingRow>
        <SettingRow
          label="Email"
          description="Sign in links and invites go here. To use another address, ask an admin to invite it."
          htmlFor="set-email"
        >
          <Field className="set-field">
            <Input
              id="set-email"
              type="email"
              value={state.data.me.email}
              readOnly
              suffix={
                <Badge tone="success" icon="circle-check">
                  Verified
                </Badge>
              }
            />
          </Field>
        </SettingRow>
      </SettingsGroup>
      <div className="set-actions">
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => {
              setName(me.name);
              setTried(false);
            }}
          >
            Discard
          </Button>
        )}
        <Button variant="primary" type="submit" loading={busy} disabled={!dirty}>
          Save profile
        </Button>
      </div>
      <SettingsGroup title="Session">
        <SettingRow
          label="Sign out"
          description="Signs you out of secmgr in this browser. Other sessions stay signed in."
        >
          <Button variant="secondary" icon="log-out" onClick={() => actions.signOut()}>
            Sign out
          </Button>
        </SettingRow>
      </SettingsGroup>
    </form>
  );
}

function TwoFactorSetup({ onClose, onDone }) {
  const { actions } = useStore();
  const [step, setStep] = useState("start");
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await unwrap(authClient.twoFactor.enable({}));
      setSetup(data);
      setStep("scan");
    } catch (err) {
      setError(
        /fresh/i.test(err.message)
          ? "Sign out and back in, then turn on two factor within a day of signing in."
          : err.message,
      );
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    if (e) e.preventDefault();
    const clean = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(clean)) {
      setError("Enter the 6 digit code from your app.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await unwrap(authClient.twoFactor.verifyTotp({ code: clean }));
      setStep("codes");
      onDone();
    } catch (err) {
      setError(err.message || "That code did not match. Check the time on your phone and try again.");
    } finally {
      setBusy(false);
    }
  };

  const secret = setup ? new URL(setup.totpURI).searchParams.get("secret") || "" : "";
  const grouped = secret.replace(/(.{4})/g, "$1 ").trim();

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      size="md"
      closeOnOverlay={step !== "codes"}
      title={step === "codes" ? "Two factor is on" : "Turn on two factor"}
      description={
        step === "start"
          ? "After you sign in with a link or GitHub, secmgr asks for a code from an authenticator app such as 1Password, Authy or Google Authenticator."
          : step === "scan"
            ? "Scan the code with your authenticator app, then enter the 6 digit code it shows."
            : "Store these recovery codes somewhere safe. Each one works once if you lose your phone."
      }
      footer={
        step === "start" ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={start}>
              Continue
            </Button>
          </>
        ) : step === "scan" ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={verify}>
              Verify and turn on
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        )
      }
    >
      {step === "start" && error && (
        <Callout tone="danger" title="Could not start">
          {error}
        </Callout>
      )}
      {step === "scan" && setup && (
        <form className="set-2fa" onSubmit={verify}>
          <div className="set-2fa__pair">
            <QrCode value={setup.totpURI} label="Authenticator setup code" />
            <div className="set-2fa__key">
              <span>Cannot scan it? Enter this key instead:</span>
              <code className="set-2fa__secret">{grouped}</code>
              <CopyButton
                variant="text"
                appearance="secondary"
                value={secret}
                label="Copy key"
                onCopied={() => actions.toast({ title: "Copied the setup key" })}
              >
                Copy key
              </CopyButton>
            </div>
          </div>
          <Field label="Code from your app" error={error}>
            <Input
              data-autofocus
              mono
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onValueChange={setCode}
              placeholder="123456"
              maxLength={7}
            />
          </Field>
        </form>
      )}
      {step === "codes" && setup && <RecoveryCodes codes={setup.backupCodes} />}
    </Dialog>
  );
}

function RecoveryCodes({ codes }) {
  const { actions } = useStore();
  return (
    <div className="set-codes">
      <ol className="set-codes__list">
        {codes.map((c) => (
          <li key={c} className="set-codes__code">
            {c}
          </li>
        ))}
      </ol>
      <CopyButton
        variant="text"
        appearance="secondary"
        value={codes.join("\n")}
        label="Copy codes"
        onCopied={() => actions.toast({ title: `Copied ${n(codes.length, "recovery code")}` })}
      >
        Copy codes
      </CopyButton>
    </div>
  );
}

function Security() {
  const { state, actions, select } = useStore();
  const now = liveNow(select);
  const enabled = !!state.data.me.twoFactor;
  const [setupOpen, setSetupOpen] = useState(false);
  const [codes, setCodes] = useState(null);
  const [sessions, setSessions] = useState({ status: "loading", list: [], current: null });
  const [confirmNode, ask] = useConfirm();

  const loadSessions = useCallback(async () => {
    try {
      const [list, current] = await Promise.all([unwrap(authClient.listSessions()), unwrap(authClient.getSession())]);
      const sorted = [...(list || [])].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      setSessions({ status: "ready", list: sorted, current: current?.session?.token ?? null });
    } catch (error) {
      setSessions((s) => ({ ...s, status: "error", error: error.message }));
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const freshHint = (error) =>
    /fresh/i.test(error.message) ? new Error("Sign out and back in, then try again within a day of signing in") : error;

  const disable = () =>
    ask({
      title: "Turn off two factor?",
      description: "Signing in then only needs your email link or GitHub. Your recovery codes stop working.",
      confirmLabel: "Turn off two factor",
      tone: "danger",
      onConfirm: async () => {
        try {
          await unwrap(authClient.twoFactor.disable({}));
          await actions.refresh();
          actions.toast({ title: "Two factor is off" });
        } catch (error) {
          actions.fail(freshHint(error), "Could not turn off two factor");
        }
      },
    });

  const regenerate = () =>
    ask({
      title: "Generate new recovery codes?",
      description: "Your current recovery codes stop working right away.",
      confirmLabel: "Generate new codes",
      onConfirm: async () => {
        try {
          const data = await unwrap(authClient.twoFactor.generateBackupCodes({}));
          setCodes(data.backupCodes);
        } catch (error) {
          actions.fail(freshHint(error), "Could not generate recovery codes");
        }
      },
    });

  const revoke = async (s) => {
    try {
      await unwrap(authClient.revokeSession({ token: s.token }));
      await loadSessions();
      actions.toast({ title: `Signed out ${describeAgent(s.userAgent).device}` });
    } catch (error) {
      actions.fail(error, "Could not sign out that session");
    }
  };

  const others = sessions.list.filter((s) => s.token !== sessions.current);
  const revokeOthers = () =>
    ask({
      title: `Sign out ${n(others.length, "other session")}?`,
      description: "Every other browser asks you to sign in again. Service tokens keep working.",
      confirmLabel: `Sign out ${n(others.length, "session")}`,
      tone: "danger",
      onConfirm: async () => {
        try {
          await unwrap(authClient.revokeOtherSessions());
          await loadSessions();
          actions.toast({ title: `Signed out ${n(others.length, "session")}` });
        } catch (error) {
          actions.fail(error, "Could not sign out the other sessions");
        }
      },
    });

  const sessionColumns = [
    {
      key: "device",
      header: "Device",
      minWidth: 220,
      render: (s) => {
        const { device, icon } = describeAgent(s.userAgent);
        return (
          <span className="pg-cell">
            <Icon name={icon} size={16} className="set-session__icon" />
            <span className="pg-trunc set-session__name">{device}</span>
            {s.token === sessions.current && (
              <Badge tone="accent" dot>
                This device
              </Badge>
            )}
          </span>
        );
      },
    },
    {
      key: "ip",
      header: "IP address",
      minWidth: 120,
      render: (s) =>
        describeIp(s.ipAddress) ? (
          <Tooltip content={`Signed in ${formatWhen(s.createdAt, now)}`}>
            <span className="pg-trunc set-session__where pg-tabular" tabIndex={0}>
              {describeIp(s.ipAddress)}
            </span>
          </Tooltip>
        ) : (
          <span className="tok-never">Unknown</span>
        ),
    },
    {
      key: "updatedAt",
      header: "Last active",
      width: 156,
      render: (s) => (
        <span className="pg-tabular">{s.token === sessions.current ? "Active now" : formatWhen(s.updatedAt, now)}</span>
      ),
    },
    {
      key: "revoke",
      header: <span className="sg-visually-hidden">Actions</span>,
      width: 88,
      align: "right",
      render: (s) =>
        s.token === sessions.current ? null : (
          <Button size="sm" variant="ghost" onClick={() => revoke(s)}>
            Revoke
          </Button>
        ),
    },
  ];

  return (
    <div className="set-stack">
      <SettingsGroup title="Two factor" description="A second step after your sign in link or GitHub.">
        <SettingRow
          label="Authenticator app"
          description={
            enabled
              ? "Sign in asks for a code from your authenticator app."
              : "Add an authenticator app to protect your account and the secrets you can read."
          }
        >
          {enabled ? (
            <div className="set-inline">
              <Badge tone="success" icon="shield-check">
                Enabled
              </Badge>
              <Button variant="ghost" size="sm" onClick={disable}>
                Turn off
              </Button>
            </div>
          ) : (
            <Button variant="primary" icon="shield-check" onClick={() => setSetupOpen(true)}>
              Turn on
            </Button>
          )}
        </SettingRow>
        {enabled && (
          <SettingRow
            label="Recovery codes"
            description="Single use codes for when you lose your phone. Generating new ones turns the old ones off."
          >
            <Button variant="secondary" icon="key-round" onClick={regenerate}>
              Generate new codes
            </Button>
          </SettingRow>
        )}
      </SettingsGroup>

      <section className="pg__section" aria-labelledby="set-sessions">
        <div className="set-section-head">
          <div>
            <h2 className="pg__section-title" id="set-sessions">
              Sessions
            </h2>
            <p className="pg__section-desc">Browsers signed in as you. Revoke anything you do not recognise.</p>
          </div>
          {others.length > 0 && (
            <Button variant="secondary" size="sm" icon="log-out" onClick={revokeOthers}>
              Sign out others
            </Button>
          )}
        </div>
        {sessions.status === "error" ? (
          <EmptyState
            variant="inline"
            icon="cloud-off"
            title="Could not load sessions"
            description={sessions.error}
            actions={
              <Button size="sm" variant="secondary" icon="refresh-cw" onClick={loadSessions}>
                Try again
              </Button>
            }
          />
        ) : (
          <Table
            framed
            label="Sessions"
            rowKey="id"
            columns={sessionColumns}
            rows={sessions.list}
            density={state.prefs.density}
            loading={sessions.status === "loading"}
            loadingRows={3}
          />
        )}
      </section>

      {setupOpen && <TwoFactorSetup onClose={() => setSetupOpen(false)} onDone={() => actions.refresh()} />}
      <Dialog
        open={!!codes}
        onOpenChange={(v) => {
          if (!v) setCodes(null);
        }}
        size="sm"
        title="New recovery codes"
        description="Each code works once. The old codes no longer work."
        footer={
          <Button variant="primary" onClick={() => setCodes(null)}>
            Done
          </Button>
        }
      >
        {codes && <RecoveryCodes codes={codes} />}
      </Dialog>
      {confirmNode}
    </div>
  );
}

function Appearance() {
  const { state, actions } = useStore();
  const p = state.prefs;
  const reveal = String(p.revealTimeoutSec || 0);
  const clip = String(p.clipboardClearSec || 0);
  return (
    <div className="set-stack">
      <SettingsGroup title="Appearance" description="Follows you to every browser you sign in to.">
        <SettingRow
          label="Theme"
          description={p.theme === "system" ? "Follows your system setting." : `Always ${p.theme}.`}
        >
          <SegmentedControl
            aria-label="Theme"
            value={p.theme}
            onValueChange={(theme) => actions.setPrefs({ theme })}
            options={[
              { value: "light", label: "Light", icon: "sun" },
              { value: "dark", label: "Dark", icon: "moon" },
              { value: "system", label: "System", icon: "monitor" },
            ]}
          />
        </SettingRow>
        <SettingRow
          label="Density"
          description={
            p.density === "compact" ? "36px rows. More secrets on screen." : "44px rows. Easier to scan and click."
          }
        >
          <SegmentedControl
            aria-label="Density"
            value={p.density}
            onValueChange={(density) => actions.setPrefs({ density })}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Secrets" description="How values behave after you reveal or copy them.">
        <SettingRow
          label="Hide revealed values after"
          description={
            reveal === "0"
              ? "Revealed values stay visible until you hide them or leave the page."
              : `A revealed value masks itself again after ${reveal} seconds.`
          }
        >
          <Select
            className="set-select"
            aria-label="Hide revealed values after"
            value={reveal}
            onValueChange={(v) => actions.setPrefs({ revealTimeoutSec: Number(v) })}
            options={[
              { value: "5", label: "5 seconds" },
              { value: "10", label: "10 seconds", description: "Default" },
              { value: "30", label: "30 seconds" },
              { value: "0", label: "Never" },
            ]}
            placement="bottom-end"
          />
        </SettingRow>
        <SettingRow
          label="Clear clipboard after"
          description={
            clip === "0"
              ? "Copied values stay on the clipboard."
              : `Copied values are cleared from the clipboard after ${clip} seconds, if this tab is still open.`
          }
        >
          <Select
            className="set-select"
            aria-label="Clear clipboard after"
            value={clip}
            onValueChange={(v) => actions.setPrefs({ clipboardClearSec: Number(v) })}
            options={[
              { value: "15", label: "15 seconds" },
              { value: "30", label: "30 seconds", description: "Default" },
              { value: "60", label: "60 seconds" },
              { value: "0", label: "Never" },
            ]}
            placement="bottom-end"
          />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}

function Workspace() {
  const { state, actions, select } = useStore();
  const ws = state.data.workspace;
  const manage = select.canManage;
  const [name, setName] = useState(ws.name);
  const [slug, setSlug] = useState(ws.slug);
  const [busy, setBusy] = useState(false);
  const cleanSlug = toSlug(slug, { trim: true });
  const dirty = name.trim() !== ws.name || cleanSlug !== ws.slug;
  const nameError = !name.trim() ? "Name the workspace, for example your company." : null;
  const slugError = !cleanSlug
    ? "Pick a slug with letters, digits and dashes."
    : cleanSlug.length < 3
      ? "Use at least 3 characters."
      : null;

  const save = async (e) => {
    if (e) e.preventDefault();
    if (nameError || slugError || !dirty || !manage) return;
    setBusy(true);
    const input = {};
    if (name.trim() !== ws.name) input.name = name.trim();
    if (cleanSlug !== ws.slug) input.slug = cleanSlug;
    const ok = await actions.renameWorkspace(input);
    setBusy(false);
    if (ok)
      actions.toast({
        tone: "success",
        title: `Saved ${name.trim()}`,
        description: input.slug ? "Old links to this workspace no longer work." : undefined,
      });
  };

  return (
    <form className="set-stack" onSubmit={save}>
      <SettingsGroup title="General" description={manage ? undefined : "Only owners and admins can change these."}>
        <SettingRow label="Icon" description="The workspace tile in the switcher and on invites.">
          <AppIcon size={32} />
        </SettingRow>
        <SettingRow label="Name" htmlFor="set-ws-name">
          <Field error={nameError} className="set-field">
            <Input id="set-ws-name" value={name} onValueChange={setName} readOnly={!manage} />
          </Field>
        </SettingRow>
        <SettingRow
          label="URL"
          description="Changing it breaks bookmarks and shared links to this workspace."
          htmlFor="set-ws-slug"
        >
          <Field error={slugError} className="set-field set-field--wide">
            <Input
              id="set-ws-slug"
              mono
              prefix={`${window.location.host}/`}
              value={slug}
              onValueChange={(v) => setSlug(toSlug(v))}
              readOnly={!manage}
            />
          </Field>
        </SettingRow>
      </SettingsGroup>
      {manage && (
        <div className="set-actions">
          {dirty && (
            <Button
              variant="ghost"
              onClick={() => {
                setName(ws.name);
                setSlug(ws.slug);
              }}
            >
              Discard
            </Button>
          )}
          <Button variant="primary" type="submit" loading={busy} disabled={!dirty || !!nameError || !!slugError}>
            Save workspace
          </Button>
        </div>
      )}
    </form>
  );
}

function Danger() {
  const { state, actions, select } = useStore();
  const d = state.data;
  const ws = d.workspace;
  const me = select.me;
  const isOwner = me.roleValue === "owner";
  const candidates = d.members.filter((m) => m.id !== d.currentUserId && m.roleValue !== "owner");
  const [to, setTo] = useState((candidates.find((m) => m.roleValue === "admin") || candidates[0])?.id || null);
  const [confirmNode, ask] = useConfirm();
  const target = d.members.find((m) => m.id === to);
  const secretCount = d.secrets.length;

  const transfer = () => {
    if (!target) return;
    ask({
      title: `Transfer ${ws.name} to ${target.name}?`,
      description: `${target.name.split(" ")[0]} becomes an owner and you become an admin. Only an owner can make you an owner again.`,
      confirmLabel: "Transfer ownership",
      tone: "danger",
      requireText: ws.slug,
      onConfirm: async () => {
        if (!(await actions.setRole(target.id, "Owner"))) return;
        if (!(await actions.setRole(me.id, "Admin"))) return;
        actions.toast({ title: `${target.name} owns ${ws.name} now`, description: "You are an admin." });
      },
    });
  };

  const del = () => {
    ask({
      title: `Delete ${ws.name}?`,
      description: `Deletes ${n(d.projects.length, "project")}, ${n(d.environments.length, "environment")}, ${n(secretCount, "secret")} and the activity log right away. Every token stops working. This cannot be undone.`,
      confirmLabel: "Delete workspace",
      tone: "danger",
      requireText: ws.slug,
      onConfirm: async () => {
        try {
          await api.deleteWorkspace(ws.slug, ws.slug);
          window.location.href = "/";
        } catch (error) {
          actions.fail(error, "Could not delete the workspace");
        }
      },
    });
  };

  return (
    <div className="set-stack">
      <SettingsGroup
        title="Danger zone"
        danger
        description={
          isOwner
            ? "These actions are hard to undo. Each asks you to type the workspace slug."
            : "Only owners can use these."
        }
      >
        <SettingRow
          label="Transfer ownership"
          description="Hand the workspace to another member. You become an admin."
          danger
        >
          <div className="set-inline">
            <Select
              className="set-select"
              aria-label="New owner"
              value={to}
              onValueChange={setTo}
              disabled={!isOwner || !candidates.length}
              placeholder="No other members"
              options={candidates.map((m) => ({
                value: m.id,
                label: m.name,
                prefix: <Avatar name={m.name} size={16} title={null} />,
                description: m.role,
              }))}
              placement="bottom-end"
            />
            <Button variant="secondary" onClick={transfer} disabled={!isOwner || !target}>
              Transfer
            </Button>
          </div>
        </SettingRow>
        <SettingRow
          label="Delete workspace"
          description={`Deletes ${ws.name}, its ${n(d.projects.length, "project")} and ${n(secretCount, "secret")}. Services reading them fail on their next deploy.`}
          danger
        >
          <Button variant="secondary" icon="trash-2" onClick={del} disabled={!isOwner}>
            Delete workspace
          </Button>
        </SettingRow>
      </SettingsGroup>
      {confirmNode}
    </div>
  );
}
