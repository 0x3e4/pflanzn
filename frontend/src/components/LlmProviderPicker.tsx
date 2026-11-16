import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { useConfig } from "../context/ConfigContext";
import { useModalA11y } from "../hooks/useModalA11y";
import { LlmProviderInfo } from "../services/config";
import { useUiPreferences } from "../hooks/useUiPreferences";
import "../styles/llmPicker.css";

const LAST_CHOICE_KEY = "pflanzn.llmProvider";

function readLastChoice(): string | null {
    try {
        return localStorage.getItem(LAST_CHOICE_KEY);
    } catch {
        return null;
    }
}

function rememberChoice(id: string) {
    try {
        localStorage.setItem(LAST_CHOICE_KEY, id);
    } catch {
        /* private window: just ask with the default first next time */
    }
}

/** The configured providers with the one picked last first, then the server default. */
export function orderProviders(providers: LlmProviderInfo[], last: string | null): LlmProviderInfo[] {
    const index = providers.findIndex((p) => p.id === last);
    if (index <= 0) return providers;
    return [providers[index], ...providers.filter((_, i) => i !== index)];
}

type Pending = { action: string; resolve: (provider: string | null | undefined) => void };

/** The provider set under Manage → Customize, if it is still configured. */
export function preferredProvider(providers: LlmProviderInfo[], preferred: string): string | undefined {
    return providers.some((p) => p.id === preferred) ? preferred : undefined;
}

/**
 * Asks which AI provider to use when the server has several. `choose(action)` resolves
 * with the chosen id, `undefined` when there is only one (the server's default applies)
 * and `null` when the person cancels. A default provider chosen under Manage → Customize
 * is used without asking. Render `picker` somewhere in the component.
 */
export function useLlmProviderPicker() {
    const { llmProviders } = useConfig();
    const { llmProvider: preferred } = useUiPreferences();
    const fixed = preferredProvider(llmProviders, preferred);
    const [pending, setPending] = useState<Pending | null>(null);
    const pendingRef = useRef<Pending | null>(null);

    const finish = useCallback((value: string | null) => {
        pendingRef.current?.resolve(value);
        pendingRef.current = null;
        setPending(null);
    }, []);

    const close = useCallback(() => finish(null), [finish]);
    const { modalRef } = useModalA11y({ isOpen: pending !== null, onClose: close });

    const choose = useCallback(
        (action: string): Promise<string | null | undefined> => {
            if (llmProviders.length <= 1) return Promise.resolve(undefined);
            if (fixed) return Promise.resolve(fixed);
            return new Promise((resolve) => {
                const next = { action, resolve };
                pendingRef.current = next;
                setPending(next);
            });
        },
        [llmProviders.length, fixed],
    );

    const ordered = orderProviders(llmProviders, readLastChoice());

    const picker = pending
        ? createPortal(
              <div className="llm-picker-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
                  <div
                      className="llm-picker"
                      ref={modalRef}
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="llm-picker-title"
                  >
                      <h3 id="llm-picker-title">
                          <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" /> {pending.action}
                      </h3>
                      <p>Which AI should do it?</p>
                      <ul>
                          {ordered.map((provider) => (
                              <li key={provider.id}>
                                  <button
                                      type="button"
                                      onClick={() => {
                                          rememberChoice(provider.id);
                                          finish(provider.id);
                                      }}
                                  >
                                      <strong>{provider.label}</strong>
                                      {provider.model && <span>{provider.model}</span>}
                                  </button>
                              </li>
                          ))}
                      </ul>
                      <button type="button" className="llm-picker-cancel" onClick={close}>
                          Cancel
                      </button>
                  </div>
              </div>,
              document.body,
          )
        : null;

    return { choose, picker, providers: llmProviders, preferred: fixed };
}
