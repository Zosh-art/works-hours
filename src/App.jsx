import { useState, useEffect, useMemo } from "react";

const STORAGE_KEY = "work_hours_data_v3";
const WAGE_KEY = "hourly_rate_v1";
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

const JEWISH_HOLIDAYS_RAW = [
  { name: "ראש השנה", eve: [2024,10,2], endDay: [2024,10,4] },
  { name: "יום כיפור", eve: [2024,10,11], endDay: [2024,10,12] },
  { name: "סוכות (א׳)", eve: [2024,10,16], endDay: [2024,10,17] },
  { name: "שמיני עצרת", eve: [2024,10,23], endDay: [2024,10,24] },
  { name: "פסח (א׳)", eve: [2025,4,12], endDay: [2025,4,13] },
  { name: "פסח (ז׳-ח׳)", eve: [2025,4,18], endDay: [2025,4,20] },
  { name: "שבועות", eve: [2025,6,1], endDay: [2025,6,3] },
  { name: "ראש השנה", eve: [2025,9,22], endDay: [2025,9,24] },
  { name: "יום כיפור", eve: [2025,10,1], endDay: [2025,10,2] },
  { name: "סוכות (א׳)", eve: [2025,10,6], endDay: [2025,10,7] },
  { name: "שמיני עצרת", eve: [2025,10,13], endDay: [2025,10,14] },
  { name: "פסח (א׳)", eve: [2026,4,1], endDay: [2026,4,2] },
  { name: "פסח (ז׳-ח׳)", eve: [2026,4,7], endDay: [2026,4,9] },
  { name: "שבועות", eve: [2026,5,21], endDay: [2026,5,23] },
  { name: "ראש השנה", eve: [2026,9,11], endDay: [2026,9,13] },
  { name: "יום כיפור", eve: [2026,9,20], endDay: [2026,9,21] },
  { name: "סוכות (א׳)", eve: [2026,9,25], endDay: [2026,9,26] },
  { name: "שמיני עצרת", eve: [2026,10,2], endDay: [2026,10,3] },
  { name: "פסח (א׳)", eve: [2027,3,21], endDay: [2027,3,22] },
  { name: "פסח (ז׳-ח׳)", eve: [2027,3,27], endDay: [2027,3,29] },
  { name: "שבועות", eve: [2027,5,11], endDay: [2027,5,13] },
];

// ── Parasha list: [name, shabbat_date YYYY-MM-DD (Israel)] ───────────────────
// Israel cycle 2024-2027
// ── Hebcal API (hebcal.com) ──────────────────────────────────────────────────
const hebcalCache = {};


// ── Gematria helper (used by fetchHebrewDate above) ─────────────────────────
const HEB_HUNDREDS = ["","ק","ר","ש","ת","תק","תר","תש","תת","תתק"];
const HEB_TENS     = ["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
const HEB_UNITS    = ["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
function numToGematria(n) {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  let s = (HEB_HUNDREDS[h] || "") + (HEB_TENS[t] || "") + (HEB_UNITS[u] || "");
  if (!s) return "";
  if (s.length === 1) return s + "׳";
  return s.slice(0, -1) + "״" + s.slice(-1);
}

const HEB_DAY_ARR = ["","א","ב","ג","ד","ה","ו","ז","ח","ט","י","יא","יב","יג","יד","טו","טז","יז","יח","יט","כ","כא","כב","כג","כד","כה","כו","כז","כח","כט","ל"];

async function fetchHebcalMonth(year, month) {
  const key = `${year}-${month}`;
  if (hebcalCache[key]) return hebcalCache[key];
  try {
    // 1. Get parasha
    const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=off&min=off&nx=off&ss=off&mf=off&c=off&s=on&i=on&geo=il&year=${year}&month=${month}&lg=he&leyning=off`;
    const res = await fetch(url);
    const json = await res.json();
    console.log("Hebcal response:", json);
    const days = {};
    for (const item of (json.items || [])) {
      const dt = item.date?.slice(0, 10);
      if (!dt || item.category !== "parashat") continue;
      if (!days[dt]) days[dt] = {};
      days[dt].parasha = item.hebrew;
      // Assign to Friday too
      const sat = new Date(dt + "T12:00:00");
      const fri = new Date(sat); fri.setDate(sat.getDate() - 1);
      const friKey = `${fri.getFullYear()}-${String(fri.getMonth()+1).padStart(2,"0")}-${String(fri.getDate()).padStart(2,"0")}`;
      if (!days[friKey]) days[friKey] = {};
      days[friKey].parasha = item.hebrew;
    }
    // 2. Get Hebrew date for 1st of month (for month name + year)
    const hdUrl = `https://www.hebcal.com/converter?cfg=json&g2h=1&year=${year}&month=${month}&day=1&gs=off`;
    const hdRes = await fetch(hdUrl);
    const hdJson = await hdRes.json();
    const hebrewMonth = hdJson.hmonth_name || "";
    // 3. Build Hebrew date strings for every day using the converter data
    // We know 1st day, increment from there
    let hd = hdJson.hd || 1;
    let hmonth = hdJson.hmonth_name || "";
    let hmonth2 = hdJson.hmonth2_name || "";
    let hy = hdJson.hy || 0;
    const daysInGregMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInGregMonth; d++) {
      const gKey = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      // Fetch individual day Hebrew date (cached)
      const dateObj = new Date(year, month-1, d);
      // We'll fetch async per-day inside the component via fetchHebrewDate
      if (!days[gKey]) days[gKey] = {};
    }
    const result = { hebrewMonth, days };
    hebcalCache[key] = result;
    return result;
  } catch {
    const r = { hebrewMonth: "", days: {} };
    hebcalCache[key] = r;
    return r;
  }
}

// Fetch Hebrew date string for a specific date
const hdateCache = {};
async function fetchHebrewDate(date) {
  const key = date.toISOString().slice(0, 10);
  if (hdateCache[key] !== undefined) return hdateCache[key];
  try {
    const url = `https://www.hebcal.com/converter?cfg=json&g2h=1&year=${date.getFullYear()}&month=${date.getMonth()+1}&day=${date.getDate()}&gs=off`;
    const res = await fetch(url);
    const json = await res.json();
    // json.hd = day number, json.hmonth_name = month name, json.hy = Hebrew year number
    const dayNum = json.hd;
    const monthName = json.hmonth_name || "";
    const hyear = json.hy || 0;
    const withinMil = hyear % 1000;
    const yearStr = numToGematria(withinMil);
    const HEB_DAY_LOCAL = ["","א","ב","ג","ד","ה","ו","ז","ח","ט","י","יא","יב","יג","יד","טו","טז","יז","יח","יט","כ","כא","כב","כג","כד","כה","כו","כז","כח","כט","ל"];
    const dayStr = (HEB_DAY_LOCAL[dayNum] || String(dayNum)) + "׳";
    const result = `${dayStr} ב${monthName} ה${yearStr}`;
    hdateCache[key] = result;
    return result;
  } catch {
    hdateCache[key] = "";
    return "";
  }
}

const PARASHA_LIST = [
  ["בראשית","2024-10-26"],["נח","2024-11-02"],["לך לך","2024-11-09"],
  ["וירא","2024-11-16"],["חיי שרה","2024-11-23"],["תולדות","2024-11-30"],
  ["ויצא","2024-12-07"],["וישלח","2024-12-14"],["וישב","2024-12-21"],
  ["מקץ","2024-12-28"],["ויגש","2025-01-04"],["ויחי","2025-01-11"],
  ["שמות","2025-01-18"],["וארא","2025-01-25"],["בא","2025-02-01"],
  ["בשלח","2025-02-08"],["יתרו","2025-02-15"],["משפטים","2025-02-22"],
  ["תרומה","2025-03-01"],["תצוה","2025-03-08"],["כי תשא","2025-03-15"],
  ["ויקהל-פקודי","2025-03-22"],["ויקרא","2025-03-29"],["צו","2025-04-05"],
  ["שמיני","2025-04-26"],["תזריע-מצורע","2025-05-03"],["אחרי מות-קדושים","2025-05-10"],
  ["אמור","2025-05-17"],["בהר-בחוקותי","2025-05-24"],["במדבר","2025-05-31"],
  ["נשא","2025-06-07"],["בהעלותך","2025-06-14"],["שלח","2025-06-21"],
  ["קורח","2025-06-28"],["חקת","2025-07-05"],["בלק","2025-07-12"],
  ["פינחס","2025-07-19"],["מטות-מסעי","2025-07-26"],["דברים","2025-08-02"],
  ["ואתחנן","2025-08-09"],["עקב","2025-08-16"],["ראה","2025-08-23"],
  ["שופטים","2025-08-30"],["כי תצא","2025-09-06"],["כי תבוא","2025-09-13"],
  ["ניצבים","2025-09-20"],["וילך","2025-10-11"],["האזינו","2025-10-18"],
  ["וזאת הברכה","2025-10-14"],
  ["בראשית","2025-10-25"],["נח","2025-11-01"],["לך לך","2025-11-08"],
  ["וירא","2025-11-15"],["חיי שרה","2025-11-22"],["תולדות","2025-11-29"],
  ["ויצא","2025-12-06"],["וישלח","2025-12-13"],["וישב","2025-12-20"],
  ["מקץ","2025-12-27"],["ויגש","2026-01-03"],["ויחי","2026-01-10"],
  ["שמות","2026-01-17"],["וארא","2026-01-24"],["בא","2026-01-31"],
  ["בשלח","2026-02-07"],["יתרו","2026-02-14"],["משפטים","2026-02-21"],
  ["תרומה","2026-02-28"],["תצוה","2026-03-07"],["כי תשא","2026-03-14"],
  ["ויקהל-פקודי","2026-03-21"],["ויקרא","2026-04-11"],["צו","2026-04-18"],
  ["שמיני","2026-04-25"],["תזריע-מצורע","2026-05-02"],["אחרי מות-קדושים","2026-05-09"],
  ["אמור","2026-05-16"],["בהר","2026-05-23"],["בחוקותי","2026-05-30"],
  ["במדבר","2026-06-06"],["נשא","2026-06-13"],["בהעלותך","2026-06-20"],
  ["שלח","2026-06-27"],["קורח","2026-07-04"],["חקת","2026-07-11"],
  ["בלק","2026-07-18"],["פינחס","2026-07-25"],["מטות","2026-08-01"],
  ["מסעי","2026-08-08"],["דברים","2026-08-15"],["ואתחנן","2026-08-22"],
  ["עקב","2026-08-29"],["ראה","2026-09-05"],["שופטים","2026-09-12"],
  ["כי תצא","2026-09-19"],["כי תבוא","2026-09-26"],["ניצבים-וילך","2026-10-03"],
  ["האזינו","2026-10-17"],
  ["בראשית","2026-11-07"],["נח","2026-11-14"],["לך לך","2026-11-21"],
  ["וירא","2026-11-28"],["חיי שרה","2026-12-05"],["תולדות","2026-12-12"],
  ["ויצא","2026-12-19"],["וישלח","2026-12-26"],["וישב","2027-01-02"],
  ["מקץ","2027-01-09"],["ויגש","2027-01-16"],["ויחי","2027-01-23"],
  ["שמות","2027-01-30"],["וארא","2027-02-06"],["בא","2027-02-13"],
  ["בשלח","2027-02-20"],["יתרו","2027-02-27"],["משפטים","2027-03-06"],
  ["תרומה","2027-03-13"],["תצוה","2027-03-20"],["כי תשא","2027-03-27"],
  ["ויקהל","2027-04-17"],["פקודי","2027-04-24"],["ויקרא","2027-05-01"],
];



const DARK_THEME = {
  bg:"#0F1117", cardBg:"#1A1D2E", cardBorder:"#252840",
  cardBgAlt:"#13151F", inputBg:"#252840", inputBorder:"#334155",
  text:"#E2E8F0", textStrong:"#F1F5F9", textMuted:"#94A3B8",
  textFaint:"#64748B", textVeryFaint:"#475569",
  todayBg:"#1E2145", todayBorder:"#6366F1",
  navBg:"#1E2130", expandedBg:"#161827",
  nextEventBg:"#1A1420", nextEventBorder:"#2D1F40",
  modalBg:"#1A1D2E", modalBorder:"#2D2F4A",
  previewBg:"#13151F",
  clockFace:"#13151F", clockRing:"#1E2130",
  clockTick:"#334155", clockHour:"#E2E8F0", clockMin:"#94A3B8",
};
const LIGHT_THEME = {
  bg:"#F1F5F9", cardBg:"#FFFFFF", cardBorder:"#E2E8F0",
  cardBgAlt:"#F8FAFC", inputBg:"#F1F5F9", inputBorder:"#CBD5E1",
  text:"#334155", textStrong:"#0F172A", textMuted:"#64748B",
  textFaint:"#94A3B8", textVeryFaint:"#CBD5E1",
  todayBg:"#EEF2FF", todayBorder:"#6366F1",
  navBg:"#E2E8F0", expandedBg:"#F8FAFC",
  nextEventBg:"#F5F3FF", nextEventBorder:"#C4B5FD",
  modalBg:"#FFFFFF", modalBorder:"#E2E8F0",
  previewBg:"#F1F5F9",
  clockFace:"#F8FAFC", clockRing:"#E2E8F0",
  clockTick:"#CBD5E1", clockHour:"#1E293B", clockMin:"#64748B",
};

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
  const M = (357.52911 + T*(35999.05029 - 0.0001537*T)) * Math.PI/180;
  const C = (1.914602 - T*(0.004817 + 0.000014*T))*Math.sin(M) + (0.019993 - 0.000101*T)*Math.sin(2*M) + 0.000289*Math.sin(3*M);
  const sunLon = (L0 + C) * Math.PI/180;
  const e = 0.016708634 - T*(0.000042037 + 0.0000001267*T);
  const eps = (23.439291111 - T*(0.013004167 + T*(0.00000164 - T*0.000000504))) * Math.PI/180;
  const dec = Math.asin(Math.sin(eps)*Math.sin(sunLon));
  const y2 = Math.tan(eps/2)**2, L0r = L0*Math.PI/180;
  const eqTime = (y2*Math.sin(2*L0r) - 2*e*Math.sin(M) + 4*e*y2*Math.sin(M)*Math.cos(2*L0r) - 0.5*y2*y2*Math.sin(4*L0r) - 1.25*e*e*Math.sin(2*M))*4*180/Math.PI;
  const cosHA = (Math.cos(90.833*Math.PI/180) - Math.sin(lat*Math.PI/180)*Math.sin(dec)) / (Math.cos(lat*Math.PI/180)*Math.cos(dec));
  const HAdeg = Math.acos(cosHA)*180/Math.PI;
  const sunsetUTC = (720 - 4*lon - eqTime)/60 + HAdeg*4/60;
  const dateObj = new Date(year, month-1, day);
  const lsm = new Date(year,2,31); lsm.setDate(31-lsm.getDay());
  const lso = new Date(year,9,31); lso.setDate(31-lso.getDay());
  const isDST = dateObj >= lsm && dateObj < lso;
  const local = sunsetUTC + (isDST ? 3 : 2);
  return { h: Math.floor(local), m: Math.round((local - Math.floor(local))*60) };
}

function buildHolidayWindows() {
  return JEWISH_HOLIDAYS_RAW.map(h => {
    const [ey, em, ed] = h.eve;
    const [dy, dm, dd] = h.endDay;
    const sunset = getSunsetIL(ey, em, ed);
    const start = new Date(ey, em-1, ed, sunset.h, sunset.m, 0, 0).getTime();
    const endDate = new Date(dy, dm-1, dd);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(6, 0, 0, 0);
    return { start, end: endDate.getTime(), name: h.name };
  });
}
const HOLIDAY_WINDOWS = buildHolidayWindows();

function buildHolidayEveSunsets() {
  return JEWISH_HOLIDAYS_RAW.map(h => {
    const [ey, em, ed] = h.eve;
    const sunset = getSunsetIL(ey, em, ed);
    return new Date(ey, em-1, ed, sunset.h, sunset.m, 0, 0).getTime();
  });
}
const HOLIDAY_EVE_SUNSETS = buildHolidayEveSunsets();

function getShabbatWindow(dateTs) {
  const fd = new Date(dateTs); fd.setHours(0,0,0,0);
  while (fd.getDay() !== 5) fd.setDate(fd.getDate() + (fd.getDay() < 5 ? 5-fd.getDay() : 7-(fd.getDay()-5)));
  const s = getSunsetIL(fd.getFullYear(), fd.getMonth()+1, fd.getDate());
  const start = new Date(fd); start.setHours(s.h, s.m, 0, 0);
  const end = new Date(fd); end.setDate(fd.getDate()+2); end.setHours(6,0,0,0);
  return { start: start.getTime(), end: end.getTime() };
}

function isInPremiumWindow(ts) {
  const sw = getShabbatWindow(ts);
  if (ts >= sw.start && ts < sw.end) return true;
  for (const hw of HOLIDAY_WINDOWS) { if (ts >= hw.start && ts < hw.end) return true; }
  return false;
}

function getNextPremiumStart(startTs, endTs) {
  const candidates = [];
  const sw = getShabbatWindow(startTs);
  if (sw.start > startTs && sw.start < endTs) candidates.push(sw.start);
  for (const hw of HOLIDAY_WINDOWS) { if (hw.start > startTs && hw.start < endTs) candidates.push(hw.start); }
  for (const eveSunset of HOLIDAY_EVE_SUNSETS) { if (eveSunset > startTs && eveSunset < endTs) candidates.push(eveSunset); }
  return candidates.length ? Math.min(...candidates) : null;
}

function splitSession(startTs, endTs) {
  const totalMs = endTs - startTs;
  if (isInPremiumWindow(startTs)) return { regularMs: 0, premiumMs: totalMs };
  const premiumStart = getNextPremiumStart(startTs, endTs);
  if (premiumStart !== null) return { regularMs: premiumStart - startTs, premiumMs: endTs - premiumStart };
  return { regularMs: totalMs, premiumMs: 0 };
}

function getHolidayName(ts) {
  for (const hw of HOLIDAY_WINDOWS) { if (ts >= hw.start && ts < hw.end) return hw.name; }
  return null;
}

function formatTime(ms) {
  if (!ms || ms <= 0) return "0:00";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return `${h}:${m.toString().padStart(2,"0")}`;
}
function formatMoney(n) { return "₪" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,","); }
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
  return { regularMs, premiumMs, totalMs: regularMs+premiumMs, regularEarnings, premiumEarnings, total: regularEarnings+premiumEarnings };
}

function ManualEntryModal({ targetDate, existingSessions, onSave, onClose, hourlyRate=52.19, T=DARK_THEME }) {
  const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,"0")}-${String(targetDate.getDate()).padStart(2,"0")}`;
  const [sessions, setSessions] = useState(
    existingSessions?.length
      ? existingSessions.map(s => ({
          startStr: new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}).replace(".",":"),
          endStr: new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}).replace(".",":"),
        }))
      : [{ startStr: "09:00", endStr: "17:00" }]
  );
  function parseTime(ds, timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const d = new Date(ds + "T00:00:00"); d.setHours(h, m, 0, 0); return d.getTime();
  }
  function handleSave() {
    const parsed = sessions.map(s => ({ start: parseTime(dateStr, s.startStr), end: parseTime(dateStr, s.endStr) })).filter(s => s.start && s.end && s.end > s.start);
    if (!parsed.length) return; onSave(parsed);
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
      <div style={{background:T.modalBg,borderRadius:20,padding:24,width:"100%",maxWidth:380,border:`1px solid ${T.modalBorder}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontWeight:700,fontSize:17,color:T.textStrong}}>הזנה ידנית — {targetDate.getDate()} {MONTH_NAMES[targetDate.getMonth()]}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.textFaint,fontSize:22,cursor:"pointer"}}>✕</button>
        </div>
        {sessions.map((s, i) => (
          <div key={i} style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:T.textFaint,marginBottom:4}}>כניסה</div>
              <input type="time" value={s.startStr} onChange={e => setSessions(prev => prev.map((x,j) => j===i?{...x,startStr:e.target.value}:x))}
                style={{width:"100%",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:8,padding:"10px 12px",color:T.textStrong,fontSize:16,outline:"none"}} />
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:T.textFaint,marginBottom:4}}>יציאה</div>
              <input type="time" value={s.endStr} onChange={e => setSessions(prev => prev.map((x,j) => j===i?{...x,endStr:e.target.value}:x))}
                style={{width:"100%",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:8,padding:"10px 12px",color:T.textStrong,fontSize:16,outline:"none"}} />
            </div>
            {sessions.length > 1 && (
              <button onClick={() => setSessions(prev => prev.filter((_,j) => j!==i))} style={{background:"none",border:"none",color:"#EF4444",fontSize:20,cursor:"pointer",marginTop:16}}>✕</button>
            )}
          </div>
        ))}
        <button onClick={() => setSessions(prev => [...prev, {startStr:"09:00",endStr:"17:00"}])}
          style={{width:"100%",padding:"9px",background:T.inputBg,border:`1px dashed ${T.inputBorder}`,borderRadius:10,color:T.textMuted,cursor:"pointer",fontSize:14,marginBottom:16}}>
          + הוסף סשן נוסף
        </button>
        {sessions.length > 0 && (() => {
          const parsed = sessions.map(s => ({start:parseTime(dateStr,s.startStr),end:parseTime(dateStr,s.endStr)})).filter(s=>s.start&&s.end&&s.end>s.start);
          if (!parsed.length) return null;
          const earn = calcEarnings(parsed, null, hourlyRate);
          return (
            <div style={{background:T.previewBg,borderRadius:10,padding:"12px 14px",marginBottom:16,display:"flex",justifyContent:"space-between"}}>
              <span style={{color:T.textFaint,fontSize:13}}>סה"כ: <span style={{color:"#6366F1",fontWeight:700}}>{formatTime(earn.totalMs)}</span></span>
              <span style={{color:"#F59E0B",fontWeight:700,fontSize:15}}>{formatMoney(earn.total)}</span>
            </div>
          );
        })()}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"12px",background:T.inputBg,border:"none",borderRadius:12,color:T.textMuted,cursor:"pointer",fontWeight:600,fontSize:15}}>ביטול</button>
          <button onClick={handleSave} style={{flex:2,padding:"12px",background:"#6366F1",border:"none",borderRadius:12,color:"#fff",cursor:"pointer",fontWeight:700,fontSize:15}}>שמור</button>
        </div>
      </div>
    </div>
  );
}

function WageModal({ currentRate, onSave, onClose, T=DARK_THEME }) {
  const preset = WAGE_PRESETS.find(p => p.value === currentRate);
  const [selected, setSelected] = useState(preset ? preset.value : null);
  const [customVal, setCustomVal] = useState(preset ? "" : String(currentRate));
  function handleSave() {
    const rate = selected !== null ? selected : parseFloat(customVal.replace(",","."));
    if (!rate || isNaN(rate) || rate <= 0) return; onSave(rate);
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
      <div style={{background:T.modalBg,borderRadius:20,padding:24,width:"100%",maxWidth:360,border:`1px solid ${T.modalBorder}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontWeight:700,fontSize:17,color:T.textStrong}}>תעריף שעתי</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.textFaint,fontSize:22,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          {WAGE_PRESETS.map(p => (
            <button key={p.label} onClick={() => { setSelected(p.value); if (p.value) setCustomVal(""); }}
              style={{padding:"14px 18px",borderRadius:12,border:"none",cursor:"pointer",textAlign:"right",
                background:(p.value!==null?selected===p.value:selected===null)?"#6366F1":T.inputBg,
                color:(p.value!==null?selected===p.value:selected===null)?"#fff":T.textMuted,
                fontWeight:700,fontSize:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>{p.value?`₪${p.label}`:p.label}</span>
              {(p.value!==null?selected===p.value:selected===null)&&<span>✓</span>}
            </button>
          ))}
        </div>
        {selected === null && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:T.textFaint,marginBottom:6}}>הזן תעריף ידנית</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:"#F59E0B",fontWeight:700,fontSize:18}}>₪</span>
              <input type="number" step="0.01" min="0" value={customVal} onChange={e=>setCustomVal(e.target.value)} placeholder="0.00"
                style={{flex:1,background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:8,padding:"12px",color:T.textStrong,fontSize:18,outline:"none"}} autoFocus />
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"12px",background:T.inputBg,border:"none",borderRadius:12,color:T.textMuted,cursor:"pointer",fontWeight:600,fontSize:15}}>ביטול</button>
          <button onClick={handleSave} style={{flex:2,padding:"12px",background:"#6366F1",border:"none",borderRadius:12,color:"#fff",cursor:"pointer",fontWeight:700,fontSize:15}}>שמור</button>
        </div>
      </div>
    </div>
  );
}

function PWABanner({ onDismiss }) {
  return (
    <div style={{width:"100%",maxWidth:480,margin:"0 auto",background:"linear-gradient(135deg,#1E2145,#252840)",border:"1px solid #6366F1",borderRadius:14,padding:"14px 16px",marginBottom:16,display:"flex",gap:12,alignItems:"flex-start"}}>
      <span style={{fontSize:28}}>📱</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:14,color:"#F1F5F9",marginBottom:4}}>הוסף למסך הבית</div>
        <div style={{fontSize:12,color:"#94A3B8",lineHeight:1.5}}>
          בכרום: תפריט ⋮ ← <strong style={{color:"#C4B5FD"}}>"הוסף למסך הבית"</strong><br/>
          האפליקציה תיפתח במסך מלא, בלי שורת כתובות.
        </div>
      </div>
      <button onClick={onDismiss} style={{background:"none",border:"none",color:"#475569",fontSize:18,cursor:"pointer",padding:0}}>✕</button>
    </div>
  );
}

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
  const T = theme === "dark" ? DARK_THEME : LIGHT_THEME;
  const [data, setData] = useState(() => { try { const s=localStorage.getItem(STORAGE_KEY); return s?JSON.parse(s):{}; } catch { return {}; } });
  const [summaryMonth, setSummaryMonth] = useState(() => { const d=new Date(); return {year:d.getFullYear(),month:d.getMonth()}; });

  useEffect(() => { const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); },[]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); } catch {} },[data]);
  useEffect(() => { try { localStorage.setItem(WAGE_KEY,String(hourlyRate)); } catch {} },[hourlyRate]);
  useEffect(() => { try { localStorage.setItem(THEME_KEY,theme); } catch {} },[theme]);

  const todayKey = getDayKey(now);
  const todayData = data[todayKey] || { sessions:[], active:null };
  const isCheckedIn = !!todayData.active;
  const todayEarnings = useMemo(() => calcEarnings(todayData.sessions,todayData.active,hourlyRate),[todayData,now,hourlyRate]);



  function handleCheckIn() {
    setData(prev=>{ const e=prev[todayKey]||{sessions:[],active:null}; if(e.active)return prev; return {...prev,[todayKey]:{...e,active:Date.now()}}; });
  }
  function handleCheckOut() {
    setData(prev=>{ const e=prev[todayKey]; if(!e?.active)return prev; return {...prev,[todayKey]:{sessions:[...(e.sessions||[]),{start:e.active,end:Date.now()}],active:null}}; });
  }
  function handleManualSave(date, sessions) {
    const key = getDayKey(date);
    setData(prev=>({...prev,[key]:{sessions,active:null}}));
    setManualEntry(null);
  }

  const {year,month} = summaryMonth;
  const daysInMonth = getDaysInMonth(year,month);
  const days = useMemo(()=>Array.from({length:daysInMonth},(_,i)=>{
    const d=new Date(year,month,i+1),key=getDayKey(d),entry=data[key];
    const earnings=entry?calcEarnings(entry.sessions,entry.active,hourlyRate):{regularMs:0,premiumMs:0,totalMs:0,regularEarnings:0,premiumEarnings:0,total:0};
    return {date:d,key,earnings,entry};
  }),[data,year,month,daysInMonth]);

  const monthTotals = useMemo(()=>days.reduce((a,d)=>({
    totalMs:a.totalMs+d.earnings.totalMs,premiumMs:a.premiumMs+d.earnings.premiumMs,
    total:a.total+d.earnings.total,regularEarnings:a.regularEarnings+d.earnings.regularEarnings,
    premiumEarnings:a.premiumEarnings+d.earnings.premiumEarnings,
  }),{totalMs:0,premiumMs:0,total:0,regularEarnings:0,premiumEarnings:0}),[days]);

  const maxDayMs = Math.max(...days.map(d=>d.earnings.totalMs),1);
  const secDeg=now.getSeconds()*6, minDeg=now.getMinutes()*6+now.getSeconds()*0.1, hourDeg=(now.getHours()%12)*30+now.getMinutes()*0.5;
  const S = {card:{background:T.cardBg,borderRadius:16,border:`1px solid ${T.cardBorder}`},label:{fontSize:11,color:T.textFaint,marginTop:4},gold:"#F59E0B",purple:"#6366F1",green:"#22C55E",red:"#EF4444",violet:"#A78BFA"};
  const todayHoliday = getHolidayName(now.getTime());
  const [todayHebrewDate, setTodayHebrewDate] = useState("");
  const [todayParasha, setTodayParasha] = useState("");
  const [hebcalDays, setHebcalDays] = useState({});       // { "YYYY-MM-DD": { parasha, hdate } }
  const [hebrewMonthName, setHebrewMonthName] = useState(""); // for summary header
  const isFriOrSat = now.getDay()===5||now.getDay()===6;

  // Fetch Hebrew date for today (stable - only re-fetch when calendar date changes)
  useEffect(() => {
    const today = new Date();
    fetchHebrewDate(today).then(s => setTodayHebrewDate(s));
  }, [todayKey]);

  // Fetch today parasha if Fri/Sat
  useEffect(() => {
    if (!isFriOrSat) { setTodayParasha(""); return; }
    fetchHebcalMonth(now.getFullYear(), now.getMonth()+1).then(data => {
      const key = now.toISOString().slice(0,10);
      setTodayParasha(data.days[key]?.parasha || "");
    });
  }, [now.toDateString()]);

  // Fetch Hebcal data + Hebrew dates for summary month
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchHebcalMonth(year, month+1);
      if (cancelled) return;
      setHebrewMonthName(data.hebrewMonth);
      const merged = { ...data.days };
      setHebcalDays({ ...merged }); // show parasha immediately

      // Fetch Hebrew date for each day sequentially to avoid rate limits
      const daysInMonth = new Date(year, month+1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        if (cancelled) return;
        const d = new Date(year, month, i);
        const key = `${year}-${String(month+1).padStart(2,"0")}-${String(i).padStart(2,"0")}`;
        const hdate = await fetchHebrewDate(d);
        if (cancelled) return;
        merged[key] = { ...(merged[key]||{}), hdate };
        setHebcalDays({ ...merged });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [year, month]);

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Segoe UI',system-ui,sans-serif",direction:"rtl",display:"flex",flexDirection:"column",alignItems:"center"}}>

      {manualEntry && (
        <ManualEntryModal targetDate={manualEntry.date} existingSessions={data[getDayKey(manualEntry.date)]?.sessions}
          onSave={sessions=>handleManualSave(manualEntry.date,sessions)} onClose={()=>setManualEntry(null)} hourlyRate={hourlyRate} T={T} />
      )}
      {showWage && (
        <WageModal currentRate={hourlyRate} onSave={rate=>{setHourlyRate(rate);setShowWage(false);}} onClose={()=>setShowWage(false)} T={T} />
      )}

      {/* Header */}
      <div style={{width:"100%",maxWidth:480,padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20,fontWeight:700,color:"#F1F5F9"}}>מעקב שעות</span>
          <button onClick={()=>setShowWage(true)} style={{background:T.cardBg,border:`1px solid ${T.inputBorder}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:12,color:S.gold,fontWeight:700}}>₪{hourlyRate.toFixed(2)}</span>
            <span style={{fontSize:11,color:"#475569"}}>✎</span>
          </button>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} style={{background:T.navBg,border:`1px solid ${T.cardBorder}`,borderRadius:20,padding:"7px 10px",cursor:"pointer",fontSize:16,lineHeight:1,color:T.textMuted}}>
            {theme==="dark"?"☀️":"🌙"}
          </button>
          {["clock","summary"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"7px 16px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,background:view===v?S.purple:T.navBg,color:view===v?"#fff":T.textMuted}}>
              {v==="clock"?"שעון":"סיכום"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Clock Panel ── */}
      {view === "clock" && (
        <div style={{width:"100%",maxWidth:480,padding:"22px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
          {showPWA && <PWABanner onDismiss={()=>{setShowPWA(false);localStorage.setItem("pwa_dismissed","1");}} />}

          <svg width="180" height="180" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="96" fill="none" stroke={T.clockRing} strokeWidth="8"/>
            <circle cx="100" cy="100" r="90" fill={T.clockFace}/>
            {Array.from({length:12},(_,i)=>{ const a=(i*30-90)*Math.PI/180; return <line key={i} x1={100+75*Math.cos(a)} y1={100+75*Math.sin(a)} x2={100+83*Math.cos(a)} y2={100+83*Math.sin(a)} stroke={T.clockTick} strokeWidth={i%3===0?3:1.5} strokeLinecap="round"/>; })}
            <line x1="100" y1="100" x2={100+50*Math.cos((hourDeg-90)*Math.PI/180)} y2={100+50*Math.sin((hourDeg-90)*Math.PI/180)} stroke={T.clockHour} strokeWidth="4" strokeLinecap="round"/>
            <line x1="100" y1="100" x2={100+68*Math.cos((minDeg-90)*Math.PI/180)} y2={100+68*Math.sin((minDeg-90)*Math.PI/180)} stroke={T.clockMin} strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="100" y1="100" x2={100+72*Math.cos((secDeg-90)*Math.PI/180)} y2={100+72*Math.sin((secDeg-90)*Math.PI/180)} stroke={S.purple} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="100" cy="100" r="4" fill={S.purple}/>
          </svg>

          <div style={{textAlign:"center"}}>
            <div style={{fontSize:38,fontWeight:300,letterSpacing:2,color:T.textStrong,fontVariantNumeric:"tabular-nums"}}>{formatClock(now)}</div>
            <div style={{fontSize:14,color:T.textMuted,marginTop:3}}>
              {DAY_NAMES[now.getDay()]} · {now.getDate()} {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}
              {todayHoliday&&<span style={{color:S.violet,marginRight:8}}>· {todayHoliday} ✦</span>}
            </div>
            {todayHebrewDate&&<div style={{fontSize:13,color:T.textFaint,marginTop:3}}>{todayHebrewDate}</div>}
            {isFriOrSat&&todayParasha&&(
              <div style={{fontSize:12,color:S.violet,marginTop:4,fontWeight:600}}>{todayParasha} ✦</div>
            )}
          </div>

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

          <button onClick={()=>setManualEntry({date:new Date()})} style={{background:T.cardBg,border:`1px solid ${T.inputBorder}`,borderRadius:12,padding:"10px 20px",color:T.textMuted,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",gap:8}}>
            <span>✏️</span> הזן שעות ידנית להיום
          </button>

          {(todayData.sessions?.length>0||todayData.active) && (
            <div style={{width:"100%"}}>
              <div style={{fontSize:13,color:T.textFaint,marginBottom:8,fontWeight:600}}>סשנים היום</div>
              {[...(todayData.sessions||[]),...(todayData.active?[{start:todayData.active,end:Date.now(),live:true}]:[])].map((s,i)=>{
                const sp=splitSession(s.start,s.end);
                const earn=(sp.regularMs/3600000)*hourlyRate+(sp.premiumMs/3600000)*hourlyRate*PREMIUM_RATE;
                const hol=getHolidayName(s.start)||getHolidayName((s.start+s.end)/2);
                return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",...S.card,borderRadius:10,marginBottom:6,fontSize:13}}>
                    <span style={{color:T.textMuted}}>
                      {new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})} → {s.live?<span style={{color:S.green}}>עכשיו</span>:new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}
                      {sp.premiumMs>0&&<span style={{color:S.violet,marginRight:6,fontSize:11}}>✦ {hol||"שבת"}</span>}
                    </span>
                    <div>
                      <span style={{color:S.purple,fontWeight:700,marginLeft:10}}>{formatTime(s.end-s.start)}</span>
                      <span style={{color:S.gold,fontWeight:600}}>{formatMoney(earn)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Summary Panel ── */}
      {view === "summary" && (
        <div style={{width:"100%",maxWidth:480,padding:"24px 20px"}}>
          {/* Month nav */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <button onClick={()=>setSummaryMonth(p=>{const d=new Date(p.year,p.month-1,1);return{year:d.getFullYear(),month:d.getMonth()};})}
              style={{background:T.cardBg,border:`1px solid ${T.cardBorder}`,color:T.textMuted,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:18}}>›</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:700,color:T.textStrong}}>{MONTH_NAMES[month]} {year}{hebrewMonthName?<span style={{fontSize:15,color:T.textFaint,fontWeight:400,marginRight:8}}> · {hebrewMonthName}</span>:null}</div>
              <div style={{fontSize:15,color:S.gold,fontWeight:700,marginTop:2}}>{formatMoney(monthTotals.total)}</div>
              {(year!==new Date().getFullYear()||month!==new Date().getMonth())&&(
                <button onClick={()=>{const d=new Date();setSummaryMonth({year:d.getFullYear(),month:d.getMonth()});}}
                  style={{marginTop:6,background:S.purple,border:"none",borderRadius:12,padding:"3px 12px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>
                  היום ↩
                </button>
              )}
            </div>
            <button onClick={()=>setSummaryMonth(p=>{const d=new Date(p.year,p.month+1,1);return{year:d.getFullYear(),month:d.getMonth()};})}
              style={{background:T.cardBg,border:`1px solid ${T.cardBorder}`,color:T.textMuted,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:18}}>‹</button>
          </div>

          {/* Totals */}
          <div style={{...S.card,padding:"14px",marginBottom:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,textAlign:"center"}}>
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
              const dateKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
              const hebrewDate = hebcalDays[dateKey]?.hdate || "";
              const parasha = hebcalDays[dateKey]?.parasha || null;
              const holidayToday=JEWISH_HOLIDAYS_RAW.find(h=>{
                const [ey,em,ed]=h.eve;
                return ey===date.getFullYear()&&em===date.getMonth()+1&&ed===date.getDate();
              });

              return (
                <div key={date.getDate()}>
                  <div onClick={()=>earnings.totalMs>0?setExpandedDay(isExp?null:getDayKey(date)):setManualEntry({date})}
                    style={{...S.card,borderRadius:12,padding:"11px 14px",border:isToday?`1px solid ${T.todayBorder}`:`1px solid ${T.cardBorder}`,background:isToday?T.todayBg:T.cardBg,position:"relative",overflow:"hidden",cursor:"pointer"}}>
                    {earnings.totalMs>0&&<div style={{position:"absolute",right:0,top:0,bottom:0,width:`${pct*100}%`,background:hasPremium?"linear-gradient(90deg,transparent,rgba(167,139,250,0.08))":"linear-gradient(90deg,transparent,rgba(99,102,241,0.08))",pointerEvents:"none"}}/>}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:34,height:34,borderRadius:9,background:isToday?S.purple:T.navBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <span style={{fontSize:14,fontWeight:700,color:isToday?"#fff":isWeekend?T.textVeryFaint:T.textMuted}}>{date.getDate()}</span>
                        </div>
                        <div>
                          <div style={{fontSize:13,color:isWeekend?T.textVeryFaint:T.textMuted,fontWeight:500,display:"flex",alignItems:"center",gap:5}}>
                            {DAY_NAMES[date.getDay()]}
                            {isToday&&<span style={{color:S.purple,fontSize:10}}>היום</span>}
                            {holidayToday&&<span style={{color:S.violet,fontSize:10}}>✦ {holidayToday.name}</span>}
                            {!holidayToday&&hasPremium&&<span style={{color:S.violet,fontSize:10}}>✦</span>}
                          </div>
                          {hebrewDate&&<div style={{fontSize:10,color:T.textFaint,marginTop:1}}>{hebrewDate}</div>}
                          {parasha&&<div style={{fontSize:10,color:S.violet,marginTop:1}}>{parasha}</div>}
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

                  {isExp&&entry&&(
                    <div style={{...S.card,borderRadius:"0 0 12px 12px",padding:"12px 14px",borderTop:"none",background:T.expandedBg,marginTop:-4}}>
                      {[...(entry.sessions||[]),...(entry.active?[{start:entry.active,end:Date.now(),live:true}]:[])].map((s,i)=>{
                        const sp=splitSession(s.start,s.end);
                        const earn=(sp.regularMs/3600000)*hourlyRate+(sp.premiumMs/3600000)*hourlyRate*PREMIUM_RATE;
                        return (
                          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.cardBorder}`,fontSize:12}}>
                            <span style={{color:"#64748B"}}>
                              {new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})} → {s.live?"עכשיו":new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}
                              {sp.premiumMs>0&&<span style={{color:S.violet,marginRight:4}}> ✦ {formatTime(sp.premiumMs)}</span>}
                            </span>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{color:S.purple,marginLeft:8}}>{formatTime(s.end-s.start)}</span>
                              <span style={{color:S.gold,fontWeight:600}}>{formatMoney(earn)}</span>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10}}>
                        <button onClick={()=>setManualEntry({date})} style={{background:"none",border:"none",color:"#6366F1",cursor:"pointer",fontSize:12,padding:0}}>✏️ עריכה</button>
                        <div style={{color:T.textFaint,fontSize:12}}>
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
      )}
    </div>
  );
}
