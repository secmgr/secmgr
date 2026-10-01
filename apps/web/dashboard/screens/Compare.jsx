import {
  Badge,
  Button,
  CodeBlock,
  CompareMatrix,
  DiffView,
  EmptyState,
  EnvDot,
  Icon,
  IconButton,
  Menu,
  MenuCheckboxItem,
  MenuLabel,
  n,
  PageHeader,
  SecretValue,
  SegmentedControl,
  Select,
  Switch,
  Tooltip,
} from "@secmgr/ui";
import { useEffect, useMemo, useState } from "react";
import { useEnvValues, useStore } from "../store";
import { ProjectMissing, useHotkey } from "./NotFound.parts.jsx";

export default function Compare() {
  const { state, select } = useStore();
  const project = select.projectById(state.route.params.projectId);
  if (!project) return <ProjectMissing projectId={state.route.params.projectId} />;
  return <CompareView project={project} />;
}

function pickEnvs(all, list) {
  return (list || []).map((x) => all.find((e) => e.id === x || e.name === x)).filter(Boolean);
}

function CompareView({ project }) {
  const { state, actions, select } = useStore();
  const params = state.route.params;
  const allEnvs = select.envsOf(project.id);
  const keys = select.keysOf(project.id);
  const requested = pickEnvs(allEnvs, params.envs);
  const startDiff = params.mode === "diff";
  const byName = (nm) => allEnvs.find((e) => e.name === nm);

  const [mode, setMode] = useState(startDiff ? "diff" : "matrix");
  const [picked, setPicked] = useState(() =>
    (!startDiff && requested.length >= 2 ? requested : allEnvs.slice(0, 5)).map((e) => e.id),
  );
  const [reference, setReference] = useState(null);
  const [grouped, setGrouped] = useState(true);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [baseId, setBaseId] = useState(() =>
    startDiff && requested[0] ? requested[0].id : (byName("staging") || allEnvs[0])?.id,
  );
  const [compareId, setCompareId] = useState(() =>
    startDiff && requested[1] ? requested[1].id : (byName("production") || allEnvs[1])?.id,
  );

  const envKey = (params.envs || []).join(",");
  useEffect(() => {
    if (params.mode === "diff") {
      setMode("diff");
      if (requested[0]) setBaseId(requested[0].id);
      if (requested[1]) setCompareId(requested[1].id);
    } else if (params.mode === "matrix") setMode("matrix");
    if (params.mode !== "diff" && requested.length >= 2) setPicked(requested.map((e) => e.id));
  }, [params.mode, envKey]);

  useHotkey("m", () => setMode((m) => (m === "matrix" ? "diff" : "matrix")), allEnvs.length >= 2);

  const selected = allEnvs.filter((e) => picked.includes(e.id));
  const envs = selected.length >= 2 ? selected : allEnvs.slice(0, Math.min(5, allEnvs.length));
  const defaultRef = (envs.find((e) => e.name === "production") || envs.find((e) => e.protected) || envs[0])?.name;
  const refName = reference && envs.some((e) => e.name === reference) ? reference : defaultRef;
  const refEnv = envs.find((e) => e.name === refName);

  const matrix = useMemo(() => {
    const values = {};
    for (const e of envs) values[e.name] = {};
    const lookup = {};
    for (const k of keys) {
      const v = select.valueIn(project.id, k);
      lookup[k] = v;
      for (const e of envs) if (v[e.id]) values[e.name][k] = v[e.id].length === 0 ? "" : v[e.id].fingerprint || "";
    }
    return { values, lookup };
  }, [select, envs.map((e) => e.id).join(","), keys.join(",")]);

  const prodEnv = allEnvs.find((e) => e.name === "production");
  const annotations = useMemo(() => {
    const out = {};
    for (const k of keys) {
      const v = matrix.lookup[k];
      const badges = [];
      const prod = prodEnv ? v[prodEnv.id] : null;
      if (prod?.looksLive && prod.fingerprint) {
        const sharers = allEnvs
          .filter((e) => e.id !== prodEnv.id && v[e.id] && v[e.id].fingerprint === prod.fingerprint)
          .map((e) => e.name);
        if (sharers.length) {
          badges.push(
            <Tooltip key="live" content={`${sharers.join(" and ")} and production use the same live key`}>
              <span className="cmp-anno" tabIndex={0}>
                <Badge tone="danger" icon="circle-alert">
                  Shared live key
                </Badge>
              </span>
            </Tooltip>,
          );
        }
      }
      const staged = envs.filter((e) => select.stagedOf(e.id)[k]);
      if (staged.length)
        badges.push(
          <Badge
            key="staged"
            tone="accent"
            variant="outline"
          >{`Staged in ${staged.map((e) => e.name).join(", ")}`}</Badge>,
        );
      if (badges.length) out[k] = <span className="cmp-annos">{badges}</span>;
    }
    return out;
  }, [matrix, select, envs.map((e) => e.id).join(",")]);

  const summary = useMemo(() => {
    let differ = 0;
    let identical = 0;
    const missing = {};
    for (const k of keys) {
      const present = envs.filter((e) => matrix.lookup[k][e.id]);
      for (const e of envs) if (!matrix.lookup[k][e.id]) missing[e.name] = (missing[e.name] || 0) + 1;
      if (present.length === envs.length) {
        const vals = new Set(present.map((e) => matrix.lookup[k][e.id].fingerprint));
        if (vals.size === 1) identical++;
        else differ++;
      }
    }
    return { differ, identical, missing };
  }, [matrix, keys.join(","), envs.map((e) => e.id).join(",")]);

  const envCount = (e) => select.rawSecretsOf(e.id).length;

  const sourceFor = (key, target) => {
    const holders = allEnvs.filter((e) => e.id !== target.id && matrix.lookup[key] && matrix.lookup[key][e.id]);
    const leak = (e) => (e.protected && !target.protected ? 1 : 0);
    holders.sort((a, b) => {
      if (leak(a) !== leak(b)) return leak(a) - leak(b);
      const da = Math.abs(a.order - target.order);
      const db = Math.abs(b.order - target.order);
      return da !== db ? da - db : a.order - b.order;
    });
    const env = holders[0];
    return env ? { env, secret: matrix.lookup[key][env.id] } : null;
  };

  const stageInto = async (target, key, value, source, sensitive) => {
    const count = await actions.copyToEnv(
      [{ key, value, sensitive, envId: source ? source.id : target.id }],
      target.id,
      { silent: true },
    );
    if (!count) return;
    actions.toast({
      title: `Staged ${key} for ${target.name}`,
      description: `${source ? `Value from ${source.name}. ` : ""}${target.protected ? `Saving asks you to type ${target.name}.` : "Nothing changes until you save."}`,
      action: {
        label: "Review",
        onClick: () => actions.navigate("secrets", { projectId: project.id, envId: target.id, mode: "table" }),
      },
    });
  };

  const onAdd = (key, envName) => {
    const target = envs.find((e) => e.name === envName);
    const src = target && sourceFor(key, target);
    if (!target) return;
    stageInto(target, key, src ? undefined : "", src?.env, src ? src.secret.sensitive : true);
  };

  const onCellClick = (key, envName) => {
    const env = envs.find((e) => e.name === envName);
    if (!env) return;
    if (!matrix.lookup[key]?.[env.id]) {
      onAdd(key, envName);
      return;
    }
    actions.openSheet("secret", { secretId: matrix.lookup[key][env.id].id });
  };

  const togglePicked = (id, on) => {
    setPicked((cur) => {
      const base = cur.filter((x) => allEnvs.some((e) => e.id === x));
      if (on) return base.includes(id) || base.length >= 5 ? base : [...base, id];
      return base.length <= 2 ? base : base.filter((x) => x !== id);
    });
  };

  const baseEnv = allEnvs.find((e) => e.id === baseId) || allEnvs[0];
  const compareEnv =
    allEnvs.find((e) => e.id === compareId && e.id !== baseEnv?.id) || allEnvs.find((e) => e.id !== baseEnv?.id);

  useEnvValues(mode === "diff" ? [baseEnv?.id, compareEnv?.id] : []);
  const pairValues = (env) => {
    const out = {};
    if (!env) return out;
    for (const s of select.rawSecretsOf(env.id)) out[s.key] = s.value ?? "";
    return out;
  };
  const pairUnreadable = [baseEnv, compareEnv].find((e) => e && !select.canRead(e.id));
  const pairLoading = [baseEnv, compareEnv].some(
    (e) => e && select.canRead(e.id) && select.valuesStatus(e.id) !== "ready" && select.valuesStatus(e.id) !== "error",
  );
  const baseValues = useMemo(() => pairValues(baseEnv), [select, baseEnv?.id]);
  const compareValues = useMemo(() => pairValues(compareEnv), [select, compareEnv?.id]);

  const onDiffAction = (action, row) => {
    const find = (env, key) => select.rawSecretsOf(env.id).find((s) => s.key === key);
    if (action === "add-to-base") {
      const src = find(compareEnv, row.key);
      stageInto(baseEnv, row.key, row.compare, compareEnv, src ? src.sensitive : true);
    } else {
      const src = find(baseEnv, row.key);
      stageInto(compareEnv, row.key, row.base, baseEnv, src ? src.sensitive : true);
    }
  };

  const onReveal = (revealed) => {
    if (!revealed || !baseEnv || !compareEnv) return;
    const changed = Object.keys(baseValues).filter((k) => k in compareValues && compareValues[k] !== baseValues[k]);
    for (const env of [baseEnv, compareEnv])
      actions.log({
        action: "reveal",
        projectId: project.id,
        envId: env.id,
        keys: changed.slice(0, 50),
        count: changed.length,
      });
  };

  const stagedRenderer = (value, ctx) => {
    const env = ctx.side === "base" ? baseEnv : compareEnv;
    if (!env || !select.stagedOf(env.id)[ctx.key]) return undefined;
    return (
      <span className="cmp-staged">
        <SecretValue value={value} revealed={ctx.revealed} revealTimeout={0} secretKey={ctx.key} />
        <Badge tone="accent" variant="outline">
          Staged
        </Badge>
      </span>
    );
  };

  const revealMs = state.prefs.revealTimeoutSec ? state.prefs.revealTimeoutSec * 1000 : undefined;

  const envOptions = (otherId) =>
    allEnvs.map((e) => ({
      value: e.id,
      label: e.name,
      prefix: <EnvDot color={e.color} />,
      description: `${n(envCount(e), "secret")}${e.protected ? ", protected" : ""}`,
      disabled: e.id === otherId,
    }));

  const cliPair =
    mode === "diff"
      ? [baseEnv?.name, compareEnv?.name]
      : (() => {
          const names = envs.map((e) => e.name);
          if (names.includes("staging") && names.includes("production")) return ["staging", "production"];
          const other = envs.find((e) => e.name !== refName);
          return [other ? other.name : names[0], refName];
        })();

  const cliCounts = (() => {
    const a = allEnvs.find((e) => e.name === cliPair[0]);
    const b = allEnvs.find((e) => e.name === cliPair[1]);
    if (!a || !b) return "";
    const fp = (e) =>
      Object.fromEntries(select.rawSecretsOf(e.id).map((s) => [s.key, s.length === 0 ? "" : s.fingerprint]));
    const av = fp(a);
    const bv = fp(b);
    let differ = 0;
    let same = 0;
    let missing = 0;
    for (const k of new Set([...Object.keys(av), ...Object.keys(bv)])) {
      if (!(k in bv)) missing++;
      else if (!(k in av)) continue;
      else if (av[k] === bv[k]) same++;
      else differ++;
    }
    return `${differ} differ · ${missing} missing in ${b.name} · ${same} identical`;
  })();

  const header = (
    <PageHeader
      title="Compare"
      description={
        <>
          {n(keys.length, "key")} of <code className="pg-code">{project.name}</code> across{" "}
          {n(allEnvs.length, "environment")}. Fingerprints prove two values match without showing them.
        </>
      }
      actions={
        allEnvs.length >= 2 && keys.length ? (
          <Tooltip content="Switch view" kbd="m">
            <SegmentedControl
              aria-label="View"
              size="sm"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: "matrix", label: "Matrix", icon: "table-2" },
                { value: "diff", label: "Side by side", icon: "columns-2" },
              ]}
            />
          </Tooltip>
        ) : null
      }
    />
  );

  if (allEnvs.length < 2) {
    return (
      <div className="pg">
        {header}
        <EmptyState
          variant="page"
          icon="git-compare-arrows"
          title="Compare needs two environments"
          description={
            <>
              <code>{project.name}</code> has {n(allEnvs.length, "environment")}. Add another to see which keys differ,
              which are missing and which match.
            </>
          }
          actions={
            select.canManage ? (
              <Button
                variant="primary"
                icon="plus"
                onClick={() => actions.openDialog("create-environment", { projectId: project.id })}
              >
                New environment
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (!keys.length) {
    return (
      <div className="pg">
        {header}
        <EmptyState
          variant="page"
          icon="git-compare-arrows"
          title="Nothing to compare yet"
          description={
            <>
              No environment in <code>{project.name}</code> holds a secret. Import a .env into {allEnvs[0].name} and
              come back.
            </>
          }
          actions={
            <Button
              variant="primary"
              icon="arrow-right"
              onClick={() =>
                actions.navigate("secrets", { projectId: project.id, envId: allEnvs[0].id, mode: "table" })
              }
            >{`Open ${allEnvs[0].name}`}</Button>
          }
        />
      </div>
    );
  }

  const missingEntries = Object.entries(summary.missing).sort((a, b) =>
    a[0] === refName ? -1 : b[0] === refName ? 1 : 0,
  );

  return (
    <div className="pg cmp">
      {header}
      <div className="pg__body">
        {mode === "matrix" ? (
          <>
            <div className="pg__toolbar cmp-toolbar">
              <Menu
                align="start"
                trigger={
                  <Button
                    variant="secondary"
                    size="sm"
                    iconRight="chevron-down"
                    aria-label={`Environments: ${envs.map((e) => e.name).join(", ")}`}
                  >
                    <span className="cmp-picker">
                      <span className="cmp-picker__dots" aria-hidden="true">
                        {envs.map((e) => (
                          <EnvDot key={e.id} color={e.color} />
                        ))}
                      </span>
                      {n(envs.length, "environment")}
                    </span>
                  </Button>
                }
              >
                <MenuLabel>Compare 2 to 5 environments</MenuLabel>
                {allEnvs.map((e) => {
                  const on = picked.includes(e.id);
                  return (
                    <MenuCheckboxItem
                      key={e.id}
                      checked={on}
                      textValue={e.name}
                      disabled={on ? envs.length <= 2 : envs.length >= 5}
                      onCheckedChange={(v) => togglePicked(e.id, v)}
                      label={
                        <span className="cmp-opt">
                          <EnvDot color={e.color} />
                          <span className="cmp-opt__name">{e.name}</span>
                          {e.protected && <Icon name="lock" size={12} className="cmp-opt__lock" label="Protected" />}
                        </span>
                      }
                      description={n(envCount(e), "secret")}
                    />
                  );
                })}
              </Menu>
              <div className="pg__toolbar-end">
                <Switch size="sm" label="Group by prefix" checked={grouped} onCheckedChange={setGrouped} />
              </div>
            </div>

            <p className="cmp-summary" aria-live="polite">
              <span className="cmp-summary__item" data-tone="change">
                <b>{summary.differ}</b> differ
              </span>
              {missingEntries.map(([nm, count]) => (
                <span key={nm} className="cmp-summary__item" data-tone="remove">
                  <b>{count}</b>
                  {` missing in ${nm}`}
                </span>
              ))}
              <span className="cmp-summary__item" data-tone="same">
                <b>{summary.identical}</b> identical
              </span>
            </p>

            <CompareMatrix
              envs={envs}
              values={matrix.values}
              reference={refName}
              referenceSelect={
                <span className="cmp-ref">
                  <span className="cmp-ref__label" id="cmp-ref-label">
                    Reference
                  </span>
                  <Select
                    size="sm"
                    aria-labelledby="cmp-ref-label"
                    value={refEnv ? refEnv.id : null}
                    onValueChange={(id) => {
                      const e = envs.find((x) => x.id === id);
                      if (e) setReference(e.name);
                    }}
                    options={envs.map((e) => ({ value: e.id, label: e.name, prefix: <EnvDot color={e.color} /> }))}
                    placement="bottom-end"
                  />
                </span>
              }
              onlyDifferences={onlyDiff}
              onOnlyDifferencesChange={setOnlyDiff}
              groupBy={grouped ? "prefix" : "none"}
              annotations={annotations}
              onCellClick={onCellClick}
              onAdd={onAdd}
            />
            <p className="pg__note">
              Click a cell to open its value. Hover a missing cell and choose Add to stage the key from the nearest
              environment that has it. Arrow keys move between cells.
            </p>
          </>
        ) : (
          <>
            <div className="pg__toolbar cmp-toolbar">
              <div className="cmp-pair">
                <span className="cmp-pair__field">
                  <span className="cmp-pair__label" id="cmp-base-label">
                    Base
                  </span>
                  <Select
                    size="sm"
                    aria-labelledby="cmp-base-label"
                    value={baseEnv?.id}
                    onValueChange={setBaseId}
                    options={envOptions(compareEnv?.id)}
                  />
                </span>
                <IconButton
                  icon="arrow-left-right"
                  label="Swap environments"
                  size="sm"
                  onClick={() => {
                    const b = baseEnv?.id;
                    setBaseId(compareEnv?.id);
                    setCompareId(b);
                  }}
                />
                <span className="cmp-pair__field">
                  <span className="cmp-pair__label" id="cmp-compare-label">
                    Compare
                  </span>
                  <Select
                    size="sm"
                    aria-labelledby="cmp-compare-label"
                    value={compareEnv?.id}
                    onValueChange={setCompareId}
                    options={envOptions(baseEnv?.id)}
                  />
                </span>
              </div>
            </div>
            {pairUnreadable ? (
              <EmptyState
                variant="inline"
                icon="lock"
                title={`You cannot read ${pairUnreadable.name}`}
                description="Side by side shows values, so it needs read access to both environments. The matrix compares fingerprints and works without it."
                actions={
                  <Button size="sm" onClick={() => setMode("matrix")}>
                    Show the matrix
                  </Button>
                }
              />
            ) : (
              <DiffView
                key={`${baseEnv?.id}:${compareEnv?.id}`}
                base={baseEnv}
                compare={compareEnv}
                baseValues={baseValues}
                compareValues={compareValues}
                revealTimeout={revealMs}
                onRevealedChange={onReveal}
                onAction={onDiffAction}
                valueRenderer={stagedRenderer}
                loading={pairLoading}
              />
            )}
            <p className="pg__note">{`Reveals are logged for both environments. Copying a value stages it; nothing is written until you save ${compareEnv ? compareEnv.name : "the environment"}.`}</p>
          </>
        )}

        <section className="cmp-cli" aria-labelledby="cmp-cli-title">
          <div className="cmp-cli__text">
            <h2 className="pg__section-title" id="cmp-cli-title">
              From your terminal
            </h2>
            <p className="pg__section-desc">
              The same comparison for scripts and CI. It exits with 1 when a key is missing on either side.
            </p>
          </div>
          <CodeBlock
            className="cmp-cli__code"
            language="shell"
            copy
            prompt
            code={`$ secmgr diff ${cliPair[0]} ${cliPair[1]}${cliCounts ? `\n${cliCounts}` : ""}`}
            onCopy={() => actions.toast({ title: "Copied diff command" })}
          />
        </section>
      </div>
    </div>
  );
}
