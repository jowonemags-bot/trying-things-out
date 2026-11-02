const $ = s => document.querySelector(s);
const LABELS = { allergies: "Allergy", conditions: "Condition", meds: "Medication" };
let bid = "", bcode = "";   // the bracelet ID and code, kept only in memory while this page is open

/* ---------- form rows ---------- */
function addRow(kind, item = {}) {
  const hasNote = kind !== "meds";
  const d = document.createElement("div");
  d.className = "item";
  // Labels are fixed text; user data is set through .value below, never through innerHTML.
  d.innerHTML =
    `<label>${LABELS[kind]} (English)<input data-k="en"></label>` +
    `<label>${LABELS[kind]} (Filipino, optional)<input data-k="fil"></label>` +
    (hasNote
      ? `<label>What should responders know or do? (English)<input data-k="noteEn"></label>` +
        `<label>Same, in Filipino (optional)<input data-k="noteFil"></label>`
      : "") +
    `<button type="button" class="btn quiet rm">Remove</button>`;
  const set = (k, v) => { const e = d.querySelector(`[data-k="${k}"]`); if (e) e.value = v || ""; };
  set("en", item.en); set("fil", item.fil);
  if (hasNote) { set("noteEn", item.note && item.note.en); set("noteFil", item.note && item.note.fil); }
  $("#" + kind).append(d);
}

function collect(kind) {
  return [...document.querySelectorAll(`#${kind} .item`)].map(d => {
    const v = k => { const e = d.querySelector(`[data-k="${k}"]`); return e ? e.value.trim() : ""; };
    const o = { en: v("en"), fil: v("fil") };
    if (kind !== "meds") o.note = { en: v("noteEn"), fil: v("noteFil") };
    return o;
  }).filter(o => o.en);
}

const blank = () => ({ name: "", age: "", blood: "Unknown",
  contact: { name: "", rel: { en: "", fil: "" }, phone: "" }, allergies: [], conditions: [], meds: [] });

function fill(p) {
  const c = p.contact || {}, rel = c.rel || {};
  $("#name").value = p.name || "";
  $("#age").value = p.age || "";
  $("#blood").value = p.blood || "Unknown";
  $("#cname").value = c.name || "";
  $("#relEn").value = rel.en || "";
  $("#relFil").value = rel.fil || "";
  $("#phone").value = c.phone || "";
  ["allergies", "conditions", "meds"].forEach(k => {
    $("#" + k).innerHTML = "";
    (p[k] || []).forEach(item => addRow(k, item));
  });
}

/* ---------- messages ---------- */
function say(msg, ok) { const s = $("#status"); s.textContent = msg; s.className = ok ? "ok" : "err"; }
function loginSay(msg, ok) { const s = $("#loginStatus"); s.textContent = msg; s.className = ok ? "ok" : "err"; }
function reasonMsg(r) {
  if (r === "locked") return "Too many wrong tries. This bracelet is locked for 15 minutes.";
  if (r === "missing") return "We couldn't find a bracelet with that ID. Check the ID and try again.";
  if (r === "bad") return "That code doesn't match this bracelet.";
  return "Something went wrong. Please try again.";
}

/* ---------- screens ---------- */
function scanLink() { return new URL("index.html?id=" + encodeURIComponent(bid), location.href).href; }
function updateShare() {
  const on = !backend.demo && !!bid;
  $("#shareBox").hidden = !on;
  if (on) $("#shareLink").value = scanLink();
}
function showLock(msg) {
  bcode = "";
  $("#f").hidden = true; $("#login").hidden = false; $("#lock").hidden = true;
  $("#code").value = "";
  loginSay(msg || "", !msg);
}
function enter(data) {
  $("#login").hidden = true; $("#f").hidden = false;
  $("#lock").hidden = backend.demo;
  $("#reset").hidden = !backend.demo;
  fill(validProfile(data) ? data : blank());   // a bracelet not set up yet starts with a blank form
  updateShare();
}

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const add = e.target.closest("[data-add]");
  if (add) { addRow(add.dataset.add); return; }
  const rm = e.target.closest(".rm");
  if (rm) rm.closest(".item").remove();
});

$("#unlockForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("#bid").value.trim().toLowerCase(), code = $("#code").value;
  if (!id) return loginSay("Please enter the bracelet ID.", false);
  if (code.replace(/[^A-Za-z0-9]/g, "").length !== 12)
    return loginSay("The code has 12 letters and numbers, like ABCD-EFGH-JKMN.", false);
  const btn = e.submitter; if (btn) btn.disabled = true;
  loginSay("Checking…", true);
  try {
    const r = await backend.unlock(id, code);
    if (!r || !r.ok) loginSay(reasonMsg(r && r.reason), false);
    else { bid = id; bcode = code; loginSay("", true); enter(r.data); }
  } catch (err) { loginSay("Could not connect. Check your internet and try again.", false); }
  if (btn) btn.disabled = false;
});

$("#lock").addEventListener("click", () => location.reload());

$("#f").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("#name").value.trim(), cname = $("#cname").value.trim(), phone = $("#phone").value.trim();
  const digits = phone.replace(/\D/g, "");
  const age = $("#age").value ? Number($("#age").value) : "";
  if (!name) return say("Please enter your name.", false);
  if (age !== "" && (age < 0 || age > 120)) return say("Please enter a valid age.", false);
  if (!cname) return say("Please enter an emergency contact name.", false);
  if (digits.length < 7 || digits.length > 15) return say("Please enter a valid phone number for your contact.", false);

  const profile = {
    name, age, blood: $("#blood").value,
    updated: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    contact: { name: cname, rel: { en: $("#relEn").value.trim(), fil: $("#relFil").value.trim() }, phone },
    allergies: collect("allergies"), conditions: collect("conditions"), meds: collect("meds")
  };

  say("Saving…", true);
  try {
    const r = await backend.save(bid, bcode, profile);
    if (r && r.ok) say(backend.demo ? "Saved on this browser. Open the scan page to see your changes."
                                    : "Saved. Anyone who scans your bracelet now sees the updated profile.", true);
    else if (r && (r.reason === "bad" || r.reason === "locked")) showLock("Your code no longer works. " + reasonMsg(r.reason));
    else say("Could not save. Please try again.", false);
  } catch (err) { say("Could not save: " + ((err && err.message) || "unknown error"), false); }
});

$("#copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#shareLink").value); say("Link copied.", true); }
  catch (e) { $("#shareLink").select(); say("Press and hold the link to copy it.", true); }
});

$("#reset").addEventListener("click", () => {
  if (!confirm("Replace everything with the demo profile?")) return;
  backend.reset();
  backend.unlock().then(r => { fill(r.data); say("Demo profile restored.", true); });
});

/* ---------- start ---------- */
(async () => {
  $("#demoBanner").hidden = !backend.demo;
  const qid = new URLSearchParams(location.search).get("id");
  if (qid) $("#bid").value = qid;
  if (backend.demo) { bid = "demo"; const r = await backend.unlock(); enter(r.data); }
  else showLock("");
})();
