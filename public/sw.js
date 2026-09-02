const CACHE_NAME = "dochshaot-shell-v1";

// בהתקנה: מנסים לשמור מראש את דף הבית (לא קריטי אם נכשל — קאשינג אמיתי קורה תוך כדי גלישה)
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add("/").catch(() => {}))
  );
});

// בהפעלה: מנקים גרסאות קאש ישנות
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// אסטרטגיה: "רשת קודם, קאש כגיבוי" — כשיש אינטרנט מקבלים תמיד את הכי עדכני,
// וכל תגובה מוצלחת נשמרת אוטומטית לקאש כדי שתהיה זמינה גם בלי חיבור בפעם הבאה.
// בקשות ל-Firebase/Firestore/API חיצוני לא נשמרות כאן בכוונה — הן מטופלות בנפרד ע"י Firestore עצמו.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return; // רק קבצי האתר עצמו, לא קריאות רשת חיצוניות

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("/"))
      )
  );
});
