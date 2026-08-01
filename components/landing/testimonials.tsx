import { TESTIMONIALS, type Testimonial } from "@/lib/testimonials";

function Avatar({ t }: { t: Testimonial }) {
  if (t.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={t.avatar}
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = (t.name ?? t.label ?? "·").charAt(0).toUpperCase();
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-full bg-sun-soft text-sm font-bold text-sun-deep"
      aria-hidden
    >
      {t.name ? initial : "❝"}
    </span>
  );
}

function Card({ t }: { t: Testimonial }) {
  const recording = t.video ?? t.audio;
  return (
    <figure
      className={`glass flex flex-col rounded-[1.75rem] p-6 shadow-lg shadow-ink/5 ${
        t.featured || recording ? "sm:col-span-2" : ""
      }`}
    >
      {t.video && (
        <video
          controls
          playsInline
          preload="metadata"
          poster={t.poster}
          className="mb-4 w-full rounded-2xl bg-paper-deep"
        >
          <source src={t.video} />
          Your browser can&apos;t play this recording, the transcript is below.
        </video>
      )}

      {t.audio && !t.video && (
        <div className="mb-4 rounded-2xl bg-paper-deep/60 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            <span aria-hidden>🎧</span> Hear it in their words
          </div>
          <audio controls preload="metadata" className="w-full">
            <source src={t.audio} type="audio/mpeg" />
            Your browser can&apos;t play this recording, the transcript is below.
          </audio>
        </div>
      )}

      <blockquote
        className={`flex-1 leading-relaxed text-ink-soft ${
          t.featured && !recording ? "text-lg" : "text-[15px]"
        }`}
      >
        {recording && (
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            Transcript
          </span>
        )}
        <span className="text-ink">“</span>
        {t.quote}
        <span className="text-ink">”</span>
      </blockquote>

      <figcaption className="mt-5 flex items-center gap-3 border-t border-line/70 pt-4">
        <Avatar t={t} />
        <span className="min-w-0">
          {t.name ? (
            <>
              <span className="block truncate text-sm font-semibold">{t.name}</span>
              {t.role && <span className="block truncate text-xs text-ink-faint">{t.role}</span>}
            </>
          ) : (
            <span className="block truncate text-xs text-ink-faint">
              {t.label ?? "Anonymous"}
            </span>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

export function Testimonials() {
  if (TESTIMONIALS.length === 0) return null;

  return (
    <section aria-label="What people say" className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
      <h2 className="font-display text-center text-4xl tracking-tight sm:text-5xl">
        In people&apos;s <em className="text-sun">own words</em>
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-[15px] leading-7 text-ink-soft">
        {TESTIMONIALS.length === 1
          ? "An early user on what actually stuck, press play, or read it below."
          : "Written, anonymous, or recorded, real experiences from people who plan their days in Kairo."}
      </p>

      <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
        {TESTIMONIALS.map((t) => (
          <Card key={t.id} t={t} />
        ))}
      </div>
    </section>
  );
}
