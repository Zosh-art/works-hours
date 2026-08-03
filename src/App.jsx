import { useState, useEffect, useMemo } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

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
  { name:"ראש השנה",    eve:[2024,10,2],  endDay:[2024,10,4],  eveName:"ערב ראש השנה"   },
  { name:"יום כיפור",   eve:[2024,10,11], endDay:[2024,10,12], eveName:"ערב יום כיפור"  },
  { name:"סוכות",       eve:[2024,10,16], endDay:[2024,10,17], eveName:"ערב סוכות"       },
  { name:"שמיני עצרת",  eve:[2024,10,23], endDay:[2024,10,24], eveName:"ערב שמיני עצרת" },
  { name:"פסח",         eve:[2025,4,12],  endDay:[2025,4,13],  eveName:"ערב פסח"         },
  { name:"שביעי פסח",   eve:[2025,4,18],  endDay:[2025,4,19],  eveName:"ערב שביעי פסח"  },
  { name:"שבועות",      eve:[2025,6,1],   endDay:[2025,6,2],   eveName:"ערב שבועות"      },
  { name:"ראש השנה",    eve:[2025,9,22],  endDay:[2025,9,24],  eveName:"ערב ראש השנה"   },
  { name:"יום כיפור",   eve:[2025,10,1],  endDay:[2025,10,2],  eveName:"ערב יום כיפור"  },
  { name:"סוכות",       eve:[2025,10,6],  endDay:[2025,10,7],  eveName:"ערב סוכות"       },
  { name:"שמיני עצרת",  eve:[2025,10,13], endDay:[2025,10,14], eveName:"ערב שמיני עצרת" },
  { name:"פסח",         eve:[2026,4,1],   endDay:[2026,4,2],   eveName:"ערב פסח"         },
  { name:"שביעי פסח",   eve:[2026,4,7],   endDay:[2026,4,8],   eveName:"ערב שביעי פסח"  },
  { name:"שבועות",      eve:[2026,5,21],  endDay:[2026,5,22],  eveName:"ערב שבועות"      },
  { name:"ראש השנה",    eve:[2026,9,11],  endDay:[2026,9,13],  eveName:"ערב ראש השנה"   },
  { name:"יום כיפור",   eve:[2026,9,20],  endDay:[2026,9,21],  eveName:"ערב יום כיפור"  },
  { name:"סוכות",       eve:[2026,9,25],  endDay:[2026,9,26],  eveName:"ערב סוכות"       },
  { name:"שמיני עצרת",  eve:[2026,10,2],  endDay:[2026,10,3],  eveName:"ערב שמיני עצרת" },
  { name:"פסח",         eve:[2027,4,21],  endDay:[2027,4,22],  eveName:"ערב פסח"         },
  { name:"שביעי פסח",   eve:[2027,4,27],  endDay:[2027,4,28],  eveName:"ערב שביעי פסח"  },
  { name:"שבועות",      eve:[2027,6,10],  endDay:[2027,6,11],  eveName:"ערב שבועות"      },
];

const CHANUKAH_RANGES = [
  { eve:[2024,12,25], endDay:[2025,1,2]  },
  { eve:[2025,12,14], endDay:[2025,12,22] },
  { eve:[2026,12,4],  endDay:[2026,12,12] },
];

const MINOR_JEWISH_DAYS = [
  { name:"צום גדליה",       date:[2024,10,6]  },
  { name:"צום גדליה",       date:[2025,9,25]  },
  { name:"צום גדליה",       date:[2026,9,14]  },
  { name:"עשרה בטבת",       date:[2025,1,10]  },
  { name:"עשרה בטבת",       date:[2025,12,30] },
  { name:"עשרה בטבת",       date:[2026,12,20] },
  { name:"תענית אסתר",      date:[2025,3,13]  },
  { name:"תענית אסתר",      date:[2026,3,2]   },
  { name:"תענית אסתר",      date:[2027,3,22]  },
  { name:"פורים",           date:[2025,3,14]  },
  { name:"פורים",           date:[2026,3,3]   },
  { name:"פורים",           date:[2027,3,23]  },
  { name:"שבעה עשר בתמוז",  date:[2025,7,13]  },
  { name:"שבעה עשר בתמוז",  date:[2026,7,2]   },
  { name:"שבעה עשר בתמוז",  date:[2027,7,22]  },
  { name:"תשעה באב",        date:[2025,8,3]   },
  { name:"תשעה באב",        date:[2026,7,23]  },
  { name:"תשעה באב",        date:[2027,8,12]  },
];

const HEB_HUNDREDS=["","ק","ר","ש","ת","תק","תר","תש","תת","תתק"];
const HEB_TENS=["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
const HEB_UNITS=["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
const HEB_DAY_ARR=["","א","ב","ג","ד","ה","ו","ז","ח","ט","י","יא","יב","יג","יד","טו","טז","יז","יח","יט","כ","כא","כב","כג","כד","כה","כו","כז","כח","כט","ל"];
function numToGematria(n){const h=Math.floor(n/100),t=Math.floor((n%100)/10),u=n%10;let s=(HEB_HUNDREDS[h]||"")+(HEB_TENS[t]||"")+(HEB_UNITS[u]||"");if(!s)return"";return s.length===1?s+"׳":s.slice(0,-1)+"״"+s.slice(-1);}
function toHebrewDate(date){try{const parts=new Intl.DateTimeFormat("he-IL-u-ca-hebrew",{day:"numeric",month:"long",year:"numeric"}).formatToParts(date);const dayNum=parseInt(parts.find(p=>p.type==="day")?.value||"0");const monthStr=parts.find(p=>p.type==="month")?.value||"";const yearNum=parseInt(new Intl.DateTimeFormat("en-u-ca-hebrew",{year:"numeric"}).format(date));const dayStr=(HEB_DAY_ARR[dayNum]||String(dayNum))+"׳";const yearStr="ה׳"+numToGematria(yearNum%1000);return{dayNum,monthStr,yearNum,dayStr,yearStr,full:`${dayStr} ב${monthStr} ${yearStr}`};}catch{return{dayNum:0,monthStr:"",yearNum:0,dayStr:"",yearStr:"",full:""};}}

const parashaCache={};
async function fetchParasha(saturdayDate){const key=`${saturdayDate.getFullYear()}-${String(saturdayDate.getMonth()+1).padStart(2,"0")}-${String(saturdayDate.getDate()).padStart(2,"0")}`;if(parashaCache[key])return parashaCache[key];try{const url=`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=off&min=off&mod=off&nx=off&year=${saturdayDate.getFullYear()}&month=${saturdayDate.getMonth()+1}&ss=off&mf=off&c=off&s=on&i=on&lg=he&leyning=off`;const res=await fetch(url,{mode:"cors",cache:"no-store"});if(!res.ok)throw new Error(`hebcal http ${res.status}`);const json=await res.json();const item=(json.items||[]).find((i)=>i.category==="parashat"&&i.date?.slice(0,10)===key);if(item?.hebrew){parashaCache[key]=item.hebrew;return item.hebrew;}return "";}catch(err){console.error("fetchParasha failed for",key,err);return "";}}

const SPECIAL_SHABBAT_RULES=[
  {months:["שבט"],range:[24,30],name:"שבת שקלים"},
  {months:["אדר","אדר ב׳"],range:[1,1],name:"שבת שקלים"},
  {months:["אדר","אדר ב׳"],range:[8,14],name:"שבת זכור"},
  {months:["אדר","אדר ב׳"],range:[15,21],name:"שבת פרה"},
  {months:["אדר","אדר ב׳"],range:[24,30],name:"שבת החודש"},
  {months:["ניסן"],range:[1,1],name:"שבת החודש"},
  {months:["ניסן"],range:[8,14],name:"שבת הגדול"},
  {months:["אב"],range:[3,9],name:"שבת חזון"},
  {months:["אב"],range:[10,16],name:"שבת נחמו"},
  {months:["תשרי"],range:[3,9],name:"שבת שובה"},
  {months:["תשרי"],range:[23,29],name:"שבת בראשית"},
  {months:["חשוון"],range:[1,6],name:"שבת בראשית"},
];
function getSpecialShabbat(date){const{monthStr,dayNum}=toHebrewDate(date);for(const r of SPECIAL_SHABBAT_RULES){if(r.months.includes(monthStr)&&dayNum>=r.range[0]&&dayNum<=r.range[1])return r.name;}return "";}
function formatParashaLabel(name,special){if(!name)return"";return special?`${name} (${special})`:name;}
function getSaturdayOf(date){const d=new Date(date),day=d.getDay();if(day===6)return d;if(day===5){d.setDate(d.getDate()+1);return d;}return null;}

const THEMES={
  light:{bg:"#F6F1E7",surface:"#FCFAF3",surface2:"#F0E9D8",surface3:"#E8DFC8",border:"#DED5C0",border2:"#C9BC9F",text:"#2A2620",textSub:"#5C5346",textMuted:"#847A68",textFaint:"#AFA48D",accent:"#A23B2E",accentLight:"#F3DCD6",gold:"#9C7A1E",green:"#2F5233",red:"#7A2A22",violet:"#3D3A6B",plum:"#95566A",plumLight:"#F2E2E3",sage:"#7C9473",clockFace:"#FCFAF3",clockRing:"#DED5C0",clockTick:"#C9BC9F",clockHour:"#2A2620",clockMin:"#5C5346",todayBg:"#F0E9D8",todayBorder:"#A23B2E",expandedBg:"#F8F4EA",modalOverlay:"rgba(30,22,14,0.5)",navBg:"#FCFAF3",nightBg:"#212B3D",nightSurface:"#283449",nightInk:"#E9E4D8",nightInkSub:"#AEB4C4",nightRing:"#3B4863",moonGold:"#C9A227"},
};

function getSunsetIL(year,month,day){const lat=31.7683,lon=35.2137;function calcJD(y,mo,d){if(mo<=2){y-=1;mo+=12;}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(mo+1))+d+B-1524.5;}const JD=calcJD(year,month,day),T=(JD-2451545.0)/36525.0;const L0=(280.46646+T*(36000.76983+T*0.0003032))%360;const M=(357.52911+T*(35999.05029-0.0001537*T))*Math.PI/180;const C=(1.914602-T*(0.004817+0.000014*T))*Math.sin(M)+(0.019993-0.000101*T)*Math.sin(2*M)+0.000289*Math.sin(3*M);const sunLon=(L0+C)*Math.PI/180,e=0.016708634-T*(0.000042037+0.0000001267*T);const eps=(23.439291111-T*(0.013004167+T*(0.00000164-T*0.000000504)))*Math.PI/180;const dec=Math.asin(Math.sin(eps)*Math.sin(sunLon));const y2=Math.tan(eps/2)**2,L0r=L0*Math.PI/180;const eqTime=(y2*Math.sin(2*L0r)-2*e*Math.sin(M)+4*e*y2*Math.sin(M)*Math.cos(2*L0r)-0.5*y2*y2*Math.sin(4*L0r)-1.25*e*e*Math.sin(2*M))*4*180/Math.PI;const cosHA=(Math.cos(90.833*Math.PI/180)-Math.sin(lat*Math.PI/180)*Math.sin(dec))/(Math.cos(lat*Math.PI/180)*Math.cos(dec));const HAdeg=Math.acos(cosHA)*180/Math.PI;const sunsetUTC=(720-4*lon-eqTime)/60+HAdeg*4/60;const dateObj=new Date(year,month-1,day);const lsm=new Date(year,2,31);lsm.setDate(31-lsm.getDay());const lso=new Date(year,9,31);lso.setDate(31-lso.getDay());const local=sunsetUTC+((dateObj>=lsm&&dateObj<lso)?3:2);return{h:Math.floor(local),m:Math.round((local-Math.floor(local))*60)};}
function buildHolidayWindows(){return JEWISH_HOLIDAYS_RAW.map(h=>{const[ey,em,ed]=h.eve,[dy,dm,dd]=h.endDay,s=getSunsetIL(ey,em,ed);const start=new Date(ey,em-1,ed,s.h,s.m,0,0).getTime();const end=new Date(dy,dm-1,dd);end.setDate(end.getDate()+1);end.setHours(6,0,0,0);return{start,end:end.getTime(),name:h.name};});}
const HOLIDAY_WINDOWS=buildHolidayWindows();
function buildHolidayEveSunsets(){return JEWISH_HOLIDAYS_RAW.map(h=>{const[ey,em,ed]=h.eve,s=getSunsetIL(ey,em,ed);return new Date(ey,em-1,ed,s.h,s.m,0,0).getTime();});}
const HOLIDAY_EVE_SUNSETS=buildHolidayEveSunsets();
function getShabbatWindow(dateTs){const fd=new Date(dateTs);fd.setHours(0,0,0,0);while(fd.getDay()!==5)fd.setDate(fd.getDate()+(fd.getDay()<5?5-fd.getDay():7-(fd.getDay()-5)));const s=getSunsetIL(fd.getFullYear(),fd.getMonth()+1,fd.getDate());const start=new Date(fd);start.setHours(s.h,s.m,0,0);const end=new Date(fd);end.setDate(fd.getDate()+2);end.setHours(6,0,0,0);return{start:start.getTime(),end:end.getTime()};}
function isInPremiumWindow(ts){const sw=getShabbatWindow(ts);if(ts>=sw.start&&ts<sw.end)return true;for(const hw of HOLIDAY_WINDOWS)if(ts>=hw.start&&ts<hw.end)return true;return false;}
function getNextPremiumStart(startTs,endTs){const c=[];const sw=getShabbatWindow(startTs);if(sw.start>startTs&&sw.start<endTs)c.push(sw.start);for(const hw of HOLIDAY_WINDOWS)if(hw.start>startTs&&hw.start<endTs)c.push(hw.start);for(const es of HOLIDAY_EVE_SUNSETS)if(es>startTs&&es<endTs)c.push(es);return c.length?Math.min(...c):null;}
function splitSession(startTs,endTs){const totalMs=endTs-startTs;if(isInPremiumWindow(startTs))return{regularMs:0,premiumMs:totalMs};const ps=getNextPremiumStart(startTs,endTs);if(ps!==null)return{regularMs:ps-startTs,premiumMs:endTs-ps};return{regularMs:totalMs,premiumMs:0};}
function getHolidayName(ts){for(const hw of HOLIDAY_WINDOWS)if(ts>=hw.start&&ts<hw.end)return hw.name;return null;}

function getDayHolidayInfo(date) {
  const y=date.getFullYear(), m=date.getMonth()+1, d=date.getDate();
  const asEve = JEWISH_HOLIDAYS_RAW.find(h=>h.eve[0]===y&&h.eve[1]===m&&h.eve[2]===d);
  if(asEve) return { type:"eve", label: asEve.eveName };
  const asHoliday = HOLIDAY_WINDOWS.find(hw=>{
    const dayStart=new Date(y,m-1,d,6,0,0,0).getTime();
    const dayEnd=new Date(y,m-1,d,23,59,0,0).getTime();
    return hw.start<=dayEnd && hw.end>dayStart;
  });
  if(asHoliday) return { type:"holiday", label: asHoliday.name };
  const asChanukahEve = CHANUKAH_RANGES.find(c=>c.eve[0]===y&&c.eve[1]===m&&c.eve[2]===d);
  if(asChanukahEve) return { type:"eve", label:"ערב חנוכה" };
  const dateTs=new Date(y,m-1,d).getTime();
  const asChanukah = CHANUKAH_RANGES.find(c=>{
    const startTs=new Date(c.eve[0],c.eve[1]-1,c.eve[2]+1).getTime();
    const endTs=new Date(c.endDay[0],c.endDay[1]-1,c.endDay[2]).getTime();
    return dateTs>=startTs && dateTs<=endTs;
  });
  if(asChanukah) return { type:"holiday", label:"חנוכה" };
  const asMinor = MINOR_JEWISH_DAYS.find(md=>md.date[0]===y&&md.date[1]===m&&md.date[2]===d);
  if(asMinor) return { type: asMinor.name==="פורים"?"holiday":"fast", label: asMinor.name };
  return null;
}

function formatTime(ms){if(!ms||ms<=0)return"0:00";return`${Math.floor(ms/3600000)}:${String(Math.floor((ms%3600000)/60000)).padStart(2,"0")}`;}
function formatMoney(n){return"₪"+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");}
function formatClock(d){return d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit",second:"2-digit"});}
function getDayKey(d){return`${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate();}

function carryOverMidnight(prevData,todayKeyNow){
  let changed=false;
  const next={...prevData};
  for(const key of Object.keys(prevData)){
    const entry=prevData[key];
    if(!entry?.active||key===todayKeyNow)continue;
    const[y,m,d]=key.split("-").map(Number);
    let cursorYear=y,cursorMonth=m,cursorDay=d;
    let cursorKey=key;
    let sessionStart=entry.active;
    let sessions=entry.sessions?[...entry.sessions]:[];
    while(cursorKey!==todayKeyNow){
      const endOfDay=new Date(cursorYear,cursorMonth,cursorDay,23,59,59,999).getTime();
      sessions.push({start:sessionStart,end:endOfDay});
      next[cursorKey]={sessions,active:null};
      const nd=new Date(cursorYear,cursorMonth,cursorDay+1);
      cursorYear=nd.getFullYear();cursorMonth=nd.getMonth();cursorDay=nd.getDate();
      cursorKey=getDayKey(nd);
      sessionStart=new Date(cursorYear,cursorMonth,cursorDay,0,0,0,0).getTime();
      sessions=next[cursorKey]?.sessions?[...next[cursorKey].sessions]:[];
    }
    next[cursorKey]={sessions,active:sessionStart};
    changed=true;
  }
  return changed?next:prevData;
}

function calcEarnings(sessions,activeStart=null,hourlyRate=52.19){let regularMs=0,premiumMs=0;const all=[...(sessions||[])];if(activeStart)all.push({start:activeStart,end:Date.now()});for(const s of all){const sp=splitSession(s.start,s.end);regularMs+=sp.regularMs;premiumMs+=sp.premiumMs;}const re=(regularMs/3600000)*hourlyRate,pe=(premiumMs/3600000)*hourlyRate*PREMIUM_RATE;return{regularMs,premiumMs,totalMs:regularMs+premiumMs,regularEarnings:re,premiumEarnings:pe,total:re+pe};}

function isExactMidnight(ts,dateRef){const d=new Date(ts);const ref=new Date(dateRef);return d.getFullYear()===ref.getFullYear()&&d.getMonth()===ref.getMonth()&&d.getDate()===ref.getDate()&&d.getHours()===0&&d.getMinutes()===0;}
function isExactEndOfDay(ts,dateRef){const d=new Date(ts);const ref=new Date(dateRef);return d.getFullYear()===ref.getFullYear()&&d.getMonth()===ref.getMonth()&&d.getDate()===ref.getDate()&&d.getHours()===23&&d.getMinutes()===59;}
function getDisplaySessionsForDay(data,dateObj){
  const dayKey=getDayKey(dateObj);
  const entry=data[dayKey];
  const prevDate=new Date(dateObj);prevDate.setDate(prevDate.getDate()-1);
  const prevEntry=data[getDayKey(prevDate)];
  const rawSessions=entry?.sessions||[];
  const result=[];
  for(const s of rawSessions){
    if(isExactMidnight(s.start,dateObj)){
      const prevRaw=prevEntry?.sessions||[];
      const prevLast=prevRaw[prevRaw.length-1];
      if(prevLast&&isExactEndOfDay(prevLast.end,prevDate))continue;
    }
    if(isExactEndOfDay(s.end,dateObj)){
      let mergedEnd=s.end,isLive=false;
      const cursorDate=new Date(dateObj);cursorDate.setDate(cursorDate.getDate()+1);
      for(let guard=0;guard<400;guard++){
        const cEntry=data[getDayKey(cursorDate)];
        if(!cEntry)break;
        const cRaw=cEntry.sessions||[];
        const first=cRaw[0];
        if(first&&isExactMidnight(first.start,cursorDate)){
          mergedEnd=first.end;
          if(isExactEndOfDay(first.end,cursorDate)){cursorDate.setDate(cursorDate.getDate()+1);continue;}
          break;
        }else if(cEntry.active&&isExactMidnight(cEntry.active,cursorDate)){
          mergedEnd=Date.now();isLive=true;break;
        }else break;
      }
      result.push({start:s.start,end:mergedEnd,live:isLive,shiftLabel:s.shiftLabel});
    }else{
      result.push({start:s.start,end:s.end,live:false,shiftLabel:s.shiftLabel});
    }
  }
  if(entry?.active&&!isExactMidnight(entry.active,dateObj)){
    result.push({start:entry.active,end:Date.now(),live:true});
  }
  return result;
}

const SHIFT_LABELS={morning:"בוקר",afternoon:"צהריים",night:"לילה",bt:"בצ",tl:"צל",btl:"בצל"};
function classifySession(startTs,endTs){
  if(!startTs||!endTs||endTs<=startTs)return"";
  const H=3600000;
  let mo=0,af=0,ni=0;
  const first=new Date(startTs);first.setHours(0,0,0,0);
  let dayStart=first.getTime();
  const ov=(w)=>Math.max(0,Math.min(endTs,w[1])-Math.max(startTs,w[0]));
  while(dayStart<endTs){
    mo+=ov([dayStart+5*H,dayStart+14*H]);
    af+=ov([dayStart+14*H,dayStart+20*H]);
    ni+=ov([dayStart+20*H,dayStart+24*H])+ov([dayStart,dayStart+5*H]);
    dayStart+=24*H;
  }
  const THRESH=45*60000;
  const segs=[];
  if(mo>THRESH)segs.push("m");
  if(af>THRESH)segs.push("a");
  if(ni>THRESH)segs.push("n");
  if(segs.length<=1){
    const max=Math.max(mo,af,ni);
    if(max<=0)return"";
    if(max===ni)return SHIFT_LABELS.night;
    if(max===mo)return SHIFT_LABELS.morning;
    return SHIFT_LABELS.afternoon;
  }
  const key=segs.join("");
  if(key==="ma")return SHIFT_LABELS.bt;
  if(key==="an")return SHIFT_LABELS.tl;
  if(key==="man")return SHIFT_LABELS.btl;
  return mo>=ni?SHIFT_LABELS.morning:SHIFT_LABELS.night;
}

const ChevronRight=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const ChevronLeft=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;

function ManualEntryModal({targetDate,existingSessions,onSave,onClose,hourlyRate=52.19,T}){const dateStr=`${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,"0")}-${String(targetDate.getDate()).padStart(2,"0")}`;const[sessions,setSessions]=useState(existingSessions?.length?existingSessions.map((s)=>({startStr:new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}).replace(".",":"),endStr:new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}).replace(".",":")})):[{startStr:"09:00",endStr:"17:00"}]);function parseTime(ds,t){const[h,m]=t.split(":").map(Number);if(isNaN(h)||isNaN(m))return null;const d=new Date(ds+"T00:00:00");d.setHours(h,m,0,0);return d.getTime();}function parseRange(ds,startStr,endStr){const start=parseTime(ds,startStr);let end=parseTime(ds,endStr);if(start!=null&&end!=null&&end<=start){const nd=new Date(ds+"T00:00:00");nd.setDate(nd.getDate()+1);const[h,m]=endStr.split(":").map(Number);nd.setHours(h,m,0,0);end=nd.getTime();}return{start,end};}function crossesMidnight(startStr,endStr){const[sh,sm]=startStr.split(":").map(Number);const[eh,em]=endStr.split(":").map(Number);if(isNaN(sh)||isNaN(sm)||isNaN(eh)||isNaN(em))return false;return(eh*60+em)<=(sh*60+sm);}function handleSave(){const p=sessions.map(s=>parseRange(dateStr,s.startStr,s.endStr)).filter(s=>s.start&&s.end&&s.end>s.start);if(!p.length)return;onSave(p);}const previewEarn=useMemo(()=>{const p=sessions.map(s=>parseRange(dateStr,s.startStr,s.endStr)).filter(s=>s.start&&s.end&&s.end>s.start);return p.length?calcEarnings(p,null,hourlyRate):null;},[sessions,hourlyRate]);
return (<div style={{position:"fixed",inset:0,background:T.modalOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}><div style={{background:T.surface,borderRadius:20,padding:24,width:"100%",maxWidth:380,border:`1px solid ${T.border}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><span style={{fontWeight:700,fontSize:17,color:T.text}}>הזנה ידנית — {targetDate.getDate()} {MONTH_NAMES[targetDate.getMonth()]}</span><button onClick={onClose} style={{background:"none",border:"none",color:T.textFaint,fontSize:22,cursor:"pointer"}}>✕</button></div>{sessions.map((s,i)=>(<div key={i} style={{marginBottom:12}}><div style={{display:"flex",gap:10,alignItems:"center"}}><div style={{flex:1}}><div style={{fontSize:11,color:T.textFaint,marginBottom:4}}>כניסה</div><input type="time" value={s.startStr} onChange={e=>setSessions(p=>p.map((x,j)=>j===i?{...x,startStr:e.target.value}:x))} style={{width:"100%",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:16,outline:"none"}}/></div><div style={{flex:1}}><div style={{fontSize:11,color:T.textFaint,marginBottom:4}}>יציאה</div><input type="time" value={s.endStr} onChange={e=>setSessions(p=>p.map((x,j)=>j===i?{...x,endStr:e.target.value}:x))} style={{width:"100%",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:16,outline:"none"}}/></div>{sessions.length>1&&<button onClick={()=>setSessions(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:T.red,fontSize:20,cursor:"pointer",marginTop:16}}>✕</button>}</div>{crossesMidnight(s.startStr,s.endStr)&&<div style={{fontSize:11,color:T.violet,marginTop:4}}>🌙 המשמרת נמשכת עד למחרת</div>}</div>))}<button onClick={()=>setSessions(p=>[...p,{startStr:"09:00",endStr:"17:00"}])} style={{width:"100%",padding:"9px",background:T.surface2,border:`1px dashed ${T.border}`,borderRadius:10,color:T.textSub,cursor:"pointer",fontSize:14,marginBottom:14}}>+ הוסף סשן נוסף</button>{previewEarn&&<div style={{background:T.surface2,borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",justifyContent:"space-between"}}><span style={{color:T.textMuted,fontSize:13}}>סה"כ: <span style={{color:T.accent,fontWeight:700}}>{formatTime(previewEarn.totalMs)}</span></span><span style={{color:T.gold,fontWeight:700,fontSize:15}}>{formatMoney(previewEarn.total)}</span></div>}<div style={{display:"flex",gap:10}}><button onClick={onClose} style={{flex:1,padding:"12px",background:T.surface2,border:"none",borderRadius:12,color:T.textSub,cursor:"pointer",fontWeight:600,fontSize:15}}>ביטול</button><button onClick={handleSave} style={{flex:2,padding:"12px",background:T.accent,border:"none",borderRadius:12,color:"#fff",cursor:"pointer",fontWeight:700,fontSize:15}}>שמור</button></div></div></div>);}

function WageModal({currentRate,onSave,onClose,T}){const preset=WAGE_PRESETS.find(p=>p.value===currentRate);const[selected,setSelected]=useState(preset?preset.value:null);const[customVal,setCustomVal]=useState(preset?"":String(currentRate));function handleSave(){const rate=selected!==null?selected:parseFloat(customVal.replace(",","."));if(!rate||isNaN(rate)||rate<=0)return;onSave(rate);}
return (<div style={{position:"fixed",inset:0,background:T.modalOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}><div style={{background:T.surface,borderRadius:20,padding:24,width:"100%",maxWidth:360,border:`1px solid ${T.border}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><span style={{fontWeight:700,fontSize:17,color:T.text}}>תעריף שעתי</span><button onClick={onClose} style={{background:"none",border:"none",color:T.textFaint,fontSize:22,cursor:"pointer"}}>✕</button></div><div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>{WAGE_PRESETS.map(p=>(<button key={p.label} onClick={()=>{setSelected(p.value);if(p.value)setCustomVal("");}} style={{padding:"14px 18px",borderRadius:12,border:"none",cursor:"pointer",textAlign:"right",background:(p.value!==null?selected===p.value:selected===null)?T.accent:T.surface2,color:(p.value!==null?selected===p.value:selected===null)?"#fff":T.textSub,fontWeight:700,fontSize:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>{p.value?`₪${p.label}`:p.label}</span>{(p.value!==null?selected===p.value:selected===null)&&<span>✓</span>}</button>))}</div>{selected===null&&<div style={{marginBottom:16}}><div style={{fontSize:12,color:T.textFaint,marginBottom:6}}>הזן תעריף ידנית</div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:T.gold,fontWeight:700,fontSize:18}}>₪</span><input type="number" step="0.01" min="0" value={customVal} onChange={e=>setCustomVal(e.target.value)} placeholder="0.00" autoFocus style={{flex:1,background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:"12px",color:T.text,fontSize:18,outline:"none"}}/></div></div>}<div style={{display:"flex",gap:10}}><button onClick={onClose} style={{flex:1,padding:"12px",background:T.surface2,border:"none",borderRadius:12,color:T.textSub,cursor:"pointer",fontWeight:600,fontSize:15}}>ביטול</button><button onClick={handleSave} style={{flex:2,padding:"12px",background:T.accent,border:"none",borderRadius:12,color:"#fff",cursor:"pointer",fontWeight:700,fontSize:15}}>שמור</button></div></div></div>);}

function JournalDayModal({date,sessions,notes,parasha,specialShabbat,onAddNote,onDeleteNote,onSetShiftOverride,onMergeSessions,onDeleteSession,onClose,T}){
  const[text,setText]=useState("");
  const[editingStart,setEditingStart]=useState(null);
  const[confirmDeleteStart,setConfirmDeleteStart]=useState(null);
  const[mergeMode,setMergeMode]=useState(false);
  const[selected,setSelected]=useState([]);
  const hebrewDate=toHebrewDate(date);
  const holidayInfo=getDayHolidayInfo(date);
  function handleAdd(){if(!text.trim())return;onAddNote(text);setText("");}
  function toggleSelect(start){setSelected(p=>p.includes(start)?p.filter(x=>x!==start):[...p,start]);}
  function handleMergeConfirm(){if(selected.length>=2)onMergeSessions(selected);setSelected([]);setMergeMode(false);}
  function cancelMerge(){setSelected([]);setMergeMode(false);}
  return (
    <div style={{position:"fixed",inset:0,background:T.modalOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
      <div style={{background:T.surface,borderRadius:20,padding:24,width:"100%",maxWidth:380,maxHeight:"80vh",overflowY:"auto",border:`1px solid ${T.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontWeight:700,fontSize:17,color:T.text}}>{DAY_NAMES[date.getDay()]} {date.getDate()} {MONTH_NAMES[date.getMonth()]}</div>
            <div style={{fontSize:12,color:T.textFaint,marginTop:2}}>{hebrewDate.full}</div>
            {holidayInfo&&<div style={{fontSize:12,color:T.plum,marginTop:3,fontWeight:600}}>✦ {holidayInfo.label}</div>}
            {!holidayInfo&&specialShabbat&&<div style={{fontSize:12,color:T.plum,marginTop:3,fontWeight:600}}>✦ {specialShabbat}</div>}
            {parasha&&<div style={{fontSize:12,color:T.plum,marginTop:3,fontWeight:600}}>{formatParashaLabel(parasha,specialShabbat||"")} ✦</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.textFaint,fontSize:22,cursor:"pointer"}}>✕</button>
        </div>

        {sessions.length>0&&(
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:12,color:T.textFaint,fontWeight:600}}>משמרות</div>
              {sessions.filter(s=>!s.live).length>=2&&(
                mergeMode?(
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={cancelMerge} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:11}}>ביטול</button>
                    <button onClick={handleMergeConfirm} disabled={selected.length<2} style={{background:selected.length>=2?T.accent:T.surface2,border:"none",borderRadius:8,padding:"3px 10px",color:selected.length>=2?"#fff":T.textFaint,cursor:selected.length>=2?"pointer":"default",fontSize:11,fontWeight:600}}>מזג ({selected.length})</button>
                  </div>
                ):(
                  <button onClick={()=>setMergeMode(true)} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:11,fontWeight:600}}>איחוד משמרות</button>
                )
              )}
            </div>
            {sessions.map((s,i)=>{
              const label=s.shiftLabel||classifySession(s.start,s.end);
              const isEditing=editingStart===s.start;
              const isSelected=selected.includes(s.start);
              return (
                <div key={i} onClick={()=>mergeMode&&!s.live&&toggleSelect(s.start)} style={{padding:"8px 12px",background:isSelected?T.accentLight:T.surface2,borderRadius:10,marginBottom:6,fontSize:13,cursor:mergeMode&&!s.live?"pointer":"default",border:isSelected?`1px solid ${T.accent}`:"1px solid transparent"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {mergeMode&&!s.live&&<span style={{width:16,height:16,borderRadius:4,border:`2px solid ${T.accent}`,background:isSelected?T.accent:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,flexShrink:0}}>{isSelected?"✓":""}</span>}
                      <span style={{color:T.textSub}}>{new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})} ← {s.live?<span style={{color:T.green}}>עכשיו</span>:new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}{!s.live&&new Date(s.start).toDateString()!==new Date(s.end).toDateString()&&<span style={{color:T.textFaint}}> ({new Date(s.end).toLocaleDateString("he-IL",{day:"2-digit",month:"2-digit"})})</span>}</span>
                    </div>
                    {!mergeMode&&(<div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:T.accent,fontWeight:600}}>{label}</span>
                      {!s.live&&<button onClick={()=>setEditingStart(isEditing?null:s.start)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:12,padding:0}}>✏️</button>}
                      {!s.live&&<button onClick={()=>setConfirmDeleteStart(confirmDeleteStart===s.start?null:s.start)} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:12,padding:0}}>🗑️</button>}
                    </div>)}
                  </div>
                  {confirmDeleteStart===s.start&&!mergeMode&&(
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,background:T.accentLight,borderRadius:8,padding:"6px 10px"}}>
                      <span style={{fontSize:12,color:T.text}}>למחוק את המשמרת הזו?</span>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={(e)=>{e.stopPropagation();setConfirmDeleteStart(null);}} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:12,fontWeight:600}}>ביטול</button>
                        <button onClick={(e)=>{e.stopPropagation();onDeleteSession(s.start);setConfirmDeleteStart(null);}} style={{background:T.red,border:"none",borderRadius:6,padding:"3px 10px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>מחק</button>
                      </div>
                    </div>
                  )}
                  {isEditing&&!mergeMode&&(
                    <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                      {["בוקר","צהריים","לילה","בצ","צל","בצל"].map(opt=>(
                        <button key={opt} onClick={(e)=>{e.stopPropagation();onSetShiftOverride(s.start,opt);setEditingStart(null);}} style={{padding:"5px 10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:label===opt?T.accent:T.surface,color:label===opt?"#fff":T.textSub}}>{opt}</button>
                      ))}
                      <button onClick={(e)=>{e.stopPropagation();onSetShiftOverride(s.start,null);setEditingStart(null);}} style={{padding:"5px 10px",borderRadius:8,border:`1px dashed ${T.border}`,cursor:"pointer",fontSize:12,color:T.textFaint,background:"none"}}>אוטומטי</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{fontSize:12,color:T.textFaint,marginBottom:6,fontWeight:600}}>הערות</div>
        {(notes||[]).length>0?(notes.map(n=>(
          <div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:T.surface2,borderRadius:10,marginBottom:6,fontSize:13}}>
            <span style={{color:T.textSub}}>{n.text}</span>
            <button onClick={()=>onDeleteNote(n.id)} style={{background:"none",border:"none",color:T.red,fontSize:15,cursor:"pointer",padding:0}}>✕</button>
          </div>
        ))):(<div style={{fontSize:12,color:T.textFaint,marginBottom:8}}>אין הערות עדיין</div>)}

        <div style={{display:"flex",gap:8,marginTop:10}}>
          <input type="text" value={text} onChange={e=>setText(e.target.value)} placeholder="הוסף הערה..." onKeyDown={e=>e.key==="Enter"&&handleAdd()} style={{flex:1,background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:T.text,fontSize:14,outline:"none"}}/>
          <button onClick={handleAdd} style={{background:T.accent,border:"none",borderRadius:10,padding:"0 16px",color:"#fff",cursor:"pointer",fontWeight:700}}>+</button>
        </div>
      </div>
    </div>
  );
}

// ── מסך התחברות / הרשמה (Firebase Authentication) ────────────────────────────
function AuthScreen({T}){
  const[mode,setMode]=useState("login"); // login | signup | reset
  const[email,setEmail]=useState("");
  const[pw,setPw]=useState("");
  const[pw2,setPw2]=useState("");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const[msg,setMsg]=useState("");

  function translateErr(err){
    const c=err?.code||"";
    if(c.includes("email-already-in-use"))return"האימייל הזה כבר רשום — נסה להתחבר במקום";
    if(c.includes("invalid-email"))return"כתובת אימייל לא תקינה";
    if(c.includes("weak-password"))return"הסיסמה חייבת להכיל לפחות 6 תווים";
    if(c.includes("user-not-found")||c.includes("wrong-password")||c.includes("invalid-credential"))return"אימייל או סיסמה שגויים";
    if(c.includes("too-many-requests"))return"יותר מדי ניסיונות, נסה שוב בעוד כמה דקות";
    return"קרתה תקלה, נסה שוב";
  }

  async function handleSubmit(){
    setError("");setMsg("");setBusy(true);
    try{
      if(mode==="signup"){
        if(pw.length<6){setError("הסיסמה חייבת להכיל לפחות 6 תווים");setBusy(false);return;}
        if(pw!==pw2){setError("הסיסמאות לא תואמות");setBusy(false);return;}
        await createUserWithEmailAndPassword(auth,email.trim(),pw);
      }else if(mode==="login"){
        await signInWithEmailAndPassword(auth,email.trim(),pw);
      }else if(mode==="reset"){
        await sendPasswordResetEmail(auth,email.trim());
        setMsg("נשלח מייל לאיפוס סיסמה — בדוק את תיבת הדואר שלך");
      }
    }catch(err){setError(translateErr(err));}
    setBusy(false);
  }

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,direction:"rtl"}}>
      <div style={{background:T.surface,borderRadius:20,padding:28,width:"100%",maxWidth:360,border:`1px solid ${T.border}`,textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:10}}>{mode==="reset"?"✉️":"👋"}</div>
        <div style={{fontSize:19,fontWeight:800,color:T.text,marginBottom:6}}>{mode==="signup"?"יצירת חשבון":mode==="reset"?"איפוס סיסמה":"התחברות"}</div>
        <div style={{fontSize:13,color:T.textMuted,marginBottom:18,lineHeight:1.5}}>{mode==="signup"?"המידע שלך יישמר בענן, נגיש רק לך מכל מכשיר":mode==="reset"?"נשלח לך קישור לאיפוס הסיסמה במייל":"התחבר כדי לראות את השעות שלך"}</div>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="אימייל" autoFocus style={{width:"100%",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",color:T.text,fontSize:16,outline:"none",marginBottom:10,textAlign:"center"}}/>
        {mode!=="reset"&&<input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="סיסמה" onKeyDown={e=>e.key==="Enter"&&mode!=="signup"&&handleSubmit()} style={{width:"100%",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",color:T.text,fontSize:16,outline:"none",marginBottom:mode==="signup"?10:16,textAlign:"center"}}/>}
        {mode==="signup"&&<input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="אימות סיסמה" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} style={{width:"100%",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",color:T.text,fontSize:16,outline:"none",marginBottom:16,textAlign:"center"}}/>}
        {error&&<div style={{color:T.red,fontSize:13,marginBottom:12,fontWeight:600}}>{error}</div>}
        {msg&&<div style={{color:T.green,fontSize:13,marginBottom:12,fontWeight:600}}>{msg}</div>}
        <button onClick={handleSubmit} disabled={busy||!email||(mode!=="reset"&&!pw)} style={{width:"100%",padding:"13px",background:busy||!email?T.surface2:T.accent,border:"none",borderRadius:12,color:busy||!email?T.textFaint:"#fff",cursor:busy?"default":"pointer",fontWeight:700,fontSize:15}}>{busy?"רגע...":mode==="signup"?"צור חשבון":mode==="reset"?"שלח קישור איפוס":"התחבר"}</button>
        <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:8}}>
          {mode==="login"&&<>
            <button onClick={()=>{setMode("signup");setError("");setMsg("");}} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:13}}>אין לך חשבון? הירשם</button>
            <button onClick={()=>{setMode("reset");setError("");setMsg("");}} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:12}}>שכחת סיסמה?</button>
          </>}
          {mode==="signup"&&<button onClick={()=>{setMode("login");setError("");setMsg("");}} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:13}}>כבר יש לך חשבון? התחבר</button>}
          {mode==="reset"&&<button onClick={()=>{setMode("login");setError("");setMsg("");}} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",fontSize:13}}>חזרה להתחברות</button>}
        </div>
      </div>
    </div>
  );
}

function StampButton({isCheckedIn,onClick,sinceLabel,T}){
  const[pressed,setPressed]=useState(false);
  function handleClick(){setPressed(true);onClick();setTimeout(()=>setPressed(false),180);}
  const color=isCheckedIn?T.red:T.green;
  return (
    <button onClick={handleClick} style={{width:155,height:155,borderRadius:"50%",border:`3px solid ${color}`,background:T.surface,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:7,position:"relative",transform:pressed?"scale(0.93)":"scale(1)",transition:"transform 0.15s ease",boxShadow:`0 0 0 6px ${color}18`}}>
      <span style={{position:"absolute",inset:8,borderRadius:"50%",border:`1px dashed ${color}66`,pointerEvents:"none"}}/>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">{isCheckedIn?<rect x="6" y="6" width="12" height="12" rx="2"/>:<polygon points="5,3 19,12 5,21"/>}</svg>
      <span style={{fontSize:19,fontWeight:800,color}}>{isCheckedIn?"יציאה":"כניסה"}</span>
      {sinceLabel&&<span style={{fontSize:11,color:T.textFaint}}>מאז {sinceLabel}</span>}
    </button>
  );
}

function BottomNav({view,setView,onWage,hourlyRate,T}){
  const tabs=[
    {id:"clock",label:"ראשי",icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9L12 2l9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
    {id:"summary",label:"סיכום",icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>},
    {id:"wage",label:"שכר",icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>},
    {id:"journal",label:"יומן",icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>},
  ];
  return (<div style={{position:"fixed",bottom:0,left:0,right:0,background:T.navBg,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-around",padding:"6px 0 max(8px,env(safe-area-inset-bottom))",zIndex:100}}>{tabs.map(tab=>{const isActive=["clock","summary","journal"].includes(tab.id)?view===tab.id:false;const color=isActive?T.accent:T.textMuted;return (<button key={tab.id} onClick={()=>{if(tab.id==="wage")onWage();else setView(tab.id);}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 10px",color,minWidth:56}}>{tab.icon}<span style={{fontSize:10,fontWeight:isActive?700:500}}>{tab.label}</span></button>);})}</div>);
}

export default function WorkHoursTracker(){
  const[now,setNow]=useState(new Date());
  const[view,setView]=useState("clock");
  const[expandedDay,setExpandedDay]=useState(null);
  const[manualEntry,setManualEntry]=useState(null);
  const[showWage,setShowWage]=useState(false);
  const[user,setUser]=useState(undefined); // undefined=בטעינה, null=לא מחובר, אובייקט=מחובר
  const[docLoaded,setDocLoaded]=useState(false);
  const[hourlyRate,setHourlyRate]=useState(52.19);
  const[data,setData]=useState({});
  const[summaryMonth,setSummaryMonth]=useState(()=>{const d=new Date();return{year:d.getFullYear(),month:d.getMonth()};});
  const[journalMonth,setJournalMonth]=useState(()=>{const d=new Date();return{year:d.getFullYear(),month:d.getMonth()};});
  const[journalNotes,setJournalNotes]=useState({});
  const[journalDay,setJournalDay]=useState(null);
  const[todayParasha,setTodayParasha]=useState("");
  const[summaryParashas,setSummaryParashas]=useState({});
  const[journalParashas,setJournalParashas]=useState({});
  const[weather,setWeather]=useState([]);
  const T=THEMES.light;

  useEffect(()=>{const link=document.createElement("link");link.rel="stylesheet";link.href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap";document.head.appendChild(link);return ()=>{document.head.removeChild(link);};},[]);
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return ()=>clearInterval(t);},[]);

  // מעקב אחרי מצב ההתחברות ל-Firebase
  useEffect(()=>{const unsub=onAuthStateChanged(auth,u=>{setUser(u);setDocLoaded(false);});return unsub;},[]);

  // האזנה בזמן אמת למסמך המשתמש ב-Firestore (מתעדכן אוטומטית מכל מכשיר)
  useEffect(()=>{
    if(!user)return;
    const ref=doc(db,"users",user.uid);
    const unsub=onSnapshot(ref,async(snap)=>{
      if(snap.exists()){
        const d=snap.data();
        setData(d.data||{});setHourlyRate(d.hourlyRate||52.19);setJournalNotes(d.journalNotes||{});
      }else{
        try{await setDoc(ref,{data:{},hourlyRate:52.19,journalNotes:{}});}catch{}
      }
      setDocLoaded(true);
    },()=>setDocLoaded(true));
    return unsub;
  },[user]);

  function handleLogout(){signOut(auth);}

  // כל שינוי בנתונים, כשמחוברים, נשמר ל-Firestore (ומסונכרן אוטומטית לכל מכשיר מחובר)
  useEffect(()=>{
    if(!user||!docLoaded)return;
    const ref=doc(db,"users",user.uid);
    setDoc(ref,{data,hourlyRate,journalNotes},{merge:true}).catch(()=>{});
  },[data,hourlyRate,journalNotes,user,docLoaded]);

  const todayKey=getDayKey(now);
  useEffect(()=>{setData((prev)=>carryOverMidnight(prev,todayKey));},[todayKey]);

  const todayData=data[todayKey]||{sessions:[],active:null};
  const isCheckedIn=!!todayData.active;
  const todayEarnings=useMemo(()=>calcEarnings(todayData.sessions,todayData.active,hourlyRate),[todayData,now,hourlyRate]);
  const monthToDateHours=useMemo(()=>{const ty=now.getFullYear(),tm=now.getMonth(),td=now.getDate();let totalMs=0,total=0;for(let i=1;i<=td;i++){const d=new Date(ty,tm,i),key=getDayKey(d),entry=data[key];if(!entry)continue;const earn=calcEarnings(entry.sessions,i===td?entry.active:null,hourlyRate);totalMs+=earn.totalMs;total+=earn.total;}return{totalMs,total};},[data,now.getFullYear(),now.getMonth(),now.getDate(),hourlyRate]);

  function handleCheckIn(){setData((prev)=>{const e=prev[todayKey]||{sessions:[],active:null};if(e.active)return prev;return{...prev,[todayKey]:{...e,active:Date.now()}};});}
  function handleCheckOut(){
    setData((prev)=>{
      const e=prev[todayKey];
      if(!e?.active)return prev;
      const checkoutTs=Date.now();
      if(!isExactMidnight(e.active,now)){
        return{...prev,[todayKey]:{sessions:[...(e.sessions||[]),{start:e.active,end:checkoutTs}],active:null}};
      }
      const next={...prev};
      let trueStart=e.active;
      let trueStartDayKey=todayKey;
      const daysToTrim=[];
      let cursor=new Date(now);cursor.setHours(0,0,0,0);
      for(let guard=0;guard<400;guard++){
        const prevDate=new Date(cursor);prevDate.setDate(prevDate.getDate()-1);
        const prevKey=getDayKey(prevDate);
        const prevEntry=prev[prevKey];
        const prevRaw=prevEntry?.sessions||[];
        const prevLast=prevRaw[prevRaw.length-1];
        if(prevLast&&isExactEndOfDay(prevLast.end,prevDate)){
          trueStart=prevLast.start;
          trueStartDayKey=prevKey;
          daysToTrim.push(prevKey);
          if(isExactMidnight(prevLast.start,prevDate)){cursor=prevDate;continue;}
          break;
        }
        break;
      }
      for(const k of daysToTrim){
        const entry=next[k];
        if(!entry)continue;
        next[k]={...entry,sessions:(entry.sessions||[]).slice(0,-1)};
      }
      const startEntry=next[trueStartDayKey]||{sessions:[],active:null};
      next[trueStartDayKey]={...startEntry,sessions:[...(startEntry.sessions||[]),{start:trueStart,end:checkoutTs}],active:trueStartDayKey===todayKey?null:startEntry.active};
      next[todayKey]={...next[todayKey],active:null};
      return next;
    });
  }
  function handleManualSave(date,sessions){const key=getDayKey(date);setData((prev)=>({...prev,[key]:{sessions,active:null}}));setManualEntry(null);}
  function handleAddNote(dateKey,text){setJournalNotes((prev)=>({...prev,[dateKey]:[...(prev[dateKey]||[]),{id:Date.now(),text}]}));}
  function handleDeleteNote(dateKey,id){setJournalNotes((prev)=>({...prev,[dateKey]:(prev[dateKey]||[]).filter((n)=>n.id!==id)}));}
  function handleSetShiftOverride(dateKey,sessionStart,label){
    setData((prev)=>{
      const entry=prev[dateKey];
      if(!entry?.sessions)return prev;
      let changed=false;
      const sessions=entry.sessions.map((s)=>{
        if(s.start!==sessionStart)return s;
        changed=true;
        if(label===null){const{shiftLabel,...rest}=s;return rest;}
        return{...s,shiftLabel:label};
      });
      if(!changed)return prev;
      return{...prev,[dateKey]:{...entry,sessions}};
    });
  }
  function handleMergeSessions(dateKey,starts){
    setData((prev)=>{
      const entry=prev[dateKey];
      if(!entry?.sessions)return prev;
      const startSet=new Set(starts);
      const toMerge=entry.sessions.filter((s)=>startSet.has(s.start));
      if(toMerge.length<2)return prev;
      const remaining=entry.sessions.filter((s)=>!startSet.has(s.start));
      const merged={start:Math.min(...toMerge.map((s)=>s.start)),end:Math.max(...toMerge.map((s)=>s.end))};
      const sessions=[...remaining,merged].sort((a,b)=>a.start-b.start);
      return{...prev,[dateKey]:{...entry,sessions}};
    });
  }
  function handleDeleteSession(dateKey,sessionStart){
    setData((prev)=>{
      const entry=prev[dateKey];
      if(!entry?.sessions)return prev;
      const sessions=entry.sessions.filter((s)=>s.start!==sessionStart);
      if(sessions.length===entry.sessions.length)return prev;
      return{...prev,[dateKey]:{...entry,sessions}};
    });
  }

  const isFriOrSat=now.getDay()===5||now.getDay()===6;
  const todayHebrew=useMemo(()=>toHebrewDate(now),[todayKey]);
  const todayHolidayInfo=useMemo(()=>getDayHolidayInfo(now),[todayKey]);
  useEffect(()=>{if(!isFriOrSat){setTodayParasha("");return;}const sat=getSaturdayOf(now);if(sat)fetchParasha(sat).then(p=>setTodayParasha(p));},[todayKey]);
  const todaySpecialShabbat=useMemo(()=>{if(!isFriOrSat)return"";const sat=getSaturdayOf(now);return sat?getSpecialShabbat(sat):"";},[todayKey]);
  useEffect(()=>{const WEATHER_ICONS={0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",51:"🌦️",61:"🌧️",71:"🌨️",80:"🌧️",95:"⛈️"};async function load(){try{const url="https://api.open-meteo.com/v1/forecast?latitude=32.0853&longitude=34.7818&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia%2FJerusalem&forecast_days=3";const res=await fetch(url);const json=await res.json();const d=json.daily;setWeather(d.time.slice(1,3).map((dt,i)=>({label:["מחר","מחרתיים"][i],high:Math.round(d.temperature_2m_max[i+1]),low:Math.round(d.temperature_2m_min[i+1]),icon:WEATHER_ICONS[d.weathercode[i+1]]||"🌡️"})));}catch{setWeather([]);}}load();},[todayKey]);

  const{year,month}=summaryMonth;
  const daysInMonth=getDaysInMonth(year,month);
  const days=useMemo(()=>Array.from({length:daysInMonth},(_,i)=>{const d=new Date(year,month,i+1),key=getDayKey(d),entry=data[key];const earnings=entry?calcEarnings(entry.sessions,entry.active,hourlyRate):{regularMs:0,premiumMs:0,totalMs:0,regularEarnings:0,premiumEarnings:0,total:0};return{date:d,key,earnings,entry};}),[data,year,month,daysInMonth,hourlyRate]);
  const monthTotals=useMemo(()=>days.reduce((a,d)=>({totalMs:a.totalMs+d.earnings.totalMs,premiumMs:a.premiumMs+d.earnings.premiumMs,total:a.total+d.earnings.total,regularEarnings:a.regularEarnings+d.earnings.regularEarnings,premiumEarnings:a.premiumEarnings+d.earnings.premiumEarnings}),{totalMs:0,premiumMs:0,total:0,regularEarnings:0,premiumEarnings:0}),[days]);
  const maxDayMs=Math.max(...days.map(d=>d.earnings.totalMs),1);
  useEffect(()=>{const result={};const jobs=[];for(let i=1;i<=daysInMonth;i++){const d=new Date(year,month,i);if(d.getDay()!==6)continue;const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;jobs.push(fetchParasha(d).then(p=>{if(p)result[key]=p;}));}Promise.all(jobs).then(()=>setSummaryParashas(prev=>({...prev,...result})));},[year,month]);

  const secDeg=now.getSeconds()*6,minDeg=now.getMinutes()*6+now.getSeconds()*0.1,hourDeg=(now.getHours()%12)*30+now.getMinutes()*0.5;
  const prevMonth=new Date(year,month-1,1),nextMonth=new Date(year,month+1,1);

  const{year:jYear,month:jMonth}=journalMonth;
  const jDaysInMonth=getDaysInMonth(jYear,jMonth);
  const jLeadingBlanks=new Date(jYear,jMonth,1).getDay();
  const jDays=useMemo(()=>Array.from({length:jDaysInMonth},(_,i)=>{const d=new Date(jYear,jMonth,i+1),key=getDayKey(d),entry=data[key];const sessions=getDisplaySessionsForDay(data,d);return{date:d,key,entry,sessions};}),[data,jYear,jMonth,jDaysInMonth,now]);
  useEffect(()=>{const result={};const jobs=[];for(let i=1;i<=jDaysInMonth;i++){const d=new Date(jYear,jMonth,i);if(d.getDay()!==6)continue;const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;jobs.push(fetchParasha(d).then(p=>{if(p)result[key]=p;}));}Promise.all(jobs).then(()=>setJournalParashas(prev=>({...prev,...result})));},[jYear,jMonth]);

  if(user===undefined||(user&&!docLoaded))return <div style={{minHeight:"100vh",background:T.bg}}/>;
  if(user===null)return <AuthScreen T={T}/>;

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Rubik','Segoe UI',system-ui,sans-serif",direction:"rtl",display:"flex",flexDirection:"column",alignItems:"center",paddingBottom:80}}>
      {manualEntry&&<ManualEntryModal targetDate={manualEntry.date} existingSessions={data[getDayKey(manualEntry.date)]?.sessions} onSave={sessions=>handleManualSave(manualEntry.date,sessions)} onClose={()=>setManualEntry(null)} hourlyRate={hourlyRate} T={T}/>}
      {showWage&&<WageModal currentRate={hourlyRate} onSave={rate=>{setHourlyRate(rate);setShowWage(false);}} onClose={()=>setShowWage(false)} T={T}/>}
      {journalDay&&(()=>{const jk=getDayKey(journalDay);const isSat=journalDay.getDay()===6;const jkFull=`${journalDay.getFullYear()}-${String(journalDay.getMonth()+1).padStart(2,"0")}-${String(journalDay.getDate()).padStart(2,"0")}`;const specialShabbat=isSat?getSpecialShabbat(journalDay):"";return (<JournalDayModal date={journalDay} sessions={getDisplaySessionsForDay(data,journalDay)} notes={journalNotes[jk]} parasha={isSat?journalParashas[jkFull]:""} specialShabbat={specialShabbat} onAddNote={text=>handleAddNote(jk,text)} onDeleteNote={id=>handleDeleteNote(jk,id)} onSetShiftOverride={(start,label)=>handleSetShiftOverride(jk,start,label)} onMergeSessions={starts=>handleMergeSessions(jk,starts)} onDeleteSession={start=>handleDeleteSession(jk,start)} onClose={()=>setJournalDay(null)} T={T}/>);})()}

      <div style={{width:"100%",maxWidth:480,padding:"18px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:19,fontWeight:800,color:T.accent,letterSpacing:-0.5}}>דוח שעות</span>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:12,color:T.textFaint}}>{now.getDate()} {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</span>
          <button onClick={handleLogout} title="התנתקות" style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:16,padding:0,lineHeight:1}}>🚪</button>
        </div>
      </div>

      {view==="clock"&&(()=>{
        const heroNight=isInPremiumWindow(now.getTime())||now.getHours()>=20||now.getHours()<5;
        const heroBg=heroNight?T.nightSurface:T.surface;
        const heroCardBg=heroNight?T.nightSurface:`radial-gradient(circle at 28% 20%,${T.accentLight},${T.surface} 62%)`;
        const heroText=heroNight?T.nightInk:T.text;
        const heroSub=heroNight?T.nightInkSub:T.textMuted;
        const heroFaint=heroNight?T.nightInkSub:T.textFaint;
        const heroRing=heroNight?T.nightRing:T.clockRing;
        const heroTick=heroNight?T.nightRing:T.clockTick;
        const heroAccent=heroNight?T.moonGold:T.accent;
        return (
        <div style={{width:"100%",maxWidth:480,padding:"18px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:18}}>
          <div style={{width:"100%",background:heroCardBg,borderRadius:16,padding:"16px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,transition:"background 0.6s ease"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:32,fontWeight:600,letterSpacing:1,color:heroText,fontVariantNumeric:"tabular-nums",fontFamily:"'Courier New',ui-monospace,monospace"}}>{formatClock(now)}</div>
              <div style={{fontSize:13,color:heroSub,marginTop:4,display:"flex",alignItems:"center",gap:5}}>
                <span>{heroNight?"🌙":"☀️"}</span>
                <span>{DAY_NAMES[now.getDay()]} · {now.getDate()} {MONTH_NAMES[now.getMonth()]}</span>
                {todayHolidayInfo&&<span style={{color:heroAccent,fontWeight:600}}> · {todayHolidayInfo.label}</span>}
              </div>
              {todayHebrew.full&&<div style={{fontSize:12,color:heroFaint,marginTop:2}}>{todayHebrew.full}</div>}
              {isFriOrSat&&todayParasha&&<div style={{fontSize:12,color:heroAccent,marginTop:3,fontWeight:600}}>{formatParashaLabel(todayParasha,todaySpecialShabbat)} ✦</div>}
              {weather.length>0&&(<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:3}}>{weather.map((w,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:heroSub}}><span>{w.label}</span><span>{w.icon}</span><span style={{fontWeight:700,color:heroText}}>{w.high}°</span><span style={{color:heroFaint}}>{w.low}°</span></div>))}</div>)}
            </div>
            <svg width="118" height="118" viewBox="0 0 200 200" style={{flexShrink:0}}>
              {!heroNight&&<circle cx="100" cy="100" r="99" fill="none" stroke={T.gold} strokeWidth="2" strokeDasharray="4 7" opacity="0.55"/>}
              <circle cx="100" cy="100" r="96" fill="none" stroke={heroRing} strokeWidth="8"/>
              <circle cx="100" cy="100" r="90" fill={heroBg}/>
              {Array.from({length:12},(_,i)=>{const a=(i*30-90)*Math.PI/180;return <line key={i} x1={100+75*Math.cos(a)} y1={100+75*Math.sin(a)} x2={100+83*Math.cos(a)} y2={100+83*Math.sin(a)} stroke={heroTick} strokeWidth={i%3===0?3:1.5} strokeLinecap="round"/>;})}
              <line x1="100" y1="100" x2={100+50*Math.cos((hourDeg-90)*Math.PI/180)} y2={100+50*Math.sin((hourDeg-90)*Math.PI/180)} stroke={heroText} strokeWidth="4" strokeLinecap="round"/>
              <line x1="100" y1="100" x2={100+68*Math.cos((minDeg-90)*Math.PI/180)} y2={100+68*Math.sin((minDeg-90)*Math.PI/180)} stroke={heroSub} strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="100" y1="100" x2={100+72*Math.cos((secDeg-90)*Math.PI/180)} y2={100+72*Math.sin((secDeg-90)*Math.PI/180)} stroke={heroAccent} strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="100" cy="100" r="4" fill={heroAccent}/>
            </svg>
          </div>

          <div style={{background:T.surface,borderRadius:16,border:`1px solid ${T.border}`,padding:"14px 10px",width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
            {[{val:formatTime(todayEarnings.totalMs),label:'סה"כ היום',color:isCheckedIn?T.green:T.text},{val:formatTime(monthToDateHours.totalMs),label:"שעות החודש",color:T.accent},{val:formatMoney(monthToDateHours.total),label:"רווח החודש",color:T.gold},{val:`₪${hourlyRate.toFixed(2)}`,label:"תעריף שעתי",color:T.violet}].map((item,i)=>(<div key={i} style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:item.color,fontVariantNumeric:"tabular-nums"}}>{item.val}</div><div style={{fontSize:9,color:T.textFaint,marginTop:3}}>{item.label}</div></div>))}
          </div>

          <StampButton isCheckedIn={isCheckedIn} onClick={isCheckedIn?handleCheckOut:handleCheckIn} sinceLabel={isCheckedIn?new Date(todayData.active).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}):null} T={T}/>

          <button onClick={()=>setManualEntry({date:new Date()})} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 20px",color:T.textSub,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",gap:8}}><span>✏️</span> הזן שעות ידנית להיום</button>

          {(todayData.sessions?.length>0||todayData.active)&&(
            <div style={{width:"100%"}}>
              <div style={{fontSize:13,color:T.textFaint,marginBottom:8,fontWeight:600}}>סשנים היום</div>
              {[...(todayData.sessions||[]),...(todayData.active?[{start:todayData.active,end:Date.now(),live:true}]:[])].map((s,i)=>{
                const sp=splitSession(s.start,s.end);
                const earn=(sp.regularMs/3600000)*hourlyRate+(sp.premiumMs/3600000)*hourlyRate*PREMIUM_RATE;
                const hol=getHolidayName(s.start);
                return (<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,marginBottom:6,fontSize:13}}>
                  <span style={{color:T.textSub}}>{new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})} ← {s.live?<span style={{color:T.green}}>עכשיו</span>:new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}{sp.premiumMs>0&&<span style={{color:T.violet,marginRight:6,fontSize:11}}>✦ {hol||"שבת"}</span>}</span>
                  <span style={{color:T.gold,fontWeight:600}}>{formatMoney(earn)}</span>
                </div>);
              })}
            </div>
          )}
        </div>
        );
      })()}

      {view==="summary"&&(
        <div style={{width:"100%",maxWidth:480,padding:"16px 20px"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <button onClick={()=>setSummaryMonth((p)=>{const d=new Date(p.year,p.month-1,1);return{year:d.getFullYear(),month:d.getMonth()};})} style={{background:T.surface,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,width:40,height:40,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronRight/></button>
              <span style={{fontSize:10,color:T.textFaint}}>{MONTH_NAMES[prevMonth.getMonth()]}</span>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:700,color:T.text}}>{MONTH_NAMES[month]} {year}<span style={{fontSize:13,color:T.textFaint,fontWeight:400,marginRight:8}}>· {toHebrewDate(new Date(year,month,1)).monthStr}</span></div>
              {(year!==new Date().getFullYear()||month!==new Date().getMonth())&&(<button onClick={()=>{const d=new Date();setSummaryMonth({year:d.getFullYear(),month:d.getMonth()});}} style={{marginTop:4,background:T.accent,border:"none",borderRadius:12,padding:"2px 12px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>היום ↩</button>)}
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <button onClick={()=>setSummaryMonth((p)=>{const d=new Date(p.year,p.month+1,1);return{year:d.getFullYear(),month:d.getMonth()};})} style={{background:T.surface,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,width:40,height:40,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronLeft/></button>
              <span style={{fontSize:10,color:T.textFaint}}>{MONTH_NAMES[nextMonth.getMonth()]}</span>
            </div>
          </div>

          <div style={{background:T.surface,borderRadius:16,border:`1px solid ${T.border}`,padding:"14px",marginBottom:12,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
            <div><div style={{fontSize:18,fontWeight:700,color:T.accent}}>{formatTime(monthTotals.totalMs)}</div><div style={{fontSize:10,color:T.textFaint,marginTop:3}}>שעות</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:T.gold}}>{formatMoney(monthTotals.regularEarnings)}</div><div style={{fontSize:10,color:T.textFaint,marginTop:3}}>שכר רגיל</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:T.violet}}>{formatMoney(monthTotals.premiumEarnings)}</div><div style={{fontSize:10,color:T.textFaint,marginTop:3}}>בונוס ×1.5</div></div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {days.map(({date,earnings,entry})=>{
              const isToday=getDayKey(date)===getDayKey(new Date());
              const isWeekend=date.getDay()===5||date.getDay()===6;
              const pct=earnings.totalMs/maxDayMs;
              const isExp=expandedDay===getDayKey(date);
              const hasPremium=earnings.premiumMs>0;
              const dayKey2=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
              const hebrewDate=toHebrewDate(date);
              const parasha=date.getDay()===6?(summaryParashas[dayKey2]||null):null;
              const specialShabbat=date.getDay()===6?getSpecialShabbat(date):"";
              const holidayInfo=getDayHolidayInfo(date);
              return (
                <div key={date.getDate()}>
                  <div onClick={()=>earnings.totalMs>0?setExpandedDay(isExp?null:getDayKey(date)):setManualEntry({date})} style={{background:isToday?T.todayBg:T.surface,borderRadius:12,padding:"11px 14px",border:`1px solid ${isToday?T.todayBorder:T.border}`,position:"relative",overflow:"hidden",cursor:"pointer"}}>
                    {earnings.totalMs>0&&<div style={{position:"absolute",right:0,top:0,bottom:0,width:`${pct*100}%`,background:hasPremium?`linear-gradient(90deg,transparent,${T.violet}20)`:`linear-gradient(90deg,transparent,${T.accent}18)`,pointerEvents:"none"}}/>}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:34,height:34,borderRadius:9,background:isToday?T.accent:holidayInfo?T.violet+"33":T.surface2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <span style={{fontSize:14,fontWeight:700,color:isToday?"#fff":isWeekend?T.textFaint:T.textSub}}>{date.getDate()}</span>
                        </div>
                        <div>
                          <div style={{fontSize:13,color:isWeekend?T.textFaint:T.textSub,fontWeight:500,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                            {DAY_NAMES[date.getDay()]}
                            {isToday&&<span style={{color:T.accent,fontSize:10}}>היום</span>}
                            {holidayInfo&&<span style={{color:T.violet,fontSize:10,fontWeight:700}}>✦ {holidayInfo.label}</span>}
                            {!holidayInfo&&hasPremium&&<span style={{color:T.violet,fontSize:10}}>✦</span>}
                          </div>
                          {hebrewDate.full&&<div style={{fontSize:10,color:T.textFaint,marginTop:1}}>{hebrewDate.full}</div>}
                          {parasha&&<div style={{fontSize:10,color:T.violet,marginTop:1}}>{formatParashaLabel(parasha,specialShabbat)}</div>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {earnings.totalMs>0?(<><span style={{fontSize:12,color:T.textMuted,fontVariantNumeric:"tabular-nums"}}>{formatTime(earnings.totalMs)}</span><span style={{fontSize:15,fontWeight:700,color:T.gold}}>{formatMoney(earnings.total)}</span><span style={{fontSize:11,color:T.textFaint}}>{isExp?"▲":"▼"}</span></>):(<span style={{fontSize:12,color:T.textFaint}}>{isWeekend?"סופ״ש":"—"} <span style={{fontSize:11}}>✏️</span></span>)}
                      </div>
                    </div>
                  </div>

                  {isExp&&entry&&(
                    <div style={{background:T.expandedBg,borderRadius:"0 0 12px 12px",padding:"12px 14px",border:`1px solid ${T.border}`,borderTop:"none",marginTop:-4}}>
                      {[...(entry.sessions||[]),...(entry.active?[{start:entry.active,end:Date.now(),live:true}]:[])].map((s,i)=>{
                        const sp=splitSession(s.start,s.end);
                        const earn=(sp.regularMs/3600000)*hourlyRate+(sp.premiumMs/3600000)*hourlyRate*PREMIUM_RATE;
                        return (<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:12}}>
                          <span style={{color:T.textSub}}>{new Date(s.start).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})} ← {s.live?"עכשיו":new Date(s.end).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}{sp.premiumMs>0&&<span style={{color:T.violet,marginRight:4}}> ✦ {formatTime(sp.premiumMs)}</span>}</span>
                          <span style={{color:T.gold,fontWeight:600}}>{formatMoney(earn)}</span>
                        </div>);
                      })}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,fontSize:12}}>
                        <button onClick={()=>setManualEntry({date})} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:12,padding:0}}>✏️ עריכה</button>
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

      {view==="journal"&&(
        <div style={{width:"100%",maxWidth:480,padding:"16px 20px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <button onClick={()=>setJournalMonth((p)=>{const d=new Date(p.year,p.month-1,1);return{year:d.getFullYear(),month:d.getMonth()};})} style={{background:T.surface,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,width:36,height:36,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronRight/></button>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:700,color:T.text}}>{MONTH_NAMES[jMonth]} {jYear}<span style={{fontSize:12,color:T.textFaint,fontWeight:400,marginRight:6}}>· {toHebrewDate(new Date(jYear,jMonth,1)).monthStr}</span></div>
              {(jYear!==new Date().getFullYear()||jMonth!==new Date().getMonth())&&(<button onClick={()=>{const d=new Date();setJournalMonth({year:d.getFullYear(),month:d.getMonth()});}} style={{marginTop:4,background:T.accent,border:"none",borderRadius:12,padding:"2px 12px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>היום ↩</button>)}
            </div>
            <button onClick={()=>setJournalMonth((p)=>{const d=new Date(p.year,p.month+1,1);return{year:d.getFullYear(),month:d.getMonth()};})} style={{background:T.surface,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,width:36,height:36,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><ChevronLeft/></button>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:6}}>
            {DAY_NAMES.map(n=>(<div key={n} style={{textAlign:"center",fontSize:10,color:T.textFaint,fontWeight:600}}>{n}</div>))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {Array.from({length:jLeadingBlanks}).map((_,i)=>(<div key={"b"+i}/>))}
            {jDays.map(({date,key,sessions})=>{
              const isToday=key===todayKey;
              const holidayInfo=getDayHolidayInfo(date);
              const specialShabbat=date.getDay()===6?getSpecialShabbat(date):"";
              const dayKeyFull=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
              const parasha=date.getDay()===6?(journalParashas[dayKeyFull]||null):null;
              const hebrewDate=toHebrewDate(date);
              const notesCount=(journalNotes[key]||[]).length;
              const worked=sessions.length>0;
              return (
                <div key={key} onClick={()=>setJournalDay(date)} style={{cursor:"pointer",borderRadius:8,padding:"4px 2px",minHeight:66,background:isToday?T.todayBg:holidayInfo?T.plumLight:T.surface,border:`1px solid ${isToday?T.todayBorder:T.border}`,display:"flex",flexDirection:"column",alignItems:"center",gap:2,position:"relative"}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:3}}>
                    <span style={{fontSize:12,fontWeight:700,color:isToday?T.accent:T.textSub}}>{date.getDate()}</span>
                    {hebrewDate.dayStr&&<span style={{fontSize:10,fontWeight:600,color:T.textMuted,lineHeight:1.1}}>{hebrewDate.dayStr}</span>}
                  </div>
                  {(holidayInfo||specialShabbat)&&<span style={{fontSize:7,color:T.plum,textAlign:"center",lineHeight:1.1}}>{holidayInfo?holidayInfo.label:specialShabbat}</span>}
                  {parasha&&<span style={{fontSize:7,color:T.plum,textAlign:"center",lineHeight:1.1,fontWeight:700}}>{parasha}</span>}
                  <div style={{flex:1,width:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    {worked&&sessions.map((s,si)=>(<span key={si} style={{fontSize:10,color:T.sage,fontWeight:800,textAlign:"center",lineHeight:1.3}}>{s.shiftLabel||classifySession(s.start,s.end)}</span>))}
                  </div>
                  {notesCount>0&&<span style={{position:"absolute",top:3,left:3,width:5,height:5,borderRadius:"50%",background:T.gold}}/>}
                </div>
              );
            })}
          </div>

          <div style={{marginTop:16,fontSize:11,color:T.textFaint,textAlign:"center"}}>לחיצה על יום מציגה משמרות והערות, ומאפשרת להוסיף הערה ידנית</div>
          <div style={{height:16}}/>
        </div>
      )}

      <BottomNav view={view} setView={setView} onWage={()=>setShowWage(true)} hourlyRate={hourlyRate} T={T}/>
    </div>
  );
}