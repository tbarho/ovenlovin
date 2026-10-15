"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  DEMO_HOUSEHOLD,
  STORAGE_KEY,
  restrictionLabel,
  type Bucket,
  type CookingFor,
  type Household,
  type Person,
  type Restriction,
} from "./model";

export type ToastState = {
  message: string;
  undo?: () => void;
};

export type WizardStep = "welcome" | "identity" | "foods" | "another" | "summary";

export type WizardDraft = {
  name: string;
  emoji: string;
  color: string;
  generation: Person["generation"];
  restrictions: Restriction[];
};

export type WizardState = {
  step: WizardStep;
  people: Person[];
  draft: WizardDraft;
  mergeOnFinish: boolean;
};

type UndoSnapshot = {
  personId: string;
  restriction: Restriction;
};

export type PrototypeState = {
  household: Household;
  cookingFor: CookingFor;
  appliedSwaps: Record<string, string[]>;
  featuredRecipeId: string;
  toast: ToastState | null;
  undo: UndoSnapshot | null;
  wizard: WizardState | null;
};

type Persisted = Pick<
  PrototypeState,
  "household" | "cookingFor" | "appliedSwaps" | "featuredRecipeId" | "wizard"
>;

type Action =
  | { type: "hydrate"; payload: Persisted }
  | { type: "reset" }
  | { type: "set-household"; household: Household }
  | { type: "upsert-person"; person: Person }
  | { type: "delete-person"; personId: string }
  | { type: "add-restriction"; personId: string; restriction: Restriction }
  | { type: "update-restriction"; personId: string; restriction: Restriction }
  | { type: "move-restriction"; personId: string; restrictionId: string; bucket: Bucket }
  | { type: "remove-restriction"; personId: string; restrictionId: string }
  | { type: "undo-remove" }
  | { type: "toast"; toast: ToastState | null }
  | { type: "toggle-swap"; recipeId: string; swapId: string }
  | { type: "set-cooking-for"; cookingFor: CookingFor }
  | { type: "set-featured-recipe"; recipeId: string }
  | { type: "set-wizard"; wizard: WizardState | null };

const emptyDraft = (): WizardDraft => ({
  name: "",
  emoji: "🧑‍🍳",
  color: "#e07a3d",
  generation: "adult",
  restrictions: [],
});

export function createWizard(mergeOnFinish: boolean, people: Person[] = []): WizardState {
  return {
    step: mergeOnFinish ? "identity" : "welcome",
    people,
    draft: emptyDraft(),
    mergeOnFinish,
  };
}

const initialState: PrototypeState = {
  household: DEMO_HOUSEHOLD,
  cookingFor: { mode: "everyone" },
  appliedSwaps: {},
  featuredRecipeId: "pesto-pasta",
  toast: null,
  undo: null,
  wizard: null,
};

function persistable(state: PrototypeState): Persisted {
  return {
    household: state.household,
    cookingFor: state.cookingFor,
    appliedSwaps: state.appliedSwaps,
    featuredRecipeId: state.featuredRecipeId,
    wizard: state.wizard,
  };
}

function mapPerson(
  household: Household,
  personId: string,
  fn: (person: Person) => Person
): Household {
  return {
    ...household,
    people: household.people.map((person) => (person.id === personId ? fn(person) : person)),
  };
}

function reducer(state: PrototypeState, action: Action): PrototypeState {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.payload, toast: null, undo: null };
    case "reset":
      return { ...initialState };
    case "set-household":
      return { ...state, household: action.household, wizard: null };
    case "upsert-person": {
      const exists = state.household.people.some((person) => person.id === action.person.id);
      return {
        ...state,
        household: {
          ...state.household,
          people: exists
            ? state.household.people.map((person) =>
                person.id === action.person.id ? action.person : person
              )
            : [...state.household.people, action.person],
        },
      };
    }
    case "delete-person":
      return {
        ...state,
        household: {
          ...state.household,
          people: state.household.people.filter((person) => person.id !== action.personId),
        },
      };
    case "add-restriction":
      return {
        ...state,
        household: mapPerson(state.household, action.personId, (person) => ({
          ...person,
          restrictions: person.restrictions.some(
            (item) => item.itemId === action.restriction.itemId
          )
            ? person.restrictions
            : [...person.restrictions, action.restriction],
        })),
      };
    case "update-restriction":
      return {
        ...state,
        household: mapPerson(state.household, action.personId, (person) => ({
          ...person,
          restrictions: person.restrictions.map((item) =>
            item.id === action.restriction.id ? action.restriction : item
          ),
        })),
      };
    case "move-restriction":
      return {
        ...state,
        household: mapPerson(state.household, action.personId, (person) => ({
          ...person,
          restrictions: person.restrictions.map((item) =>
            item.id === action.restrictionId ? { ...item, bucket: action.bucket } : item
          ),
        })),
      };
    case "remove-restriction": {
      const person = state.household.people.find((item) => item.id === action.personId);
      const restriction = person?.restrictions.find((item) => item.id === action.restrictionId);
      if (!person || !restriction) return state;
      return {
        ...state,
        household: mapPerson(state.household, action.personId, (item) => ({
          ...item,
          restrictions: item.restrictions.filter((entry) => entry.id !== action.restrictionId),
        })),
        undo: { personId: action.personId, restriction },
        toast: {
          message: `Removed ${restrictionLabel(restriction)}`,
        },
      };
    }
    case "undo-remove": {
      if (!state.undo) return { ...state, toast: null };
      const { personId, restriction } = state.undo;
      return {
        ...state,
        household: mapPerson(state.household, personId, (person) => ({
          ...person,
          restrictions: person.restrictions.some((item) => item.id === restriction.id)
            ? person.restrictions
            : [...person.restrictions, restriction],
        })),
        undo: null,
        toast: null,
      };
    }
    case "toast":
      return { ...state, toast: action.toast };
    case "toggle-swap": {
      const current = state.appliedSwaps[action.recipeId] ?? [];
      const next = current.includes(action.swapId)
        ? current.filter((id) => id !== action.swapId)
        : [...current, action.swapId];
      return {
        ...state,
        appliedSwaps: { ...state.appliedSwaps, [action.recipeId]: next },
      };
    }
    case "set-cooking-for":
      return { ...state, cookingFor: action.cookingFor };
    case "set-featured-recipe":
      return { ...state, featuredRecipeId: action.recipeId };
    case "set-wizard":
      return { ...state, wizard: action.wizard };
    default:
      return state;
  }
}

type Store = PrototypeState & {
  resetDemo: () => void;
  setHousehold: (household: Household) => void;
  upsertPerson: (person: Person) => void;
  deletePerson: (personId: string) => void;
  addRestriction: (personId: string, restriction: Restriction) => void;
  updateRestriction: (personId: string, restriction: Restriction) => void;
  moveRestriction: (personId: string, restrictionId: string, bucket: Bucket) => void;
  removeRestriction: (personId: string, restrictionId: string) => void;
  undoRemove: () => void;
  dismissToast: () => void;
  toggleSwap: (recipeId: string, swapId: string) => void;
  setCookingFor: (cookingFor: CookingFor) => void;
  setFeaturedRecipe: (recipeId: string) => void;
  setWizard: (wizard: WizardState | null) => void;
};

const PrototypeContext = createContext<Store | null>(null);

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        if (parsed?.household?.people) {
          dispatch({ type: "hydrate", payload: parsed });
        }
      }
    } catch {
      // mock prototype - ignore bad local data
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable(state)));
    } catch {
      // ignore quota
    }
  }, [ready, state]);

  const undoRemove = useCallback(() => dispatch({ type: "undo-remove" }), []);

  const value = useMemo<Store>(
    () => ({
      ...state,
      resetDemo: () => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        dispatch({ type: "reset" });
      },
      setHousehold: (household) => dispatch({ type: "set-household", household }),
      upsertPerson: (person) => dispatch({ type: "upsert-person", person }),
      deletePerson: (personId) => dispatch({ type: "delete-person", personId }),
      addRestriction: (personId, restriction) =>
        dispatch({ type: "add-restriction", personId, restriction }),
      updateRestriction: (personId, restriction) =>
        dispatch({ type: "update-restriction", personId, restriction }),
      moveRestriction: (personId, restrictionId, bucket) =>
        dispatch({ type: "move-restriction", personId, restrictionId, bucket }),
      removeRestriction: (personId, restrictionId) => {
        dispatch({ type: "remove-restriction", personId, restrictionId });
        window.setTimeout(() => dispatch({ type: "toast", toast: null }), 5200);
      },
      undoRemove,
      dismissToast: () => dispatch({ type: "toast", toast: null }),
      toggleSwap: (recipeId, swapId) => dispatch({ type: "toggle-swap", recipeId, swapId }),
      setCookingFor: (cookingFor) => dispatch({ type: "set-cooking-for", cookingFor }),
      setFeaturedRecipe: (recipeId) => dispatch({ type: "set-featured-recipe", recipeId }),
      setWizard: (wizard) => dispatch({ type: "set-wizard", wizard }),
    }),
    [state, undoRemove]
  );

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

export function usePrototype(): Store {
  const store = useContext(PrototypeContext);
  if (!store) {
    throw new Error("usePrototype must be used inside PrototypeProvider");
  }
  return store;
}

export function toastMessageForRemoval(itemLabel: string): string {
  return `Removed ${itemLabel}`;
}
