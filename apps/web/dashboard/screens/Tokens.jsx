import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CodeBlock,
  EmptyState,
  EnvBadge,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  n,
  PageHeader,
  Table,
  Tooltip,
} from "@secmgr/ui";
import { useStore } from "../store";
import { formatUntil, formatWhen, liveNow, shortDate, useConfirm, useHotkey } from "./NotFound.parts.jsx";

export default function Tokens() {
  const { state, actions, select } = useStore();
  const d = state.data;
  const now = liveNow(select);
  const [confirmNode, ask] = useConfirm();

  const manage = select.canManage;
  const projectName = (id) => select.projectById(id)?.name ?? "";
  useHotkey("n", () => actions.openDialog("create-token"), manage);

  const tokens = d.tokens.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const expired = tokens.filter((t) => formatUntil(t.expiresAt, now).expired);
  const soon = tokens.filter((t) => {
    const u = formatUntil(t.expiresAt, now);
    return !u.expired && u.soon;
  });

  const rotate = (t) => {
    const env = select.envById(t.envId);
    ask({
      title: `Rotate ${t.name}?`,
      description: `The current token stops working at once. Update it wherever it runs before the next ${env ? env.name : ""} deploy.`,
      confirmLabel: `Rotate ${t.name}`,
      onConfirm: async () => {
        const res = await actions.rotateToken(t.id);
        if (res)
          actions.openDialog("create-token", {
            reveal: { name: t.name, secret: res.secret, envId: t.envId, rotated: true },
          });
      },
    });
  };

  const revoke = (t) => {
    const env = select.envById(t.envId);
    ask({
      title: `Revoke ${t.name}?`,
      description: `Requests with this token fail with 401 from now on.${t.lastUsedAt ? ` It last read ${env ? env.name : "its environment"} ${formatWhen(t.lastUsedAt, now)}.` : ""}`,
      confirmLabel: `Revoke ${t.name}`,
      tone: "danger",
      onConfirm: async () => {
        await actions.revokeToken(t.id);
      },
    });
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      minWidth: 180,
      render: (t) => {
        const u = formatUntil(t.expiresAt, now);
        return (
          <span className="pg-cell">
            <Avatar name={t.name} kind="service" size={20} title={null} />
            <span className={u.expired ? "tok-name tok-name--expired pg-trunc" : "tok-name pg-trunc"}>{t.name}</span>
            {u.expired && <span className="sg-visually-hidden">, expired</span>}
          </span>
        );
      },
    },
    {
      key: "scope",
      header: "Scope",
      minWidth: 200,
      render: (t) => {
        const env = select.envById(t.envId);
        return (
          <span className="pg-cell">
            <code className="tok-proj pg-trunc">{projectName(t.projectId)}</code>
            {env ? <EnvBadge env={env} size="sm" /> : <Badge variant="outline">Deleted environment</Badge>}
          </span>
        );
      },
    },
    {
      key: "access",
      header: "Access",
      width: 136,
      render: (t) =>
        t.access === "write" ? (
          <Badge tone="warning" icon="pencil">
            Read and write
          </Badge>
        ) : (
          <Badge icon="eye">Read</Badge>
        ),
    },
    {
      key: "createdBy",
      header: "Created by",
      width: 156,
      render: (t) => {
        const m = select.memberById(t.createdBy);
        return (
          <span className="pg-cell">
            <Avatar name={m.name} size={16} title={null} />
            <span className="pg-trunc">{m.name.split(" ")[0]}</span>
            <span className="pg-cell__sub">{shortDate(t.createdAt, now)}</span>
          </span>
        );
      },
    },
    {
      key: "lastUsed",
      header: "Last used",
      width: 124,
      render: (t) => <span className={t.lastUsedAt ? "pg-tabular" : "tok-never"}>{formatWhen(t.lastUsedAt, now)}</span>,
    },
    {
      key: "expires",
      header: "Expires",
      width: 136,
      render: (t) => {
        const u = formatUntil(t.expiresAt, now);
        if (!t.expiresAt) return <span className="tok-never">Never</span>;
        return (
          <Tooltip content={u.hint}>
            <span
              className={u.expired ? "tok-exp tok-exp--expired" : u.soon ? "tok-exp tok-exp--soon" : "tok-exp"}
              tabIndex={0}
            >
              {u.label}
            </span>
          </Tooltip>
        );
      },
    },
    {
      key: "menu",
      header: <span className="sg-visually-hidden">Actions</span>,
      width: 48,
      align: "right",
      render: (t) => (
        <Menu align="end" trigger={<IconButton icon="more-horizontal" size="xs" label={`Actions for ${t.name}`} />}>
          <MenuLabel>{t.name}</MenuLabel>
          <MenuItem
            icon="copy"
            label="Copy prefix"
            description={`${t.prefix}…${t.suffix}, to find it in logs`}
            onSelect={() =>
              actions.copyString(
                `${t.prefix}`,
                `Copied the prefix of ${t.name}`,
                "Search your CI logs for it to see where it runs.",
              )
            }
          />
          <MenuItem
            icon="history"
            label="Show activity"
            onSelect={() => actions.navigate("activity", { projectId: t.projectId })}
          />
          {manage && (
            <MenuItem
              icon="rotate-cw"
              label="Rotate"
              description="Issues a new value; the old one stops working"
              onSelect={() => rotate(t)}
            />
          )}
          {manage && <MenuSeparator />}
          {manage && <MenuItem icon="trash-2" tone="danger" label={`Revoke ${t.name}`} onSelect={() => revoke(t)} />}
        </Menu>
      ),
    },
  ];

  const header = (
    <PageHeader
      title="Access tokens"
      description={`Service tokens let CI and servers read secrets without a person. ${n(tokens.length, "token")}${expired.length ? `, ${expired.length} expired` : ""}.`}
      actions={
        manage ? (
          <Button variant="primary" icon="plus" kbd="n" onClick={() => actions.openDialog("create-token")}>
            New token
          </Button>
        ) : null
      }
    />
  );

  return (
    <div className="pg tok">
      {header}
      <div className="pg__body">
        {expired.map((t) => {
          const u = formatUntil(t.expiresAt, now);
          const env = select.envById(t.envId);
          return (
            <Callout
              key={t.id}
              tone="danger"
              title={`${t.name} expired ${u.hint}`}
              action={
                manage ? (
                  <Button size="sm" variant="secondary" icon="rotate-cw" onClick={() => rotate(t)}>
                    Rotate token
                  </Button>
                ) : null
              }
            >
              Jobs that use it to read <code>{projectName(t.projectId)}</code>
              {env ? (
                <>
                  {" "}
                  in <code>{env.name}</code>
                </>
              ) : null}{" "}
              now fail with 401. It last ran {formatWhen(t.lastUsedAt, now)}.
            </Callout>
          );
        })}
        {soon.length > 0 && !expired.length && (
          <Callout tone="warning" title={`${soon[0].name} expires ${formatUntil(soon[0].expiresAt, now).hint}`}>
            Rotate it before then so deploys keep reading secrets.
          </Callout>
        )}
        <Table
          framed
          label="Access tokens"
          columns={columns}
          rows={tokens}
          density={state.prefs.density}
          empty={
            <EmptyState
              variant="inline"
              icon="bot"
              title="No tokens yet"
              description={
                manage
                  ? "Create a token for CI or a server so it can read secrets without a person signing in."
                  : "Owners and admins create tokens for CI and servers."
              }
              actions={
                manage ? (
                  <Button size="sm" variant="primary" icon="plus" onClick={() => actions.openDialog("create-token")}>
                    New token
                  </Button>
                ) : undefined
              }
            />
          }
        />
        <Card
          title="Use a token"
          description="Set SECMGR_TOKEN and the CLI reads the environment the token is scoped to. No login, no browser."
        >
          <CodeBlock
            language="shell"
            copy
            prompt
            code={"export SECMGR_TOKEN=smg_live_…\nsecmgr run -- ./deploy.sh"}
            onCopy={() => actions.toast({ title: "Copied command" })}
          />
        </Card>
      </div>
      {confirmNode}
    </div>
  );
}
