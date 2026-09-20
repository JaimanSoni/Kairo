"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Task } from "@/lib/types";
import { agentState, agentWhen } from "@/lib/agent-run";
import { hiddenListIds, useApp } from "./store";
import { Modal } from "./ui";

/**
 * What's being done for you while you're not at the machine.
 *
 * A task handed to an agent goes on doing something after you close the
 * laptop, and until now the only way to know how it was going was to go back
 * and look. This is the part that travels: one line per task saying what it's
 * doing, and — the reason this exists at all — the questions it stopped on,
 * answerable from a phone.
 *
 * Anything waiting on you comes first and stays first, because an agent that
 * asked a question two hours ago has been sitting idle for two hours. That is
 * the expensive thing this is here to prevent.
 *
 * It shows nothing at all when no agent is working, which is most of the time
 * for most people, and it never takes over the screen: a question is a thing
 * to answer when you get to it, not an interruption.
 */

export function AgentWork() {
  const { state, answerAgent, setEditing } = useApp();
  const params = useSearchParams();
  const [picked, setPicked] = useState<string | null>(null);
  const [closedPush, setClosedPush] = useState(false);

  const runs = useMemo(() => {
    const hidden = hiddenListIds(state);
    const open = Object.values(state.tasks).filter(
      (t) => t.agent && t.status !== "done" && !(t.listId && hidden.has(t.listId))
    );
    const rank = (t: Task) => (agentState(t.agent) === "waiting" ? 0 : agentState(t.agent) === "working" ? 1 : 2);
    return open.sort((a, b) => rank(a) - rank(b) || Date.parse(b.agent?.at ?? "") - Date.parse(a.agent?.at ?? ""));
  }, [state]);

  // arriving from the push: the question it was about is open until you close it
  const wanted = params.get("answer");
  const fromPush = !closedPush && wanted && agentState(state.tasks[wanted]?.agent) === "waiting" ? wanted : null;
  const asking = picked ?? fromPush;

  if (state.appLocked || runs.length === 0) return null;
  const waiting = runs.filter((t) => agentState(t.agent) === "waiting");
  const askingTask = asking ? state.tasks[asking] : null;

  return (
    <section aria-label="Agent work" className="rounded-2xl border border-line bg-card p-1.5" data-agent-work>
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {waiting.length > 0 ? `${waiting.length === 1 ? "An agent needs" : `${waiting.length} agents need`} you` : "Being worked on"}
        </h2>
        <span className="text-[11px] text-ink-faint">{runs.length}</span>
      </div>
      <ul className="space-y-1">
        {runs.map((task) => {
          const run = task.agent;
          if (!run) return null;
          const stage = agentState(run);
          return (
            <li key={task.id}>
              <div className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${stage === "waiting" ? "bg-clay-soft/50" : ""}`} data-agent-row data-agent-state={stage}>
                <span className="shrink-0" aria-hidden>
                  {stage === "waiting" ? (
                    <span className="grid size-7 place-items-center rounded-full bg-clay text-on-accent text-[13px] font-bold">?</span>
                  ) : stage === "finished" ? (
                    <span className="grid size-7 place-items-center rounded-full bg-moss text-on-accent">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : (
                    <span className="grid size-7 place-items-center rounded-full bg-sky-soft">
                      <span className="anim-pulse size-2 rounded-full bg-sky" />
                    </span>
                  )}
                </span>
                <button onClick={() => setEditing(task.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium leading-snug">{task.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-ink-soft">
                    {stage === "waiting" ? run.question : run.note || (stage === "finished" ? "Finished" : "Working")}
                  </span>
                </button>
                {stage === "waiting" ? (
                  <button
                    onClick={() => setPicked(task.id)}
                    className="h-8 shrink-0 rounded-lg bg-ink px-3 text-[13px] font-semibold text-paper"
                    data-agent-answer
                  >
                    Answer
                  </button>
                ) : (
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-ink-faint">{agentWhen(run.at)}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {askingTask?.agent?.question && (
        <AnswerSheet
          task={askingTask}
          onClose={() => { setPicked(null); setClosedPush(true); }}
          onSend={(answer) => {
            answerAgent(askingTask.id, answer);
            setPicked(null);
            setClosedPush(true);
          }}
        />
      )}
    </section>
  );
}

/** The question, in full, and a box to answer it in. */
function AnswerSheet({ task, onClose, onSend }: { task: Task; onClose: () => void; onSend: (answer: string) => void }) {
  const [answer, setAnswer] = useState("");
  const run = task.agent;
  const send = () => {
    const a = answer.trim();
    if (a) onSend(a);
  };
  return (
    <Modal onClose={onClose}>
      <div className="p-5 sm:p-6" data-answer-sheet>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {run?.by} · {task.title}
        </p>
        <h2 className="font-display mt-2 text-xl leading-snug">{run?.question}</h2>
        {run?.note && <p className="mt-2 text-[13px] text-ink-soft">Last thing it did: {run.note}</p>}
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            // a plain Enter sends: most answers here are a word or two
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={3}
          autoFocus
          placeholder="Tell it what to do…"
          aria-label="Your answer"
          className="mt-4 w-full resize-none rounded-2xl border border-line bg-paper p-3.5 text-base outline-none placeholder:text-ink-faint focus:border-sun"
          data-answer-input
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <button onClick={onClose} className="-ml-2 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-deep">
            Not now
          </button>
          <button onClick={send} disabled={!answer.trim()} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper disabled:opacity-30" data-answer-send>
            Send
          </button>
        </div>
      </div>
    </Modal>
  );
}
