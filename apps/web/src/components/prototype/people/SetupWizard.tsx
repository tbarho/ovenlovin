"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  DEMO_HOUSEHOLD,
  defaultBucketForItem,
  defaultOptionsForItem,
  newId,
  restrictionLabel,
  slugPersonName,
  summarizeHousehold,
  type Person,
  type Restriction,
} from "./model";
import { FoodPicker } from "./FoodPicker";
import { createWizard, usePrototype, type WizardDraft } from "./store";
import { Avatar, Chip, EmptyState } from "./ui";

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "identity", label: "Name" },
  { id: "foods", label: "Foods" },
  { id: "another", label: "People" },
  { id: "summary", label: "Summary" },
] as const;

export function SetupWizard() {
  const router = useRouter();
  const { household, wizard, setWizard, setHousehold, upsertPerson, resetDemo } = usePrototype();
  const reduce = useReducedMotion();
  const state = wizard ?? createWizard(false);

  function save(next: typeof state) {
    setWizard(next);
  }

  function beginFresh() {
    save({ ...createWizard(false), step: "identity", people: [] });
  }

  function beginAdd() {
    save({ ...createWizard(true), step: "identity" });
  }

  function useDemo() {
    resetDemo();
    router.push("/prototype/people");
  }

  function commitDraft(people: Person[], draft: WizardDraft): Person[] {
    const idBase = slugPersonName(draft.name);
    const id = people.some((person) => person.id === idBase) ? newId(idBase) : idBase;
    const person: Person = {
      id,
      name: draft.name.trim(),
      emoji: draft.emoji,
      color: draft.color,
      generation: draft.generation,
      restrictions: draft.restrictions,
    };
    return [...people, person];
  }

  function finish(people: Person[]) {
    if (state.mergeOnFinish) {
      for (const person of people) upsertPerson(person);
    } else {
      setHousehold({ name: "Your kitchen", people });
    }
    setWizard(null);
    router.push("/prototype/people");
  }

  const direction = 1;
  const variants = {
    enter: { x: reduce ? 0 : 24 * direction, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: reduce ? 0 : -24 * direction, opacity: 0 },
  };

  return (
    <div className="olp-wizard">
      <ol className="olp-steps" aria-label="Setup steps">
        {STEPS.map((step) => (
          <li key={step.id} className={state.step === step.id ? "is-current" : undefined}>
            {step.label}
          </li>
        ))}
      </ol>
      <AnimatePresence mode="wait">
        <motion.div
          key={state.step}
          initial="enter"
          animate="center"
          exit="exit"
          variants={variants}
          transition={{ duration: 0.22, ease: [0.2, 0.65, 0.25, 1] }}
        >
          {state.step === "welcome" ? (
            <Welcome
              hasPeople={household.people.length > 0}
              onFresh={beginFresh}
              onAdd={beginAdd}
              onDemo={useDemo}
            />
          ) : null}
          {state.step === "identity" ? (
            <Identity
              draft={state.draft}
              onChange={(draft) => save({ ...state, draft })}
              onNext={() => save({ ...state, step: "foods" })}
              onBack={() => save({ ...state, step: state.mergeOnFinish ? "welcome" : "welcome" })}
            />
          ) : null}
          {state.step === "foods" ? (
            <Foods
              draft={state.draft}
              onToggle={(restriction, on) => {
                const restrictions = on
                  ? [...state.draft.restrictions, restriction]
                  : state.draft.restrictions.filter((item) => item.itemId !== restriction.itemId);
                save({ ...state, draft: { ...state.draft, restrictions } });
              }}
              onNext={() => {
                const people = commitDraft(state.people, state.draft);
                save({
                  ...state,
                  people,
                  draft: {
                    name: "",
                    emoji: "🌟",
                    color: "#3d8bfd",
                    generation: "kid",
                    restrictions: [],
                  },
                  step: "another",
                });
              }}
              onBack={() => save({ ...state, step: "identity" })}
            />
          ) : null}
          {state.step === "another" ? (
            <Another
              people={state.people}
              onAdd={() => save({ ...state, step: "identity" })}
              onFinish={() => save({ ...state, step: "summary" })}
            />
          ) : null}
          {state.step === "summary" ? (
            <Summary people={state.people} onFinish={() => finish(state.people)} />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Welcome({
  hasPeople,
  onFresh,
  onAdd,
  onDemo,
}: {
  hasPeople: boolean;
  onFresh: () => void;
  onAdd: () => void;
  onDemo: () => void;
}) {
  return (
    <div className="olp-stack">
      <p className="olp-kicker">Household setup</p>
      <h1>Who do you cook for?</h1>
      <p className="olp-lead">
        Add people as a name plus a face. Then we&apos;ll ask, for each person: anything they
        can&apos;t or won&apos;t eat? A tap is enough.
      </p>
      <div className="olp-stack-sm">
        <button type="button" className="olp-btn olp-btn-primary" onClick={onFresh}>
          Start a new household
        </button>
        {hasPeople ? (
          <button type="button" className="olp-btn" onClick={onAdd}>
            Add someone to this kitchen
          </button>
        ) : null}
        <button type="button" className="olp-btn" onClick={onDemo}>
          Use the demo family
        </button>
      </div>
    </div>
  );
}

function Identity({
  draft,
  onChange,
  onNext,
  onBack,
}: {
  draft: WizardDraft;
  onChange: (draft: WizardDraft) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const ready = draft.name.trim().length > 0;
  return (
    <div className="olp-stack">
      <p className="olp-kicker">Add a person</p>
      <h1>Name and a face</h1>
      <p className="olp-lead">An emoji is fine. Initials on a color work too.</p>
      <label className="olp-field">
        <span>Name</span>
        <input
          value={draft.name}
          autoComplete="off"
          placeholder="Ty"
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>
      <div className="olp-identity-preview">
        <Avatar
          person={{ name: draft.name || "?", emoji: draft.emoji, color: draft.color }}
          size={64}
        />
        <span>{draft.name.trim() || "Someone new"}</span>
      </div>
      <p className="olp-kicker">Emoji</p>
      <div className="olp-emoji-grid">
        {AVATAR_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={draft.emoji === emoji ? "is-on" : undefined}
            onClick={() => onChange({ ...draft, emoji })}
            aria-label={`Use ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <p className="olp-kicker">Color</p>
      <div className="olp-color-grid">
        {AVATAR_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={draft.color === color ? "is-on" : undefined}
            style={{ background: color }}
            onClick={() => onChange({ ...draft, color })}
            aria-label={`Use color ${color}`}
          />
        ))}
      </div>
      <fieldset className="olp-fieldset">
        <legend>This person is</legend>
        <div className="olp-seg">
          {(["adult", "kid"] as const).map((generation) => (
            <button
              key={generation}
              type="button"
              className={draft.generation === generation ? "is-on" : undefined}
              onClick={() => onChange({ ...draft, generation })}
            >
              {generation === "kid" ? "A kid" : "An adult"}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="olp-row">
        <button type="button" className="olp-btn" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="olp-btn olp-btn-primary"
          disabled={!ready}
          onClick={onNext}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function Foods({
  draft,
  onToggle,
  onNext,
  onBack,
}: {
  draft: WizardDraft;
  onToggle: (restriction: Restriction, on: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const name = draft.name.trim() || "they";
  return (
    <div className="olp-stack">
      <p className="olp-kicker">{name}</p>
      <h1>Anything they can&apos;t or won&apos;t eat?</h1>
      <p className="olp-lead">
        Tap a tile or type it in plain language. Allergens land as Can&apos;t have; you can move
        them later.
      </p>
      <FoodPicker
        selectedIds={draft.restrictions.map((item) => item.itemId)}
        onToggle={(item) => {
          const existing = draft.restrictions.find((entry) => entry.itemId === item.id);
          if (existing) {
            onToggle(existing, false);
            return;
          }
          onToggle(
            {
              id: newId("r"),
              itemId: item.id,
              bucket: defaultBucketForItem(item),
              options: defaultOptionsForItem(item),
            },
            true
          );
        }}
        onAddParsed={(item, bucket) => {
          onToggle(
            {
              id: newId("r"),
              itemId: item.id,
              bucket,
              options: defaultOptionsForItem(item),
            },
            true
          );
        }}
      />
      {draft.restrictions.length > 0 ? (
        <div className="olp-chip-row">
          {draft.restrictions.map((restriction) => (
            <Chip
              key={restriction.id}
              label={restrictionLabel(restriction)}
              itemId={restriction.itemId}
              bucket={restriction.bucket}
              onRemove={() => onToggle(restriction, false)}
            />
          ))}
        </div>
      ) : (
        <p className="olp-empty-inline">Leave this empty if {name} eats everything.</p>
      )}
      <div className="olp-row">
        <button type="button" className="olp-btn" onClick={onBack}>
          Back
        </button>
        <button type="button" className="olp-btn olp-btn-primary" onClick={onNext}>
          {draft.restrictions.length === 0 ? `Skip — ${name} eats everything` : "Next"}
        </button>
      </div>
    </div>
  );
}

function Another({
  people,
  onAdd,
  onFinish,
}: {
  people: Person[];
  onAdd: () => void;
  onFinish: () => void;
}) {
  if (people.length === 0) {
    return (
      <EmptyState
        title="No one added yet"
        body="Add at least one person so the kitchen has someone to cook for."
        action={
          <button type="button" className="olp-btn olp-btn-primary" onClick={onAdd}>
            Add a person
          </button>
        }
      />
    );
  }
  return (
    <div className="olp-stack">
      <p className="olp-kicker">So far</p>
      <h1>{people.length === 1 ? `${people[0]?.name} is in` : `${people.length} people so far`}</h1>
      <div className="olp-person-row">
        {people.map((person) => (
          <div key={person.id} className="olp-person-chip">
            <Avatar person={person} size={44} />
            <span>
              <b>{person.name}</b>
              <small>
                {person.restrictions.length === 0
                  ? "Eats everything"
                  : person.restrictions.map((item) => restrictionLabel(item)).join(", ")}
              </small>
            </span>
          </div>
        ))}
      </div>
      <div className="olp-stack-sm">
        <button type="button" className="olp-btn" onClick={onAdd}>
          Add someone else
        </button>
        <button type="button" className="olp-btn olp-btn-primary" onClick={onFinish}>
          That&apos;s everyone
        </button>
      </div>
    </div>
  );
}

function Summary({ people, onFinish }: { people: Person[]; onFinish: () => void }) {
  const summary = summarizeHousehold({ name: "Your kitchen", people });
  return (
    <div className="olp-stack">
      <p className="olp-kicker">Household</p>
      <h1>This kitchen is ready</h1>
      <section className="olp-hero-card">
        <div className="olp-hero-faces">
          {people.map((person) => (
            <Avatar key={person.id} person={person} size={36} />
          ))}
        </div>
        <p className="olp-hero-line">{summary.line}</p>
        {summary.badge ? <span className="olp-badge-severe">{summary.badge}</span> : null}
      </section>
      <ul className="olp-summary-list">
        {people.map((person) => (
          <li key={person.id}>
            <Avatar person={person} size={32} />
            <span>
              <b>{person.name}</b>
              <small>
                {person.restrictions.length === 0
                  ? "No restrictions"
                  : person.restrictions.map((item) => restrictionLabel(item)).join(", ")}
              </small>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="olp-btn olp-btn-primary" onClick={onFinish}>
        Go to household
      </button>
      <p className="olp-hint">
        Demo family is {DEMO_HOUSEHOLD.people.map((person) => person.name).join(", ")} if you want
        that back later.
      </p>
    </div>
  );
}
