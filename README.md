# Agenda AM

Agenda personal para el iPhone: citas, recados, lista de la compra y notas, con avisos en el móvil.

- App: `index.html`, `app.js`, `nlp.js` (entiende frases como «médico el jueves a las 10»), `sw.js` (avisos y uso sin red).
- Datos: Supabase, tablas `agenda_items`, `agenda_avisos` y `agenda_push`, protegidas con llave (cabecera `x-agenda-key`).
- Avisos: la función `supabase/agenda-avisos` se lanza cada minuto con pg_cron y manda los avisos que tocan.
