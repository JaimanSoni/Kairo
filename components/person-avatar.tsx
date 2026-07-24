/** Tiny avatar: profile photo when available, else a colored initial. */
export function PersonAvatar({
  name,
  picture,
  size = 20,
}: {
  name: string;
  picture?: string;
  size?: number;
}) {
  const dim = `${size}px`;
  if (picture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={picture}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover"
        style={{ width: dim, height: dim }}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-sun-soft font-bold text-sun-deep"
      style={{ width: dim, height: dim, fontSize: Math.round(size * 0.5) }}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}
