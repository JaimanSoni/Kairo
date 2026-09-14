/**
 * The page-icon emoji set: a few hundred, grouped, each with the words people
 * search for. Hand-picked rather than all 3,700 — a picker that shows every
 * flag and skin tone is a picker nobody finds anything in.
 */

type Group = { name: string; items: [emoji: string, words: string][] };

const raw: [name: string, list: string][] = [
  [
    "Pages",
    "📄 page doc|📝 note memo write|📚 books library reading|📖 book read|🗒️ notepad|📓 notebook|📔 journal diary|📒 ledger|📋 clipboard list|📌 pin|📎 clip|🗂️ folders index|📁 folder|🗃️ archive box|🔖 bookmark|🏷️ label tag|✏️ pencil|🖊️ pen|🖋️ fountain|📐 ruler design|📏 measure|🔍 search find|💡 idea light|🧠 brain think|🎯 goal target|🚀 launch rocket project|⭐ star favorite|✨ sparkle new|🔥 fire hot|✅ done check|☑️ todo checkbox|🗓️ calendar week|📅 date|⏰ alarm time|⌛ hourglass wait|📊 chart stats|📈 growth up|📉 down|🧾 receipt|💼 work briefcase|🏢 office company",
  ],
  [
    "Smileys",
    "😀 grin happy|😃 smile|😄 laugh|😁 beam|😊 blush|🙂 slight|😉 wink|😍 love heart eyes|🥰 adore|😘 kiss|😎 cool sunglasses|🤓 nerd|🧐 monocle|🤔 thinking|🤨 skeptic|😐 neutral|😴 sleep|😌 relieved calm|🥳 party|🤩 star struck|😇 angel|🙃 upside|😅 sweat|😂 joy tears|🤯 mind blown|😬 grimace|😢 cry sad|😭 sob|😤 huff|😡 angry|🥶 cold|🥵 hot|🤒 sick|🤗 hug|🤫 shush secret|🫡 salute|👻 ghost|🤖 robot bot|👽 alien|💀 skull",
  ],
  [
    "People",
    "👋 wave hello|👍 thumbs up yes|👎 thumbs down|👏 clap|🙌 raise hands|🙏 pray thanks|💪 strong flex|✍️ writing|🤝 handshake deal|👀 eyes look|🧑‍💻 developer coder|👩‍🍳 cook chef|🧑‍🎨 artist|🧑‍🏫 teacher|🧑‍🔬 scientist|🧘 yoga meditate|🏃 run|🚴 cycle bike|🏋️ gym lift|👶 baby|👨‍👩‍👧 family|💃 dance|🧑‍🤝‍🧑 friends people|🗣️ speak talk",
  ],
  [
    "Nature",
    "🌱 seedling grow|🌿 herb|🍀 clover luck|🌸 blossom|🌻 sunflower|🌷 tulip|🌹 rose|🌵 cactus|🌲 tree evergreen|🌳 tree|🍁 maple autumn|🍂 leaves fall|🌊 wave ocean sea|🏔️ mountain|🌋 volcano|🏝️ island beach|☀️ sun|🌤️ sunny|⛅ cloud|🌧️ rain|⛈️ storm|❄️ snow|🌈 rainbow|🌙 moon night|⭐ star|🌍 earth world globe|🔆 bright|🐶 dog puppy|🐱 cat|🦊 fox|🐻 bear|🐼 panda|🐨 koala|🦁 lion|🐯 tiger|🐸 frog|🐧 penguin|🦉 owl|🦋 butterfly|🐝 bee|🐢 turtle|🐙 octopus|🐳 whale|🦄 unicorn",
  ],
  [
    "Food",
    "☕ coffee|🍵 tea|🧋 boba|🍷 wine|🍺 beer|🥂 cheers|🍎 apple|🍋 lemon|🍓 strawberry|🍉 watermelon|🍌 banana|🥑 avocado|🥕 carrot|🌽 corn|🍞 bread|🥐 croissant|🧀 cheese|🍳 egg breakfast|🥞 pancakes|🍕 pizza|🍔 burger|🌮 taco|🍣 sushi|🍜 ramen noodles|🍛 curry|🥗 salad|🍰 cake|🎂 birthday|🍪 cookie|🍫 chocolate|🍩 donut|🍿 popcorn|🧁 cupcake|🥘 recipe pan|🍽️ dinner plate",
  ],
  [
    "Activities",
    "⚽ football soccer|🏀 basketball|🎾 tennis|🏏 cricket|🏈 american football|⛳ golf|🏓 ping pong|🎮 game controller|🕹️ arcade|🎲 dice|♟️ chess|🧩 puzzle|🎨 art paint|🎭 theatre|🎬 film movie|🎤 mic sing|🎧 headphones music|🎸 guitar|🎹 piano|🥁 drum|📷 camera photo|🎉 party celebrate|🎁 gift present|🏆 trophy win|🥇 medal first|🎟️ ticket event|🎪 circus|🧶 knit|🪴 plant garden",
  ],
  [
    "Travel",
    "✈️ plane flight travel|🚗 car|🚕 taxi|🚌 bus|🚆 train|🚲 bicycle|🛵 scooter|⛵ sail boat|🚢 ship|🗺️ map|🧭 compass|🏕️ camping|🏖️ beach holiday|🏙️ city|🌆 skyline|🗼 tower|🗽 liberty|🏰 castle|⛩️ shrine|🕌 mosque|🛕 temple|🏠 home house|🏡 garden house|🛏️ bed hotel|🧳 luggage trip|🛫 departure|🌅 sunrise|🌄 sunrise mountain|🎡 ferris wheel",
  ],
  [
    "Objects",
    "💻 laptop computer|🖥️ desktop|⌨️ keyboard|🖱️ mouse|📱 phone mobile|☎️ telephone|📺 tv|🔋 battery|🔌 plug|💾 save disk|💿 cd|🧮 abacus|🔬 microscope science|🔭 telescope|🧪 test tube experiment|💊 pill health|🩺 doctor|🧰 toolbox|🔧 wrench fix|🔨 hammer build|⚙️ settings gear|🔗 link chain|🔒 lock secure private|🔑 key|🛠️ tools|💰 money bag|💳 card payment|💵 cash dollar|🪙 coin|📦 package box shipping|✉️ envelope mail email|📬 mailbox|📣 megaphone announce|🔔 bell notify|🎓 graduation school|🏫 school|🧹 broom clean|🛒 cart shopping|🪄 magic wand",
  ],
  [
    "Symbols",
    "❤️ heart love|🧡 orange heart|💛 yellow heart|💚 green heart|💙 blue heart|💜 purple heart|🖤 black heart|🤍 white heart|💯 hundred|✔️ check|❌ cross no|⚠️ warning|❗ exclamation important|❓ question|💬 speech chat|💭 thought|🔴 red circle|🟠 orange circle|🟡 yellow circle|🟢 green circle|🔵 blue circle|🟣 purple circle|⚫ black circle|⚪ white circle|🔶 diamond|🔷 blue diamond|➕ plus add|➖ minus|♻️ recycle|⚡ zap lightning energy|☮️ peace|☯️ yin yang|♾️ infinity|🆕 new|🆒 cool|🔝 top|🏁 finish flag|🚩 flag",
  ],
];

export const EMOJI_GROUPS: Group[] = raw.map(([name, list]) => ({
  name,
  items: list.split("|").map((entry) => {
    const [emoji, ...words] = entry.split(" ");
    return [emoji, words.join(" ")] as [string, string];
  }),
}));

export function searchEmoji(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: string[] = [];
  for (const g of EMOJI_GROUPS) {
    for (const [emoji, words] of g.items) {
      if (words.split(" ").some((w) => w.startsWith(q)) && !out.includes(emoji)) out.push(emoji);
    }
  }
  return out;
}

export function randomEmoji(seed: number): string {
  const all = EMOJI_GROUPS.flatMap((g) => g.items.map(([e]) => e));
  return all[Math.abs(seed) % all.length];
}
