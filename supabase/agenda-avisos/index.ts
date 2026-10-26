// agenda-avisos: cada minuto mira los avisos que tocan y los manda al iPhone (Web Push).
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

Deno.serve(async (req) => {
  try {
    const c = await config();
    if (req.headers.get("x-agenda-cron") !== c.agenda_cron_token) return new Response("no", { status: 401 });

    const ahora = new Date();
    const desde = new Date(ahora.getTime() - 6 * 3600e3).toISOString(); // lo muy atrasado no se manda
    const avisos = await rest(`agenda_avisos?select=id,titulo,cuerpo,fire_at,item_id&enviado=is.false&fire_at=lte.${ahora.toISOString()}&fire_at=gte.${desde}&order=fire_at.asc&limit=50`);
    if (!avisos.length) return new Response(JSON.stringify({ enviados: 0 }), { headers: { "Content-Type": "application/json" } });

    const subs = await rest("agenda_push?select=endpoint,p256dh,auth");
    let ok = 0;
    const caducadas = new Set<string>();
    for (const a of avisos) {
      const payload = JSON.stringify({ titulo: a.titulo, cuerpo: a.cuerpo, tag: `${a.item_id}-${a.fire_at}` });
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" });
          ok++;
        } catch (e) {
          const st = (e as { statusCode?: number }).statusCode;
          if (st === 404 || st === 410) caducadas.add(s.endpoint);
          console.error("push", st, String(e).slice(0, 200));
        }
      }
    }
    await rest(`agenda_avisos?id=in.(${avisos.map((a: { id: number }) => a.id).join(",")})`, { method: "PATCH", body: JSON.stringify({ enviado: true }) });
    for (const ep of caducadas) await rest(`agenda_push?endpoint=eq.${encodeURIComponent(ep)}`, { method: "DELETE" });
    // limpieza: avisos enviados de hace más de 30 días
    await rest(`agenda_avisos?enviado=is.true&fire_at=lt.${new Date(ahora.getTime() - 30 * 864e5).toISOString()}`, { method: "DELETE" });

    return new Response(JSON.stringify({ avisos: avisos.length, enviados: ok, caducadas: caducadas.size }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
