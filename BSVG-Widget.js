// BSVG Abfahrts-Widget für Scriptable (iPhone)
// Haltestelle: Braunschweig, Goslarsche Straße
// Tipp aufs Widget öffnet die Live-Tafel.

const STOP_ID = "de:03101:152";
const STOP_NAME = "Goslarsche Straße";
const LIVE_URL = "https://levitgh.github.io/bsvg-tafel/";
const API = "https://bsvg.efa.de/bsvagstd/XML_DM_REQUEST";

const BG = new Color("#0b0f14");
const TEXT = new Color("#f2f5f7");
const MUTED = new Color("#8a97a5");
const AMBER = new Color("#ffb000");
const LATE = new Color("#ff5d5d");
const OK = new Color("#4cd38a");
const BUS = new Color("#0a6cc4");
const TRAM = new Color("#d6002a");

const family = config.widgetFamily || "medium";
const ROWS = family === "large" ? 9 : family === "small" ? 3 : 4;
const SMALL = family === "small";

const timeFmt = new DateFormatter();
timeFmt.dateFormat = "HH:mm";

async function loadDepartures() {
  const url = API +
    "?outputFormat=rapidJSON&type_dm=stop&name_dm=" + encodeURIComponent(STOP_ID) +
    "&mode=direct&useRealtime=1&depType=stopEvents&limit=" + (ROWS + 4);
  const req = new Request(url);
  req.timeoutInterval = 15;
  const data = await req.loadJSON();
  const now = new Date();
  return (data.stopEvents || [])
    .map(ev => {
      if (!ev.departureTimePlanned) return null;
      const planned = new Date(ev.departureTimePlanned);
      const est = ev.departureTimeEstimated ? new Date(ev.departureTimeEstimated) : null;
      const t = ev.transportation || {};
      const prod = t.product || {};
      const status = ev.realtimeStatus || [];
      return {
        line: t.number || t.disassembledName || "?",
        tram: prod.class === 4,
        dest: ((t.destination || {}).name || "—").replace(/^Braunschweig,?\s*/i, ""),
        planned: planned,
        when: est || planned,
        realtime: !!est && ev.isRealtimeControlled === true,
        delay: est ? Math.round((est - planned) / 60000) : 0,
        cancelled: ev.isCancelled === true || status.some(s => /CANCEL/i.test(s))
      };
    })
    .filter(e => e && e.when - now > -30000)
    .sort((a, b) => a.when - b.when)
    .slice(0, ROWS);
}

function addRow(widget, e) {
  const row = widget.addStack();
  row.centerAlignContent();
  row.spacing = 8;

  const badge = row.addStack();
  badge.backgroundColor = e.tram ? TRAM : BUS;
  badge.cornerRadius = 5;
  badge.size = new Size(SMALL ? 34 : 40, SMALL ? 18 : 20);
  badge.centerAlignContent();
  const lineText = badge.addText(String(e.line));
  lineText.font = Font.boldSystemFont(SMALL ? 11 : 13);
  lineText.textColor = Color.white();

  if (!SMALL) {
    const dest = row.addText(e.dest);
    dest.font = Font.mediumSystemFont(14);
    dest.textColor = e.cancelled ? MUTED : TEXT;
    dest.lineLimit = 1;
    dest.minimumScaleFactor = 0.8;
  }

  row.addSpacer();

  if (e.cancelled) {
    const c = row.addText("fällt aus");
    c.font = Font.boldSystemFont(12);
    c.textColor = LATE;
    return;
  }

  if (e.realtime) {
    const d = row.addText(e.delay > 0 ? "+" + e.delay : "•");
    d.font = Font.boldSystemFont(12);
    d.textColor = e.delay > 0 ? LATE : OK;
  }

  const time = row.addText(timeFmt.string(e.when));
  time.font = Font.boldMonospacedSystemFont(SMALL ? 14 : 15);
  time.textColor = AMBER;
}

async function buildWidget() {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.url = LIVE_URL;
  w.setPadding(12, 14, 12, 14);
  // iOS entscheidet selbst, wann es aktualisiert; das ist nur der früheste Zeitpunkt.
  w.refreshAfterDate = new Date(Date.now() + 2 * 60 * 1000);

  const head = w.addStack();
  head.centerAlignContent();
  const title = head.addText(SMALL ? "Goslarsche Str." : STOP_NAME);
  title.font = Font.boldSystemFont(SMALL ? 12 : 14);
  title.textColor = TEXT;
  title.lineLimit = 1;
  head.addSpacer();
  if (!SMALL) {
    const stand = head.addText("Stand " + timeFmt.string(new Date()));
    stand.font = Font.systemFont(10);
    stand.textColor = MUTED;
  }
  w.addSpacer(SMALL ? 6 : 8);

  let deps = [];
  let failed = false;
  try {
    deps = await loadDepartures();
  } catch (err) {
    failed = true;
  }

  if (failed || deps.length === 0) {
    const msg = w.addText(failed ? "Keine Verbindung zur BSVG" : "Aktuell keine Abfahrten");
    msg.font = Font.systemFont(12);
    msg.textColor = failed ? LATE : MUTED;
  } else {
    deps.forEach((e, i) => {
      addRow(w, e);
      if (i < deps.length - 1) w.addSpacer(SMALL ? 5 : 6);
    });
  }

  w.addSpacer();
  if (SMALL) {
    const stand = w.addText("Stand " + timeFmt.string(new Date()));
    stand.font = Font.systemFont(9);
    stand.textColor = MUTED;
  }
  return w;
}

const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
