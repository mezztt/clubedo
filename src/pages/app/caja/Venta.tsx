import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { appApi, canAccess, getSessionUser, money, useVocab } from "../../../config";
import { Empty, Field, Loading, Modal, Switch, useFlash } from "../../../components/ui";
import { METHODS, MemberPicker } from "../../../components/c3/common";
import type { MemberHit } from "../../../components/c3/common";
import type { CashSess, Product, SaleDetail } from "./types";

interface Line { product: Product; qty: number }

/** Venta rápida: buscás o escaneás el código de barras, sumás al carrito y cobrás (o la dejás a cuenta de un socio). */
function Venta() {
  const { t } = useVocab();
  const { fail, node: flash } = useFlash();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [method, setMethod] = useState("EFECTIVO");
  const [member, setMember] = useState<MemberHit | null>(null);
  const [onAccount, setOnAccount] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);
  const [discPct, setDiscPct] = useState("");
  const [discReason, setDiscReason] = useState("");
  const [invoice, setInvoice] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [instructors, setInstructors] = useState<{ id: number; name: string }[]>([]);
  const [cash, setCash] = useState<CashSess | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<SaleDetail | null>(null);
  const scan = useRef<HTMLInputElement>(null);
  const user = getSessionUser();

  const loadProducts = useCallback(() => { appApi<Product[]>("/products?active=true").then(setProducts).catch(fail); }, [fail]);
  useEffect(() => {
    loadProducts();
    appApi<{ session: CashSess | null }>("/cash/current").then((r) => setCash(r.session)).catch(() => setCash(null));
    if (canAccess(user, "instructores") && user?.role !== "RECEPCION") {
      appApi<any[]>("/instructors?active=true").then((r) => setInstructors(r.map((i) => ({ id: i.id, name: i.full_name || `${i.first_name} ${i.last_name}` })))).catch(() => undefined);
    }
  }, [loadProducts]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = useCallback((p: Product) => {
    if (p.kind === "PRODUCTO" && p.stock <= 0) { fail(new Error(`«${p.name}» no tiene stock`)); return; }
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === p.id);
      if (i >= 0) {
        const next = [...c];
        const qty = next[i].qty + 1;
        if (p.kind === "PRODUCTO" && qty > p.stock) { fail(new Error(`Solo quedan ${p.stock} de «${p.name}»`)); return c; }
        next[i] = { ...next[i], qty };
        return next;
      }
      return [...c, { product: p, qty: 1 }];
    });
  }, [fail]);

  function onScan(e: FormEvent) {
    e.preventDefault();
    const code = q.trim();
    if (!code || !products) return;
    const exact = products.find((p) => p.barcode === code || p.sku === code);
    if (exact) { add(exact); setQ(""); return; }
    const found = filtered;
    if (found.length === 1) { add(found[0]); setQ(""); } else if (!found.length) fail(new Error("No encontramos ese producto"));
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (products || []).filter((p) => !s || p.name.toLowerCase().includes(s) || (p.category || "").toLowerCase().includes(s) || p.barcode === q.trim());
  }, [products, q]);

  const subtotal = cart.reduce((a, l) => a + l.product.price * l.qty, 0);
  const pct = Number(discPct.replace(",", ".")) || 0;
  const discount = Math.round(subtotal * pct) / 100;
  const total = Math.max(subtotal - discount, 0);
  const needsCash = !onAccount && method === "EFECTIVO" && cash === null;

  function setQty(id: number, d: number) {
    setCart((c) => c.map((l) => {
      if (l.product.id !== id) return l;
      const qty = l.qty + d;
      if (d > 0 && l.product.kind === "PRODUCTO" && qty > l.product.stock) { fail(new Error(`Solo quedan ${l.product.stock}`)); return l; }
      return { ...l, qty };
    }).filter((l) => l.qty > 0));
  }

  async function charge() {
    if (!cart.length) return;
    setSaving(true);
    try {
      const sale = await appApi<SaleDetail>("/sales", { method: "POST", body: {
        items: cart.map((l) => ({ product_id: l.product.id, qty: l.qty })), method: onAccount ? null : method, member_id: member?.id ?? null, on_account: onAccount,
        discount_pct: pct > 0 ? pct : null, discount_reason: pct > 0 ? discReason.trim() : null, external_invoice_number: invoice.trim() || null,
        sold_by_instructor_id: sellerId ? Number(sellerId) : null,
      } });
      setDone(sale);
      setCart([]); setMember(null); setOnAccount(false); setDiscPct(""); setDiscReason(""); setDiscOpen(false); setInvoice("");
      loadProducts();
    } catch (e) { fail(e); } finally { setSaving(false); }
  }

  function again() { setDone(null); window.setTimeout(() => scan.current?.focus(), 50); }

  return (
    <div className="c3-pos">
      <div>
        <form className="c3-scan" onSubmit={onScan}>
          <input ref={scan} className="c3-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escaneá el código de barras o buscá por nombre" aria-label="Buscar producto" />
          <button className="secondary-button" type="submit">Agregar</button>
        </form>
        {!products ? <Loading /> : filtered.length === 0 ? <Empty title={products.length ? "Ningún producto coincide" : "Todavía no cargaste productos"}>
          {!products.length && <p className="cb-muted">Cargalos en «Productos y stock» para empezar a vender.</p>}</Empty> : (
          <div className="c3-prod-grid">
            {filtered.map((p) => (
              <button key={p.id} className="c3-prod" onClick={() => add(p)} disabled={p.kind === "PRODUCTO" && p.stock <= 0}>
                <strong>{p.name}</strong><em>{money(p.price)}</em>
                <small>{p.kind === "SERVICIO" ? "Servicio" : p.stock <= 0 ? "Sin stock" : `Stock: ${p.stock}`}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="cb-card c3-cart">
        <div className="cb-card-head"><h2 style={{ margin: 0, fontSize: 17 }}>Venta actual</h2>{cart.length > 0 && <button className="cb-link" onClick={() => setCart([])}>Vaciar</button>}</div>
        {cart.length === 0 ? <p className="cb-muted">Tocá un producto para sumarlo.</p> : cart.map((l) => (
          <div className="c3-cart-line" key={l.product.id}>
            <span>{l.product.name}<small className="cb-muted" style={{ display: "block" }}>{money(l.product.price)} c/u</small></span>
            <span className="c3-qty"><button onClick={() => setQty(l.product.id, -1)} aria-label="Menos">−</button><span>{l.qty}</span><button onClick={() => setQty(l.product.id, 1)} aria-label="Más">+</button></span>
            <strong>{money(l.product.price * l.qty)}</strong>
          </div>
        ))}
        <div className="c3-total"><span>Total</span><strong>{money(total)}</strong></div>
        {discount > 0 && <p className="cb-muted" style={{ margin: 0 }}>Incluye descuento de {money(discount)}</p>}

        <div style={{ marginTop: 12 }}>
          <MemberPicker value={member} onPick={(m) => { setMember(m); if (!m) setOnAccount(false); }} placeholder={`${t("member", true)} (opcional)`} />
        </div>
        {member && <Switch on={onAccount} onChange={setOnAccount} label={`Dejar a cuenta de ${member.full_name}`} hint="Queda como deuda y la cobrás después" />}
        {!onAccount && (
          <div className="c3-methods" role="group" aria-label="Medio de pago">
            {METHODS.map(([k, label]) => <button key={k} className={method === k ? "is-on" : ""} onClick={() => setMethod(k)}>{label}</button>)}
          </div>
        )}
        {needsCash && <div className="cb-note cb-note-warn" style={{ marginBottom: 8 }}>Abrí tu caja en «Caja del día» para cobrar en efectivo.</div>}

        <button className="cb-link c3-disc" onClick={() => setDiscOpen(!discOpen)}>{discOpen ? "Sin descuento" : "Aplicar descuento"}</button>
        {discOpen && (
          <div className="product-form" style={{ margin: "10px 0", gap: 10 }}>
            <Field label="Descuento (%)"><input inputMode="decimal" value={discPct} onChange={(e) => setDiscPct(e.target.value)} /></Field>
            <Field label="Motivo del descuento"><input value={discReason} maxLength={200} onChange={(e) => setDiscReason(e.target.value)} /></Field>
          </div>
        )}
        {instructors.length > 0 && (
          <Field label="Vendió (para comisión)">
            <select value={sellerId} onChange={(e) => setSellerId(e.target.value)}><option value="">Nadie</option>{instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
          </Field>
        )}
        <Field label="N.º de factura externa (opcional)"><input value={invoice} maxLength={40} onChange={(e) => setInvoice(e.target.value)} /></Field>
        <button className="primary-button" style={{ width: "100%", marginTop: 12, minHeight: 48 }} disabled={!cart.length || saving || (onAccount && !member) || (pct > 0 && !discReason.trim())} onClick={charge}>
          {saving ? "Cobrando..." : onAccount ? "Dejar a cuenta" : `Cobrar ${money(total)}`}
        </button>
      </aside>

      {done && (
        <Modal eyebrow="VENTA REGISTRADA" title={`Venta #${done.number}`} onClose={again}
          footer={<><button className="secondary-button" onClick={() => window.open(`/print/venta/${done.id}`, "_blank")}>Imprimir ticket</button><button className="primary-button" onClick={again}>Nueva venta</button></>}>
          <p className="c3-bignum">{money(done.total)}</p>
          <p className="cb-muted">{done.on_account ? `Quedó a cuenta de ${done.member_name}.` : "Cobrado."} {done.items_count} {done.items_count === 1 ? "artículo" : "artículos"}.</p>
        </Modal>
      )}
      {flash}
    </div>
  );
}

export default Venta;
