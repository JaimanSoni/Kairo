/**
 * Things to write about, for the page that won't start.
 *
 * Every one is answerable on a bad day. "What went well?" asks for a win
 * someone may not have had; "What's taking up space in your head?" asks only
 * for honesty. None of them grade the day, and none assume it was good.
 */
export const PROMPTS = [
  "What's taking up space in your head right now?",
  "What did today feel like, in one word? Now say why.",
  "What's one small thing that went better than expected?",
  "Who did you think about today?",
  "What would you tell this morning's version of you?",
  "What drained you today, and what gave some back?",
  "What are you looking forward to, even a little?",
  "What did you notice today that you'd usually walk past?",
  "What's something you're carrying that you could put down?",
  "Describe the best ten minutes of today.",
  "What surprised you?",
  "What are you grateful for that you didn't have a year ago?",
  "What's a conversation you keep replaying?",
  "What did you learn today, about anything at all?",
  "If today were a chapter, what would it be called?",
  "What's one thing you'd like tomorrow to hold?",
  "What made you laugh, or almost?",
  "Where did your time actually go today?",
  "What's something you did for someone else?",
  "What's a worry that turned out smaller than it looked?",
  "What does rest look like for you this week?",
  "Write about a sound, a smell, or a taste from today.",
  "What are you proud of that nobody saw?",
  "What would make you feel lighter tomorrow?",
  "What's a question you don't have an answer to yet?",
  "What did your body need today? Did it get it?",
  "Who would you like to hear from?",
  "What's changed since the last time you wrote here?",
  "Finish this: \"Right now, I mostly want…\"",
  "What went unsaid today?",
  "Name three ordinary things that were good.",
  "What's one thing you'd do differently, gently?",
];

/**
 * A prompt for a given day, chosen by the date so it doesn't change every time
 * the page opens — a prompt that reshuffles on each visit feels like a slot
 * machine, one that stays feels like a question.
 */
export function promptFor(date: string, offset = 0): string {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PROMPTS[(h + offset) % PROMPTS.length];
}
