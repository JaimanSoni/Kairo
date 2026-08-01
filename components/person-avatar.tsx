import { animalAvatar } from "@/lib/avatars";

/** Tiny avatar: profile photo when available, else the person's animal. */
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
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-sun-soft"
      style={{ width: dim, height: dim }}
    >
      {/* object-contain with a whisker of padding: the characters have ears
          and cups that a cover-crop circle would amputate */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={animalAvatar(name)} alt="" className="size-full object-contain p-[5%]" />
    </span>
  );
}
