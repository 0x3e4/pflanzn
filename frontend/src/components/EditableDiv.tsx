import { useEffect, useRef, useState } from "react";

interface EditableDivProps {
    value: string;
    onSave: (value: string) => void;
    onChange?: (value: string) => void;
    editable?: boolean;
    placeholder?: string;
    className?: string;
}

export default function EditableDiv({
    value,
    onSave,
    onChange,
    editable = true,
    placeholder = "Click to edit...",
    className = "",
}: EditableDivProps) {
    const [editing, setEditing] = useState(false);
    const divRef = useRef<HTMLDivElement>(null);
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        if (!editing) setLocalValue(value);
    }, [value, editing]);

    useEffect(() => {
        if (!editing) return;

        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (divRef.current && !divRef.current.contains(event.target as Node)) {
                exitEditingMode();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [editing]);

    useEffect(() => {
        if (!editing || !divRef.current) return;

        const el = divRef.current;
        el.innerText = localValue ?? "";
        el.focus();

        // place caret at end
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);

        // click outside to exit
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (el && !el.contains(e.target as Node)) exitEditingMode();
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [editing, localValue]);

    const exitEditingMode = () => {
        if (!divRef.current) return;
        const newValue = divRef.current.innerText.trim();
        setEditing(false);
        setLocalValue(newValue);
        onChange?.(newValue);
        if (newValue !== value) onSave(newValue);
    };

    return (
        <div
            className={`editable-div ${editing ? "editing" : ""} ${className}`}
            contentEditable={editable && editing}
            suppressContentEditableWarning
            ref={divRef}
            onClick={() => editable && setEditing(true)}
            onInput={(e) => {
                const v = e.currentTarget.textContent ?? "";
                setLocalValue(v);
                onChange?.(v);
            }}
            onBlur={exitEditingMode}
            onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    exitEditingMode();
                }
            }}
            style={{ direction: "ltr", unicodeBidi: "plaintext" }}
        >
            {!editing ? localValue || placeholder : null}
        </div>
    );
}
