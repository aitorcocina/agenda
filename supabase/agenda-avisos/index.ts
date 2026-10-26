// agenda-avisos: cada minuto (pg_cron) manda los avisos que tocan al iPhone por Web Push.
//  1) Agenda AM: tablas agenda_avisos / agenda_push.
//  2) Centro de Entrenamiento (UrtziMtz): tablas ent_avisos / ent_push. Aquí también se crean
//     los avisos fijos: convocatorias (viernes 17:00 y 21:30) y partidos del finde (jueves 19:00).
// Lo llama pg_cron con la cabecera x-agenda-cron. Las claves VAPID viven en config_privada.
import webpush from "npm:web-push@3.6.7";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

let cfg: Record<string, string> | null = null;
async function config() {
  if (cfg) return cfg;
  const rows = await rest("config_privada?select=key,value&key=in.(agenda_cron_token,agenda_vapid_public,agenda_vapid_private)");
  cfg = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  webpush.setVapidDetails("mailto:aitor.urtzi@gmail.com", cfg!.agenda_vapid_public, cfg!.agenda_vapid_private);
  return cfg!;
}

type Aviso = { id: number; titulo: string; cuerpo: string; fire_at: string; tag: string };

// Manda los avisos pendientes de una tabla a todas las suscripciones de otra
async function enviar(tablaAvisos: string, tablaPush: string, select: string, tagDe: (a: any) => string) {
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - 6 * 3600e3).toISOString(); // lo muy atrasado no se manda
  const avisos = await rest(`${tablaAvisos}?select=${select}&enviado=is.false&fire_at=lte.${ahora.toISOString()}&fire_at=gte.${desde}&order=fire_at.asc&limit=50`);
  if (!avisos.length) return { avisos: 0, enviados: 0 };
  const subs = await rest(`${tablaPush}?select=endpoint,p256dh,auth`);
  let ok = 0;
  const caducadas = new Set<string>();
  for (const a of avisos) {
    const payload = JSON.stringify({ titulo: a.titulo, cuerpo: a.cuerpo, tag: tagDe(a) });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" });
        ok++;
      } catch (e) {
        const st = (e as { statusCode?: number }).statusCode;
        if (st === 404 || st === 410) caducadas.add(s.endpoint);
        console.error("push", tablaPush, st, String(e).slice(0, 200));
      }
    }
  }
  await rest(`${tablaAvisos}?id=in.(${avisos.map((a: Aviso) => a.id).join(",")})`, { method: "PATCH", body: JSON.stringify({ enviado: true }) });
  for (const ep of caducadas) await rest(`${tablaPush}?endpoint=eq.${encodeURIComponent(ep)}`, { method: "DELETE" });
  return { avisos: avisos.length, enviados: ok };
}

// ---------- Centro de Entrenamiento: avisos fijos de la semana ----------
function horaMadrid(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).map((x) => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { dow, min: (+p.hour % 24) * 60 + +p.minute, fecha: `${p.year}-${p.month}-${p.day}` };
}
const sinComillas = (s: string) => String(s || "").replace(/"/g, "").trim();
const esGorliz = (s: string) => /^gorliz\b/i.test(sinComillas(s));
const minus = (s: string) => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;

function partidoDe(comp: any, cat: "juvenil" | "cadete") {
  const ps = comp?.[cat]?.proximos?.partidos || [];
  const p = ps.find((x: string[]) => esGorliz(x[1]) || esGorliz(x[3]));
  if (!p) return null;
  return { texto: `${p[1]} vs ${p[3]}`, cuando: minus(p[0]), casa: esGorliz(p[1]) };
}

const PROGRAMA = [
  { dow: 5, min: 17 * 60, tipo: "conv" },        // viernes 17:00
  { dow: 5, min: 21 * 60 + 30, tipo: "conv2" },  // viernes 21:30
  { dow: 4, min: 19 * 60, tipo: "partidos" },    // jueves 19:00
];

async function programarEntrenador(simular?: string | null) {
  const t = horaMadrid();
  const toca = simular ? PROGRAMA.filter((p) => p.tipo === simular) : PROGRAMA.filter((p) => p.dow === t.dow && t.min >= p.min && t.min < p.min + 15);
  if (!toca.length) return 0;
  const row = await rest("team_data?select=value&key=eq.competicion");
  const comp = row?.[0]?.value || {};
  const ju = partidoDe(comp, "juvenil"), ca = partidoDe(comp, "cadete");
  const linea = (x: ReturnType<typeof partidoDe>) => x ? `${x.texto} · ${x.cuando}` : "No encuentro el partido, revísalo en la app";
  const nuevos: { clave: string; titulo: string; cuerpo: string }[] = [];
  for (const p of toca) {
    const base = `${simular ? "sim-" + Date.now() + "-" : ""}${t.fecha}-${p.tipo}`;
    if (p.tipo === "conv" || p.tipo === "conv2") {
      const pre = p.tipo === "conv" ? "📋 Convocatoria" : "⏰ Última llamada: convocatoria";
      nuevos.push({ clave: `${base}-juvenil`, titulo: `${pre} del Juvenil`, cuerpo: linea(ju) });
      nuevos.push({ clave: `${base}-cadete`, titulo: `${pre} del Cadete`, cuerpo: linea(ca) });
      nuevos.push({
        clave: `${base}-suben`,
        titulo: p.tipo === "conv" ? "📋 Cadetes que suben con el Juvenil" : "⏰ Última llamada: cadetes que suben",
        cuerpo: ju ? `Mira si suben cadetes para ${ju.texto} · ${ju.cuando}` : "Mira si suben cadetes con el Juvenil este finde",
      });
    } else {
      const lin = [
        `Juvenil: ${ju ? `${ju.texto} · ${ju.cuando}${ju.casa ? " (en casa)" : ""}` : "sin datos"}`,
        `Cadete: ${ca ? `${ca.texto} · ${ca.cuando}${ca.casa ? " (en casa)" : ""}` : "sin datos"}`,
      ];
      nuevos.push({ clave: `${base}`, titulo: "⚽ Partidos del fin de semana", cuerpo: lin.join("\n") });
    }
  }
  await rest("ent_avisos?on_conflict=clave", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(nuevos) });
  return nuevos.length;
}

Deno.serve(async (req) => {
  try {
    const c = await config();
    if (req.headers.get("x-agenda-cron") !== c.agenda_cron_token) return new Response("no", { status: 401 });

    const agenda = await enviar("agenda_avisos", "agenda_push", "id,titulo,cuerpo,fire_at,item_id", (a) => `${a.item_id}-${a.fire_at}`);

    let entrenador: unknown = null;
    try {
      const programados = await programarEntrenador(new URL(req.url).searchParams.get("simular"));
      entrenador = { programados, ...(await enviar("ent_avisos", "ent_push", "id,titulo,cuerpo,fire_at,clave", (a) => a.clave)) };
    } catch (e) { console.error("entrenador", e); entrenador = { error: String(e).slice(0, 200) }; }

    // limpieza: avisos enviados de hace más de 30 días
    const viejo = new Date(Date.now() - 30 * 864e5).toISOString();
    await rest(`agenda_avisos?enviado=is.true&fire_at=lt.${viejo}`, { method: "DELETE" });
    await rest(`ent_avisos?enviado=is.true&fire_at=lt.${viejo}`, { method: "DELETE" });

    return new Response(JSON.stringify({ agenda, entrenador }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
