import { useState, useEffect, useMemo } from "react";

const STORAGE_KEY = "work_hours_data_v3";
const WAGE_KEY = "hourly_rate_v1";
const DEG = Math.PI / 180;
const THEME_KEY = "app_theme_v1";
const PREMIUM_RATE = 1.5;
const WAGE_PRESETS = [
  { label: "52.19", value: 52.19 },
  { label: "57.40", value: 57.40 },
  { label: "63.72", value: 63.72 },
  { label: "אחר", value: null },
];

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

// ── Jewish Holidays (fixed Gregorian approximations for 2024-2027) ────────────
// Each entry: { name, eve: [y,m,d], end: [y,m,d] } — eve=sunset that day, end=06:00 next morning
// We store the EVENING before the holiday starts (candle lighting) and the day it ends.
const JEWISH_HOLIDAYS_RAW = [
  // Rosh Hashana 5785: Oct 2-4, 2024 eve Oct 2
  { name: "ראש השנה", eve: [2024,10,2], endDay: [2024,10,4] },
  // Yom Kippur 5785: Oct 11-12, 2024
  { name: "יום כיפור", eve: [2024,10,11], endDay: [2024,10,12] },
  // Sukkot 5785: Oct 16-23, 2024 (first & last days premium)
  { name: "סוכות (א׳)", eve: [2024,10,16], endDay: [2024,10,17] },
  { name: "שמיני עצרת", eve: [2024,10,23], endDay: [2024,10,24] },
  // Pesach 5785: Apr 12-20, 2025
  { name: "פסח (א׳)", eve: [2025,4,12], endDay: [2025,4,13] },
  { name: "פסח (ז׳-ח׳)", eve: [2025,4,18], endDay: [2025,4,20] },
  // Shavuot 5785: Jun 1-3, 2025
  { name: "שבועות", eve: [2025,6,1], endDay: [2025,6,3] },
  // Rosh Hashana 5786: Sep 22-24, 2025
  { name: "ראש השנה", eve: [2025,9,22], endDay: [2025,9,24] },
  // Yom Kippur 5786: Oct 1-2, 2025
  { name: "יום כיפור", eve: [2025,10,1], endDay: [2025,10,2] },
  // Sukkot 5786: Oct 6-13, 2025
  { name: "סוכות (א׳)", eve: [2025,10,6], endDay: [2025,10,7] },
  { name: "שמיני עצרת", eve: [2025,10,13], endDay: [2025,10,14] },
  // Pesach 5786: Apr 1-9, 2026
  { name: "פסח (א׳)", eve: [2026,4,1], endDay: [2026,4,2] },
  { name: "פסח (ז׳-ח׳)", eve: [2026,4,7], endDay: [2026,4,9] },
  // Shavuot 5786: May 21-23, 2026
  { name: "שבועות", eve: [2026,5,21], endDay: [2026,5,23] },
  // Rosh Hashana 5787: Sep 11-13, 2026
  { name: "ראש השנה", eve: [2026,9,11], endDay: [2026,9,13] },
  // Yom Kippur 5787: Sep 20-21, 2026
  { name: "יום כיפור", eve: [2026,9,20], endDay: [2026,9,21] },
  // Sukkot 5787: Sep 25 - Oct 2, 2026
  { name: "סוכות (א׳)", eve: [2026,9,25], endDay: [2026,9,26] },
  { name: "שמיני עצרת", eve: [2026,10,2], endDay: [2026,10,3] },
  // Pesach 5787: Mar 21-29, 2027
  { name: "פסח (א׳)", eve: [2027,3,21], endDay: [2027,3,22] },
  { name: "פסח (ז׳-ח׳)", eve: [2027,3,27], endDay: [2027,3,29] },
  // Shavuot 5787: May 11-13, 2027
  { name: "שבועות", eve: [2027,5,11], endDay: [2027,5,13] },
];

const DARK = {
  bg:"#0F1117",card:"#1A1D2E",cardB:"#252840",cardAlt:"#13151F",
  inp:"#252840",inpB:"#334155",text:"#E2E8F0",textS:"#F1F5F9",
  textM:"#94A3B8",textF:"#64748B",textVF:"#475569",
  todayBg:"#1E2145",todayB:"#6366F1",nav:"#1E2130",exp:"#161827",
  evBg:"#1A1420",evB:"#2D1F40",modal:"#1A1D2E",modalB:"#2D2F4A",
  pre:"#13151F",cf:"#13151F",cr:"#1E2130",ct:"#334155",ch:"#E2E8F0",cm:"#94A3B8"
};
const LIGHT = {
  bg:"#F1F5F9",card:"#FFFFFF",cardB:"#E2E8F0",cardAlt:"#F8FAFC",
  inp:"#F1F5F9",inpB:"#CBD5E1",text:"#334155",textS:"#0F172A",
  textM:"#64748B",textF:"#94A3B8",textVF:"#CBD5E1",
  todayBg:"#EEF2FF",todayB:"#6366F1",nav:"#E2E8F0",exp:"#F8FAFC",
  evBg:"#F5F3FF",evB:"#C4B5FD",modal:"#FFFFFF",modalB:"#E2E8F0",
  pre:"#F1F5F9",cf:"#F8FAFC",cr:"#E2E8F0",ct:"#CBD5E1",ch:"#1E293B",cm:"#64748B"
};

// ── Sunset calculation (NOAA, Israel) ────────────────────────────────────────
function getSunsetIL(year, month, day) {
  const lat = 31.7683, lon = 35.2137;
  function calcJD(y, mo, d) {
    if (mo <= 2) { y -= 1; mo += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(mo+1)) + d + B - 1524.5;
  }
  const JD = calcJD(year, month, day);
  const T = (JD - 2451545.0) / 36525.0;
  const L0 = (280.46646 + T*(36000.76983 + T*0.0003032)) % 360;
  const M = (357.52911 + T*(35999.05029 - 0.0001537*T)) * DEG;
  const C = (1.914602 - T*(0.004817 + 0.000014*T))*Math.sin(M) + (0.019993 - 0.000101*T)*Math.sin(2*M) + 0.000289*Math.sin(3*M);
  const sunLon = (L0 + C) * DEG;
  const e = 0.016708634 - T*(0.000042037 + 0.0000001267*T);
  const eps = (23.439291111 - T*(0.013004167 + T*(0.00000164 - T*0.000000504))) * DEG;
  const dec = Math.asin(Math.sin(eps)*Math.sin(sunLon));
  const y2 = Math.tan(eps/2)**2, L0r = L0*DEG;
  const eqTime = (y2*Math.sin(2*L0r) - 2*e*Math.sin(M) + 4*e*y2*Math.sin(M)*Math.cos(2*L0r) - 0.5*y2*y2*Math.sin(4*L0r) - 1.25*e*e*Math.sin(2*M))*4*180/Math.PI;
  const cosHA = (Math.cos(90.833*DEG) - Math.sin(lat*DEG)*Math.sin(dec)) / (Math.cos(lat*DEG)*Math.cos(dec));
  const HAdeg = Math.acos(cosHA)*180/Math.PI;
  const sunsetUTC = (720 - 4*lon - eqTime)/60 + HAdeg*4/60;
  const dateObj = new Date(year, month-1, day);
  const lsm = new Date(year,2,31); lsm.setDate(31-lsm.getDay());
  const lso = new Date(year,9,31); lso.setDate(31-lso.getDay());
  const isDST = dateObj >= lsm && dateObj < lso;
  const local = sunsetUTC + (isDST ? 3 : 2);
  return { h: Math.floor(local), m: Math.round((local - Math.floor(local))*60) };
}

// Build holiday premium windows: [start_ms, end_ms, name]
function buildHolidayWindows() {
  return JEWISH_HOLIDAYS_RAW.map(h => {
    const [ey, em, ed] = h.eve;
    const [dy, dm, dd] = h.endDay;
    const sunset = getSunsetIL(ey, em, ed);
    const start = new Date(ey, em-1, ed, sunset.h, sunset.m, 0, 0).getTime();
    const endDate = new Date(dy, dm-1, dd);
    endDate.setDate(endDate.getDate() + 1); // day after
    endDate.setHours(6, 0, 0, 0);
    return { start, end: endDate.getTime(), name: h.name };
  });
}
const HOLIDAY_WINDOWS = buildHolidayWindows();

// Build list of holiday EVE sunset timestamps (candle lighting times) — sessions starting
// before these on an eve day should split here (regular → premium)
function buildHolidayEveSunsets() {
  return JEWISH_HOLIDAYS_RAW.map(h => {
    const [ey, em, ed] = h.eve;
    const sunset = getSunsetIL(ey, em, ed);
    return new Date(ey, em-1, ed, sunset.h, sunset.m, 0, 0).getTime();
  });
}
const HOLIDAY_EVE_SUNSETS = buildHolidayEveSunsets();

// ── Premium window check: shabbat + holidays ─────────────────────────────────
function getShabbatWindow(dateTs) {
  const fd = new Date(dateTs); fd.setHours(0,0,0,0);
  while (fd.getDay() !== 5) fd.setDate(fd.getDate() + (fd.getDay() < 5 ? 5-fd.getDay() : 7-(fd.getDay()-5)));
  const s = getSunsetIL(fd.getFullYear(), fd.getMonth()+1, fd.getDate());
  const start = new Date(fd); start.setHours(s.h, s.m, 0, 0);
  const end = new Date(fd); end.setDate(fd.getDate()+2); end.setHours(6,0,0,0);
  return { start: start.getTime(), end: end.getTime() };
}

// Returns true if a timestamp falls inside any premium window (shabbat or holiday)
function isInPremiumWindow(ts) {
  const sw = getShabbatWindow(ts);
  if (ts >= sw.start && ts < sw.end) return true;
  for (const hw of HOLIDAY_WINDOWS) {
    if (ts >= hw.start && ts < hw.end) return true;
  }
  return false;
}

// Returns the earliest premium boundary that starts DURING [startTs, endTs], or null
// Includes: shabbat start (Friday sunset), holiday windows start, and holiday eve sunsets
function getNextPremiumStart(startTs, endTs) {
  const candidates = [];
  const sw = getShabbatWindow(startTs);
  if (sw.start > startTs && sw.start < endTs) candidates.push(sw.start);
  for (const hw of HOLIDAY_WINDOWS) {
    if (hw.start > startTs && hw.start < endTs) candidates.push(hw.start);
  }
  // Holiday eve sunsets (candle lighting) — same split logic as Friday sunset
  for (const eveSunset of HOLIDAY_EVE_SUNSETS) {
    if (eveSunset > startTs && eveSunset < endTs) candidates.push(eveSunset);
  }
  return candidates.length ? Math.min(...candidates) : null;
}

// Split a session into {regularMs, premiumMs}
// - Started inside premium window → all premium
// - Started before premium (e.g. Friday before sunset) but crosses into it → split at boundary
// - No premium window in session → all regular
function splitSession(startTs, endTs) {
  const totalMs = endTs - startTs;
  if (isInPremiumWindow(startTs)) {
    return { regularMs: 0, premiumMs: totalMs };
  }
  const premiumStart = getNextPremiumStart(startTs, endTs);
  if (premiumStart !== null) {
    return { regularMs: premiumStart - startTs, premiumMs: endTs - premiumStart };
  }
  return { regularMs: totalMs, premiumMs: 0 };
}

// Check if a timestamp is in a holiday (for label)
function getHolidayName(ts) {
  for (const hw of HOLIDAY_WINDOWS) { if (ts >= hw.start && ts < hw.end) return hw.name; }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ms) {
  if (!ms || ms <= 0) return "0:00";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return `${h}:${m.toString().padStart(2,"0")}`;
}
function formatMoney(n) {
  const str = n.toFixed(2);
  const dot = str.indexOf(".");
  const intPart = str.slice(0, dot);
  const decPart = str.slice(dot);
  let result = "";
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 === 0) result += ",";
    result += intPart[i];
  }
  return "₪" + result + decPart;
}
function formatClock(d) { return d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
function getDayKey(d) { return `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function getDaysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }

function calcEarnings(sessions, activeStart=null, hourlyRate=52.19) {
  let regularMs=0, premiumMs=0;
  const all = [...(sessions||[])];
  if (activeStart) all.push({start:activeStart, end:Date.now()});
  for (const s of all) { const sp=splitSession(s.start,s.end); regularMs+=sp.regularMs; premiumMs+=sp.premiumMs; }
  const regularEarnings = (regularMs/3600000)*hourlyRate;
  const premiumEarnings = (premiumMs/3600000)*hourlyRate*PREMIUM_RATE;
  return {
    regularMs, premiumMs, totalMs: regularMs+premiumMs,
    regularEarnings, premiumEarnings, total: regularEarnings + premiumEarnings
  };
}

// ── Manual Entry Modal ────────────────────────────────────────────────────────
function ManualEntryModal({ targetDate, existingSessions, onSave, onClose, hourlyRate=52.19, T=DARK }) {
  const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,"0")}-${String(targetDate.getDate()).padStart(2,"0")}`;
  const [sessions, setSessions] = useState(
    existingSessions?.length
      ? existingSessions.map(s => ({
          startStr: new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}).replace(".",":"),
          endStr: new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}).replace(".",":"),
        }))
      : [{ startStr: "09:00", endStr: "17:00" }]
  );

  function parseTime(dateStr, timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const d = new Date(dateStr + "T00:00:00");
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }

  function handleSave() {
    const parsed = sessions.map(s => ({
      start: parseTime(dateStr, s.startStr),
      end: parseTime(dateStr, s.endStr),
    })).filter(s => s.start && s.end && s.end > s.start);
    if (!parsed.length) return;
    onSave(parsed);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
      <div style={{ background:T.modal, borderRadius:20, padding:24, width:"100%", maxWidth:380, border:`1px solid ${T.modalB}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontWeight:700, fontSize:17, color:T.textS }}>
            הזנה ידנית — {targetDate.getDate()} {MONTH_NAMES[targetDate.getMonth()]}
          </span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.textF, fontSize:22, cursor:"pointer" }}>✕</button>
        </div>

        {sessions.map((s, i) => (
          <div key={i} style={{ display:"flex", gap:10, alignItems:"center", marginBottom:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:T.textF, marginBottom:4 }}>כניסה</div>
              <input type="time" value={s.startStr} onChange={e => setSessions(prev => prev.map((x,j) => j===i ? {...x, startStr:e.target.value} : x))}
                style={{ width:"100%", background:T.inp, border:`1px solid ${T.inpB}`, borderRadius:8, padding:"10px 12px", color:T.textS, fontSize:16, outline:"none" }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:T.textF, marginBottom:4 }}>יציאה</div>
              <input type="time" value={s.endStr} onChange={e => setSessions(prev => prev.map((x,j) => j===i ? {...x, endStr:e.target.value} : x))}
                style={{ width:"100%", background:T.inp, border:`1px solid ${T.inpB}`, borderRadius:8, padding:"10px 12px", color:T.textS, fontSize:16, outline:"none" }} />
            </div>
            {sessions.length > 1 && (
              <button onClick={() => setSessions(prev => prev.filter((_,j) => j!==i))}
                style={{ background:"none", border:"none", color:"#EF4444", fontSize:20, cursor:"pointer", marginTop:16 }}>✕</button>
            )}
          </div>
        ))}

        <button onClick={() => setSessions(prev => [...prev, { startStr:"09:00", endStr:"17:00" }])}
          style={{ width:"100%", padding:"9px", background:T.inp, border:`1px dashed ${T.inpB}`, borderRadius:10, color:T.textM, cursor:"pointer", fontSize:14, marginBottom:16 }}>
          + הוסף סשן נוסף
        </button>

        {/* Preview */}
        {sessions.length > 0 && (() => {
          const parsed = sessions.map(s => ({ start: parseTime(dateStr, s.startStr), end: parseTime(dateStr, s.endStr) })).filter(s => s.start && s.end && s.end > s.start);
          if (!parsed.length) return null;
          const earn = calcEarnings(parsed, null, hourlyRate);
          return (
            <div style={{ background:T.pre, borderRadius:10, padding:"12px 14px", marginBottom:16, display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:T.textF, fontSize:13 }}>סה"כ: <span style={{ color:"#6366F1", fontWeight:700 }}>{formatTime(earn.totalMs)}</span></span>
              <span style={{ color:"#F59E0B", fontWeight:700, fontSize:15 }}>{formatMoney(earn.total)}</span>
            </div>
          );
        })()}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"12px", background:T.inp, border:"none", borderRadius:12, color:T.textM, cursor:"pointer", fontWeight:600, fontSize:15 }}>ביטול</button>
          <button onClick={handleSave} style={{ flex:2, padding:"12px", background:"#6366F1", border:"none", borderRadius:12, color:"#fff", cursor:"pointer", fontWeight:700, fontSize:15 }}>שמור</button>
        </div>
      </div>
    </div>
  );
}

// ── Wage Selector Modal ───────────────────────────────────────────────────────
function WageModal({ currentRate, onSave, onClose, T=DARK }) {
  const preset = WAGE_PRESETS.find(p => p.value === currentRate);
  const [selected, setSelected] = useState(preset ? preset.value : null);
  const [customVal, setCustomVal] = useState(preset ? "" : String(currentRate));

  function handleSave() {
    const rate = selected !== null ? selected : parseFloat(customVal.replace(",","."));
    if (!rate || isNaN(rate) || rate <= 0) return;
    onSave(rate);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
      <div style={{ background:T.modal, borderRadius:20, padding:24, width:"100%", maxWidth:360, border:`1px solid ${T.modalB}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontWeight:700, fontSize:17, color:T.textS }}>תעריף שעתי</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.textF, fontSize:22, cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {WAGE_PRESETS.map(p => (
            <button key={p.label} onClick={() => { setSelected(p.value); if (p.value) setCustomVal(""); }}
              style={{
                padding:"14px 18px", borderRadius:12, border:"none", cursor:"pointer", textAlign:"right",
                background: (p.value !== null ? selected === p.value : selected === null) ? "#6366F1" : T.inp,
                color: (p.value !== null ? selected === p.value : selected === null) ? "#fff" : T.textM,
                fontWeight:700, fontSize:16, display:"flex", justifyContent:"space-between", alignItems:"center"
              }}>
              <span>{p.value ? `₪${p.label}` : p.label}</span>
              {(p.value !== null ? selected === p.value : selected === null) && <span>✓</span>}
            </button>
          ))}
        </div>

        {selected === null && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, color:T.textF, marginBottom:6 }}>הזן תעריף ידנית</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"#F59E0B", fontWeight:700, fontSize:18 }}>₪</span>
              <input
                type="number" step="0.01" min="0" value={customVal}
                onChange={e => setCustomVal(e.target.value)}
                placeholder="0.00"
                style={{ flex:1, background:T.inp, border:`1px solid ${T.inpB}`, borderRadius:8, padding:"12px", color:T.textS, fontSize:18, outline:"none" }}
                autoFocus
              />
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"12px", background:T.inp, border:"none", borderRadius:12, color:T.textM, cursor:"pointer", fontWeight:600, fontSize:15 }}>ביטול</button>
          <button onClick={handleSave} style={{ flex:2, padding:"12px", background:"#6366F1", border:"none", borderRadius:12, color:"#fff", cursor:"pointer", fontWeight:700, fontSize:15 }}>שמור</button>
        </div>
      </div>
    </div>
  );
}

// ── PWA Install Banner ────────────────────────────────────────────────────────
function PWABanner({ onDismiss }) {
  return (
    <div style={{ width:"100%", maxWidth:480, margin:"0 auto", background:"linear-gradient(135deg,#1E2145,#252840)", border:"1px solid #6366F1", borderRadius:14, padding:"14px 16px", marginBottom:16, display:"flex", gap:12, alignItems:"flex-start" }}>
      <span style={{ fontSize:28 }}>📱</span>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:14, color:"#F1F5F9", marginBottom:4 }}>הוסף למסך הבית</div>
        <div style={{ fontSize:12, color:"#94A3B8", lineHeight:1.5 }}>
          בכרום: תפריט ⋮ ← <strong style={{color:"#C4B5FD"}}>"הוסף למסך הבית"</strong><br/>
          האפליקציה תיפתח במסך מלא, בלי שורת כתובות.
        </div>
      </div>
      <button onClick={onDismiss} style={{ background:"none", border:"none", color:"#475569", fontSize:18, cursor:"pointer", padding:0 }}>✕</button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function WorkHoursTracker() {
  const [now, setNow] = useState(new Date());
  const [view, setView] = useState("clock");
  const [expandedDay, setExpandedDay] = useState(null);
  const [manualEntry, setManualEntry] = useState(null);
  const [showWage, setShowWage] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(() => {
    const saved = parseFloat(localStorage.getItem(WAGE_KEY));
    return (!isNaN(saved) && saved > 0) ? saved : 52.19;
  });
  const [showPWA, setShowPWA] = useState(() => localStorage.getItem("pwa_dismissed") !== "1");
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const T = theme === "dark" ? DARK : LIGHT;
  const [data, setData] = useState(() => { try { const s=localStorage.getItem(STORAGE_KEY); return s?JSON.parse(s):{}; } catch { return {}; } });
  const [summaryMonth, setSummaryMonth] = useState(() => { const d=new Date(); return {year:d.getFullYear(),month:d.getMonth()}; });

  useEffect(() => { const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); },[]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} }, [data]);
  useEffect(() => { try { localStorage.setItem(WAGE_KEY, String(hourlyRate)); } catch {} }, [hourlyRate]);
  useEffect(() => { try { localStorage.setItem(THEME_KEY, theme); } catch {} }, [theme]);

  const todayKey = getDayKey(now);
  const todayData = data[todayKey] || { sessions:[], active:null };
  const isCheckedIn = !!todayData.active;
  const todayEarnings = useMemo(() => calcEarnings(todayData.sessions, todayData.active, hourlyRate), [todayData, now, hourlyRate]);

  // Next upcoming premium event (shabbat or holiday)
  const nextPremiumEvent = useMemo(() => {
    const ts = now.getTime();
    const candidates = [];
    // Next shabbat
    const fd = new Date(now); fd.setHours(0,0,0,0);
    while (fd.getDay() !== 5) fd.setDate(fd.getDate()+1);
    const sw = getShabbatWindow(fd.getTime());
    if (sw.start > ts) candidates.push({ name:"שבת", start:sw.start });
    // Upcoming holidays
    for (const hw of HOLIDAY_WINDOWS) { if (hw.start > ts) candidates.push({ name:hw.name, start:hw.start }); }
    candidates.sort((a,b)=>a.start-b.start);
    if (!candidates.length) return null;
    const next = candidates[0];
    const d = new Date(next.start);
    return { name:next.name, label:`${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}` };
  }, [now]);

  function handleCheckIn() {
    setData(prev => { const e=prev[todayKey]||{sessions:[],active:null}; if(e.active)return prev; return {...prev,[todayKey]:{...e,active:Date.now()}}; });
  }
  function handleCheckOut() {
    setData(prev => { const e=prev[todayKey]; if(!e?.active)return prev; return {...prev,[todayKey]:{sessions:[...(e.sessions||[]),{start:e.active,end:Date.now()}],active:null}}; });
  }
  function handleManualSave(date, sessions) {
    const key = getDayKey(date);
    setData(prev => ({ ...prev, [key]: { sessions, active: null } }));
    setManualEntry(null);
  }

  // Summary
  const { year, month } = summaryMonth;
  const daysInMonth = getDaysInMonth(year, month);
  const days = useMemo(() => Array.from({length:daysInMonth},(_,i)=>{
    const d=new Date(year,month,i+1), key=getDayKey(d), entry=data[key];
    const earnings=entry?calcEarnings(entry.sessions,entry.active,hourlyRate):{regularMs:0,premiumMs:0,totalMs:0,regularEarnings:0,premiumEarnings:0,total:0};
    return {date:d,key,earnings,entry};
  }), [data,year,month,daysInMonth]);

  const monthTotals = useMemo(() => days.reduce((a,d)=>({
    totalMs:a.totalMs+d.earnings.totalMs, premiumMs:a.premiumMs+d.earnings.premiumMs,
    total:a.total+d.earnings.total, regularEarnings:a.regularEarnings+d.earnings.regularEarnings,
    premiumEarnings:a.premiumEarnings+d.earnings.premiumEarnings,
  }),{totalMs:0,premiumMs:0,total:0,regularEarnings:0,premiumEarnings:0}),[days]);

  const maxDayMs = Math.max(...days.map(d=>d.earnings.totalMs), 1);

  const secDeg=now.getSeconds()*6, minDeg=now.getMinutes()*6+now.getSeconds()*0.1, hourDeg=(now.getHours()%12)*30+now.getMinutes()*0.5;

  const S = { card:{background:T.card,borderRadius:16,border:`1px solid ${T.cardB}`}, label:{fontSize:11,color:T.textF,marginTop:4}, gold:"#F59E0B", purple:"#6366F1", green:"#22C55E", red:"#EF4444", violet:"#A78BFA" };

  const todayHoliday = getHolidayName(now.getTime());

  const handleSwipeStart = (e) => {
    e.currentTarget._tx = e.touches[0].clientX;
    e.currentTarget._ty = e.touches[0].clientY;
    e.currentTarget._moved = false;
  };
  const handleSwipeMove = (e) => {
    const dx = e.touches[0].clientX - (e.currentTarget._tx || 0);
    const dy = e.touches[0].clientY - (e.currentTarget._ty || 0);
    if (!e.currentTarget._moved && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      e.currentTarget._moved = true;
    }
  };
  const handleSwipeEnd = (e) => {
    if (!e.currentTarget._moved) return;
    const dx = e.changedTouches[0].clientX - (e.currentTarget._tx || 0);
    if (Math.abs(dx) > 50) {
      setView(dx < 0 ? "summary" : "clock");
    }
    e.currentTarget._moved = false;
  };

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Segoe UI',system-ui,sans-serif",direction:"rtl",display:"flex",flexDirection:"column",alignItems:"center"}}>

      {manualEntry && (
        <ManualEntryModal
          targetDate={manualEntry.date}
          existingSessions={data[getDayKey(manualEntry.date)]?.sessions}
          onSave={sessions => handleManualSave(manualEntry.date, sessions)}
          onClose={() => setManualEntry(null)}
          hourlyRate={hourlyRate}
          T={T}
        />
      )}

      {showWage && (
        <WageModal
          currentRate={hourlyRate}
          onSave={rate => { setHourlyRate(rate); setShowWage(false); }}
          onClose={() => setShowWage(false)}
          T={T}
        />
      )}

      {/* Header */}
      <div style={{width:"100%",maxWidth:480,padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20,fontWeight:700,color:"#F1F5F9"}}>מעקב שעות</span>
          <button onClick={()=>setShowWage(true)} style={{background:T.card,border:`1px solid ${T.inpB}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:12,color:S.gold,fontWeight:700}}>₪{hourlyRate.toFixed(2)}</span>
            <span style={{fontSize:11,color:"#475569"}}>✎</span>
          </button>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} style={{background:T.nav,border:`1px solid ${T.cardB}`,borderRadius:20,padding:"7px 10px",cursor:"pointer",fontSize:16,lineHeight:1,color:T.textM}}>{theme==="dark"?"☀️":"🌙"}</button>
          {["clock","summary"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"7px 16px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,background:view===v?S.purple:T.nav,color:view===v?"#fff":T.textM}}>
              {v==="clock"?"שעון":"סיכום"}
            </button>
          ))}
        </div>
      </div>

      <div style={{width:"100%",overflow:"hidden",flex:1}} onTouchStart={handleSwipeStart} onTouchMove={handleSwipeMove} onTouchEnd={handleSwipeEnd}>
        <div style={{display:"flex",width:"200%",transform:view==="clock"?"translateX(0)":"translateX(-50%)",transition:"transform 0.35s cubic-bezier(0.4,0,0.2,1)"}}>
          <div style={{width:"50%",flexShrink:0}}>
            <div style={{maxWidth:480,margin:"0 auto",padding:"22px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>

          {showPWA && <PWABanner onDismiss={()=>{ setShowPWA(false); localStorage.setItem("pwa_dismissed","1"); }} />}

          {/* Analog Clock */}
          <svg width="180" height="180" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="96" fill="none" stroke={T.cr} strokeWidth="8"/>
            <circle cx="100" cy="100" r="90" fill={T.cf}/>
            {Array.from({length:12},(_,i)=>{ const a=(i*30-90)*DEG; return <line key={i} x1={100+75*Math.cos(a)} y1={100+75*Math.sin(a)} x2={100+83*Math.cos(a)} y2={100+83*Math.sin(a)} stroke={T.ct} strokeWidth={i%3===0?3:1.5} strokeLinecap="round"/>; })}
            <line x1="100" y1="100" x2={100+50*Math.cos((hourDeg-90)*DEG)} y2={100+50*Math.sin((hourDeg-90)*DEG)} stroke={T.ch} strokeWidth="4" strokeLinecap="round"/>
            <line x1="100" y1="100" x2={100+68*Math.cos((minDeg-90)*DEG)} y2={100+68*Math.sin((minDeg-90)*DEG)} stroke={T.cm} strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="100" y1="100" x2={100+72*Math.cos((secDeg-90)*DEG)} y2={100+72*Math.sin((secDeg-90)*DEG)} stroke={S.purple} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="100" cy="100" r="4" fill={S.purple}/>
          </svg>

          <div style={{textAlign:"center"}}>
            <div style={{fontSize:38,fontWeight:300,letterSpacing:2,color:T.textS,fontVariantNumeric:"tabular-nums"}}>{formatClock(now)}</div>
            <div style={{fontSize:14,color:"#64748B",marginTop:3}}>
              {DAY_NAMES[now.getDay()]} · {now.getDate()} {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}
              {todayHoliday && <span style={{color:S.violet,marginRight:8}}>· {todayHoliday} ✦</span>}
            </div>
          </div>

          {/* Stats */}
          <div style={{...S.card,padding:"16px 12px",width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
            {[
              {val:formatTime(todayEarnings.totalMs),label:'סה"כ היום',color:isCheckedIn?S.green:"#E2E8F0"},
              {val:formatMoney(todayEarnings.total),label:"הרווחת היום",color:S.gold},
              {val:formatTime(todayEarnings.premiumMs),label:"שעות ×1.5",color:todayEarnings.premiumMs>0?S.violet:"#334155"},
              {val:formatMoney(todayEarnings.premiumEarnings),label:"בונוס",color:todayEarnings.premiumEarnings>0?S.gold:"#334155"},
            ].map((item,i)=>(
              <div key={i} style={{textAlign:"center"}}>
                <div style={{fontSize:15,fontWeight:700,color:item.color,fontVariantNumeric:"tabular-nums"}}>{item.val}</div>
                <div style={S.label}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Next premium event */}
          {nextPremiumEvent && (
            <div style={{width:"100%",background:T.evBg,borderRadius:10,padding:"10px 16px",border:`1px solid ${T.evB}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,color:T.textM}}>הבא: {nextPremiumEvent.name}</span>
              <span style={{fontSize:13,fontWeight:700,color:S.violet}}>{nextPremiumEvent.label}</span>
            </div>
          )}

          {/* Check in/out button */}
          <button onClick={isCheckedIn?handleCheckOut:handleCheckIn} style={{
            width:160,height:160,borderRadius:"50%",
            border:`3px solid ${isCheckedIn?S.red:S.green}`,
            background:isCheckedIn?"radial-gradient(circle at 40% 40%,#3D1515,#1A0A0A)":"radial-gradient(circle at 40% 40%,#0F3D1E,#0A1A10)",
            cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,
            boxShadow:isCheckedIn?"0 0 40px rgba(239,68,68,0.25)":"0 0 40px rgba(34,197,94,0.25)",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isCheckedIn?S.red:S.green} strokeWidth="2" strokeLinecap="round">
              {isCheckedIn?<rect x="6" y="6" width="12" height="12" rx="2"/>:<polygon points="5,3 19,12 5,21"/>}
            </svg>
            <span style={{fontSize:18,fontWeight:700,color:isCheckedIn?S.red:S.green}}>{isCheckedIn?"יציאה":"כניסה"}</span>
            {isCheckedIn&&<span style={{fontSize:11,color:"#64748B"}}>מאז {new Date(todayData.active).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</span>}
          </button>

          {/* Manual entry for today */}
          <button onClick={()=>setManualEntry({date:new Date()})} style={{background:T.card,border:`1px solid ${T.inpB}`,borderRadius:12,padding:"10px 20px",color:T.textM,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",gap:8}}>
            <span>✏️</span> הזן שעות ידנית להיום
          </button>

          {/* Sessions today */}
          {(todayData.sessions?.length>0||todayData.active) && (
            <div style={{width:"100%"}}>
              <div style={{fontSize:13,color:T.textF,marginBottom:8,fontWeight:600}}>סשנים היום</div>
              {[...(todayData.sessions||[]),...(todayData.active?[{start:todayData.active,end:Date.now(),live:true}]:[])].map((s,i)=>{
                const sp=splitSession(s.start,s.end);
                const earn=(sp.regularMs/3600000)*hourlyRate+(sp.premiumMs/3600000)*hourlyRate*PREMIUM_RATE;
                const mid=(s.start+s.end)/2; const hol=getHolidayName(s.start)||getHolidayName(mid);
                return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",...S.card,borderRadius:10,marginBottom:6,fontSize:13}}>
                    <span style={{color:T.textM}}>
                      {new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})} → {s.live?<span style={{color:S.green}}>עכשיו</span>:new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}
                      {sp.premiumMs>0&&<span style={{color:S.violet,marginRight:6,fontSize:11}}>✦ {hol||"שבת"}</span>}
                    </span>
                    <div><span style={{color:S.purple,fontWeight:700,marginLeft:10}}>{formatTime(s.end-s.start)}</span><span style={{color:S.gold,fontWeight:600}}>{formatMoney(earn)}</span></div>
                  </div>
                );
              })}
            </div>
          )}
            </div>
          </div>
          </div>
          <div style={{width:"50%",flexShrink:0}}>
            <div style={{maxWidth:480,margin:"0 auto",padding:"24px 20px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <button onClick={()=>setSummaryMonth(p=>{const d=new Date(p.year,p.month-1,1);return{year:d.getFullYear(),month:d.getMonth()};})} style={{background:T.card,border:`1px solid ${T.cardB}`,color:T.textM,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:18}}>›</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:700,color:T.textS}}>{MONTH_NAMES[month]} {year}</div>
              <div style={{fontSize:15,color:S.gold,fontWeight:700,marginTop:2}}>{formatMoney(monthTotals.total)}</div>
              {(year!==new Date().getFullYear()||month!==new Date().getMonth())&&(<button onClick={()=>{const d=new Date();setSummaryMonth({year:d.getFullYear(),month:d.getMonth()});}} style={{marginTop:6,background:S.purple,border:"none",borderRadius:12,padding:"3px 12px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>היום ↩</button>)}
            </div>
            <button onClick={()=>setSummaryMonth(p=>{const d=new Date(p.year,p.month+1,1);return{year:d.getFullYear(),month:d.getMonth()};})} style={{background:T.card,border:`1px solid ${T.cardB}`,color:T.textM,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:18}}>‹</button>
          </div>

          {/* Month totals */}
          <div style={{...S.card,padding:"14px",marginBottom:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,textAlign:"center",background:T.card,border:`1px solid ${T.cardB}`}}>
            <div><div style={{fontSize:19,fontWeight:700,color:S.purple}}>{formatTime(monthTotals.totalMs)}</div><div style={S.label}>שעות עבודה</div></div>
            <div><div style={{fontSize:19,fontWeight:700,color:S.gold}}>{formatMoney(monthTotals.regularEarnings)}</div><div style={S.label}>שכר רגיל</div></div>
            <div><div style={{fontSize:19,fontWeight:700,color:S.violet}}>{formatMoney(monthTotals.premiumEarnings)}</div><div style={S.label}>בונוס ×1.5</div></div>
          </div>

          {/* Days */}
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {days.map(({date,earnings,entry})=>{
              const isToday=getDayKey(date)===getDayKey(new Date());
              const isWeekend=date.getDay()===5||date.getDay()===6;
              const pct=earnings.totalMs/maxDayMs;
              const isExp=expandedDay===getDayKey(date);
              const hasPremium=earnings.premiumMs>0;
              // Check if this date is a holiday eve or holiday
              const holidayToday=JEWISH_HOLIDAYS_RAW.find(h=>{
                const [ey,em,ed]=h.eve;
                return ey===date.getFullYear()&&em===date.getMonth()+1&&ed===date.getDate();
              });

              return (
                <div key={date.getDate()}>
                  <div onClick={()=>earnings.totalMs>0?setExpandedDay(isExp?null:getDayKey(date)):setManualEntry({date})}
                    style={{...S.card,borderRadius:12,padding:"11px 14px",border:isToday?`1px solid ${T.todayB}`:`1px solid ${T.cardB}`,background:isToday?T.todayBg:T.card,position:"relative",overflow:"hidden",cursor:"pointer"}}>
                    {earnings.totalMs>0&&<div style={{position:"absolute",right:0,top:0,bottom:0,width:`${pct*100}%`,background:hasPremium?"linear-gradient(90deg,transparent,rgba(167,139,250,0.08))":"linear-gradient(90deg,transparent,rgba(99,102,241,0.08))",pointerEvents:"none"}}/>}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:34,height:34,borderRadius:9,background:isToday?S.purple:T.nav,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <span style={{fontSize:14,fontWeight:700,color:isToday?"#fff":isWeekend?T.textVF:T.textM}}>{date.getDate()}</span>
                        </div>
                        <div>
                          <div style={{fontSize:13,color:isWeekend?T.textVF:T.textM,fontWeight:500,display:"flex",alignItems:"center",gap:5}}>
                            {DAY_NAMES[date.getDay()]}
                            {isToday&&<span style={{color:S.purple,fontSize:10}}>היום</span>}
                            {holidayToday&&<span style={{color:S.violet,fontSize:10}}>✦ {holidayToday.name}</span>}
                            {!holidayToday&&hasPremium&&<span style={{color:S.violet,fontSize:10}}>✦</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {earnings.totalMs>0?(
                          <>
                            <span style={{fontSize:12,color:"#64748B",fontVariantNumeric:"tabular-nums"}}>{formatTime(earnings.totalMs)}</span>
                            <span style={{fontSize:15,fontWeight:700,color:S.gold}}>{formatMoney(earnings.total)}</span>
                            <span style={{fontSize:11,color:"#475569"}}>{isExp?"▲":"▼"}</span>
                          </>
                        ):(
                          <span style={{fontSize:12,color:"#475569",display:"flex",alignItems:"center",gap:4}}>
                            {isWeekend?"סופ״ש":"—"} <span style={{color:"#334155",fontSize:11}}>✏️</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExp&&entry&&(
                    <div style={{...S.card,borderRadius:"0 0 12px 12px",padding:"12px 14px",borderTop:"none",background:T.exp,marginTop:-4}}>
                      {[...(entry.sessions||[]),...(entry.active?[{start:entry.active,end:Date.now(),live:true}]:[])].map((s,i)=>{
                        const sp=splitSession(s.start,s.end);
                        const earn=(sp.regularMs/3600000)*hourlyRate+(sp.premiumMs/3600000)*hourlyRate*PREMIUM_RATE;
                        return (
                          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.cardB}`,fontSize:12}}>
                            <span style={{color:"#64748B"}}>
                              {new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})} → {s.live?"עכשיו":new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}
                              {sp.premiumMs>0&&<span style={{color:S.violet,marginRight:4}}> ✦ {formatTime(sp.premiumMs)}</span>}
                            </span>
                            <div><span style={{color:S.purple,marginLeft:8}}>{formatTime(s.end-s.start)}</span><span style={{color:S.gold,fontWeight:600}}>{formatMoney(earn)}</span></div>
                          </div>
                        );
                      })}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,fontSize:12}}>
                        <button onClick={()=>setManualEntry({date})} style={{background:"none",border:"none",color:"#6366F1",cursor:"pointer",fontSize:12,padding:0}}>✏️ עריכה</button>
                        <div style={{color:T.textF}}>
                          רגיל: <span style={{color:S.gold}}>{formatMoney(earnings.regularEarnings)}</span>
                          {earnings.premiumMs>0&&<> · ×1.5: <span style={{color:S.violet}}>{formatMoney(earnings.premiumEarnings)}</span></>}
                        </div>
                        <span style={{color:S.gold,fontWeight:700}}>{formatMoney(earnings.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{height:32}}/>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
