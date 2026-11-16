import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faFingerprint, faPaperPlane, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useConfig } from "../context/ConfigContext";
import { extractErrorMessage } from "../services/apiClient";
import { updateAppSettings } from "../services/FloorPlanService";
import {
    fetchIdentificationQuota,
    fetchNotificationStatus,
    IdentificationQuota,
    NotificationStatus,
    sendTestNotification,
} from "../services/NotificationService";
import { LOW_QUOTA } from "../services/identificationQuota";
import "../styles/integrations.css";

/** Admin view of what Pflanzn talks to: notifications (Apprise), Pl@ntNet and the AI providers. */
export default function IntegrationsPanel() {
    const { llmProviders, identificationEnabled, locale, tz } = useConfig();
    const [notify, setNotify] = useState<NotificationStatus | null>(null);
    const [quota, setQuota] = useState<IdentificationQuota | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        let active = true;
        Promise.allSettled([fetchNotificationStatus(), fetchIdentificationQuota()]).then(([n, q]) => {
            if (!active) return;
            if (n.status === "fulfilled") setNotify(n.value);
            else toast.error(extractErrorMessage(n.reason, "Failed to load the notification settings."));
            if (q.status === "fulfilled") setQuota(q.value);
            setLoading(false);
        });
        return () => {
            active = false;
        };
    }, []);

    const save = async (values: Partial<NotificationStatus["settings"]>) => {
        if (!notify) return;
        setSaving(true);
        try {
            const saved = await updateAppSettings(values);
            setNotify({
                ...notify,
                settings: {
                    notify_reminders: saved.notify_reminders,
                    notify_watering: saved.notify_watering,
                    notify_watering_time: saved.notify_watering_time,
                },
            });
            toast.success("Saved.");
        } catch (error) {
            toast.error(extractErrorMessage(error, "Failed to save."));
        } finally {
            setSaving(false);
        }
    };

    const test = async () => {
        setSending(true);
        try {
            await sendTestNotification();
            toast.success("Test notification sent.");
        } catch (error) {
            toast.error(extractErrorMessage(error, "The test notification failed."));
        } finally {
            setSending(false);
        }
    };

    const used = quota && quota.remaining !== null ? Math.max(0, quota.limit - quota.remaining) : null;

    return (
        <div className="users-panel integrations-panel">
            <h2>Integrations</h2>
            <p>What Pflanzn talks to besides its database: notifications, plant identification and AI.</p>

            <section className="integration-card" aria-labelledby="integration-notify">
                <h3 id="integration-notify">
                    <FontAwesomeIcon icon={faBell} aria-hidden="true" /> Notifications
                </h3>
                {loading ? (
                    <Skeleton count={3} />
                ) : !notify ? (
                    <p className="integration-muted">Not available.</p>
                ) : !notify.configured ? (
                    <>
                        <p>
                            Not set up. Reminders and a daily watering digest can be sent through an{" "}
                            <a href="https://github.com/caronc/apprise-api" target="_blank" rel="noreferrer">
                                Apprise
                            </a>{" "}
                            server to Telegram, ntfy, Matrix, mail and many more.
                        </p>
                        <p className="integration-muted">
                            Set <code>APPRISE_URL</code> and either <code>APPRISE_KEY</code> (a configuration
                            stored in Apprise) or <code>APPRISE_URLS</code> in the backend's <code>.env</code>,
                            then restart the backend. The compose example has an Apprise container.
                        </p>
                    </>
                ) : (
                    <>
                        <dl className="integration-facts">
                            <dt>Apprise</dt>
                            <dd>{notify.server}</dd>
                            <dt>Sends to</dt>
                            <dd>
                                {notify.mode === "key"
                                    ? `configuration "${notify.key}"${notify.tag ? `, tag ${notify.tag}` : ""}`
                                    : notify.services.join(", ") || "the URLs in APPRISE_URLS"}
                            </dd>
                        </dl>

                        <label className="manage-setting-row">
                            <input
                                type="checkbox"
                                checked={notify.settings.notify_reminders}
                                disabled={saving}
                                onChange={(e) => save({ notify_reminders: e.target.checked })}
                            />
                            <span>Reminders, when they are due</span>
                        </label>
                        <div className="integration-row">
                            <label className="manage-setting-row">
                                <input
                                    type="checkbox"
                                    checked={notify.settings.notify_watering}
                                    disabled={saving}
                                    onChange={(e) => save({ notify_watering: e.target.checked })}
                                />
                                <span>Plants that need water, every day at</span>
                            </label>
                            <input
                                type="time"
                                aria-label="Time of the watering digest"
                                className="integration-time"
                                value={notify.settings.notify_watering_time}
                                disabled={saving || !notify.settings.notify_watering}
                                onChange={(e) =>
                                    setNotify({
                                        ...notify,
                                        settings: { ...notify.settings, notify_watering_time: e.target.value },
                                    })
                                }
                                onBlur={(e) => e.target.value && save({ notify_watering_time: e.target.value })}
                            />
                        </div>
                        <p className="integration-muted">
                            Only plants with a watering schedule count.{" "}
                            {notify.plants_due_now === 0
                                ? "None needs water right now."
                                : `${notify.plants_due_now} need${notify.plants_due_now === 1 ? "s" : ""} water right now.`}
                        </p>
                        <button type="button" className="add-btn integration-test" onClick={test} disabled={sending}>
                            <FontAwesomeIcon icon={faPaperPlane} /> {sending ? "Sending…" : "Send a test"}
                        </button>
                    </>
                )}
            </section>

            <section className="integration-card" aria-labelledby="integration-plantnet">
                <h3 id="integration-plantnet">
                    <FontAwesomeIcon icon={faFingerprint} aria-hidden="true" /> Pl@ntNet
                </h3>
                {loading ? (
                    <Skeleton count={2} />
                ) : !identificationEnabled || !quota?.enabled ? (
                    <p className="integration-muted">
                        Identification is off. Set <code>PLANTNET_API_KEY</code> to turn it on.
                    </p>
                ) : quota.remaining === null ? (
                    <p>
                        No identification yet today. The key allows {quota.limit} a day; the count shows here after
                        the first one.
                    </p>
                ) : (
                    <>
                        <p>
                            <strong>{quota.remaining}</strong> of {quota.limit} identifications left today
                            {quota.remaining <= LOW_QUOTA && " — members are told how many remain with each one"}.
                        </p>
                        <div
                            className="integration-meter"
                            role="meter"
                            aria-label="Pl@ntNet identifications used today"
                            aria-valuemin={0}
                            aria-valuemax={quota.limit}
                            aria-valuenow={used ?? 0}
                        >
                            <span
                                className={quota.remaining <= LOW_QUOTA ? "is-low" : ""}
                                style={{ width: `${Math.min(100, ((used ?? 0) / quota.limit) * 100)}%` }}
                            />
                        </div>
                        {quota.updated_at && (
                            <p className="integration-muted">
                                As Pl@ntNet reported at{" "}
                                {new Date(quota.updated_at).toLocaleTimeString(locale, {
                                    timeZone: tz,
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                                . The limit resets daily.
                            </p>
                        )}
                    </>
                )}
            </section>

            <section className="integration-card" aria-labelledby="integration-ai">
                <h3 id="integration-ai">
                    <FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true" /> AI providers
                </h3>
                {llmProviders.length === 0 ? (
                    <p className="integration-muted">
                        None configured, so the AI buttons are hidden. Set an API key (e.g. <code>CLAUDE_API_KEY</code>
                        ) or <code>OLLAMA_URL</code> to add one.
                    </p>
                ) : (
                    <>
                        <ul className="integration-providers">
                            {llmProviders.map((provider, index) => (
                                <li key={provider.id}>
                                    <strong>{provider.label}</strong>
                                    {provider.model && <span>{provider.model}</span>}
                                    {index === 0 && <em>default</em>}
                                </li>
                            ))}
                        </ul>
                        {llmProviders.length > 1 && (
                            <p className="integration-muted">
                                With more than one, every AI button asks which to use (the last choice comes first).
                            </p>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
