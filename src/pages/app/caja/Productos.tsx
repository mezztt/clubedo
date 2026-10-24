import { useCallback, useEffect, useState } from "react";
import { appApi, dateTime, money } from "../../../config";
import { Empty, Field, Loading, Modal, Pill, Seg, useFlash } from "../../../components/ui";
import { isManager } from "../../../components/c3/common";
import type { Product } from "./types";

const REASONS: [string, string][] = [["COMPRA", "Compra (suma)"], ["ROTURA", "Rotura o pérdida (resta)"], ["AJUSTE", "Ajuste con signo"]];
const MOVE_LABEL: Record<string, string> = { COMPRA: "Compra", VENTA: "Venta", AJUSTE: "Ajuste", ROTURA: "Rotura" };

/** Productos y stock: alta, precio, mínimo, ajustes y movimientos. Solo ve y edita quien administra; recepción mira. */
function Productos() {
  const { show, fail, node: flash } = useFlash();
  const manager = isManager();
  const [items, setItems] = useState<Product[] | null>(null);
  const [q, setQ] = useState("");
  const [low, setLow] = useState(() => new URLSearchParams(window.location.search).get("bajo") === "1");
  const [showInactive, setShowInactive] = useState(false);
  const [edit, setEdit] = useState<Partial<Product> | null>(null);
  const [stock, setStock] = useState<Product | null>(null);
  const [moves, setMoves] = useState<{ p: Product; rows: any[] } | null>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (q.trim()) qs.set("q", q.trim());
    if (low) qs.set("low", "true");
    if (!showInactive) qs.set("active", "true");
    appApi<Product[]>(`/products?${qs}`).then(setItems).catch(fail);
  }, [q, low, showInactive, fail]);
  useEffect(() => { const h = window.setTimeout(load, 200); return () => window.clearTimeout(h); }, [load]);

  async function openMoves(p: Product) { try { setMoves({ p, rows: await appApi(`/products/${p.id}/movements`) }); } catch (e) { fail(e); } }

  return (
    <div>
      <div className="cb-toolbar">
        <input className="c3-input cb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, código o rubro" aria-label="Buscar" />
        <div className="cb-filters">
          <Seg value={low ? "low" : "all"} onChange={(v) => setLow(v === "low")} options={[["all", "Todos"], ["low", "Stock bajo"]]} />
          <label className="c3-inline"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Ver archivados</label>
          {manager && <button className="primary-button" onClick={() => setEdit({ kind: "PRODUCTO", price: 0, cost: 0, stock: 0, min_stock: 0, active: true })}>Nuevo producto</button>}
        </div>
      </div>
      {!items ? <Loading /> : items.length === 0 ? <Empty title={low ? "No hay productos con stock bajo" : "Todavía no hay productos"} /> : (
        <div className="cb-table-wrap"><table className="cb-table">
          <thead><tr><th>Producto</th><th>Código</th><th className="num">Precio</th>{manager && <th className="num">Costo</th>}<th className="num">Stock</th><th className="num">Mínimo</th><th /></tr></thead>
          <tbody>{items.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.name}</strong><small>{p.kind === "SERVICIO" ? "Servicio" : p.category || ""}{!p.active ? " · archivado" : ""}</small></td>
              <td>{p.barcode || p.sku || "—"}</td><td className="num">{money(p.price)}</td>{manager && <td className="num">{money(p.cost)}</td>}
              <td className="num">{p.kind === "SERVICIO" ? "—" : <Pill tone={p.low_stock ? (p.stock <= 0 ? "red" : "orange") : "green"}>{p.stock}</Pill>}</td>
              <td className="num">{p.kind === "SERVICIO" ? "—" : p.min_stock}</td>
              <td className="num"><div className="cb-row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                <button className="cb-link" onClick={() => openMoves(p)}>Movimientos</button>
                {manager && p.kind === "PRODUCTO" && <button className="cb-link" onClick={() => setStock(p)}>Stock</button>}
                {manager && <button className="cb-link" onClick={() => setEdit(p)}>Editar</button>}</div></td>
            </tr>))}</tbody></table></div>
      )}
      {edit && <ProductModal initial={edit} onClose={() => setEdit(null)} onFail={fail} onDone={() => { setEdit(null); load(); show("Producto guardado"); }} />}
      {stock && <StockModal p={stock} onClose={() => setStock(null)} onFail={fail} onDone={() => { setStock(null); load(); show("Stock actualizado"); }} />}
      {moves && (
        <Modal eyebrow="STOCK" title={moves.p.name} onClose={() => setMoves(null)} footer={<button className="primary-button" onClick={() => setMoves(null)}>Cerrar</button>}>
          {moves.rows.length === 0 ? <p className="cb-muted">Sin movimientos todavía.</p> : (
            <div className="cb-table-wrap"><table className="cb-table"><tbody>{moves.rows.map((m) => <tr key={m.id}><td>{dateTime(m.at)}</td><td>{MOVE_LABEL[m.reason] || m.reason}{m.ref_id ? ` #${m.ref_id}` : ""}</td><td>{m.user || ""}</td><td className="num"><Pill tone={m.delta < 0 ? "red" : "green"}>{m.delta > 0 ? "+" : ""}{m.delta}</Pill></td></tr>)}</tbody></table></div>)}
        </Modal>
      )}
      {flash}
    </div>
  );
}

function ProductModal({ initial, onClose, onDone, onFail }: { initial: Partial<Product>; onClose: () => void; onDone: () => void; onFail: (e: unknown) => void }) {
  const isNew = !initial.id;
  const [f, setF] = useState({
    name: initial.name || "", sku: initial.sku || "", barcode: initial.barcode || "", category: initial.category || "", price: String(initial.price ?? 0), cost: String(initial.cost ?? 0),
    stock: String(initial.stock ?? 0), min_stock: String(initial.min_stock ?? 0), kind: initial.kind || "PRODUCTO", active: initial.active ?? true,
  });
  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }));
  const n = (v: string) => Number(v.replace(",", ".")) || 0;
  async function save() {
    const body: any = { name: f.name.trim(), sku: f.sku, barcode: f.barcode, category: f.category, price: n(f.price), cost: n(f.cost), min_stock: Math.round(n(f.min_stock)), kind: f.kind, active: f.active };
    if (isNew) body.stock = Math.round(n(f.stock));
    try { await appApi(isNew ? "/products" : `/products/${initial.id}`, { method: isNew ? "POST" : "PUT", body }); onDone(); } catch (e) { onFail(e); }
  }
  return (
    <Modal eyebrow="PRODUCTOS" title={isNew ? "Nuevo producto" : "Editar producto"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!f.name.trim()} onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <Field label="Nombre"><input value={f.name} maxLength={120} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="form-row">
          <Field label="Tipo"><select value={f.kind} onChange={(e) => set("kind", e.target.value)}><option value="PRODUCTO">Producto (lleva stock)</option><option value="SERVICIO">Servicio (sin stock)</option></select></Field>
          <Field label="Rubro"><input value={f.category} maxLength={60} onChange={(e) => set("category", e.target.value)} placeholder="Bebidas, suplementos..." /></Field>
        </div>
        <div className="form-row">
          <Field label="Precio de venta ($)"><input inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Costo ($)"><input inputMode="decimal" value={f.cost} onChange={(e) => set("cost", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Código de barras"><input value={f.barcode} maxLength={40} onChange={(e) => set("barcode", e.target.value)} /></Field>
          <Field label="Código propio (SKU)"><input value={f.sku} maxLength={40} onChange={(e) => set("sku", e.target.value)} /></Field>
        </div>
        {f.kind === "PRODUCTO" && (
          <div className="form-row">
            {isNew ? <Field label="Stock inicial"><input inputMode="numeric" value={f.stock} onChange={(e) => set("stock", e.target.value)} /></Field> : <Field label="Stock actual" hint="Para cambiarlo usá «Stock»"><input value={initial.stock ?? 0} disabled /></Field>}
            <Field label="Stock mínimo" hint="Te avisamos en Pendientes cuando llegue acá"><input inputMode="numeric" value={f.min_stock} onChange={(e) => set("min_stock", e.target.value)} /></Field>
          </div>
        )}
        {!isNew && <div className="cb-inline-checks"><label><input type="checkbox" checked={!f.active} onChange={(e) => set("active", !e.target.checked)} /> Archivado (no aparece para vender)</label></div>}
      </div>
    </Modal>
  );
}

function StockModal({ p, onClose, onDone, onFail }: { p: Product; onClose: () => void; onDone: () => void; onFail: (e: unknown) => void }) {
  const [reason, setReason] = useState("COMPRA");
  const [qty, setQty] = useState("");
  const q = Math.round(Number(qty.replace(",", ".")));
  async function save() { try { await appApi(`/products/${p.id}/stock`, { method: "POST", body: { delta: q, reason } }); onDone(); } catch (e) { onFail(e); } }
  return (
    <Modal eyebrow="STOCK" title={p.name} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!q} onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <p className="cb-muted" style={{ margin: 0 }}>Hoy hay <strong>{p.stock}</strong> unidades.</p>
        <Field label="Motivo"><select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label={reason === "AJUSTE" ? "Cantidad (con signo: -3 resta)" : "Cantidad"}><input inputMode="numeric" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export default Productos;
