import type { ReactNode } from "react";

type StepperLayoutProps = {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  children: ReactNode;
};

export function StepperLayout({
  currentStep,
  totalSteps,
  stepLabels,
  onBack,
  onNext,
  nextLabel = "Next",
  backLabel = "Back",
  nextDisabled = false,
  children,
}: StepperLayoutProps) {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 0" }}>
      {/* Desktop step indicator */}
      <div className="step-indicator-desktop" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 }}>
        {stepLabels.map((label, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                backgroundColor:
                  i < currentStep ? "#dcfce7" :
                  i === currentStep ? "#2E7D32" : "#f5f5f5",
                color:
                  i < currentStep ? "#15803d" :
                  i === currentStep ? "#ffffff" : "#646464",
                border: i < currentStep ? "2px solid #22C55E" :
                        i === currentStep ? "2px solid #2E7D32" : "2px solid transparent",
              }}
            >
              {i < currentStep ? "✓" : i + 1}
            </div>
            {i < totalSteps - 1 && (
              <div
                style={{
                  width: 32,
                  height: 2,
                  backgroundColor: i < currentStep ? "#22C55E" : "#e8e8e8",
                  borderRadius: 1,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Mobile step indicator */}
      <div className="step-indicator-mobile" style={{ display: "none", textAlign: "center", marginBottom: 16, fontSize: 14, fontWeight: 500, color: "var(--color-text-secondary)" }}>
        Step <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{currentStep + 1}</span> of {totalSteps}
      </div>

      {/* Step title */}
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: "var(--color-text)" }}>
        {stepLabels[currentStep]}
      </h2>

      {/* Content */}
      <div style={{ minHeight: 300 }}>
        {children}
      </div>

      {/* Bottom nav */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, gap: 16 }}>
        {currentStep > 0 ? (
          <button
            onClick={onBack}
            style={{
              height: 40,
              padding: "0 16px",
              backgroundColor: "transparent",
              color: "var(--color-primary)",
              border: "1px solid var(--color-primary)",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background-color 150ms ease-in-out",
            }}
          >
            ← {backLabel}
          </button>
        ) : (
          <div />
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          style={{
            height: 40,
            padding: "0 16px",
            backgroundColor: nextDisabled ? "#c8c8c8" : "var(--color-primary)",
            color: nextDisabled ? "#646464" : "#ffffff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: nextDisabled ? "not-allowed" : "pointer",
            transition: "background-color 150ms ease-in-out",
          }}
        >
          {nextLabel} →
        </button>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .step-indicator-desktop { display: none !important; }
          .step-indicator-mobile { display: block !important; }
        }
      `}</style>
    </div>
  );
}
