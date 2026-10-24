export interface Product {
  id: number; name: string; sku: string | null; barcode: string | null; category: string | null; price: number; cost: number;
  stock: number; min_stock: number; kind: "PRODUCTO" | "SERVICIO"; active: boolean; low_stock: boolean;
}
export interface SaleRow {
  id: number; number: number; total: number; discount_amount: number; status: "OK" | "ANULADA"; at: string; member_name: string | null;
  user_name: string | null; method: string | null; on_account: boolean; charge_status: string | null; items_count: number; receipt_number: number | null;
}
export interface SaleDetail extends SaleRow {
  items: { name: string; qty: number; unit_price: number; subtotal: number }[]; subtotal: number;
  club: { name: string; address: string | null; city: string | null; phone: string | null; cuit: string | null }; footer: string | null;
  external_invoice_number: string | null; voided_reason: string | null;
}
export interface Totals {
  opening_amount: number; by_method: Record<string, { total: number; count: number }>; cash_in: number; movements_in: number; movements_out: number;
  expected_cash: number; total_collected: number; voided_total: number; voided_count: number; sales_total: number; sales_count: number;
}
export interface CashSess {
  id: number; user_id: number; user_name: string | null; status: "ABIERTA" | "CERRADA"; opened_at: string; closed_at: string | null; opening_amount: number;
  closing_counted: number | null; expected_cash: number | null; difference: number | null; notes: string | null; from_previous_day: boolean; totals?: Totals;
}
export interface Movement { id: number; kind: "INGRESO" | "EGRESO"; concept: string; amount: number; method: string; category: string | null; at: string; user_name: string | null; session_id: number }
export const CATEGORY_LABEL: Record<string, string> = {
  LIMPIEZA: "Limpieza", SERVICIOS: "Servicios (luz, agua...)", SUELDOS: "Sueldos", MANTENIMIENTO: "Mantenimiento", COMPRAS: "Compras", RETIRO: "Retiro", ANULACION: "Anulación de venta", OTRO: "Otro",
};
