import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  n,
  PageHeader,
  Select,
  Table,
  Tooltip,
} from "@secmgr/ui";
import { useStore } from "../store";
import { formatUntil, formatWhen, liveNow, useConfirm, useHotkey } from "./NotFound.parts.jsx";

export const ROLES = ["Owner", "Admin", "Developer", "Viewer"];
const RANK = { Owner: 3, Admin: 2, Developer: 1, Viewer: 0 };
export const ROLE_INFO = {
  Owner: "Everything, including other owners and deleting the workspace.",
  Admin: "Manage projects, environments, members and tokens.",
  Developer: "Read and write secrets in every environment.",
  Viewer: "Read values outside protected environments.",
};
const LOSSES = {
  Owner: "owner rights, including deleting the workspace",
  Admin: "managing projects, environments, members and tokens",
  Developer: "writing secrets and reading protected environments",
};

const PERMISSIONS = [
  {
    id: "read",
    label: "Read values in unprotected environments",
    roles: { Owner: true, Admin: true, Developer: true, Viewer: true },
  },
  {
    id: "read-protected",
    label: "Read values in protected environments",
    roles: { Owner: true, Admin: true, Developer: true, Viewer: "Key names only" },
  },
  {
    id: "write",
    label: "Write secrets, typing the name for protected ones",
    roles: { Owner: true, Admin: true, Developer: true, Viewer: false },
  },
  {
    id: "manage",
    label: "Manage projects, environments and access",
    roles: { Owner: true, Admin: true, Developer: false, Viewer: false },
  },
  {
    id: "members",
    label: "Manage members and tokens",
    roles: { Owner: true, Admin: true, Developer: false, Viewer: false },
  },
  {
    id: "owners",
    label: "Change owners and delete the workspace",
    roles: { Owner: true, Admin: false, Developer: false, Viewer: false },
  },
];

export default function Members() {
  const { state, actions, select } = useStore();
  const d = state.data;
  const now = liveNow(select);
  const me = d.members.find((m) => m.id === d.currentUserId);
  const canManage = select.canManage;
  const isOwner = me && me.role === "Owner";
  const [confirmNode, ask] = useConfirm();

  useHotkey("n", () => canManage && actions.openDialog("invite"));

  const first = (name) => name.split(" ")[0];

  const changeRole = (m, role) => {
    if (role === m.role) return;
    const prev = m.role;
    const apply = async () => {
      const ok = await actions.setRole(m.id, role);
      if (ok)
        actions.toast({
          tone: "success",
          title: `${m.name} is now ${role === "Admin" || role === "Owner" ? "an" : "a"} ${role}`,
          action: { label: "Undo", onClick: () => actions.setRole(m.id, prev) },
        });
    };
    if (RANK[role] < RANK[prev]) {
      ask({
        title: `Change ${m.name} to ${role}?`,
        description: `${first(m.name)} loses ${LOSSES[prev] || "some access"} right away, in every project of ${d.workspace.name}.`,
        confirmLabel: `Change to ${role}`,
        tone: "danger",
        onConfirm: apply,
      });
      return;
    }
    if (role === "Owner") {
      ask({
        title: `Make ${m.name} an owner?`,
        description: `Owners can delete ${d.workspace.name} and remove other owners. ${first(m.name)} gets that right away.`,
        confirmLabel: "Make owner",
        onConfirm: apply,
      });
      return;
    }
    apply();
  };

  const remove = (m) => {
    const self = m.id === d.currentUserId;
    const toks = d.tokens.filter((t) => t.createdBy === m.id);
    ask({
      title: self ? `Leave ${d.workspace.name}?` : `Remove ${m.name} from ${d.workspace.name}?`,
      description: self
        ? `You lose access to ${n(d.projects.length, "project")} right away. An owner or admin has to invite you again to come back.`
        : `${first(m.name)} loses access to ${n(d.projects.length, "project")} right away.${toks.length ? ` ${n(toks.length, "token")} ${first(m.name)} created keep working; rotate them if needed.` : ""}`,
      confirmLabel: self ? "Leave workspace" : `Remove ${m.name}`,
      tone: "danger",
      onConfirm: async () => {
        const ok = await actions.removeMember(m.id);
        if (ok && !self) actions.toast({ title: `Removed ${m.name}` });
      },
    });
  };

  const resend = async (inv) => {
    const ok = await actions.invite({ email: inv.email, role: inv.role, resend: true });
    if (ok)
      actions.toast({
        tone: "success",
        title: `Sent the invite to ${inv.email} again`,
        description: "The link now works for another 48 hours.",
      });
  };
  const revokeInvite = (inv) => {
    ask({
      title: `Revoke the invite for ${inv.email}?`,
      description: "The link in the email stops working right away. You can invite them again later.",
      confirmLabel: "Revoke invite",
      tone: "danger",
      onConfirm: async () => {
        const ok = await actions.cancelInvite(inv.id);
        if (ok) actions.toast({ title: `Revoked the invite for ${inv.email}` });
      },
    });
  };
  const inviteLink = (inv) => `${window.location.origin}/invite/${inv.id}`;

  const roleOptions = ROLES.map((r) => ({
    value: r,
    label: r,
    description: ROLE_INFO[r],
    disabled: r === "Owner" && !isOwner,
  }));
  const roleLabel = (value) => ROLES.find((r) => r.toLowerCase() === value) || value;

  const columns = [
    {
      key: "name",
      header: "Name",
      minWidth: 180,
      render: (m) => (
        <span className="pg-cell">
          <Avatar name={m.name} size={24} title={null} />
          <span className="mem-name pg-trunc">{m.name}</span>
          {m.id === d.currentUserId && <Badge variant="outline">You</Badge>}
        </span>
      ),
    },
    { key: "email", header: "Email", minWidth: 180, render: (m) => <span className="pg-trunc">{m.email}</span> },
    {
      key: "role",
      header: "Role",
      width: 152,
      render: (m) => {
        const self = m.id === d.currentUserId;
        const select_ = (
          <Select
            size="sm"
            className="mem-role"
            aria-label={`Role of ${m.name}`}
            value={m.role}
            onValueChange={(r) => changeRole(m, r)}
            options={roleOptions}
            disabled={self || !canManage || (m.role === "Owner" && !isOwner)}
            placement="bottom-end"
            menuClassName="mem-role-menu"
          />
        );
        return self ? (
          <Tooltip content="Ask another owner or admin to change your role.">
            <span className="mem-role-wrap" tabIndex={0}>
              {select_}
            </span>
          </Tooltip>
        ) : (
          select_
        );
      },
    },
    {
      key: "twoFactor",
      header: "Two factor",
      width: 120,
      render: (m) =>
        m.twoFactor ? (
          <Badge tone="success" icon="shield-check">
            Enabled
          </Badge>
        ) : (
          <Badge tone="warning" icon="triangle-alert">
            Off
          </Badge>
        ),
    },
    {
      key: "lastActive",
      header: "Last active",
      width: 148,
      render: (m) => <span className="pg-tabular">{formatWhen(m.lastActiveAt, now)}</span>,
    },
    {
      key: "menu",
      header: <span className="sg-visually-hidden">Actions</span>,
      width: 48,
      align: "right",
      render: (m) => (
        <Menu align="end" trigger={<IconButton icon="more-horizontal" size="xs" label={`Actions for ${m.name}`} />}>
          <MenuLabel>{m.name}</MenuLabel>
          <MenuItem icon="copy" label="Copy email" onSelect={() => actions.copyString(m.email, `Copied ${m.email}`)} />
          {m.id === d.currentUserId ? (
            <>
              <MenuSeparator />
              <MenuItem icon="log-out" tone="danger" label="Leave workspace" onSelect={() => remove(m)} />
            </>
          ) : canManage && (m.role !== "Owner" || isOwner) ? (
            <>
              <MenuSeparator />
              <MenuItem icon="user-minus" tone="danger" label="Remove from workspace" onSelect={() => remove(m)} />
            </>
          ) : null}
        </Menu>
      ),
    },
  ];

  const inviteColumns = [
    {
      key: "email",
      header: "Email",
      minWidth: 200,
      render: (i) => (
        <span className="pg-cell">
          <Avatar name={i.email} size={24} title={null} />
          <span className="pg-trunc mem-name">{i.email}</span>
          <Badge tone="accent" dot>
            Pending
          </Badge>
        </span>
      ),
    },
    { key: "role", header: "Role", width: 120, render: (i) => roleLabel(i.role) },
    {
      key: "invitedBy",
      header: "Invited by",
      width: 148,
      render: (i) => i.invitedByName || select.memberById(i.invitedBy).name,
    },
    {
      key: "expiresAt",
      header: "Expires",
      width: 148,
      render: (i) => {
        const u = formatUntil(i.expiresAt, now);
        return (
          <span className={u.expired ? "tok-exp tok-exp--expired" : "pg-tabular"}>
            {u.expired ? "Expired" : u.hint}
          </span>
        );
      },
    },
    {
      key: "menu",
      header: <span className="sg-visually-hidden">Actions</span>,
      width: 48,
      align: "right",
      render: (i) =>
        canManage ? (
          <Menu
            align="end"
            trigger={<IconButton icon="more-horizontal" size="xs" label={`Actions for the invite to ${i.email}`} />}
          >
            <MenuItem
              icon="send"
              label="Resend invite"
              description="Emails the link again and resets its 48 hour expiry"
              onSelect={() => resend(i)}
            />
            <MenuItem
              icon="link"
              label="Copy invite link"
              onSelect={() => actions.copyString(inviteLink(i), "Copied invite link", `Only ${i.email} can accept it.`)}
            />
            <MenuSeparator />
            <MenuItem icon="x" tone="danger" label="Revoke invite" onSelect={() => revokeInvite(i)} />
          </Menu>
        ) : null,
    },
  ];

  const permColumns = [
    { key: "label", header: "Permission", minWidth: 200 },
    ...ROLES.map((r) => ({
      key: r,
      header: r,
      width: 112,
      align: "center",
      render: (p) => {
        const v = p.roles[r];
        if (v === true) return <Icon name="check" size={16} label="Allowed" className="mem-yes" />;
        if (v === false) return <Icon name="minus" size={16} label="Not allowed" className="mem-no" />;
        return <span className="mem-partial">{v}</span>;
      },
    })),
  ];

  const without2fa = d.members.filter((m) => !m.twoFactor);

  return (
    <div className="pg mem">
      <PageHeader
        title="Members"
        description={`${n(d.members.length, "member")} in ${d.workspace.name}${d.invites.length ? `, ${n(d.invites.length, "pending invite")}` : ""}. Roles apply to every project.`}
        actions={
          canManage ? (
            <Button variant="primary" icon="user-plus" kbd="n" onClick={() => actions.openDialog("invite")}>
              Invite members
            </Button>
          ) : null
        }
      />
      <div className="pg__body">
        <Table
          framed
          label="Members"
          columns={columns}
          rows={d.members}
          density={state.prefs.density}
          empty={
            <EmptyState
              variant="inline"
              icon="users"
              title="Only you so far"
              description="Invite the people who deploy with you."
              actions={
                canManage ? (
                  <Button size="sm" variant="primary" icon="user-plus" onClick={() => actions.openDialog("invite")}>
                    Invite members
                  </Button>
                ) : undefined
              }
            />
          }
        />
        {without2fa.length > 0 && (
          <p className="pg__note">{`${without2fa.map((m) => m.name).join(", ")} ${without2fa.length === 1 ? "has" : "have"} not set up two factor. Each person turns it on in Settings, under Security.`}</p>
        )}

        <section className="pg__section" aria-labelledby="mem-invites">
          <div className="pg__section-head">
            <h2 className="pg__section-title" id="mem-invites">
              Pending invites
            </h2>
            <span className="pg__section-count">{d.invites.length}</span>
          </div>
          <Table
            framed
            label="Pending invites"
            rowKey="id"
            columns={inviteColumns}
            rows={d.invites}
            density={state.prefs.density}
            empty={
              <EmptyState
                variant="inline"
                icon="send"
                title="No pending invites"
                description="Invites you send wait here until they are accepted. Links expire after 48 hours."
              />
            }
          />
        </section>

        <Card
          padding="none"
          title="Roles"
          description={`What each role can do in every project of ${d.workspace.name}. Owners and admins can override access per environment.`}
        >
          <Table label="Permissions by role" columns={permColumns} rows={PERMISSIONS} density="compact" />
        </Card>
      </div>
      {confirmNode}
    </div>
  );
}
