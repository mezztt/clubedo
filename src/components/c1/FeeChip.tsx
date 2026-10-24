import { Pill } from "../ui";

export interface FeeInfo { state: string; state_label?: string; label?: string; state_tone?: string; tone?: string; days?: number | null }

/** Estado de cuota de una persona: etiqueta con color y el texto («vence en 3 días»). */
export default function FeeChip({ state, label, tone, name }: { state: string; label?: string; tone?: string; name?: string }) {
  return (
    <span className="c1-fee">
      <Pill tone={tone || "gray"}>{name || state}</Pill>
      {label && <small>{label}</small>}
    </span>
  );
}
