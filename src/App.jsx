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
  { name: "ראש השנה",   eve: [2024,10,2],  endDay: [2024,10,4]  },
  { name: "יום כיפור",  eve: [2024,10,11], endDay: [2024,10,12] },
  { name: "סוכות (א׳)", eve: [2024,10,16], endDay: [2024,10,17] },
  { name: "שמיני עצרת", eve: [2024,10,23], endDay: [2024,10,24] },
  { name: "פסח (א׳)",   eve: [2025,4,12],  endDay: [2025,4,13]  },
  { name: "פסח (ז׳-ח׳)",eve: [2025,4,18],  endDay: [2025,4,20]  },
  { name: "שבועות",     eve: [2025,6,1],   endDay: [2025,6,3]   },
  { name: "ראש השנה",   eve: [2025,9,22],  endDay: [2025,9,24]  },
  { name: "יום כיפור",  eve: [2025,10,1],  endDay: [2025,10,2]  },
  { name: "סוכות (א׳)", eve: [2025,10,6],  endDay: [2025,10,7]  },
  { name: "שמיני עצרת", eve: [2025,10,13], endDay: [2025,10,14] },
  { name: "פסח (א׳)",   eve: [2026,4,1],   endDay: [2026,4,2]   },
  { name: "פסח (ז׳-ח׳)",eve: [2026,4,7],   endDay: [2026,4,9]   },
  { name: "שבועות",     eve: [2026,5,21],  endDay: [2026,5,23]  },
  { name: "ראש השנה",   eve: [2026,9,11],  endDay: [2026,9,13]  },
  { name: "יום כיפור",  eve: [2026,9,20],  endDay: [2026,9,21]  },
  { name: "סוכות (א׳)", eve: [2026,9,25],  endDay: [2026,9,26]  },
  { name: "שמיני עצרת", eve: [2026,10,2],  endDay: [2026,10,3]  },
  { name: "פסח (א׳)",   eve: [2027,3,21],  endDay: [2027,3,22]  },
  { name: "פסח (ז׳-ח׳)",eve: [2027,3,27],  endDay: [2027,3,29]  },
  { name: "שבועות",     eve: [2027,5,11],  endDay: [2027,5,13]  },
];

// ── Hebrew date ───────────────────────────────────────────────────────────────
const HEB_HUNDREDS = ["","ק","ר","ש","ת","תק","תר","תש","תת","תתק"];
const HEB_TENS     = ["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
const HEB_UNITS    = ["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
const HEB_DAY_ARR  = ["","א","ב","ג","ד","ה","ו","ז","ח","ט","י","יא","יב","יג","יד","טו","טז","יז","יח","יט","כ","כא","כב","כג","כד","כה","כו","כז","כח","כט","ל"];

function numToGematria(n) {
  const h=Math.floor(n/100), t=Math.floor((n%100)/10), u=n%10;
  let s=(HEB_HUNDREDS[h]||"")+(HEB_TENS[t]||"")+(HEB_UNITS[u]||"");
  if(!s) return "";
  return s.length===1 ? s+"׳" : s.slice(0,-1)+"״"+s.slice(-1);
}
function toHebrewDate(date) {
  try {
    const parts=new Intl.DateTimeFormat("he-IL-u-ca-hebrew",{day:"numeric",month:"long",year:"numeric"}).formatToParts(date);
    const dayNum=parseInt(parts.find(p=>p.type==="day")?.value||"0");
    const monthStr=parts.find(p=>p.type==="month")?.value||"";
    const yearNum=parseInt(new Intl.DateTimeFormat("en-u-ca-hebrew",{year:"numeric"}).format(date));
    const dayStr=(HEB_DAY_ARR[dayNum]||String(dayNum))+"׳";
    const yearStr="ה׳"+numToGematria(yearNum%1000);
    return {dayNum,monthStr,yearNum,dayStr,yearStr,full:`${dayStr} ב${monthStr} ${yearStr}`};
  } catch { return {dayNum:0,monthStr:"",yearNum:0,dayStr:"",yearStr:"",full:""}; }
}

// ── Parasha ───────────────────────────────────────────────────────────────────
const parashaCache = {};
async function fetchParasha(saturdayDate) {
  const key=`${saturdayDate.getFullYear()}-${String(saturdayDate.getMonth()+1).padStart(2,"0")}-${String(saturdayDate.getDate()).padStart(2,"0")}`;
  if(parashaCache[key]!==undefined) return parashaCache[key];
  try {
    const url=`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=off&min=off&mod=off&nx=off&year=${saturdayDate.getFullYear()}&month=${saturdayDate.getMonth()+1}&ss=off&mf=off&c=off&s=on&i=on&lg=he&geo=il&leyning=off`;
    const res=await fetch(url); const json=await res.json();
    const item=(json.items||[]).find(i=>i.category==="parashat"&&i.date?.slice(0,10)===key);
    parashaCache[key]=item?item.hebrew:"";
    return parashaCache[key];
  } catch { parashaCache[key]=""; return ""; }
}
function getSaturdayOf(date) {
  const d=new Date(date), day=d.getDay();
  if(day===6) return d;
  if(day===5){d.setDate(d.getDate()+1);return d;}
  return null;
}

// ── Theme tokens ──────────────────────────────────────────────────────────────
const THEMES = {
  light: {
    bg:"#FDF6EE", surface:"#FFFFFF", surface2:"#FFF0DC", surface3:"#FEE8CC",
    border:"#E8D4B8", border2:"#D4BB98",
    text:"#2C1A06", textSub:"#7A5230", textMuted:"#A07850", textFaint:"#C09870",
    accent:"#C8580A", accentLight:"#FDE8CC",
    gold:"#B87000", green:"#2A7A3A", red:"#B83020", violet:"#7040A0",
    clockFace:"#FFFBF5", clockRing:"#E8D4B8", clockTick:"#D4BB98",
    clockHour:"#2C1A06", clockMin:"#7A5230",
    todayBg:"#FFF0DC", todayBorder:"#C8580A",
    expandedBg:"#FFF8F0",
    modalOverlay:"rgba(60,20,0,0.45)",
    navBg:"#FFFFFF",
  },
  dark: {
    bg:"#1A1007", surface:"#251808", surface2:"#2E1F0A", surface3:"#38260C",
    border:"#4A3418", border2:"#5C4220",
    text:"#F5EAD0", textSub:"#C09860", textMuted:"#8A6840", textFaint:"#5A4828",
    accent:"#E07820", accentLight:"#4A2808",
    gold:"#D4A020", green:"#3A9040", red:"#C04030", violet:"#9050C0",
    clockFace:"#1A1007", clockRing:"#4A3418", clockTick:"#5C4220",
    clockHour:"#F5EAD0", clockMin:"#C09860",
    todayBg:"#2E1F0A", todayBorder:"#E07820",
    expandedBg:"#1A1007",
    modalOverlay:"rgba(0,0,0,0.75)",
    navBg:"#251808",
  },
};

// ── Sunset (NOAA, Israel) ─────────────────────────────────────────────────────
function getSunsetIL(year, month, day) {
  const lat=31.7683, lon=35.2137;
  function calcJD(y,mo,d){if(mo<=2){y-=1;mo+=12;}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(mo+1))+d+B-1524.5;}
  const JD=calcJD(year,month,day),T=(JD-2451545.0)/36525.0;
  const L0=(280.46646+T*(36000.76983+T*0.0003032))%360;
  const M=(357.52911+T*(35999.05029-0.0001537*T))*Math.PI/180;
  const C=(1.914602-T*(0.004817+0.000014*T))*Math.sin(M)+(0.019993-0.000101*T)*Math.sin(2*M)+0.000289*Math.sin(3*M);
  const sunLon=(L0+C)*Math.PI/180,e=0.016708634-T*(0.000042037+0.0000001267*T);
  const eps=(23.439291111-T*(0.013004167+T*(0.00000164-T*0.000000504)))*Math.PI/180;
  const dec=Math.asin(Math.sin(eps)*Math.sin(sunLon));
  const y2=Math.tan(eps/2)**2,L0r=L0*Math.PI/180;
  const eqTime=(y2*Math.sin(2*L0r)-2*e*Math.sin(M)+4*e*y2*Math.sin(M)*Math.cos(2*L0r)-0.5*y2*y2*Math.sin(4*L0r)-1.25*e*e*Math.sin(2*M))*4*180/Math.PI;
  const cosHA=(Math.cos(90.833*Math.PI/180)-Math.sin(lat*Math.PI/180)*Math.sin(dec))/(Math.cos(lat*Math.PI/180)*Math.cos(dec));
  const HAdeg=Math.acos(cosHA)*180/Math.PI;
  const sunsetUTC=(720-4*lon-eqTime)/60+HAdeg*4/60;
  const dateObj=new Date(year,month-1,day);
  const lsm=new Date(year,2,31);lsm.setDate(31-lsm.getDay());
  const lso=new Date(year,9,31);lso.setDate(31-lso.getDay());
  const local=sunsetUTC+((dateObj>=lsm&&dateObj<lso)?3:2);
  return{h:Math.floor(local),m:Math.round((local-Math.floor(local))*60)};
}

function buildHolidayWindows() {
  return JEWISH_HOLIDAYS_RAW.map(h=>{
    const[ey,em,ed]=h.eve,[dy,dm,dd]=h.endDay,s=getSunsetIL(ey,em,ed);
    const start=new Date(ey,em-1,ed,s.h,s.m,0,0).getTime();
    const end=new Date(dy,dm-1,dd);end.setDate(end.getDate()+1);end.setHours(6,0,0,0);
    return{start,end:end.getTime(),name:h.name};
  });
}
const HOLIDAY_WINDOWS=buildHolidayWindows();

function buildHolidayEveSunsets() {
  return JEWISH_HOLIDAYS_RAW.map(h=>{const[ey,em,ed]=h.eve,s=getSunsetIL(ey,em,ed);return new Date(ey,em-1,ed,s.h,s.m,0,0).getTime();});
}
const HOLIDAY_EVE_SUNSETS=buildHolidayEveSunsets();

function getShabbatWindow(dateTs) {
  const fd=new Date(dateTs);fd.setHours(0,0,0,0);
  while(fd.getDay()!==5)fd.setDate(fd.getDate()+(fd.getDay()<5?5-fd.getDay():7-(fd.getDay()-5)));
  const s=getSunsetIL(fd.getFullYear(),fd.getMonth()+1,fd.getDate());
  const start=new Date(fd);start.setHours(s.h,s.m,0,0);
  const end=new Date(fd);end.setDate(fd.getDate()+2);end.setHours(6,0,0,0);
  return{start:start.getTime(),end:end.getTime()};
}
function isInPremiumWindow(ts) {
  const sw=getShabbatWindow(ts);
  if(ts>=sw.start&&ts<sw.end)return true;
  for(const hw of HOLIDAY_WINDOWS)if(ts>=hw.start&&ts<hw.end)return true;
  return false;
}
function getNextPremiumStart(startTs,endTs) {
  const c=[];
  const sw=getShabbatWindow(startTs);
  if(sw.start>startTs&&sw.start<endTs)c.push(sw.start);
  for(const hw of HOLIDAY_WINDOWS)if(hw.start>startTs&&hw.start<endTs)c.push(hw.start);
  for(const es of HOLIDAY_EVE_SUNSETS)if(es>startTs&&es<endTs)c.push(es);
  return c.length?Math.min(...c):null;
}
function splitSession(startTs,endTs) {
  const totalMs=endTs-startTs;
  if(isInPremiumWindow(startTs))return{regularMs:0,premiumMs:totalMs};
  const ps=getNextPremiumStart(startTs,endTs);
  if(ps!==null)return{regularMs:ps-startTs,premiumMs:endTs-ps};
  return{regularMs:totalMs,premiumMs:0};
}
function getHolidayName(ts) {
  for(const hw of HOLIDAY_WINDOWS)if(ts>=hw.start&&ts<hw.end)return hw.name;
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ms){if(!ms||ms<=0)return"0:00";return`${Math.floor(ms/3600000)}:${String(Math.floor((ms%3600000)/60000)).padStart(2,"0")}`;}
function formatMoney(n){return"₪"+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");}
function formatClock(d){return d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit",second:"2-digit"});}
function getDayKey(d){return`${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate();}

function calcEarnings(sessions,activeStart=null,hourlyRate=52.19) {
  let regularMs=0,premiumMs=0;
  const all=[...(sessions||[])];
  if(activeStart)all.push({start:activeStart,end:Date.now()});
  for(const s of all){const sp=splitSession(s.start,s.end);regularMs+=sp.regularMs;premiumMs+=sp.premiumMs;}
  const re=(regularMs/3600000)*hourlyRate,pe=(premiumMs/3600000)*hourlyRate*PREMIUM_RATE;
  return{regularMs,premiumMs,totalMs:regularMs+premiumMs,regularEarnings:re,premiumEarnings:pe,total:re+pe};
}

// ── Modals ────────────────────────────────────────────────────────────────────
function ManualEntryModal({targetDate,existingSessions,onSave,onClose,hourlyRate=52.19,T}) {
  const dateStr=`${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,"0")}-${String(targetDate.getDate()).padStart(2,"0")}`;
  const[sessions,setSessions]=useState(existingSessions?.length?existingSessions.map(s=>({startStr:new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}).replace(".",":"),endStr:new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}).replace(".",":")})):[{startStr:"09:00",endStr:"17:00"}]);
  function parseTime(ds,t){const[h,m]=t.split(":").map(Number);if(isNaN(h)||isNaN(m))return null;const d=new Date(ds+"T00:00:00");d.setHours(h,m,0,0);return d.getTime();}
  function handleSave(){const p=sessions.map(s=>({start:parseTime(dateStr,s.startStr),end:parseTime(dateStr,s.endStr)})).filter(s=>s.start&&s.end&&s.end>s.start);if(!p.length)return;onSave(p);}
  const previewEarn=useMemo(()=>{const p=sessions.map(s=>({start:parseTime(dateStr,s.startStr),end:parseTime(dateStr,s.endStr)})).filter(s=>s.start&&s.end&&s.end>s.start);return p.length?calcEarnings(p,null,hourlyRate):null;},[sessions,hourlyRate]);
  return(
    <div style={{position:"fixed",inset:0,background:T.modalOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
      <div style={{background:T.surface,borderRadius:20,padding:24,width:"100%",maxWidth:380,border:`1px solid ${T.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontWeight:700,fontSize:17,color:T.text}}>הזנה ידנית — {targetDate.getDate()} {MONTH_NAMES[targetDate.getMonth()]}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.textFaint,fontSize:22,cursor:"pointer"}}>✕</button>
        </div>
        {sessions.map((s,i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
            <div style={{flex:1}}><div style={{fontSize:11,color:T.textFaint,marginBottom:4}}>כניסה</div><input type="time" value={s.startStr} onChange={e=>setSessions(p=>p.map((x,j)=>j===i?{...x,startStr:e.target.value}:x))} style={{width:"100%",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:16,outline:"none"}}/></div>
            <div style={{flex:1}}><div style={{fontSize:11,color:T.textFaint,marginBottom:4}}>יציאה</div><input type="time" value={s.endStr} onChange={e=>setSessions(p=>p.map((x,j)=>j===i?{...x,endStr:e.target.value}:x))} style={{width:"100%",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:16,outline:"none"}}/></div>
            {sessions.length>1&&<button onClick={()=>setSessions(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:T.red,fontSize:20,cursor:"pointer",marginTop:16}}>✕</button>}
          </div>
        ))}
        <button onClick={()=>setSessions(p=>[...p,{startStr:"09:00",endStr:"17:00"}])} style={{width:"100%",padding:"9px",background:T.surface2,border:`1px dashed ${T.border}`,borderRadius:10,color:T.textSub,cursor:"pointer",fontSize:14,marginBottom:14}}>+ הוסף סשן נוסף</button>
        {previewEarn&&<div style={{background:T.surface2,borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",justifyContent:"space-between"}}><span style={{color:T.textMuted,fontSize:13}}>סה"כ: <span style={{color:T.accent,fontWeight:700}}>{formatTime(previewEarn.totalMs)}</span></span><span style={{color:T.gold,fontWeight:700,fontSize:15}}>{formatMoney(previewEarn.total)}</span></div>}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"12px",background:T.surface2,border:"none",borderRadius:12,color:T.textSub,cursor:"pointer",fontWeight:600,fontSize:15}}>ביטול</button>
          <button onClick={handleSave} style={{flex:2,padding:"12px",background:T.accent,border:"none",borderRadius:12,color:"#fff",cursor:"pointer",fontWeight:700,fontSize:15}}>שמור</button>
        </div>
      </div>
    </div>
  );
}

function WageModal({currentRate,onSave,onClose,T}) {
  const preset=WAGE_PRESETS.find(p=>p.value===currentRate);
  const[selected,setSelected]=useState(preset?preset.value:null);
  const[customVal,setCustomVal]=useState(preset?"":String(currentRate));
  function handleSave(){const rate=selected!==null?selected:parseFloat(customVal.replace(",","."));if(!rate||isNaN(rate)||rate<=0)return;onSave(rate);}
  return(
    <div style={{position:"fixed",inset:0,background:T.modalOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
      <div style={{background:T.surface,borderRadius:20,padding:24,width:"100%",maxWidth:360,border:`1px solid ${T.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontWeight:700,fontSize:17,color:T.text}}>תעריף שעתי</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.textFaint,fontSize:22,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          {WAGE_PRESETS.map(p=>(
            <button key={p.label} onClick={()=>{setSelected(p.value);if(p.value)setCustomVal("");}}
              style={{padding:"14px 18px",borderRadius:12,border:"none",cursor:"pointer",textAlign:"right",background:(p.value!==null?selected===p.value:selected===null)?T.accent:T.surface2,color:(p.value!==null?selected===p.value:selected===null)?"#fff":T.textSub,fontWeight:700,fontSize:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>{p.value?`₪${p.label}`:p.label}</span>
              {(p.value!==null?selected===p.value:selected===null)&&<span>✓</span>}
            </button>
          ))}
        </div>
        {selected===null&&<div style={{marginBottom:16}}><div style={{fontSize:12,color:T.textFaint,marginBottom:6}}>הזן תעריף ידנית</div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:T.gold,fontWeight:700,fontSize:18}}>₪</span><input type="number" step="0.01" min="0" value={customVal} onChange={e=>setCustomVal(e.target.value)} placeholder="0.00" autoFocus style={{flex:1,background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:"12px",color:T.text,fontSize:18,outline:"none"}}/></div></div>}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"12px",background:T.surface2,border:"none",borderRadius:12,color:T.textSub,cursor:"pointer",fontWeight:600,fontSize:15}}>ביטול</button>
          <button onClick={handleSave} style={{flex:2,padding:"12px",background:T.accent,border:"none",borderRadius:12,color:"#fff",cursor:"pointer",fontWeight:700,fontSize:15}}>שמור</button>
        </div>
      </div>
    </div>
  );
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({view,setView,darkMode,toggleDark,onWage,hourlyRate,T}) {
  const tabs=[
    {id:"clock",label:"ראשי",icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9L12 2l9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
    {id:"summary",label:"סיכום",icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>},
    {id:"wage",label:"שכר",icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>},
    {id:"theme",label:"בהירות",icon:darkMode
      ?<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      :<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>},
  ];
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.navBg,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-around",padding:"6px 0 max(8px,env(safe-area-inset-bottom))",zIndex:100}}>
      {tabs.map(tab=>{
        const isActive=tab.id==="clock"||tab.id==="summary"?view===tab.id:false;
        const color=isActive?T.accent:T.textMuted;
        return(
          <button key={tab.id} onClick={()=>{if(tab.id==="theme")toggleDark();else if(tab.id==="wage")onWage();else setView(tab.id);}}
            style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 10px",color,minWidth:56}}>
            {tab.icon}
            <span style={{fontSize:10,fontWeight:isActive?700:500}}>{tab.label}</span>
            {tab.id==="wage"&&<span style={{fontSize:9,color:T.gold,fontWeight:700,marginTop:-1}}>₪{hourlyRate.toFixed(2)}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function WorkHoursTracker() {
  const[now,setNow]=useState(new Date());
  const[view,setView]=useState("clock");
  const[expandedDay,setExpandedDay]=useState(null);
  const[manualEntry,setManualEntry]=useState(null);
  const[showWage,setShowWage]=useState(false);
  const[darkMode,setDarkMode]=useState(()=>localStorage.getItem(THEME_KEY)==="dark");
  const[hourlyRate,setHourlyRate]=useState(()=>{const s=parseFloat(localStorage.getItem(WAGE_KEY));return(!isNaN(s)&&s>0)?s:52.19;});
  const[data,setData]=useState(()=>{try{const s=localStorage.getItem(STORAGE_KEY);return s?JSON.parse(s):{};}catch{return{};}});
  const[summaryMonth,setSummaryMonth]=useState(()=>{const d=new Date();return{year:d.getFullYear(),month:d.getMonth()};});
  const[todayParasha,setTodayParasha]=useState("");
  const[summaryParashas,setSummaryParashas]=useState({});
  const[weather,setWeather]=useState([]);

  const T=useMemo(()=>darkMode?THEMES.dark:THEMES.light,[darkMode]);

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch{}},[data]);
  useEffect(()=>{try{localStorage.setItem(WAGE_KEY,String(hourlyRate));}catch{}},[hourlyRate]);
  useEffect(()=>{try{localStorage.setItem(THEME_KEY,darkMode?"dark":"light");}catch{}},[darkMode]);

  const todayKey=getDayKey(now);
  const todayData=data[todayKey]||{sessions:[],active:null};
  const isCheckedIn=!!todayData.active;
  const todayEarnings=useMemo(()=>calcEarnings(todayData.sessions,todayData.active,hourlyRate),[todayData,now,hourlyRate]);

  const monthToDateHours=useMemo(()=>{
    const ty=now.getFullYear(),tm=now.getMonth(),td=now.getDate();
    let totalMs=0,total=0;
    for(let i=1;i<=td;i++){const d=new Date(ty,tm,i),key=getDayKey(d),entry=data[key];if(!entry)continue;const earn=calcEarnings(entry.sessions,i===td?entry.active:null,hourlyRate);totalMs+=earn.totalMs;total+=earn.total;}
    return{totalMs,total};
  },[data,now.getFullYear(),now.getMonth(),now.getDate(),hourlyRate]);

  function handleCheckIn(){setData(prev=>{const e=prev[todayKey]||{sessions:[],active:null};if(e.active)return prev;return{...prev,[todayKey]:{...e,active:Date.now()}};});}
  function handleCheckOut(){setData(prev=>{const e=prev[todayKey];if(!e?.active)return prev;return{...prev,[todayKey]:{sessions:[...(e.sessions||[]),{start:e.active,end:Date.now()}],active:null}};});}
  function handleManualSave(date,sessions){const key=getDayKey(date);setData(prev=>({...prev,[key]:{sessions,active:null}}));setManualEntry(null);}

  const isFriOrSat=now.getDay()===5||now.getDay()===6;
  const todayHebrew=useMemo(()=>toHebrewDate(now),[todayKey]);

  useEffect(()=>{if(!isFriOrSat){setTodayParasha("");return;}const sat=getSaturdayOf(now);if(sat)fetchParasha(sat).then(p=>setTodayParasha(p));},[todayKey]);

  useEffect(()=>{
    const WEATHER_ICONS={0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",51:"🌦️",61:"🌧️",71:"🌨️",80:"🌧️",95:"⛈️"};
    async function load(){try{const url="https://api.open-meteo.com/v1/forecast?latitude=32.0853&longitude=34.7818&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia%2FJerusalem&forecast_days=3";const res=await fetch(url);const json=await res.json();const d=json.daily;setWeather(d.time.slice(1,3).map((dt,i)=>({label:["מחר","מחרתיים"][i],high:Math.round(d.temperature_2m_max[i+1]),low:Math.round(d.temperature_2m_min[i+1]),icon:WEATHER_ICONS[d.weathercode[i+1]]||"🌡️"})));}catch{setWeather([]);}}
    load();
  },[todayKey]);

  const{year,month}=summaryMonth;
  const daysInMonth=getDaysInMonth(year,month);
  const days=useMemo(()=>Array.from({length:daysInMonth},(_,i)=>{const d=new Date(year,month,i+1),key=getDayKey(d),entry=data[key];const earnings=entry?calcEarnings(entry.sessions,entry.active,hourlyRate):{regularMs:0,premiumMs:0,totalMs:0,regularEarnings:0,premiumEarnings:0,total:0};return{date:d,key,earnings,entry};}),[data,year,month,daysInMonth,hourlyRate]);
  const monthTotals=useMemo(()=>days.reduce((a,d)=>({totalMs:a.totalMs+d.earnings.totalMs,premiumMs:a.premiumMs+d.earnings.premiumMs,total:a.total+d.earnings.total,regularEarnings:a.regularEarnings+d.earnings.regularEarnings,premiumEarnings:a.premiumEarnings+d.earnings.premiumEarnings}),{totalMs:0,premiumMs:0,total:0,regularEarnings:0,premiumEarnings:0}),[days]);
  const maxDayMs=Math.max(...days.map(d=>d.earnings.totalMs),1);

  useEffect(()=>{
    const result={};const promises=[];
    for(let i=1;i<=daysInMonth;i++){const d=new Date(year,month,i);const sat=getSaturdayOf(d);if(sat){const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;promises.push(fetchParasha(sat).then(p=>{if(p)result[key]=p;}));}}
    Promise.all(promises).then(()=>setSummaryParashas({...result}));
  },[year,month]);

  const secDeg=now.getSeconds()*6,minDeg=now.getMinutes()*6+now.getSeconds()*0.1,hourDeg=(now.getHours()%12)*30+now.getMinutes()*0.5;
  const todayHoliday=getHolidayName(now.getTime());

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Segoe UI',system-ui,sans-serif",direction:"rtl",display:"flex",flexDirection:"column",alignItems:"center",paddingBottom:80}}>

      {manualEntry&&<ManualEntryModal targetDate={manualEntry.date} existingSessions={data[getDayKey(manualEntry.date)]?.sessions} onSave={sessions=>handleManualSave(manualEntry.date,sessions)} onClose={()=>setManualEntry(null)} hourlyRate={hourlyRate} T={T}/>}
      {showWage&&<WageModal currentRate={hourlyRate} onSave={rate=>{setHourlyRate(rate);setShowWage(false);}} onClose={()=>setShowWage(false)} T={T}/>}

      {/* Top bar */}
      <div style={{width:"100%",maxWidth:480,padding:"18px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:19,fontWeight:800,color:T.accent,letterSpacing:-0.5}}>דוח שעות</span>
        <span style={{fontSize:12,color:T.textFaint}}>{now.getDate()} {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</span>
      </div>

      {/* ── Clock view ── */}
      {view==="clock"&&(
        <div style={{width:"100%",maxWidth:480,padding:"18px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:18}}>

          {/* Clock + info row */}
          <div style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:14}}>
            <div style={{flex:1}}>
              <div style={{fontSize:30,fontWeight:300,letterSpacing:1,color:T.text,fontVariantNumeric:"tabular-nums"}}>{formatClock(now)}</div>
              <div style={{fontSize:13,color:T.textMuted,marginTop:3}}>
                {DAY_NAMES[now.getDay()]} · {now.getDate()} {MONTH_NAMES[now.getMonth()]}
                {todayHoliday&&<span style={{color:T.violet,marginRight:6}}>· {todayHoliday} ✦</span>}
              </div>
              {todayHebrew.full&&<div style={{fontSize:12,color:T.textFaint,marginTop:2}}>{todayHebrew.full}</div>}
              {isFriOrSat&&todayParasha&&<div style={{fontSize:12,color:T.violet,marginTop:3,fontWeight:600}}>{todayParasha} ✦</div>}
              {weather.length>0&&(
                <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:3}}>
                  {weather.map((w,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:T.textMuted}}>
                      <span>{w.label}</span><span>{w.icon}</span>
                      <span style={{fontWeight:700,color:T.text}}>{w.high}°</span>
                      <span style={{color:T.textFaint}}>{w.low}°</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <svg width="130" height="130" viewBox="0 0 200 200" style={{flexShrink:0}}>
              <circle cx="100" cy="100" r="96" fill="none" stroke={T.clockRing} strokeWidth="8"/>
              <circle cx="100" cy="100" r="90" fill={T.clockFace}/>
              {Array.from({length:12},(_,i)=>{const a=(i*30-90)*Math.PI/180;return<line key={i} x1={100+75*Math.cos(a)} y1={100+75*Math.sin(a)} x2={100+83*Math.cos(a)} y2={100+83*Math.sin(a)} stroke={T.clockTick} strokeWidth={i%3===0?3:1.5} strokeLinecap="round"/>;},)}
              <line x1="100" y1="100" x2={100+50*Math.cos((hourDeg-90)*Math.PI/180)} y2={100+50*Math.sin((hourDeg-90)*Math.PI/180)} stroke={T.clockHour} strokeWidth="4" strokeLinecap="round"/>
              <line x1="100" y1="100" x2={100+68*Math.cos((minDeg-90)*Math.PI/180)} y2={100+68*Math.sin((minDeg-90)*Math.PI/180)} stroke={T.clockMin} strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="100" y1="100" x2={100+72*Math.cos((secDeg-90)*Math.PI/180)} y2={100+72*Math.sin((secDeg-90)*Math.PI/180)} stroke={T.accent} strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="100" cy="100" r="4" fill={T.accent}/>
            </svg>
          </div>

          {/* Stats */}
          <div style={{background:T.surface,borderRadius:16,border:`1px solid ${T.border}`,padding:"14px 10px",width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
            {[
              {val:formatTime(todayEarnings.totalMs),label:'סה"כ היום',color:isCheckedIn?T.green:T.text},
              {val:formatMoney(todayEarnings.total),label:"הרווחת היום",color:T.gold},
              {val:formatTime(monthToDateHours.totalMs),label:"שעות החודש",color:T.accent},
              {val:formatMoney(monthToDateHours.total),label:"רווח החודש",color:T.gold},
            ].map((item,i)=>(
              <div key={i} style={{textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:item.color,fontVariantNumeric:"tabular-nums"}}>{item.val}</div>
                <div style={{fontSize:9,color:T.textFaint,marginTop:3}}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Check in/out */}
          <button onClick={isCheckedIn?handleCheckOut:handleCheckIn} style={{
            width:155,height:155,borderRadius:"50%",
            border:`3px solid ${isCheckedIn?T.red:T.green}`,
            background:T.surface,
            cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:7,
            boxShadow:isCheckedIn?`0 0 32px ${T.red}55`:`0 0 32px ${T.green}55`,transition:"all 0.2s",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isCheckedIn?T.red:T.green} strokeWidth="2.5" strokeLinecap="round">
              {isCheckedIn?<rect x="6" y="6" width="12" height="12" rx="2"/>:<polygon points="5,3 19,12 5,21"/>}
            </svg>
            <span style={{fontSize:19,fontWeight:800,color:isCheckedIn?T.red:T.green}}>{isCheckedIn?"יציאה":"כניסה"}</span>
            {isCheckedIn&&<span style={{fontSize:11,color:T.textFaint}}>מאז {new Date(todayData.active).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</span>}
          </button>

          {/* Manual entry */}
          <button onClick={()=>setManualEntry({date:new Date()})} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 20px",color:T.textSub,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",gap:8}}>
            <span>✏️</span> הזן שעות ידנית להיום
          </button>

          {/* Sessions */}
          {(todayData.sessions?.length>0||todayData.active)&&(
            <div style={{width:"100%"}}>
              <div style={{fontSize:13,color:T.textFaint,marginBottom:8,fontWeight:600}}>סשנים היום</div>
              {[...(todayData.sessions||[]),...(todayData.active?[{start:todayData.active,end:Date.now(),live:true}]:[])].map((s,i)=>{
                const sp=splitSession(s.start,s.end);
                const earn=(sp.regularMs/3600000)*hourlyRate+(sp.premiumMs/3600000)*hourlyRate*PREMIUM_RATE;
                const hol=getHolidayName(s.start)||getHolidayName((s.start+s.end)/2);
                return(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,marginBottom:6,fontSize:13}}>
                    <span style={{color:T.textSub}}>
                      {new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})} ← {s.live?<span style={{color:T.green}}>עכשיו</span>:new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}
                      {sp.premiumMs>0&&<span style={{color:T.violet,marginRight:6,fontSize:11}}>✦ {hol||"שבת"}</span>}
                    </span>
                    <div>
                      <span style={{color:T.gold,fontWeight:600}}>{formatMoney(earn)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Summary view ── */}
      {view==="summary"&&(
        <div style={{width:"100%",maxWidth:480,padding:"16px 20px"}}>

          {/* Month nav — RTL: right side = back, left side = forward */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            {/* Right side (RTL) arrow = back in time (previous month) */}
            <button onClick={()=>setSummaryMonth(p=>{const d=new Date(p.year,p.month-1,1);return{year:d.getFullYear(),month:d.getMonth()};})}
              style={{background:T.surface,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,width:40,height:40,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>→</button>

            <div style={{textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:700,color:T.text}}>
                {MONTH_NAMES[month]} {year}
                <span style={{fontSize:13,color:T.textFaint,fontWeight:400,marginRight:8}}>· {toHebrewDate(new Date(year,month,1)).monthStr}</span>
              </div>
              {(year!==new Date().getFullYear()||month!==new Date().getMonth())&&(
                <button onClick={()=>{const d=new Date();setSummaryMonth({year:d.getFullYear(),month:d.getMonth()});}} style={{marginTop:4,background:T.accent,border:"none",borderRadius:12,padding:"2px 12px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>היום ↩</button>
              )}
            </div>

            {/* Left side (RTL) arrow = forward in time (next month) */}
            <button onClick={()=>setSummaryMonth(p=>{const d=new Date(p.year,p.month+1,1);return{year:d.getFullYear(),month:d.getMonth()};})}
              style={{background:T.surface,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,width:40,height:40,cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          </div>

          {/* Month totals */}
          <div style={{background:T.surface,borderRadius:16,border:`1px solid ${T.border}`,padding:"14px",marginBottom:12,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
            <div><div style={{fontSize:18,fontWeight:700,color:T.accent}}>{formatTime(monthTotals.totalMs)}</div><div style={{fontSize:10,color:T.textFaint,marginTop:3}}>שעות</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:T.gold}}>{formatMoney(monthTotals.regularEarnings)}</div><div style={{fontSize:10,color:T.textFaint,marginTop:3}}>שכר רגיל</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:T.violet}}>{formatMoney(monthTotals.premiumEarnings)}</div><div style={{fontSize:10,color:T.textFaint,marginTop:3}}>בונוס ×1.5</div></div>
          </div>

          {/* Days */}
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {days.map(({date,earnings,entry})=>{
              const isToday=getDayKey(date)===getDayKey(new Date());
              const isWeekend=date.getDay()===5||date.getDay()===6;
              const pct=earnings.totalMs/maxDayMs;
              const isExp=expandedDay===getDayKey(date);
              const hasPremium=earnings.premiumMs>0;
              const dayKey2=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
              const hebrewDate=toHebrewDate(date);
              const parasha=summaryParashas[dayKey2]||null;
              const holidayToday=JEWISH_HOLIDAYS_RAW.find(h=>{const[ey,em,ed]=h.eve;return ey===date.getFullYear()&&em===date.getMonth()+1&&ed===date.getDate();});

              return(
                <div key={date.getDate()}>
                  <div onClick={()=>earnings.totalMs>0?setExpandedDay(isExp?null:getDayKey(date)):setManualEntry({date})}
                    style={{background:isToday?T.todayBg:T.surface,borderRadius:12,padding:"11px 14px",border:`1px solid ${isToday?T.todayBorder:T.border}`,position:"relative",overflow:"hidden",cursor:"pointer"}}>
                    {earnings.totalMs>0&&<div style={{position:"absolute",right:0,top:0,bottom:0,width:`${pct*100}%`,background:hasPremium?`linear-gradient(90deg,transparent,${T.violet}20)`:`linear-gradient(90deg,transparent,${T.accent}18)`,pointerEvents:"none"}}/>}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:34,height:34,borderRadius:9,background:isToday?T.accent:T.surface2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <span style={{fontSize:14,fontWeight:700,color:isToday?"#fff":isWeekend?T.textFaint:T.textSub}}>{date.getDate()}</span>
                        </div>
                        <div>
                          <div style={{fontSize:13,color:isWeekend?T.textFaint:T.textSub,fontWeight:500,display:"flex",alignItems:"center",gap:5}}>
                            {DAY_NAMES[date.getDay()]}
                            {isToday&&<span style={{color:T.accent,fontSize:10}}>היום</span>}
                            {holidayToday&&<span style={{color:T.violet,fontSize:10}}>✦ {holidayToday.name}</span>}
                            {!holidayToday&&hasPremium&&<span style={{color:T.violet,fontSize:10}}>✦</span>}
                          </div>
                          {hebrewDate.full&&<div style={{fontSize:10,color:T.textFaint,marginTop:1}}>{hebrewDate.full}</div>}
                          {parasha&&<div style={{fontSize:10,color:T.violet,marginTop:1}}>{parasha}</div>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {earnings.totalMs>0?(
                          <><span style={{fontSize:12,color:T.textMuted,fontVariantNumeric:"tabular-nums"}}>{formatTime(earnings.totalMs)}</span>
                          <span style={{fontSize:15,fontWeight:700,color:T.gold}}>{formatMoney(earnings.total)}</span>
                          <span style={{fontSize:11,color:T.textFaint}}>{isExp?"▲":"▼"}</span></>
                        ):(
                          <span style={{fontSize:12,color:T.textFaint}}>{isWeekend?"סופ״ש":"—"} <span style={{fontSize:11}}>✏️</span></span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExp&&entry&&(
                    <div style={{background:T.expandedBg,borderRadius:"0 0 12px 12px",padding:"12px 14px",border:`1px solid ${T.border}`,borderTop:"none",marginTop:-4}}>
                      {[...(entry.sessions||[]),...(entry.active?[{start:entry.active,end:Date.now(),live:true}]:[])].map((s,i)=>{
                        const sp=splitSession(s.start,s.end);
                        const earn=(sp.regularMs/3600000)*hourlyRate+(sp.premiumMs/3600000)*hourlyRate*PREMIUM_RATE;
                        return(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:12}}>
                            <span style={{color:T.textSub}}>
                              {new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})} ← {s.live?"עכשיו":new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}
                              {sp.premiumMs>0&&<span style={{color:T.violet,marginRight:4}}> ✦ {formatTime(sp.premiumMs)}</span>}
                            </span>
                            <span style={{color:T.gold,fontWeight:600}}>{formatMoney(earn)}</span>
                          </div>
                        );
                      })}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,fontSize:12}}>
                        <button onClick={()=>setManualEntry({date})} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:12,padding:0}}>✏️ עריכה</button>
                        <div style={{color:T.textMuted}}>רגיל: <span style={{color:T.gold}}>{formatMoney(earnings.regularEarnings)}</span>{earnings.premiumMs>0&&<> · ×1.5: <span style={{color:T.violet}}>{formatMoney(earnings.premiumEarnings)}</span></>}</div>
                        <span style={{color:T.gold,fontWeight:700}}>{formatMoney(earnings.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{height:16}}/>
        </div>
      )}

      <BottomNav view={view} setView={setView} darkMode={darkMode} toggleDark={()=>setDarkMode(d=>!d)} onWage={()=>setShowWage(true)} hourlyRate={hourlyRate} T={T}/>
    </div>
  );
}
