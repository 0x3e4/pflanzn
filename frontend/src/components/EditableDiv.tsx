import { useEffect, useRef, useState } from "react";

interface EditableDivProps {
    value: string;
    onSave: (value: string) => void;
    editable?: boolean;
    placeholder?: string;
    className?: string;
}

export default function EditableDiv({
    value,
    onSave,
    editable = true,
    placeholder = "Click to edit...",
    className = ""
}: EditableDivProps) {
    const [editing, setEditing] = useState(false);
    const divRef = useRef<HTMLDivElement>(null);
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

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
        if (editing && divRef.current) {
            // If showing placeholder, clear it
            if (!localValue) {
                divRef.current.innerText = '';
            }
            // Focus the div
            divRef.current.focus();
        }
    }, [editing, localValue]);

    const exitEditingMode = () => {
        if (divRef.current) {
            const newValue = divRef.current.innerText.trim();
            setEditing(false);
            if (newValue !== value) {
                onSave(newValue);
            }
        }
    };

    return (
        <div
            className={`editable-div ${editing ? "editing" : ""} ${className}`}
            contentEditable={editable && editing}
            suppressContentEditableWarning
            ref={divRef}
            onClick={() => editable && setEditing(true)}
            style={{ direction: "ltr", unicodeBidi: "plaintext" }}
        >
            {localValue || placeholder}
        </div>
    );
}