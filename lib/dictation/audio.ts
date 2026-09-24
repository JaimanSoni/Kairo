/**
 * Getting a clean second of speech out of a microphone.
 *
 * Most of what people call a bad speech model is a bad recording. Whisper
 * wants exactly one thing: mono, sixteen thousand samples a second, and as
 * little of the room as possible. It is also unusually bad at very short
 * clips -- under about a second it starts repeating itself or inventing a
 * sign-off, because every clip it was trained on was thirty seconds long and
 * padded. So a clip is trimmed to where the speech actually is, and then
 * padded back out to something the model recognises as a clip.
 *
 * Nothing here touches the model or React. It hands back a Float32Array.
 */

/** Sixteen kilohertz, mono. Whisper has never been fed anything else. */
export const SAMPLE_RATE = 16000;

/** Quieter than this, for a whole window, is the room rather than a person. */
const SILENCE = 0.01;

/** Keep a breath either side of the speech, so nothing is clipped off a word. */
const EDGE_MS = 160;

/** Shorter than this and the model starts talking to itself. */
const MIN_MS = 1100;

/**
 * A backstop, not a feature.
 *
 * Nothing stops a take but the person who started it. This exists only for
 * the microphone left open in a forgotten tab, and is long enough that
 * nobody talking will ever meet it.
 */
export const MAX_MS = 180_000;

export type Recording = {
  /** 0 to 1, for a meter. Cheap enough to poll on a frame. */
  level: () => number;
  /** Stop, and hand back what was said, ready for the model. */
  stop: () => Promise<Float32Array>;
  /** Stop and throw it away. */
  cancel: () => void;
};

/** What this browser will record into, preferring the one Whisper likes most. */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function canRecord(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

/**
 * Open the microphone and start recording.
 *
 * The constraints are the browser's own cleanup, which is built for speech
 * and is better than anything we would do afterwards: it cancels the echo of
 * our own notification sounds, suppresses steady noise like a fan, and levels
 * a quiet voice.
 *
 * It records until it is told to stop, and nothing else ends it.
 *
 * It used to end itself after a stretch of quiet, and the quiet it waited for
 * was never right: long enough for somebody thinking mid-sentence was long
 * enough to feel broken for somebody who had finished, and short enough to
 * feel quick cut people off between thoughts. Thinking out loud is exactly
 * what capture asks for, so the take is the speaker's to end.
 */
export async function startRecording(opts: { onLimit?: () => void } = {}): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);
  const frame = new Uint8Array(analyser.fftSize);

  const readLevel = () => {
    analyser.getByteTimeDomainData(frame);
    let peak = 0;
    for (let i = 0; i < frame.length; i++) {
      const v = Math.abs(frame[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    return peak;
  };

  const chunks: BlobPart[] = [];
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  rec.start();

  const shutDown = () => {
    clearTimeout(cap);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  };

  const cap = setTimeout(() => opts.onLimit?.(), MAX_MS);

  return {
    level: readLevel,
    cancel: () => {
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {
        /* already gone */
      }
      shutDown();
    },
    stop: () =>
      new Promise<Float32Array>((resolve, reject) => {
        rec.onstop = async () => {
          shutDown();
          try {
            const blob = new Blob(chunks, mime ? { type: mime } : undefined);
            resolve(await toModelAudio(blob));
          } catch (err) {
            reject(err instanceof Error ? err : new Error("could not read the recording"));
          }
        };
        try {
          if (rec.state === "inactive") rec.onstop?.(new Event("stop"));
          else rec.stop();
        } catch (err) {
          shutDown();
          reject(err instanceof Error ? err : new Error("could not stop the recording"));
        }
      }),
  };
}

/** A recorded blob, decoded and resampled to what the model reads. */
export async function toModelAudio(blob: Blob): Promise<Float32Array> {
  const bytes = await blob.arrayBuffer();
  // decoding happens at whatever rate the file is in; the resample is separate
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(bytes);
  } finally {
    void decodeCtx.close().catch(() => {});
  }
  return shape(await resample(decoded));
}

/** Down to one channel at 16kHz, by the browser's own resampler. */
async function resample(buffer: AudioBuffer): Promise<Float32Array> {
  if (buffer.sampleRate === SAMPLE_RATE && buffer.numberOfChannels === 1) {
    return new Float32Array(buffer.getChannelData(0));
  }
  const frames = Math.max(1, Math.ceil((buffer.duration * SAMPLE_RATE) | 0));
  const offline = new OfflineAudioContext(1, frames, SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start();
  const out = await offline.startRendering();
  return new Float32Array(out.getChannelData(0));
}

/**
 * Trim the silence off both ends, then pad back to a length the model is
 * comfortable with. Both halves matter: the trim is what stops a long tail of
 * room tone turning into an invented sentence, and the pad is what stops a
 * two-word task coming back as the same word four times.
 */
export function shape(samples: Float32Array): Float32Array {
  const window = Math.floor(SAMPLE_RATE * 0.02); // 20ms
  const loud = (at: number) => {
    let sum = 0;
    const end = Math.min(samples.length, at + window);
    for (let i = at; i < end; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / Math.max(1, end - at)) > SILENCE;
  };

  let first = 0;
  while (first < samples.length && !loud(first)) first += window;
  if (first >= samples.length) return new Float32Array(0); // nothing was said

  let last = samples.length - window;
  while (last > first && !loud(last)) last -= window;

  const edge = Math.floor((SAMPLE_RATE * EDGE_MS) / 1000);
  const from = Math.max(0, first - edge);
  const to = Math.min(samples.length, last + window + edge);
  const speech = samples.subarray(from, to);

  const least = Math.floor((SAMPLE_RATE * MIN_MS) / 1000);
  if (speech.length >= least) return new Float32Array(speech);

  const padded = new Float32Array(least); // zeros: silence the model expects
  padded.set(speech, Math.floor((least - speech.length) / 2));
  return padded;
}
