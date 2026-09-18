/**
 * The real weather, as the garden sees it: shared by the server that looks
 * it up and the sky that draws it.
 */

export type SkyKind = "clear" | "fair" | "partly" | "cloudy" | "fog" | "rain" | "sleet" | "snow";

export type LiveSky = {
  kind: SkyKind;
  /** 1 light, 2 steady, 3 heavy. It only matters when something is falling. */
  intensity: 1 | 2 | 3;
  thunder: boolean;
  /** Showers: rain that comes and goes, with the sun in between. */
  showers: boolean;
  tempC: number | null;
  /** Metres a second. */
  windMs: number | null;
  /** The town it's for, when we know it. */
  place: string | null;
  fahrenheit: boolean;
  /** Today's sunrise and sunset there, as ISO instants. Null in a polar day or night. */
  sunrise: string | null;
  sunset: string | null;
  /** The hour this describes. */
  at: string;
};

export const isFalling = (sky: LiveSky) => sky.kind === "rain" || sky.kind === "sleet" || sky.kind === "snow";

/** The weather in a few words: "Heavy rain", "Thunderstorm", "Clear". */
export function skyLabel(sky: LiveSky, night: boolean): string {
  const by = (light: string, steady: string, heavy: string) => [light, steady, heavy][sky.intensity - 1];
  switch (sky.kind) {
    case "clear":
      return night ? "Clear" : "Sunny";
    case "fair":
      return night ? "Mostly clear" : "Mostly sunny";
    case "partly":
      return "Partly cloudy";
    case "cloudy":
      return "Cloudy";
    case "fog":
      return "Foggy";
    case "rain":
      if (sky.thunder) return sky.intensity === 3 ? "Heavy thunderstorm" : "Thunderstorm";
      return sky.showers ? by("Light showers", "Showers", "Heavy showers") : by("Light rain", "Rain", "Heavy rain");
    case "sleet":
      return by("Light sleet", "Sleet", "Heavy sleet");
    case "snow":
      return sky.thunder ? "Snow and thunder" : by("Light snow", "Snow", "Heavy snow");
  }
}

/** "26°", in whichever scale the place reads its thermometers in. */
export function skyTemp(sky: LiveSky): string | null {
  if (sky.tempC === null) return null;
  return `${Math.round(sky.fahrenheit ? (sky.tempC * 9) / 5 + 32 : sky.tempC)}°`;
}
