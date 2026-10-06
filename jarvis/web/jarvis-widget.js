// Jarvis chat + contact widget for the portfolio site. No dependencies.
//
//   import { mountJarvis } from "/jarvis-widget.js";
//   mountJarvis(document.getElementById("jarvis"), { endpoint: "https://jarvis.example.com" });
//
// Model output is only ever assigned with textContent, never innerHTML.
// Theme it from the host page with the --jv-* custom properties below.

const STYLE = `
.jv{--jv-bg:#131312;--jv-fg:#f2efe6;--jv-dim:#8d8a80;--jv-line:#2a2a26;--jv-accent:#ff4a1c;
  font:14px/1.5 system-ui,sans-serif;color:var(--jv-fg);background:var(--jv-bg);
  border:1px solid var(--jv-line);border-radius:10px;display:flex;flex-direction:column;max-width:720px}
.jv-log{padding:12px;min-height:160px;max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:8px}
.jv-msg{max-width:88%;padding:8px 11px;border-radius:9px;white-space:pre-wrap;word-break:break-word}
.jv-u{align-self:flex-end;background:color-mix(in srgb,var(--jv-accent) 18%,var(--jv-bg))}
.jv-a{align-self:flex-start;border:1px solid var(--jv-line)}
.jv-row{display:flex;gap:7px;padding:9px;border-top:1px solid var(--jv-line)}
.jv input,.jv textarea{flex:1;min-width:0;background:transparent;color:inherit;border:1px solid var(--jv-line);
  border-radius:6px;padding:8px 10px;font:inherit}
.jv button{border:1px solid var(--jv-accent);background:var(--jv-accent);color:#0c0c0b;border-radius:6px;
  padding:8px 14px;font:inherit;font-weight:600;cursor:pointer}
.jv button:disabled{opacity:.5;cursor:default}
.jv-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 9px 9px}
.jv-chip{background:transparent!important;color:var(--jv-dim)!important;border:1px solid var(--jv-line)!important;
  border-radius:999px!important;padding:4px 10px!important;font-weight:400!important}
.jv-contact{border-top:1px solid var(--jv-line);padding:9px;display:grid;gap:7px}
.jv-contact label{display:flex;gap:8px;align-items:center;color:var(--jv-dim);font-size:13px}
.jv-contact input[type=checkbox]{flex:none;width:16px;height:16px;margin:0}
.jv-note{color:var(--jv-dim);font-size:12px;padding:0 9px 9px}
`;

const SUGGESTIONS = [
  "How did he price the acquisition pipeline?",
  "What is his strongest project?",
  "Is he a CFA charterholder?",
  "Why should we interview him?",
];

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

async function* readEvents(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      yield { event, data: data ? JSON.parse(data) : {} };
    }
  }
}

export function mountJarvis(root, { endpoint, suggestions = SUGGESTIONS, maxHistoryTurns = 6 } = {}) {
  if (!endpoint) throw new Error("mountJarvis: endpoint is required");
  const base = endpoint.replace(/\/$/, "");

  if (!document.getElementById("jv-style")) {
    const style = el("style", { id: "jv-style" });
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  const box = el("section", { class: "jv", "aria-label": "Ask Jarvis about Siddharth" });
  const log = el("div", { class: "jv-log", role: "log", "aria-live": "polite" });
  const form = el("form", { class: "jv-row" });
  const input = el("input", { type: "text", maxlength: "600", "aria-label": "Your question",
    placeholder: "Ask about his work…", autocomplete: "off" });
  const send = el("button", { type: "submit" }, "Ask");
  form.append(input, send);
  const chips = el("div", { class: "jv-chips" });
  const note = el("p", { class: "jv-note" },
    "Jarvis is an AI assistant answering from Siddharth's written brief. It can make mistakes.");
  box.append(log, form, chips, note, buildContact(base));
  root.replaceChildren(box);

  const history = [];
  let busy = false;

  function bubble(cls, text) {
    const node = el("div", { class: `jv-msg ${cls}` }, text);
    log.appendChild(node);
    log.scrollTop = log.scrollHeight;
    return node;
  }

  bubble("jv-a", "Hi, I'm Jarvis. Ask me anything about Siddharth's work and background.");

  for (const question of suggestions) {
    const chip = el("button", { type: "button", class: "jv-chip" }, question);
    chip.addEventListener("click", () => ask(question));
    chips.appendChild(chip);
  }

  async function ask(question) {
    question = question.trim();
    if (!question || busy) return;
    busy = true;
    send.disabled = true;
    input.value = "";
    bubble("jv-u", question);
    const out = bubble("jv-a", "…");
    let answer = "";
    try {
      const response = await fetch(`${base}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: history.slice(-maxHistoryTurns * 2) }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || `Request failed (${response.status})`);
      }
      for await (const { event, data } of readEvents(response)) {
        if (event === "delta") answer += data.text;
        else if (event === "reset") answer = "";
        else if (event === "refused" || event === "error") answer = data.text;
        out.textContent = answer || "…";
        log.scrollTop = log.scrollHeight;
      }
      history.push({ role: "user", content: question }, { role: "assistant", content: answer || "…" });
    } catch (error) {
      out.textContent = error.message || "Something went wrong. Please try again.";
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
  });

  return { ask };
}

function buildContact(base) {
  const form = el("form", { class: "jv-contact" });
  const name = el("input", { name: "name", required: "", maxlength: "120", placeholder: "Your name", autocomplete: "name" });
  const email = el("input", { name: "email", type: "email", required: "", maxlength: "254", placeholder: "Email", autocomplete: "email" });
  const org = el("input", { name: "organization", maxlength: "160", placeholder: "Company (optional)", autocomplete: "organization" });
  const message = el("textarea", { name: "message", maxlength: "2000", rows: "2", placeholder: "Message (optional)" });
  const consent = el("input", { type: "checkbox", required: "" });
  const consentLabel = el("label");
  consentLabel.append(consent, document.createTextNode("Siddharth may contact me at this address."));
  const submit = el("button", { type: "submit" }, "Leave your details");
  const status = el("p", { class: "jv-note", "aria-live": "polite" });
  form.append(el("strong", {}, "Want him to reach out?"), name, email, org, message, consentLabel, submit, status);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = "Sending…";
    try {
      const response = await fetch(`${base}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.value,
          email: email.value,
          organization: org.value || null,
          message: message.value || null,
          consent: consent.checked,
        }),
      });
      if (response.status === 201) {
        form.reset();
        status.textContent = "Received. Thank you.";
      } else {
        const detail = await response.json().catch(() => ({}));
        status.textContent = typeof detail.detail === "string" ? detail.detail : "Please check the form and try again.";
      }
    } catch {
      status.textContent = "Couldn't send. Please email siddharthbagga29@gmail.com instead.";
    } finally {
      submit.disabled = false;
    }
  });
  return form;
}
