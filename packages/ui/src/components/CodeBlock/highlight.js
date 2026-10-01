const REF = /(\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Za-z_][A-Za-z0-9_]*)/g;

function withRefs(text, cls) {
  const out = [];
  let last = 0;
  text.replace(REF, (m, _g, at) => {
    if (at > last) out.push([cls, text.slice(last, at)]);
    out.push(["ref", m]);
    last = at + m.length;
    return m;
  });
  if (last < text.length) out.push([cls, text.slice(last)]);
  return out;
}

function shellCommand(text) {
  const out = [];
  const re = /(\s+)|("(?:[^"\\]|\\.)*"?|'[^']*'?)|(\|\||&&|[|;<>]+|\\$)|(#.*$)|([^\s|&;<>"']+)/g;
  let expectCmd = true;
  let m;
  for (m = re.exec(text); m; m = re.exec(text)) {
    if (m[1]) {
      out.push(["plain", m[1]]);
      continue;
    }
    if (m[2]) {
      out.push(...withRefs(m[2], "value"));
      expectCmd = false;
      continue;
    }
    if (m[3]) {
      out.push(["punct", m[3]]);
      expectCmd = m[3] !== "\\" && m[3] !== ">" && m[3] !== "<";
      continue;
    }
    if (m[4]) {
      out.push(["comment", m[4]]);
      continue;
    }
    const w = m[5];
    if (expectCmd && !/^[A-Z_][A-Z0-9_]*=/.test(w)) {
      out.push(["cmd", w]);
      expectCmd = false;
      continue;
    }
    if (/^[A-Z_][A-Z0-9_]*=/.test(w)) {
      const eq = w.indexOf("=");
      out.push(["key", w.slice(0, eq)], ["punct", "="], ...withRefs(w.slice(eq + 1), "value"));
      continue;
    }
    if (w === "--") {
      out.push(["punct", w]);
      continue;
    }
    if (/^-{1,2}[A-Za-z]/.test(w)) {
      const eq = w.indexOf("=");
      if (eq > 0) out.push(["flag", w.slice(0, eq)], ["punct", "="], ...withRefs(w.slice(eq + 1), "value"));
      else out.push(["flag", w]);
      continue;
    }
    out.push(...withRefs(w, "plain"));
  }
  return out;
}

function shell(code, prompt) {
  const lines = code.split("\n");
  const hasPrompt = lines.some((l) => /^\$ /.test(l));
  let continued = false;
  return lines.map((line) => {
    if (/^\s*#/.test(line)) {
      continued = false;
      return { tokens: [["comment", line]] };
    }
    let command = false;
    let body = line;
    if (hasPrompt && /^\$ /.test(line)) {
      command = true;
      body = line.slice(2);
    } else if (continued) command = true;
    else if (!hasPrompt && line.trim()) command = true;
    const isCont = command && /\\\s*$/.test(body);
    const tokens = command ? shellCommand(body) : [["output", line]];
    const showPrompt = prompt && command && !continued;
    continued = isCont;
    return { tokens, prompt: showPrompt, command };
  });
}

function dotenv(code) {
  return code.split("\n").map((line) => {
    if (/^\s*#/.test(line)) return { tokens: [["comment", line]] };
    const m = /^(\s*)(export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)(\s*=\s*)?(.*)$/.exec(line);
    if (!m || m[4] === undefined) return { tokens: [["plain", line]] };
    const tokens = [];
    if (m[1]) tokens.push(["plain", m[1]]);
    if (m[2]) tokens.push(["punct", m[2]]);
    tokens.push(["key", m[3]], ["punct", m[4]]);
    let value = m[5];
    let comment = "";
    const q = value[0];
    if (q === '"' || q === "'") {
      const end = value.indexOf(q, 1);
      const inner = end > 0 ? value.slice(1, end) : value.slice(1);
      if (end > 0) comment = value.slice(end + 1);
      tokens.push(["punct", q], ...withRefs(inner, "value"));
      if (end > 0) tokens.push(["punct", q]);
    } else {
      const hash = value.search(/\s#/);
      if (hash >= 0) {
        comment = value.slice(hash);
        value = value.slice(0, hash);
      }
      tokens.push(...withRefs(value, "value"));
    }
    if (comment) {
      const lead = comment.match(/^\s*/)[0];
      if (lead) tokens.push(["plain", lead]);
      if (comment.trim()) tokens.push(["comment", comment.trim()]);
    }
    return { tokens };
  });
}

function json(code) {
  const re =
    /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])|(\s+)|([^\s{}[\],:"]+)/g;
  return code.split("\n").map((line) => {
    const tokens = [];
    let m;
    re.lastIndex = 0;
    for (m = re.exec(line); m; m = re.exec(line)) {
      if (m[1] && m[2] !== undefined) {
        tokens.push(["key", m[1]], ["punct", m[2]]);
        continue;
      }
      if (m[1]) {
        tokens.push(...withRefs(m[1], "value"));
        continue;
      }
      if (m[3] || m[4]) {
        tokens.push(["value", m[3] || m[4]]);
        continue;
      }
      if (m[5]) {
        tokens.push(["punct", m[5]]);
        continue;
      }
      tokens.push(["plain", m[6] || m[7]]);
    }
    return { tokens };
  });
}

function yamlValue(v) {
  const out = [];
  const hash = v.search(/(^|\s)#/);
  let value = v;
  let comment = "";
  if (hash >= 0 && !/^\s*["']/.test(v)) {
    comment = v.slice(hash);
    value = v.slice(0, hash);
  }
  const q = value.trim()[0];
  if (q === '"' || q === "'") {
    const lead = value.match(/^\s*/)[0];
    const body = value.trim();
    if (lead) out.push(["plain", lead]);
    const closed = body.length > 1 && body.endsWith(q);
    out.push(["punct", q], ...withRefs(body.slice(1, closed ? -1 : undefined), "value"));
    if (closed) out.push(["punct", q]);
  } else if (value) {
    out.push(...withRefs(value, "value"));
  }
  if (comment) out.push(["comment", comment]);
  return out;
}

function yaml(code) {
  return code.split("\n").map((line) => {
    if (/^\s*#/.test(line)) return { tokens: [["comment", line]] };
    if (/^\s*(---|\.\.\.)\s*$/.test(line)) return { tokens: [["punct", line]] };
    const m = /^(\s*)(- )?([^\s:#"'][^:#]*?|"[^"]*"|'[^']*')(:)(\s|$)(.*)$/.exec(line);
    if (m) {
      const tokens = [];
      if (m[1]) tokens.push(["plain", m[1]]);
      if (m[2]) tokens.push(["punct", m[2]]);
      tokens.push(["key", m[3]], ["punct", m[4]]);
      if (m[5]) tokens.push(["plain", m[5]]);
      tokens.push(...yamlValue(m[6]));
      return { tokens };
    }
    const li = /^(\s*)(- )(.*)$/.exec(line);
    if (li) return { tokens: [["plain", li[1]], ["punct", li[2]], ...yamlValue(li[3])] };
    return { tokens: [["plain", line]] };
  });
}

export function highlight(code, language, prompt = true) {
  const text = String(code == null ? "" : code).replace(/\n$/, "");
  if (language === "shell" || language === "sh" || language === "bash") return shell(text, prompt);
  if (language === "dotenv" || language === "env") return dotenv(text);
  if (language === "json") return json(text);
  if (language === "yaml" || language === "yml") return yaml(text);
  return text.split("\n").map((line) => ({ tokens: [["plain", line]] }));
}

export function copyValue(code, language) {
  const text = String(code == null ? "" : code).replace(/\n$/, "");
  if (language !== "shell" && language !== "sh" && language !== "bash") return text;
  const lines = text.split("\n");
  if (!lines.some((l) => /^\$ /.test(l))) return text;
  const out = [];
  let continued = false;
  for (const l of lines) {
    if (/^\$ /.test(l)) {
      out.push(l.slice(2));
      continued = /\\\s*$/.test(l);
    } else if (continued) {
      out.push(l);
      continued = /\\\s*$/.test(l);
    }
  }
  return out.join("\n");
}
