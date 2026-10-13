import type { ConfigStatus } from "@ovenlovin/core/onboarding";

export function StatusStrip({ status }: { status: ConfigStatus }) {
  return (
    <div className="status-strip" aria-label="Instance configuration">
      {status.checks.map((check) => {
        const tone =
          !check.configured || check.reachable === false
            ? check.configured
              ? "warn"
              : "bad"
            : "ok";
        return (
          <div className="status-item" key={check.id}>
            <b>
              <span className={`dot ${tone}`} aria-hidden="true" />
              {check.label}
            </b>
            <p>{check.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
