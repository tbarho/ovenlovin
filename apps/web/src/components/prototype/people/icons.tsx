import type { ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<string, ReactNode> = {
  peanut: (
    <Svg>
      <path
        d="M8.2 15.6c-1.8-1.8-1.6-5.2.6-7.4 2.1-2.1 5.2-2.4 7 .2 1 .1 2.4 1.1 2.6 2.6.3 2.2-.8 4-2.4 5.2"
        {...stroke}
      />
      <path d="M10.2 9.6c.8-.6 1.8-.4 2.4.2M12.4 13.4c.7-.5 1.7-.3 2.2.4" {...stroke} />
      <path d="M9.4 17.8c1.8 1.6 4.6 1.4 6.2-.2" {...stroke} />
    </Svg>
  ),
  tree_nut: (
    <Svg>
      <path
        d="M12 4.4c3.6 0 6.4 3.4 5.8 7.2-.6 3.4-3 6.2-5.8 8-2.8-1.8-5.2-4.6-5.8-8C5.6 7.8 8.4 4.4 12 4.4Z"
        {...stroke}
      />
      <path d="M12 4.6v14.8M9.2 9.2c1 .8 2.4 1.1 2.8 1.1" {...stroke} />
    </Svg>
  ),
  milk: (
    <Svg>
      <path
        d="M8.4 8.2 9.6 5h4.8l1.2 3.2V19a1.4 1.4 0 0 1-1.4 1.4H9.8A1.4 1.4 0 0 1 8.4 19V8.2Z"
        {...stroke}
      />
      <path d="M8.6 8.4h6.8M11 12.2c.8-1.4 2.4-1.4 2.8 0" {...stroke} />
    </Svg>
  ),
  egg: (
    <Svg>
      <path
        d="M12 4.4c2.8 0 5.4 4.2 5.4 8.4 0 3.2-2.4 6-5.4 6s-5.4-2.8-5.4-6c0-4.2 2.6-8.4 5.4-8.4Z"
        {...stroke}
      />
      <ellipse cx="12" cy="13.2" rx="2.1" ry="2.6" fill="currentColor" opacity="0.16" />
    </Svg>
  ),
  fish: (
    <Svg>
      <path
        d="M4.4 12c3.2-4.2 8.2-5.4 12.4-3.2 1.6.8 2.8 1.8 3.6 3.2-1 .1-2.2.6-3.2 1.6 1 .9 2.1 1.4 3.2 1.6-.8 1.4-2 2.4-3.6 3.2C12.6 20.4 7.6 19.2 4.4 12Z"
        {...stroke}
      />
      <path d="M8.2 12.1h.01" {...stroke} />
      <path d="M14.6 10.2c.8.6 1.2 1.4 1.2 2.2s-.4 1.6-1.2 2.2" {...stroke} />
    </Svg>
  ),
  shellfish: (
    <Svg>
      <path d="M6.2 15.6c.4-3.6 2.8-6.6 6.2-7.6 2.8-.8 5.6.4 6.6 2.6" {...stroke} />
      <path d="M5.6 17.2c1.8.8 3.8.8 5.4 0 1.8 1.2 4.2 1.4 6.2.2" {...stroke} />
      <path
        d="M8.2 9.4c-.8 1.6-1.4 3.4-1.6 5.2M12.2 8.2v8.4M16.6 10.6c.4 1.6.4 3.4 0 5"
        {...stroke}
      />
    </Svg>
  ),
  wheat: (
    <Svg>
      <path d="M12 20.4V6.2" {...stroke} />
      <path
        d="M12 7.2c-2.2-.8-3.6-2.4-3.8-4.2 2.2.4 3.6 2 3.8 4.2ZM12 7.2c2.2-.8 3.6-2.4 3.8-4.2-2.2.4-3.6 2-3.8 4.2Z"
        {...stroke}
      />
      <path
        d="M12 11.2c-2.2-.8-3.8-2.2-4.2-4 2.4.2 4 1.8 4.2 4ZM12 11.2c2.2-.8 3.8-2.2 4.2-4-2.4.2-4 1.8-4.2 4Z"
        {...stroke}
      />
      <path
        d="M12 15.2c-2.2-.8-3.8-2.2-4.2-4 2.4.2 4 1.8 4.2 4ZM12 15.2c2.2-.8 3.8-2.2 4.2-4-2.4.2-4 1.8-4.2 4Z"
        {...stroke}
      />
    </Svg>
  ),
  soy: (
    <Svg>
      <path
        d="M8.4 14.6c0-2.6 1.8-5.4 3.6-6.2 1.8.8 3.6 3.6 3.6 6.2 0 2-1.6 3.6-3.6 3.6s-3.6-1.6-3.6-3.6Z"
        {...stroke}
      />
      <path d="M9.6 9.2C8 8 6.8 6.2 7 4.8c2 .4 3.4 2 3.8 3.6" {...stroke} />
      <path d="M14.4 9.2c1.6-1.2 2.8-3 2.6-4.4-2 .4-3.4 2-3.8 3.6" {...stroke} />
    </Svg>
  ),
  sesame: (
    <Svg>
      <ellipse cx="8.2" cy="13.6" rx="2.1" ry="3" transform="rotate(-24 8.2 13.6)" {...stroke} />
      <ellipse cx="15.8" cy="13.2" rx="2.1" ry="3" transform="rotate(20 15.8 13.2)" {...stroke} />
      <ellipse cx="12" cy="8.4" rx="2" ry="2.8" {...stroke} />
    </Svg>
  ),
  vegetarian: (
    <Svg>
      <path d="M12 20.2V10" {...stroke} />
      <path d="M12 10.4c-3.2 0-6-2.2-6.6-5.2 4-.2 6.4 2.2 6.6 5.2Z" {...stroke} />
      <path d="M12 12.6c2.6-.4 4.8-2.2 5.6-4.8-3.2.2-5.2 2.2-5.6 4.8Z" {...stroke} />
    </Svg>
  ),
  vegan: (
    <Svg>
      <path d="M12 20.2V11" {...stroke} />
      <path d="M12 11.2C9.4 8 6.6 6.6 4.8 6.8c.8 3.4 3.4 5.8 7.2 6.4Z" {...stroke} />
      <path d="M12 13.2c2.6-3.2 5.4-4.6 7.2-4.4-.8 3.4-3.4 5.8-7.2 6.4Z" {...stroke} />
    </Svg>
  ),
  gluten_free: (
    <Svg>
      <path d="M7.2 16.8c1.4-2.8 3.2-4.6 4.8-5.4 1.6.8 3.4 2.6 4.8 5.4" {...stroke} />
      <path d="M8.2 11.2C9.6 9 11 7.6 12 7c1 .6 2.4 2 3.8 4.2" {...stroke} />
      <path d="M6.4 6.4l11.2 11.2" {...stroke} />
    </Svg>
  ),
  dairy_free: (
    <Svg>
      <path
        d="M8.6 8.4 9.6 5.4h4.8l1 3V18a1.2 1.2 0 0 1-1.2 1.2h-4.4A1.2 1.2 0 0 1 8.6 18V8.4Z"
        {...stroke}
      />
      <path d="M6.4 6.4l11.2 11.2" {...stroke} />
    </Svg>
  ),
  halal: (
    <Svg>
      <path d="M15.6 6.6A6.6 6.6 0 1 0 17 16.8 5.2 5.2 0 1 1 15.6 6.6Z" {...stroke} />
      <path d="M16.4 5.6l.6 1.6 1.6.4-1.4 1 .5 1.6-1.3-.9-1.3.9.5-1.6-1.4-1 1.6-.4Z" {...stroke} />
    </Svg>
  ),
  kosher: (
    <Svg>
      <path
        d="M12 4.4 13.6 9h4.8L15.4 12l1.6 4.6L12 13.8 7 16.6 8.6 12 5.6 9h4.8L12 4.4Z"
        {...stroke}
      />
    </Svg>
  ),
  coconut: (
    <Svg>
      <circle cx="12" cy="12.4" r="6.4" {...stroke} />
      <path
        d="M9.6 8.6c.4-.8 1.2-1.4 2.2-1.6M10.2 12.2h.02M13.8 11.4h.02M12.2 14.8h.02"
        {...stroke}
      />
    </Svg>
  ),
  pine_nut: (
    <Svg>
      <path
        d="M12 4.8c2.6 1.4 4.4 4.4 4.4 7.6 0 3.4-2 6.2-4.4 6.8-2.4-.6-4.4-3.4-4.4-6.8 0-3.2 1.8-6.2 4.4-7.6Z"
        {...stroke}
      />
      <path d="M9.2 10.4h5.6M8.8 13.6h6.4M9.6 16.6h4.8" {...stroke} />
    </Svg>
  ),
  mushroom: (
    <Svg>
      <path d="M6 12.2c.4-4 2.8-7 6-7s5.6 3 6 7H6Z" {...stroke} />
      <path d="M10 12.2v5.2a2 2 0 0 0 4 0v-5.2" {...stroke} />
      <path d="M8.4 9.6h.02M12.8 8.4h.02" {...stroke} />
    </Svg>
  ),
  garlic: (
    <Svg>
      <path d="M12 5.2c1.2 1.4 1.4 2.6 1.4 2.6h-2.8S10.8 6.6 12 5.2Z" {...stroke} />
      <path
        d="M7.2 10.4c-.4 2.2.2 5.6 2 7.2 1 .8 2 1.2 2.8 1.2s1.8-.4 2.8-1.2c1.8-1.6 2.4-5 2-7.2C15.6 8.4 13.6 8 12 8s-3.6.4-4.8 2.4Z"
        {...stroke}
      />
    </Svg>
  ),
  onion: (
    <Svg>
      <path d="M12 5.4c1 1.4 1.2 2.4 1.2 2.4h-2.4S11 6.8 12 5.4Z" {...stroke} />
      <path d="M7 11.2c0-1.6 2.2-3.2 5-3.2s5 1.6 5 3.2c0 4.4-2.2 8-5 8s-5-3.6-5-8Z" {...stroke} />
      <path d="M9.2 12.4c.4 3 1.4 5.4 2.8 6.6" {...stroke} />
    </Svg>
  ),
  cilantro: (
    <Svg>
      <path d="M12 20.2V11.2" {...stroke} />
      <path d="M12 11.4c-1.8-2.4-4.4-3-6-2.4.8 2.4 3.2 3.6 6 3.4Z" {...stroke} />
      <path d="M12 12.2c1.8-2.6 4.6-3.2 6.2-2.4-.8 2.4-3.2 3.6-6.2 3.2Z" {...stroke} />
      <path d="M12 9.2c-.4-2.4.6-4.4 2.2-5.2-.2 2.2-.8 3.8-2.2 5.2Z" {...stroke} />
    </Svg>
  ),
  pork: (
    <Svg>
      <path
        d="M6.4 12.6c.2-3.2 2.6-5.8 5.6-5.8s5.4 2.6 5.6 5.8c1.4.4 2.2 1.4 2.2 2.6 0 1.2-1 2.2-2.2 2.2H6.4c-1.2 0-2.2-1-2.2-2.2 0-1.2.8-2.2 2.2-2.6Z"
        {...stroke}
      />
      <path d="M10 13.8h4" {...stroke} />
      <path d="M9.4 11.2h.02M14.6 11.2h.02" {...stroke} />
    </Svg>
  ),
  spicy: (
    <Svg>
      <path
        d="M12.4 4.6s.2 2.4-1.2 3.8c1.8.2 3.4 1.6 3.4 3.6 0 3.2-2.4 5.8-5.4 5.8-2.2 0-3.8-1.4-3.8-3.4 0-3.2 2.6-5.4 5.4-6.4.2-1.4.6-2.6 1.6-3.4Z"
        {...stroke}
      />
      <path d="M14.8 8.6c1.2.6 2.2 1.8 2.6 3.2" {...stroke} />
    </Svg>
  ),
  tomato: (
    <Svg>
      <circle cx="12" cy="13.4" r="5.6" {...stroke} />
      <path d="M12 7.8C11 6 9.2 5.2 8 5.4c.8 1.4 1.8 2.2 4 2.4Z" {...stroke} />
      <path d="M12 7.8c1-1.8 2.8-2.6 4-2.4-.8 1.4-1.8 2.2-4 2.4Z" {...stroke} />
    </Svg>
  ),
  mustard: (
    <Svg>
      <path d="M10.2 4.8h3.6L15.2 8H8.8l1.4-3.2Z" {...stroke} />
      <path d="M8.8 8h6.4v10.4a1.6 1.6 0 0 1-1.6 1.6h-3.2a1.6 1.6 0 0 1-1.6-1.6V8Z" {...stroke} />
      <path d="M10.4 12.2h3.2" {...stroke} />
    </Svg>
  ),
  corn: (
    <Svg>
      <path
        d="M12 4.6c2.6 1.2 4.2 4.2 4.2 8s-1.6 6.8-4.2 8c-2.6-1.2-4.2-4.2-4.2-8s1.6-6.8 4.2-8Z"
        {...stroke}
      />
      <path d="M9.4 9.4h5.2M9.2 12.4h5.6M9.4 15.4h5.2" {...stroke} />
    </Svg>
  ),
};

const fallback = (
  <Svg>
    <circle cx="12" cy="12" r="7.2" {...stroke} />
    <path d="M12 8.6v.2M12 11v4.6" {...stroke} />
  </Svg>
);

export function FoodIcon({ id, size = 22, title }: { id: string; size?: number; title?: string }) {
  return (
    <span
      className="olp-food-icon"
      style={{ width: size, height: size }}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      {ICONS[id] ?? fallback}
    </span>
  );
}

export function NavIcon({ name }: { name: "home" | "setup" | "recipe" }) {
  if (name === "home") {
    return (
      <span className="olp-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M4.8 11.2 12 5.2l7.2 6V19a1.2 1.2 0 0 1-1.2 1.2h-4.2v-5.2H10.2V20.2H6A1.2 1.2 0 0 1 4.8 19v-7.8Z"
            {...stroke}
          />
        </svg>
      </span>
    );
  }
  if (name === "setup") {
    return (
      <span className="olp-nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3.1" {...stroke} />
          <path d="M5.6 19.2c.8-3 3.2-4.8 6.4-4.8s5.6 1.8 6.4 4.8" {...stroke} />
          <path d="M17.6 7.2h3M19.1 5.7v3" {...stroke} />
        </svg>
      </span>
    );
  }
  return (
    <span className="olp-nav-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5.4 9.2h13.2c.4 3.6-.4 8.2-2.2 10.2H7.6C5.8 17.4 5 12.8 5.4 9.2Z" {...stroke} />
        <path d="M9.2 9.2c.2-2.6 1.2-4.6 2.8-4.6s2.6 2 2.8 4.6" {...stroke} />
      </svg>
    </span>
  );
}
