// ─────────────────────────────────────────────────────────────────────────────
// events.js
// Eventos e mini quests do site, com dia e hora.
// Aparecem na faixa do topo da loja e no Quadro de Quests da ilha.
//
// 👉 Para criar um evento, copie um bloco e altere os campos:
//   id        — identificador único (sem espaços)
//   title     — nome do evento
//   desc      — texto curto
//   start/end — data e hora com fuso. Portugal: "+00:00" no inverno, "+01:00" no verão
//   objective — o que fazer no jogo:
//                 { type: "floor",   value: 3 }  → chegar ao andar 3
//                 { type: "kills",   value: 25 } → derrotar 25 monstros
//                 { type: "boss",    value: 1 }  → derrotar 1 boss
//                 { type: "upgrade", value: 2 }  → melhorar edifícios 2 vezes
//   points    — pontos de promoção que a quest vai dar (ativos quando as contas chegarem)
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const EVENTS = [
  {
    id: "inauguracao-ilha",
    title: "Inauguração da Ilha",
    desc: "A nova loja abriu! Desce às masmorras e chega ao andar 3.",
    start: "2026-10-06T00:00:00+01:00",
    end:   "2026-10-20T23:59:00+01:00",
    objective: { type: "floor", value: 3 },
    points: 50,
  },
  {
    id: "sexta-das-masmorras",
    title: "Sexta das Masmorras",
    desc: "Só nesta noite: derrota o Senhor do Lag.",
    start: "2026-10-09T20:00:00+01:00",
    end:   "2026-10-09T23:00:00+01:00",
    objective: { type: "boss", value: 1 },
    points: 100,
  },
];

const OBJECTIVE_TEXT = {
  floor:   v => `Chega ao andar ${v}`,
  kills:   v => `Derrota ${v} monstros`,
  boss:    v => v === 1 ? "Derrota um boss" : `Derrota ${v} bosses`,
  upgrade: v => v === 1 ? "Melhora um edifício" : `Melhora edifícios ${v} vezes`,
};

/** Estado de cada evento num dado instante: "ativo", "breve" ou "terminado". */
function eventStatus(ev, now = Date.now()) {
  const s = Date.parse(ev.start), e = Date.parse(ev.end);
  if (now < s) return "breve";
  if (now > e) return "terminado";
  return "ativo";
}

/** O evento a destacar na faixa: o ativo que acaba primeiro, senão o próximo. */
function featuredEvent(now = Date.now()) {
  const active = EVENTS.filter(e => eventStatus(e, now) === "ativo")
    .sort((a, b) => Date.parse(a.end) - Date.parse(b.end));
  if (active.length) return { ev: active[0], status: "ativo" };
  const next = EVENTS.filter(e => eventStatus(e, now) === "breve")
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (next.length) return { ev: next[0], status: "breve" };
  return null;
}

/** "2d 4h", "3h 12m", "8m 05s" */
function fmtCountdown(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

/** "sex, 9 out · 20:00" no fuso de Lisboa */
function fmtEventDate(iso) {
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon",
    }).format(new Date(iso)).replace(",", " ·").replace(/\./g, "");
  } catch (_) {
    return new Date(iso).toLocaleString();
  }
}
