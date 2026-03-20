import re


def clean_generated_text(text: str) -> str:
    """
    Cleans up AI-generated text by:
    - Removing leading "Title:" if present.
    - Removing "Habitat:" if present.
    - Removing markdown-like formatting (like **bold text**).
    - Removing heading markers like "#".
    - Trimming leading and trailing spaces.
    """
    text = text.replace("Title:", "").strip()
    text = text.replace("Habitat:", "").strip()
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"#+", "", text)
    text = text.strip()

    return text
