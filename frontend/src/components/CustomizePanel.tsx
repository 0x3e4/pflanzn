import { useMemo } from "react";
import { useConfig } from "../context/ConfigContext";
import { useSaveUiPreferences, useUiPreferences } from "../hooks/useUiPreferences";
import {
    Density,
    HOME_SECTIONS,
    HomeSection,
    HourCycle,
    ImageQuality,
    StartPage,
    ThemePreference,
    UiPreferences,
    WeekStart,
} from "../config/uiPreferences";
import {
    ListViewMode,
    LocationSortOption,
    PlantsSortOption,
    updateLocationsViewPreferences,
    updatePlantsViewPreferences,
} from "../config/viewPreferences";
import { ACTIVITY_FILTERS, storeFeedTypes } from "../services/activityFilter";
import { ActivityFilter } from "../services/PlantService";

const PLANT_SORTS: { value: PlantsSortOption; label: string }[] = [
    { value: "idDesc", label: "Newest first" },
    { value: "idAsc", label: "Oldest first" },
    { value: "nextWateringAsc", label: "Due for water soonest" },
    { value: "nextWateringDesc", label: "Due for water latest" },
    { value: "lastWateredDesc", label: "Watered most recently" },
    { value: "lastWateredAsc", label: "Longest since watering" },
    { value: "lastImageUploadedDesc", label: "Newest photo first" },
    { value: "lastImageUploadedAsc", label: "Oldest photo first" },
];

const LOCATION_SORTS: { value: LocationSortOption; label: string }[] = [
    { value: "updatedDesc", label: "Recently updated" },
    { value: "updatedAsc", label: "Least recently updated" },
    { value: "createdDesc", label: "Newest first" },
    { value: "createdAsc", label: "Oldest first" },
    { value: "nameAsc", label: "Name A–Z" },
    { value: "nameDesc", label: "Name Z–A" },
];

// Date formats on offer. All use Latin digits, which the calendar keys rely on.
const DATE_LOCALES: { value: string; label: string }[] = [
    { value: "en-US", label: "English (US)" },
    { value: "en-GB", label: "English (UK)" },
    { value: "de-AT", label: "Deutsch (Österreich)" },
    { value: "de-DE", label: "Deutsch (Deutschland)" },
    { value: "de-CH", label: "Deutsch (Schweiz)" },
    { value: "fr-FR", label: "Français" },
    { value: "it-IT", label: "Italiano" },
    { value: "es-ES", label: "Español" },
    { value: "nl-NL", label: "Nederlands" },
];

type Choice<T extends string> = { value: T; label: string; hint?: string };

function Choices<T extends string>({
    legend,
    name,
    value,
    options,
    onChange,
}: {
    legend: string;
    name: string;
    value: T;
    options: Choice<T>[];
    onChange: (value: T) => void;
}) {
    return (
        <fieldset className="customize-choices">
            <legend>{legend}</legend>
            <div className="customize-choices-options">
                {options.map((option) => (
                    <label key={option.value} className={option.hint ? "customize-choice-with-hint" : undefined}>
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange(option.value)}
                        />
                        <span>
                            {option.label}
                            {option.hint && <small>{option.hint}</small>}
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

function SelectField<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
}) {
    return (
        <label className="customize-field">
            <span>{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value as T)}>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

export default function CustomizePanel() {
    const { enableLocations, llmProviders, serverLocale, locale, tz } = useConfig();
    const preferences = useUiPreferences();
    const save = useSaveUiPreferences();

    const set = <K extends keyof UiPreferences>(key: K, value: UiPreferences[K]) => {
        void save({ [key]: value } as Partial<UiPreferences>);
    };

    // A new default view or sort also applies on this device at once; other devices keep
    // what they last chose until they choose again.
    const setPlantsDefault = (updates: { plantsView?: ListViewMode; plantsSort?: PlantsSortOption }) => {
        updatePlantsViewPreferences({
            ...(updates.plantsView && { viewMode: updates.plantsView }),
            ...(updates.plantsSort && { sortBy: updates.plantsSort }),
        });
        void save(updates);
    };
    const setLocationsDefault = (updates: { locationsView?: ListViewMode; locationsSort?: LocationSortOption }) => {
        updateLocationsViewPreferences({
            ...(updates.locationsView && { viewMode: updates.locationsView }),
            ...(updates.locationsSort && { sortBy: updates.locationsSort }),
        });
        void save(updates);
    };

    const toggleHomeSection = (section: HomeSection, shown: boolean) => {
        const hidden = shown
            ? preferences.homeHidden.filter((s) => s !== section)
            : [...preferences.homeHidden, section];
        set("homeHidden", hidden);
    };

    const toggleActivity = (type: ActivityFilter, shown: boolean) => {
        const next = shown
            ? ACTIVITY_FILTERS.map((f) => f.id).filter((t) => t === type || preferences.activityTypes.includes(t))
            : preferences.activityTypes.filter((t) => t !== type);
        if (next.length === 0) return;
        storeFeedTypes(next);
        set("activityTypes", next);
    };

    const dateExample = useMemo(
        () =>
            new Date().toLocaleString(locale, {
                timeZone: tz,
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
            }),
        [locale, tz],
    );

    const serverLocaleLabel =
        DATE_LOCALES.find((l) => l.value === serverLocale)?.label ?? serverLocale ?? "server setting";

    return (
        <div className="profile-info manage-customize-panel">
            <h2>Customize</h2>
            <p>These settings belong to your account and follow you to other devices. Changes apply at once.</p>

            <section className="customize-group" aria-labelledby="customize-appearance">
                <h3 id="customize-appearance">Appearance</h3>
                <Choices<ThemePreference>
                    legend="Theme"
                    name="theme"
                    value={preferences.theme}
                    onChange={(value) => set("theme", value)}
                    options={[
                        { value: "system", label: "System" },
                        { value: "light", label: "Light" },
                        { value: "dark", label: "Dark" },
                    ]}
                />
                <Choices<Density>
                    legend="Density"
                    name="density"
                    value={preferences.density}
                    onChange={(value) => set("density", value)}
                    options={[
                        { value: "comfortable", label: "Comfortable" },
                        { value: "compact", label: "Compact", hint: "Tighter tables and lists, smaller cards" },
                    ]}
                />
                <label className="manage-setting-row">
                    <input
                        type="checkbox"
                        checked={preferences.reduceMotion}
                        onChange={(e) => set("reduceMotion", e.target.checked)}
                    />
                    <span>Reduce motion</span>
                </label>
                <small className="manage-setting-hint">
                    Turns off animations and transitions. They are also off when your system asks for less motion.
                </small>
            </section>

            <section className="customize-group" aria-labelledby="customize-lists">
                <h3 id="customize-lists">Start page and lists</h3>
                <SelectField<StartPage>
                    label="Start page"
                    value={preferences.startPage === "locations" && !enableLocations ? "home" : preferences.startPage}
                    onChange={(value) => set("startPage", value)}
                    options={[
                        { value: "home", label: "Home" },
                        { value: "plants", label: "Plants" },
                        ...(enableLocations ? [{ value: "locations" as const, label: "Locations" }] : []),
                    ]}
                />
                <SelectField<ListViewMode>
                    label="Plants view"
                    value={preferences.plantsView}
                    onChange={(value) => setPlantsDefault({ plantsView: value })}
                    options={[
                        { value: "grid", label: "Grid" },
                        { value: "list", label: "List" },
                    ]}
                />
                <SelectField<PlantsSortOption>
                    label="Plants sorted by"
                    value={preferences.plantsSort}
                    onChange={(value) => setPlantsDefault({ plantsSort: value })}
                    options={PLANT_SORTS}
                />
                {enableLocations && (
                    <>
                        <SelectField<ListViewMode>
                            label="Locations view"
                            value={preferences.locationsView}
                            onChange={(value) => setLocationsDefault({ locationsView: value })}
                            options={[
                                { value: "grid", label: "Grid" },
                                { value: "list", label: "List" },
                            ]}
                        />
                        <SelectField<LocationSortOption>
                            label="Locations sorted by"
                            value={preferences.locationsSort}
                            onChange={(value) => setLocationsDefault({ locationsSort: value })}
                            options={LOCATION_SORTS}
                        />
                    </>
                )}
                <label className="manage-setting-row">
                    <input
                        type="checkbox"
                        checked={preferences.defaultWidescreen}
                        onChange={(e) => set("defaultWidescreen", e.target.checked)}
                    />
                    <span>Widescreen by default for Plants{enableLocations ? " and Locations" : ""}</span>
                </label>
                <small className="manage-setting-hint">
                    View and sort are where each device starts; changing them on the page itself is remembered on that
                    device. The expand/collapse icon on the page still switches widescreen.
                </small>
            </section>

            <section className="customize-group" aria-labelledby="customize-home">
                <h3 id="customize-home">Home</h3>
                <p className="customize-group-intro">Sections shown on the Home page.</p>
                <div className="customize-checks">
                    {HOME_SECTIONS.map((section) => (
                        <label key={section.id} className="manage-setting-row">
                            <input
                                type="checkbox"
                                checked={!preferences.homeHidden.includes(section.id)}
                                onChange={(e) => toggleHomeSection(section.id, e.target.checked)}
                            />
                            <span>{section.label}</span>
                        </label>
                    ))}
                </div>
            </section>

            <section className="customize-group" aria-labelledby="customize-activity">
                <h3 id="customize-activity">Activity feed</h3>
                <p className="customize-group-intro">
                    What a plant&apos;s activity feed shows at first. The chips above the feed still change it.
                </p>
                <div className="customize-checks">
                    {ACTIVITY_FILTERS.map((filter) => {
                        const checked = preferences.activityTypes.includes(filter.id);
                        return (
                            <label key={filter.id} className="manage-setting-row">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    // At least one type stays on, or the feed would be empty.
                                    disabled={checked && preferences.activityTypes.length === 1}
                                    onChange={(e) => toggleActivity(filter.id, e.target.checked)}
                                />
                                <span>{filter.label}</span>
                            </label>
                        );
                    })}
                </div>
            </section>

            <section className="customize-group" aria-labelledby="customize-dates">
                <h3 id="customize-dates">Date and time</h3>
                <SelectField<string>
                    label="Date format"
                    value={preferences.dateLocale}
                    onChange={(value) => set("dateLocale", value)}
                    options={[{ value: "", label: `Server default (${serverLocaleLabel})` }, ...DATE_LOCALES]}
                />
                <Choices<HourCycle>
                    legend="Clock"
                    name="hourCycle"
                    value={preferences.hourCycle}
                    onChange={(value) => set("hourCycle", value)}
                    options={[
                        { value: "auto", label: "As the date format" },
                        { value: "h23", label: "24-hour" },
                        { value: "h12", label: "12-hour" },
                    ]}
                />
                <Choices<WeekStart>
                    legend="Calendar weeks start on"
                    name="weekStart"
                    value={preferences.weekStart}
                    onChange={(value) => set("weekStart", value)}
                    options={[
                        { value: "auto", label: "As the date format" },
                        { value: "monday", label: "Monday" },
                        { value: "sunday", label: "Sunday" },
                    ]}
                />
                <small className="manage-setting-hint">Example: {dateExample}</small>
            </section>

            <section className="customize-group" aria-labelledby="customize-photos">
                <h3 id="customize-photos">Photos</h3>
                <Choices<ImageQuality>
                    legend="Image quality"
                    name="imageQuality"
                    value={preferences.imageQuality}
                    onChange={(value) => set("imageQuality", value)}
                    options={[
                        {
                            value: "auto",
                            label: "Automatic",
                            hint: "Sharper photos on high-resolution screens (Retina, 2K, 4K), small ones elsewhere",
                        },
                        {
                            value: "saver",
                            label: "Data saver",
                            hint: "Always the smallest size; quicker on mobile data",
                        },
                        {
                            value: "high",
                            label: "High",
                            hint: "Larger previews and the full-size photo on plant and location pages",
                        },
                    ]}
                />
                <small className="manage-setting-hint">
                    Changes what is loaded, not what is stored: uploads are always kept up to 2000px wide. The
                    full-screen view always shows that size.
                </small>
            </section>

            {/* Only worth a setting when there is a choice. */}
            {llmProviders.length > 1 && (
                <section className="customize-group" aria-labelledby="customize-ai">
                    <h3 id="customize-ai">AI</h3>
                    <SelectField<string>
                        label="AI provider"
                        value={
                            llmProviders.some((p) => p.id === preferences.llmProvider) ? preferences.llmProvider : ""
                        }
                        onChange={(value) => set("llmProvider", value)}
                        options={[
                            { value: "", label: "Ask each time" },
                            ...llmProviders.map((p) => ({
                                value: p.id,
                                label: p.model ? `${p.label} (${p.model})` : p.label,
                            })),
                        ]}
                    />
                    <small className="manage-setting-hint">
                        With a provider chosen, the AI buttons use it without asking. The care advice dialog lets you
                        pick another one each time.
                    </small>
                </section>
            )}
        </div>
    );
}
