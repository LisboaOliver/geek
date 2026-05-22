// ─────────────────────────────────────────────────────────────────────────────
// ui.js
// Toda a camada React: HUD, modais de loja e carrinho, intro, D-pad.
// Não faz nenhuma renderização canvas — só HTML/CSS via React.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const { useState, useEffect, useRef, useCallback } = React;

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtP     = p => p === 0 ? "GRÁTIS" : `R$ ${p.toFixed(2).replace(".", ",")}`;
const stkColor = s => s <= 5 ? N.red : s <= 10 ? N.orange : N.green;

function btnPrimary(col) {
  return {
    background: col, border: "none", color: N.bg,
    padding: "10px 22px", cursor: "pointer",
    fontSize: 10, fontFamily: "'Courier New'",
    fontWeight: "bold", letterSpacing: 2,
    boxShadow: `0 0 16px ${col}77`,
  };
}
function btnOutline(col) {
  return {
    background: "transparent", border: `2px solid ${col}`, color: col,
    padding: "8px 18px", cursor: "pointer",
    fontSize: 10, fontFamily: "'Courier New'",
    fontWeight: "bold", letterSpacing: 2,
  };
}

// ── ItemCard ─────────────────────────────────────────────────────────────────
function ItemCard({ item, zone, selected, hovered, onSelect, onHover, onAdd, qty, onQtyChange }) {
  return (
    <div
      onClick={() => onSelect(selected ? null : item)}
      onMouseEnter={() => onHover(item)}
      onMouseLeave={() => onHover(null)}
      style={{
        background: selected ? `${zone.color}1a` : hovered ? `${zone.color}0c` : N.bg,
        border: `2px solid ${selected ? zone.color : hovered ? zone.color + "66" : N.border}`,
        padding: 14, cursor: "pointer",
        boxShadow: selected ? `0 0 20px ${zone.color}44` : "none",
        transition: "all .1s", display: "flex", flexDirection: "column", gap: 6,
      }}
    >
      {/* imagem PNG se disponível, senão emoji */}
      {item.image
        ? <img src={item.image} alt={item.name}
            style={{ width: "100%", aspectRatio: "1", objectFit: "cover", imageRendering: "pixelated" }}/>
        : <div style={{ fontSize: 36, textAlign: "center", lineHeight: 1 }}>{item.emoji}</div>
      }

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ background: `${zone.color}28`, color: zone.color, fontSize: 8,
          padding: "2px 6px", letterSpacing: 2, border: `1px solid ${zone.color}55` }}>
          {item.badge}
        </span>
        <span style={{ fontSize: 8, color: stkColor(item.stock) }}>
          {item.stock <= 5 ? "⚠" : item.stock <= 10 ? "🔥" : ""} {item.stock}un
        </span>
      </div>

      <div style={{ fontSize: 10, fontWeight: "bold", lineHeight: 1.4 }}>{item.name}</div>
      <div style={{ fontSize: 8, color: N.textDim, lineHeight: 1.5, flex: 1 }}>{item.desc}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {item.tags.map(t => (
          <span key={t} style={{ fontSize: 7, color: N.textDim, background: N.panelB,
            padding: "1px 5px", border: `1px solid ${N.border}` }}>#{t}</span>
        ))}
      </div>

      {item.old && <div style={{ fontSize: 9, color: N.textDim, textDecoration: "line-through" }}>{fmtP(item.old)}</div>}
      <div style={{ fontSize: item.price === 0 ? 10 : 14, fontWeight: "bold",
        color: item.price === 0 ? zone.color : item.old ? N.red : zone.color }}>
        {fmtP(item.price)}
      </div>

      {selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={e => { e.stopPropagation(); onQtyChange(q => Math.max(1, q - 1)); }}
              style={{ ...btnOutline(zone.color), padding: "2px 8px", fontSize: 12 }}>-</button>
            <span style={{ fontSize: 11, color: zone.color, flex: 1, textAlign: "center" }}>×{qty}</span>
            <button onClick={e => { e.stopPropagation(); onQtyChange(q => Math.min(item.stock, q + 1)); }}
              style={{ ...btnOutline(zone.color), padding: "2px 8px", fontSize: 12 }}>+</button>
          </div>
          <button onClick={e => { e.stopPropagation(); onAdd(item, qty); }}
            style={{ ...btnPrimary(zone.color), padding: "8px 0", width: "100%", fontSize: 9 }}>
            + ADICIONAR{qty > 1 ? ` ×${qty}` : ""}
          </button>
        </div>
      )}
    </div>
  );
}

// ── ShopModal ─────────────────────────────────────────────────────────────────
function ShopModal({ zone, onClose, onAddToCart }) {
  const [sel, setSel]   = useState(null);
  const [qty, setQty]   = useState(1);
  const [hov, setHov]   = useState(null);
  const [tab, setTab]   = useState("loja");

  const handleSelect = item => { setSel(item); setQty(1); setTab("loja"); };
  const handleAdd    = (item, q) => { onAddToCart(item, q); setSel(null); setQty(1); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="anim-modal" style={{ background: N.panel, border: `3px solid ${zone.color}`,
        maxWidth: 680, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column",
        boxShadow: `0 0 80px ${zone.color}55` }}>

        {/* Header */}
        <div style={{ background: `${zone.color}14`, borderBottom: `2px solid ${zone.color}88`,
          padding: "14px 20px", display: "flex", justifyContent: "space-between",
          alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: "bold", letterSpacing: 4,
              color: zone.color, textShadow: `0 0 14px ${zone.color}` }}>
              {zone.glyph} {zone.name}
            </div>
            <div style={{ fontSize: 9, color: N.textDim, letterSpacing: 2, marginTop: 3 }}>
              {zone.sub} — {zone.items.length} ITENS
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {sel && <>
              <button onClick={() => setTab("loja")} style={{ ...btnOutline(tab === "loja" ? zone.color : N.border),
                padding: "4px 12px", fontSize: 9, color: tab === "loja" ? zone.color : N.textDim }}>LOJA</button>
              <button onClick={() => setTab("detalhes")} style={{ ...btnOutline(tab === "detalhes" ? zone.color : N.border),
                padding: "4px 12px", fontSize: 9, color: tab === "detalhes" ? zone.color : N.textDim }}>DETALHES</button>
            </>}
            <button onClick={onClose} style={btnOutline(zone.color)}>[ESC]</button>
          </div>
        </div>

        {/* Grid de itens */}
        {tab === "loja" && (
          <div style={{ padding: 20, display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
            gap: 12, overflowY: "auto", flex: 1 }}>
            {zone.items.map((item, i) => (
              <ItemCard key={i} item={item} zone={zone}
                selected={sel === item} hovered={hov === item}
                qty={qty}
                onSelect={handleSelect} onHover={setHov}
                onAdd={handleAdd} onQtyChange={setQty}/>
            ))}
          </div>
        )}

        {/* Aba detalhes */}
        {tab === "detalhes" && sel && (
          <div style={{ padding: 24, overflowY: "auto", flex: 1,
            display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 180px", display: "flex", flexDirection: "column", gap: 12 }}>
              {sel.image
                ? <img src={sel.image} alt={sel.name}
                    style={{ width: "100%", border: `2px solid ${zone.color}44`,
                      imageRendering: "pixelated" }}/>
                : <div style={{ background: N.bg, border: `2px solid ${zone.color}44`,
                    padding: 24, textAlign: "center", fontSize: 64, lineHeight: 1 }}>
                    {sel.emoji}
                  </div>
              }
              <div style={{ background: `${zone.color}18`, border: `1px solid ${zone.color}44`, padding: 12 }}>
                <div style={{ fontSize: 8, color: N.textDim, letterSpacing: 2, marginBottom: 6 }}>ESTOQUE</div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: stkColor(sel.stock) }}>{sel.stock} un.</div>
                <div style={{ height: 4, background: N.bg, marginTop: 6 }}>
                  <div style={{ height: "100%", background: stkColor(sel.stock),
                    width: `${Math.min(100, (sel.stock / 30) * 100)}%` }}/>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {sel.tags.map(t => (
                  <span key={t} style={{ fontSize: 8, color: zone.color, background: `${zone.color}18`,
                    padding: "3px 8px", border: `1px solid ${zone.color}44`, letterSpacing: 1 }}>#{t}</span>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 8, color: N.textDim, letterSpacing: 2, marginBottom: 4 }}>ITEM</div>
                <div style={{ fontSize: 16, fontWeight: "bold", lineHeight: 1.3 }}>{sel.name}</div>
              </div>
              <div style={{ background: N.bg, border: `1px solid ${N.border}`, padding: 12,
                fontSize: 10, color: N.textDim, lineHeight: 1.8 }}>{sel.desc}</div>
              <div style={{ background: N.bg, border: `2px solid ${zone.color}55`, padding: 14 }}>
                {sel.old && <div style={{ fontSize: 10, color: N.textDim, textDecoration: "line-through", marginBottom: 4 }}>
                  De: {fmtP(sel.old)}
                </div>}
                <div style={{ fontSize: 24, fontWeight: "bold",
                  color: sel.price === 0 ? zone.color : sel.old ? N.red : zone.color }}>
                  {fmtP(sel.price)}
                </div>
                {sel.old && <div style={{ fontSize: 9, color: N.green, marginTop: 4 }}>
                  Você economiza: {fmtP(sel.old - sel.price)}
                </div>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={{ ...btnOutline(zone.color), padding: "8px 14px", fontSize: 14 }}>-</button>
                <span style={{ fontSize: 14, fontWeight: "bold", color: zone.color,
                  minWidth: 40, textAlign: "center" }}>×{qty}</span>
                <button onClick={() => setQty(q => Math.min(sel.stock, q + 1))}
                  style={{ ...btnOutline(zone.color), padding: "8px 14px", fontSize: 14 }}>+</button>
              </div>
              <button onClick={() => handleAdd(sel, qty)}
                style={{ ...btnPrimary(zone.color), padding: "12px 0", fontSize: 12, letterSpacing: 3 }}>
                ⚡ ADICIONAR À BOLSA{qty > 1 ? ` ×${qty}` : ""}
              </button>
              <div style={{ fontSize: 9, color: N.textDim, letterSpacing: 1, lineHeight: 1.8 }}>
                🚚 Envio em 24h &nbsp;•&nbsp; 🔄 Troca em 30 dias &nbsp;•&nbsp; ✅ Produto oficial
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${N.border}`, padding: "10px 20px",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: N.textDim, letterSpacing: 1 }}>
            {sel ? `${sel.emoji} ${sel.name} — ${fmtP(sel.price)}` : "CLIQUE EM UM ITEM PARA SELECIONAR"}
          </div>
          {sel && tab === "loja" && (
            <button onClick={() => handleAdd(sel, qty)} style={{ ...btnPrimary(zone.color), padding: "8px 22px" }}>
              + ADICIONAR À BOLSA
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CartModal ─────────────────────────────────────────────────────────────────
function CartModal({ cart, onClose, onRemove, onClear }) {
  const totalItems = cart.length;
  const totalPrice = cart.reduce((s, i) => s + (i.price || 0), 0);
  const grouped    = cart.reduce((acc, item) => {
    if (!acc[item.name]) acc[item.name] = { ...item, count: 0, uids: [] };
    acc[item.name].count++;
    acc[item.name].uids.push(item.uid);
    return acc;
  }, {});

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="anim-modal" style={{ background: N.panel, border: `3px solid ${N.magenta}`,
        maxWidth: 520, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column",
        boxShadow: `0 0 70px ${N.magenta}44` }}>

        <div style={{ background: `${N.magenta}14`, borderBottom: `2px solid ${N.magenta}66`,
          padding: "14px 20px", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ color: N.magenta, fontSize: 15, letterSpacing: 4, fontWeight: "bold" }}>
              🛒 BOLSA DO AVENTUREIRO
            </div>
            <div style={{ fontSize: 9, color: N.textDim, letterSpacing: 2, marginTop: 3 }}>
              {totalItems} ITEM{totalItems !== 1 ? "S" : ""} — {Object.keys(grouped).length} TIPO{Object.keys(grouped).length !== 1 ? "S" : ""}
            </div>
          </div>
          <button onClick={onClose} style={btnOutline(N.magenta)}>[ESC]</button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", color: N.textDim, padding: "40px 0", letterSpacing: 2 }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🎒</div>
              <div style={{ fontSize: 12, marginBottom: 6 }}>BOLSA VAZIA</div>
              <div style={{ fontSize: 9, color: N.dim }}>EXPLORE O MAPA PARA ENCONTRAR ITENS</div>
            </div>
          ) : (
            <>
              {Object.values(grouped).map(group => (
                <div key={group.name} style={{ display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 0", borderBottom: `1px solid ${N.border}` }}>
                  {group.image
                    ? <img src={group.image} alt={group.name} style={{ width: 36, height: 36, imageRendering: "pixelated" }}/>
                    : <div style={{ fontSize: 28 }}>{group.emoji}</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: "bold" }}>{group.name}</div>
                    <div style={{ fontSize: 8, color: N.textDim, marginTop: 2 }}>{group.badge}</div>
                  </div>
                  {group.count > 1 && (
                    <div style={{ background: N.magenta + "22", border: `1px solid ${N.magenta}44`,
                      color: N.magenta, fontSize: 10, padding: "2px 10px", fontWeight: "bold" }}>
                      ×{group.count}
                    </div>
                  )}
                  <div style={{ color: group.price === 0 ? N.green : N.magenta,
                    fontSize: 12, fontWeight: "bold", minWidth: 90, textAlign: "right" }}>
                    {group.price === 0 ? "GRÁTIS" : fmtP(group.price * group.count)}
                  </div>
                  <button onClick={() => onRemove(group.uids[group.uids.length - 1])}
                    style={{ background: "transparent", border: `1px solid ${N.red}44`,
                      color: N.red, fontSize: 10, cursor: "pointer", padding: "2px 6px",
                      fontFamily: "'Courier New'" }}>✕</button>
                </div>
              ))}

              {/* Resumo */}
              <div style={{ marginTop: 20, background: N.bg, border: `1px solid ${N.border}`, padding: 16 }}>
                <div style={{ fontSize: 9, color: N.textDim, letterSpacing: 2, marginBottom: 12 }}>RESUMO DO PEDIDO</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: N.textDim, marginBottom: 6 }}>
                  <span>Subtotal ({totalItems} itens)</span><span>{fmtP(totalPrice)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: N.green, marginBottom: 6 }}>
                  <span>Frete</span><span>{totalPrice >= 200 ? "GRÁTIS" : "R$ 19,90"}</span>
                </div>
                {totalPrice < 200 && (
                  <div style={{ fontSize: 8, color: N.textDim, borderTop: `1px solid ${N.border}`, paddingTop: 8, marginTop: 4 }}>
                    Falta {fmtP(200 - totalPrice)} para frete grátis!
                    <div style={{ height: 3, background: N.border, marginTop: 4 }}>
                      <div style={{ height: "100%", background: N.green, width: `${(totalPrice / 200) * 100}%` }}/>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: "bold",
                  color: N.magenta, textShadow: `0 0 12px ${N.magenta}`, marginTop: 12, paddingTop: 12,
                  borderTop: `2px solid ${N.magenta}44` }}>
                  <span>TOTAL</span>
                  <span>{fmtP(totalPrice + (totalPrice >= 200 ? 0 : 19.90))}</span>
                </div>
              </div>
              <button style={{ ...btnPrimary(N.magenta), width: "100%", padding: 14, fontSize: 12,
                letterSpacing: 3, marginTop: 14 }}>
                ⚡ FINALIZAR QUEST
              </button>
              <button onClick={onClear} style={{ ...btnOutline(N.border), width: "100%", padding: 8,
                fontSize: 9, marginTop: 8, color: N.textDim, letterSpacing: 2 }}>
                ESVAZIAR BOLSA
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── IntroModal ────────────────────────────────────────────────────────────────
function IntroModal({ onStart }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.97)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div className="anim-modal" style={{ background: N.panel, border: `3px solid ${N.magenta}`,
        maxWidth: 480, width: "100%", padding: 36, textAlign: "center",
        boxShadow: `0 0 100px ${N.magenta}55, 0 0 180px ${N.cyan}22` }}>

        <div className="anim-logo" style={{ fontSize: 56, marginBottom: 4 }}>👾</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: N.textDim, marginBottom: 4 }}>GEEKONVERSE APRESENTA</div>
        <div style={{ fontSize: 26, fontWeight: "bold", letterSpacing: 6, color: N.magenta,
          textShadow: `0 0 20px ${N.magenta}`, marginBottom: 4 }}>GEEK STORE</div>
        <div style={{ fontSize: 9, letterSpacing: 4, color: N.cyan,
          textShadow: `0 0 8px ${N.cyan}`, marginBottom: 28 }}>PIXEL RPG • INVADINDO UNIVERSOS</div>

        <div style={{ background: N.bg, border: `1px solid ${N.border}`, padding: "16px 20px",
          marginBottom: 20, fontSize: 10, color: N.textDim, lineHeight: 2.2, textAlign: "left" }}>
          <div style={{ color: N.yellow, marginBottom: 8, letterSpacing: 2, fontSize: 11 }}>📜 PRÓLOGO</div>
          <span style={{ color: N.text }}>Herói,</span> bem-vindo à Geek Store do Geekonverse!<br/>
          Explore as 4 zonas e descubra{" "}
          <span style={{ color: N.cyan }}>drops exclusivos</span>,{" "}
          <span style={{ color: N.magenta }}>promoções épicas</span>,{" "}
          <span style={{ color: N.green }}>mais vendidos</span> e{" "}
          <span style={{ color: N.yellow }}>cupons VIP</span>.<br/><br/>
          Aproxime dos <span style={{ color: N.magenta }}>NPCs piscantes</span> e pressione{" "}
          <strong style={{ color: N.magenta }}>[E]</strong>!
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
          {ZONES.map(z => (
            <div key={z.id} style={{ background: `${z.color}10`, border: `1px solid ${z.color}44`,
              padding: "8px 12px", fontSize: 9, color: z.color, letterSpacing: 1,
              textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>{z.glyph}</span><span>{z.name}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 28, flexWrap: "wrap" }}>
          {["↑↓←→ MOVER","WASD MOVER","[E] ABRIR","ESC FECHAR"].map(s => (
            <div key={s} style={{ background: N.bg, padding: "5px 12px",
              border: `1px solid ${N.border}`, fontSize: 9, color: N.textDim, letterSpacing: 1 }}>{s}</div>
          ))}
        </div>

        <button onClick={onStart} style={{ ...btnPrimary(N.magenta), padding: "14px 52px", fontSize: 14, letterSpacing: 6 }}>
          ▶ INICIAR
        </button>
      </div>
    </div>
  );
}

// ── HelpPanel ─────────────────────────────────────────────────────────────────
function HelpPanel({ onClose }) {
  return (
    <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(4,4,16,.97)",
      border: `1px solid ${N.magenta}44`, padding: "14px 18px", zIndex: 30, minWidth: 190 }}>
      <div style={{ color: N.magenta, fontSize: 10, marginBottom: 8, letterSpacing: 3 }}>◈ CONTROLES</div>
      {["↑ ↓ ← → / WASD — MOVER","[E] / ESPAÇO — INTERAGIR","[ESC] — FECHAR PAINEL"].map(s => (
        <div key={s} style={{ fontSize: 9, color: N.textDim, letterSpacing: 1, lineHeight: 2 }}>{s}</div>
      ))}
      <div style={{ borderTop: `1px solid ${N.border}`, marginTop: 10, paddingTop: 10 }}>
        {ZONES.map(z => (
          <div key={z.id} style={{ fontSize: 8, color: z.color, letterSpacing: 1, lineHeight: 2 }}>
            {z.glyph} {z.name}
          </div>
        ))}
      </div>
      <button onClick={onClose} style={{ marginTop: 8, background: "transparent",
        border: `1px solid ${N.border}`, color: N.textDim, fontSize: 8,
        cursor: "pointer", padding: "2px 8px", fontFamily: "'Courier New'" }}>FECHAR</button>
    </div>
  );
}

// ── DPad (mobile) ─────────────────────────────────────────────────────────────
function DPad({ onMove, onAction, hasZone }) {
  const btns = [
    [null, { l: "▲", dx: 0, dy: -1 }, null],
    [{ l: "◄", dx: -1, dy: 0 }, { l: "●", act: true }, { l: "►", dx: 1, dy: 0 }],
    [null, { l: "▼", dx: 0, dy: 1 }, null],
  ];
  return (
    <div style={{ position: "absolute", bottom: 12, right: 12, display: "grid",
      gridTemplateColumns: "42px 42px 42px", gridTemplateRows: "42px 42px 42px", gap: 3 }}>
      {btns.map((row, ri) => row.map((b, ci) => b ? (
        <button key={`${ri}${ci}`}
          onPointerDown={() => b.act ? (hasZone && onAction()) : onMove(b.dx, b.dy)}
          style={{ background: b.act ? `${N.magenta}22` : "rgba(4,4,16,.9)",
            border: `2px solid ${b.act ? N.magenta : N.border}`,
            color: b.act ? N.magenta : N.textDim,
            fontSize: b.act ? 16 : 13, cursor: "pointer", fontFamily: "'Courier New'",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: b.act ? `0 0 8px ${N.magenta}44` : "none" }}>
          {b.l}
        </button>
      ) : <div key={`${ri}${ci}`}/>))}
    </div>
  );
}

// ── PixelStore (componente raiz) ──────────────────────────────────────────────
function PixelStore() {
  const canvasRef   = useRef(null);
  const engineRef   = useRef(null);

  const [player,     setPlayer]     = useState(PLAYER_START);
  const [activeZone, setActiveZone] = useState(null);
  const [openZone,   setOpenZone]   = useState(null);
  const [cart,       setCart]       = useState([]);
  const [cartOpen,   setCartOpen]   = useState(false);
  const [notif,      setNotif]      = useState(null);
  const [intro,      setIntro]      = useState(true);
  const [showHelp,   setShowHelp]   = useState(false);
  const [chestAnim,  setChestAnim]  = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: VIEW_COLS * TILE, h: VIEW_ROWS * TILE });

  // canvas responsivo
  useEffect(() => {
    const calc = () => {
      const navH   = document.getElementById("site-nav")?.offsetHeight  || 54;
      const footH  = document.getElementById("site-footer")?.offsetHeight || 26;
      const hudH   = 38;
      const availH = window.innerHeight - navH - footH - hudH;
      const availW = window.innerWidth;
      const scale  = Math.min(availW / (VIEW_COLS * TILE), availH / (VIEW_ROWS * TILE), 1);
      setCanvasSize({ w: Math.floor(VIEW_COLS * TILE * scale), h: Math.floor(VIEW_ROWS * TILE * scale) });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // inicia o engine após o canvas estar montado
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createGameEngine(canvasRef.current, {
      onZoneChange: zone => setActiveZone(zone),
      onPlayerMove: pos  => setPlayer(pos),
    });
    engineRef.current = engine;
    engine.start();
    return () => engine.destroy();
  }, []);

  // pausa o loop quando modal está aberto
  useEffect(() => {
    engineRef.current?.setPaused(!!openZone || cartOpen);
  }, [openZone, cartOpen]);

  // teclado global (interação e ESC)
  useEffect(() => {
    const dn = e => {
      if ((e.key === "e" || e.key === "E" || e.key === " ") && activeZone && !openZone) {
        e.preventDefault();
        openShop(activeZone);
      }
      if (e.key === "Escape") { setOpenZone(null); setCartOpen(false); }
    };
    window.addEventListener("keydown", dn);
    return () => window.removeEventListener("keydown", dn);
  }, [activeZone, openZone]);

  const notify = useCallback((msg, col = N.magenta) => {
    setNotif({ msg, col });
    setTimeout(() => setNotif(null), 2800);
  }, []);

  const openShop = zone => {
    if (zone.id === "vip") { setChestAnim(true); setTimeout(() => setChestAnim(false), 700); }
    setOpenZone(zone);
  };

  const addToCart = useCallback((item, qty = 1) => {
    const entries = Array.from({ length: qty }, () => ({ ...item, uid: Date.now() + Math.random() }));
    setCart(c => [...c, ...entries]);
    spawnParticles(VIEW_COLS * TILE / 2, VIEW_ROWS * TILE / 2, N.green, 22);
    notify(`${item.emoji} ×${qty} ${item.name} adicionado!`, N.green);
  }, [notify]);

  const totalItems = cart.length;
  const totalPrice = cart.reduce((s, i) => s + (i.price || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: N.bg }}>

      {/* HUD */}
      <div style={{ background: N.panel, borderBottom: `1px solid ${N.magenta}33`,
        padding: "0 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 38, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 16, fontSize: 9, letterSpacing: 2, alignItems: "center" }}>
          <span style={{ color: N.magenta }}>HP <span style={{ letterSpacing: 0 }}>████████░░</span></span>
          <span style={{ color: N.cyan }}>MP <span style={{ letterSpacing: 0 }}>██████░░░░</span></span>
          <span style={{ color: N.yellow }}>XP {cart.length * 100}</span>
          <span style={{ color: N.textDim }}>LVL 1 SHOPPER</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {activeZone && (
            <span style={{ fontSize: 9, color: activeZone.color, letterSpacing: 1 }}>◉ {activeZone.name}</span>
          )}
          <button onClick={() => setShowHelp(h => !h)}
            style={{ background: "transparent", border: `1px solid ${N.border}`,
              color: N.textDim, padding: "3px 8px", cursor: "pointer",
              fontSize: 9, fontFamily: "'Courier New'" }}>?</button>
          <button onClick={() => setCartOpen(true)} style={{
            background: totalItems > 0 ? `${N.magenta}18` : "transparent",
            border: `2px solid ${totalItems > 0 ? N.magenta : N.border}`,
            color: totalItems > 0 ? N.magenta : N.textDim,
            padding: "4px 14px", cursor: "pointer", fontSize: 10,
            letterSpacing: 1, fontFamily: "'Courier New'",
            boxShadow: totalItems > 0 ? `0 0 10px ${N.magenta}44` : "none" }}>
            🛒{totalItems > 0 ? ` (${totalItems})` : " BOLSA"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: "relative", flex: 1, display: "flex",
        alignItems: "center", justifyContent: "center", background: N.bg }}>
        <canvas ref={canvasRef}
          width={VIEW_COLS * TILE} height={VIEW_ROWS * TILE}
          style={{ width: canvasSize.w, height: canvasSize.h,
            imageRendering: "pixelated", cursor: "none" }}/>

        {/* toast */}
        {notif && (
          <div className="anim-toast" style={{ position: "absolute", top: 12, left: "50%",
            transform: "translateX(-50%)", background: N.panel,
            border: `2px solid ${notif.col}`, padding: "8px 20px",
            fontSize: 11, color: notif.col, letterSpacing: 1,
            boxShadow: `0 0 24px ${notif.col}66`, whiteSpace: "nowrap",
            zIndex: 20, pointerEvents: "none" }}>{notif.msg}</div>
        )}

        {chestAnim && (
          <div className="anim-chest" style={{ position: "absolute", inset: 0,
            background: `${N.yellow}22`, pointerEvents: "none", zIndex: 5,
            boxShadow: `inset 0 0 80px ${N.yellow}88` }}/>
        )}

        {showHelp && <HelpPanel onClose={() => setShowHelp(false)}/>}

        <DPad
          onMove={(dx, dy) => engineRef.current?.moveBy(dx, dy)}
          onAction={() => activeZone && openShop(activeZone)}
          hasZone={!!activeZone}/>
      </div>

      {/* Modais */}
      {openZone && (
        <ShopModal
          zone={openZone}
          onClose={() => setOpenZone(null)}
          onAddToCart={(item, qty) => { addToCart(item, qty); }}/>
      )}
      {cartOpen && (
        <CartModal
          cart={cart}
          onClose={() => setCartOpen(false)}
          onRemove={uid => setCart(c => c.filter(i => i.uid !== uid))}
          onClear={() => setCart([])}/>
      )}
      {intro && <IntroModal onStart={() => setIntro(false)}/>}
    </div>
  );
}
