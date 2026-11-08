import re
from typing import Optional

# The description prompt asks for one machine-read last line: "WATERING_INTERVAL_DAYS: 7".
# Models vary the spelling a little (spaces, "=", a trailing "days"), so the match is loose.
_MARKER = re.compile(
    r"^[ \t]*[`*_]*WATERING[ _]INTERVAL[ _]DAYS[`*_]*[ \t]*[:=][ \t]*[`*_]*(\d{1,3})\b[^\n]*$",
    re.IGNORECASE | re.MULTILINE,
)

# A sensible window for a houseplant: daily at most, every three months at least (cacti in winter).
MIN_INTERVAL_DAYS = 1
MAX_INTERVAL_DAYS = 90


def split_watering_interval(text: str) -> tuple[str, Optional[int]]:
    """Remove every watering-interval marker line from a generated description.

    Returns the description without the marker and the interval in days, or None when the
    model gave none or a number outside the sensible window.
    """
    matches = list(_MARKER.finditer(text))
    if not matches:
        return text.strip(), None

    cleaned = _MARKER.sub("", text)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    days = int(matches[-1].group(1))
    if not MIN_INTERVAL_DAYS <= days <= MAX_INTERVAL_DAYS:
        return cleaned, None
    return cleaned, days
