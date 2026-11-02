/* Aidly storage layer.
   - If config.js is filled in: each bracelet's profile lives in Supabase. Anyone with the bracelet
     link can READ it. Changing it needs the bracelet's edit code, which is checked on the server.
   - If not: DEMO MODE. Data is kept in this browser only and there is no code. */

const clone = o => JSON.parse(JSON.stringify(o));

const DEFAULT_PROFILE = {
  name: "Migi Santos", age: 31, blood: "O+", updated: "24 Oct 2026",
  contact: { name: "Ana Santos", rel: { en: "sister", fil: "kapatid" }, phone: "0917 000 0000" },
  allergies: [{ en: "Penicillin", fil: "Penicillin",
    note: { en: "Do not give penicillin-type antibiotics.", fil: "Huwag magbigay ng antibiotic na uri ng penicillin." } }],
  conditions: [{ en: "Asthma", fil: "Hika",
    note: { en: "May need a rescue inhaler. Check the bag.", fil: "Maaaring kailanganin ang inhaler. Tingnan ang bag." } }],
  meds: [{ en: "Rescue inhaler (salbutamol), as needed", fil: "Rescue inhaler (salbutamol), kung kinakailangan" }]
};

function validProfile(p) {
  return !!(p && typeof p === "object" && p.name && p.contact &&
    Array.isArray(p.allergies) && Array.isArray(p.conditions) && Array.isArray(p.meds));
}

const CONFIGURED = typeof SUPABASE_URL === "string" && typeof SUPABASE_KEY === "string" &&
  SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_") && !SUPABASE_KEY.includes("YOUR_");

/* ---------- Demo backend (this browser only) ---------- */
const LOCAL_KEY = "aidly.profile.v1";
function localRead() {
  try { const p = JSON.parse(localStorage.getItem(LOCAL_KEY)); if (validProfile(p)) return p; } catch (e) { /* use default */ }
  return clone(DEFAULT_PROFILE);
}
const localBackend = {
  demo: true,
  async publicProfile() { return localRead(); },
  async unlock() { return { ok: true, data: localRead() }; },
  async save(id, code, profile) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(profile)); } catch (e) { throw new Error("Your browser is blocking storage."); }
    return { ok: true };
  },
  reset() { try { localStorage.removeItem(LOCAL_KEY); } catch (e) { /* ignore */ } }
};

/* ---------- Supabase backend (the code is checked inside the database, not in this page) ---------- */
const sb = (CONFIGURED && typeof window !== "undefined" && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } }) : null;

async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw error;
  return data;
}
const supaBackend = {
  demo: false,
  // Public read of ONE profile by its ID. Returns null if the bracelet isn't set up yet.
  async publicProfile(id) { return id ? rpc("get_profile", { p_id: id }) : clone(DEFAULT_PROFILE); },
  // Returns { ok:true, data } or { ok:false, reason: "bad" | "locked" | "missing" }
  async unlock(id, code) { return rpc("unlock_bracelet", { p_id: id, p_code: code }); },
  async save(id, code, profile) { return rpc("save_bracelet", { p_id: id, p_code: code, p_data: profile }); }
};

const backend = sb ? supaBackend : localBackend;
