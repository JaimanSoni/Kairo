import Image from "next/image";
import { iconKeyFor } from "@/lib/icons";

/**
 * The 3D icon set living in /public/img. The keys live in lib/icons.ts, where
 * the server can read them too; see IMAGE-PROMPTS.md for the generation spec.
 */
export { LIST_ICONS, PROPERTY_ICONS, SYSTEM_ICONS, iconKeyFor } from "@/lib/icons";

/** Renders a known 3D icon by key. */
export function Icon3d({
  name,
  size = 20,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={`/img/${name}.png`}
      alt=""
      width={size}
      height={size}
      className={`inline-block select-none object-contain ${className ?? ""}`}
      draggable={false}
    />
  );
}

/**
 * A list's visual mark: 3D icon when the stored value is (or maps to) one,
 * otherwise the raw emoji as text — old custom emojis keep working.
 */
export function ListMark({ value, size = 20 }: { value: string; size?: number }) {
  const key = iconKeyFor(value);
  if (key) return <Icon3d name={key} size={size} />;
  return (
    <span className="inline-block leading-none" style={{ fontSize: Math.round(size * 0.85) }}>
      {value}
    </span>
  );
}
