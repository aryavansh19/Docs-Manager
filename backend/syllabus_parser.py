from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from document_pipeline import build_metadata, detect_mime_type, extract_document, safe_filename


MAX_SUBJECTS = 40
MAX_UNITS_PER_SUBJECT = 30

# "Course Name : Human Computer Interaction" on one line. University syllabi put the
# credit table on the same visual row, so trailing column noise is stripped separately.
_INLINE_SUBJECT = re.compile(
    r"^(?:subject|course|paper)(?:\s+(?:name|title))?\s*[:\-]\s*(.{3,160})$",
    re.IGNORECASE,
)
# The same field when PDF extraction splits the label and value onto separate lines,
# which happens whenever the header is laid out as a table.
_SUBJECT_LABEL_ONLY = re.compile(
    r"^(?:subject|course|paper)(?:\s+(?:name|title))\s*[:\-]?\s*$",
    re.IGNORECASE,
)
_COURSE_CODE_LINE = re.compile(
    r"^course\s*code\s*[:\-]\s*([A-Z]{2,8}\s*-?\s*\d{2,4})",
    re.IGNORECASE,
)
_UNIT_PATTERN = re.compile(
    r"^(?:unit|module|chapter)\s*[-–]?\s*([IVXLCDM]+|\d+)?\s*[:.\-–]?\s*(.*)$",
    re.IGNORECASE,
)

# Layout artefacts that ride along on the same line as a heading.
_TRAILING_NOISE = re.compile(
    r"\s*(?:"
    r"L\s*T\s*P\s*(?:Credits?)?"
    r"|Contact\s*Hours?\s*/?\s*Teaching\s*Hours?\s*[:\-]?\s*\d*"
    r"|Teaching\s*Hours?\s*[:\-]?\s*\d*"
    r"|Contact\s*Hours?\s*[:\-]?\s*\d*"
    r"|Self[-\s]*Learning\s*Hours?\s*=?\s*\d*"
    r"|Team\s*Activity\s*Hours?\s*=?\s*\d*"
    r"|Credits?\s*[:\-]?\s*\d*"
    r")\s*$",
    re.IGNORECASE,
)

# Lines that repeat on every page, or belong to the course metadata block rather than
# being a subject or unit. Matching these prevents them becoming folder names.
_BOILERPLATE = (
    re.compile(r"^department\s+of\b", re.IGNORECASE),
    re.compile(r"^b\.?\s*tech", re.IGNORECASE),
    re.compile(r"^m\.?\s*tech", re.IGNORECASE),
    re.compile(r"^\d{4}\s*[-–]\s*\d{2,4}(\s+batch)?$", re.IGNORECASE),
    re.compile(r"^\d{4}\s*[-–]\s*\d{2,4}\s+onwards$", re.IGNORECASE),
    re.compile(r"^(?:semester|pre[-\s]*requisite|course\s*code|credits?)\b", re.IGNORECASE),
    re.compile(r"^course\s+(?:learning\s+)?(?:objectives?|outcomes?)\b", re.IGNORECASE),
    re.compile(r"^course\s+articulation\s+matrix$", re.IGNORECASE),
    re.compile(r"^(?:text|reference)\s*books?\s*:?$", re.IGNORECASE),
    re.compile(r"^online\s+resources?\s*:?$", re.IGNORECASE),
    re.compile(r"^details\s+of\s+the\s+course\s*:?$", re.IGNORECASE),
    re.compile(r"^(?:self[-\s]*learning|team\s+activity)\s+hours?\b", re.IGNORECASE),
    re.compile(r"^contact\s+hours?\b", re.IGNORECASE),
    re.compile(r"^(?:students?|group)\s+(?:shall|should|will|activity|discussion|based)\b", re.IGNORECASE),
    re.compile(r"^(?:CO|PO|PSO)\s*\d+\b", re.IGNORECASE),
    re.compile(r"^(?:avg\.?|average)\b", re.IGNORECASE),
    re.compile(r"^https?://", re.IGNORECASE),
    re.compile(r"^page\s*\d+$", re.IGNORECASE),
    re.compile(r"^[\d\s.,–—-]+$"),
)


def _clean_heading(value: str) -> str:
    value = re.sub(r"\s+", " ", value or "").strip()
    # Repeatedly strip trailing layout noise, since several artefacts can stack up.
    for _ in range(4):
        stripped = _TRAILING_NOISE.sub("", value).strip()
        if stripped == value:
            break
        value = stripped
    value = value.strip(" .,:;|-–")
    return value[:120]


def _is_boilerplate(line: str) -> bool:
    return any(pattern.match(line) for pattern in _BOILERPLATE)


def _looks_like_subject_value(value: str) -> bool:
    """Reject values that are clearly not a course title."""
    if len(value) < 3 or len(value) > 120:
        return False
    if not re.search(r"[A-Za-z]{3}", value):
        return False
    return not _is_boilerplate(value)


def parse_syllabus_text(text: str, fallback_title: str) -> dict[str, list[str]]:
    """Extract {course name: [unit names]} from syllabus text.

    Handles documents containing several courses. Units are scoped to the course that
    precedes them, so a multi-course syllabus does not collapse into one subject.
    """
    raw_lines = [re.sub(r"\s+", " ", line).strip() for line in (text or "").splitlines()]
    raw_lines = [line for line in raw_lines if line]

    structure: dict[str, list[str]] = {}
    current_subject: str | None = None
    unassigned_units: list[str] = []
    # Remaining lines to search for a course title after seeing a bare label. Table
    # extraction often emits the separator colon on its own line before the value.
    subject_value_budget = 0

    for index, raw_line in enumerate(raw_lines):
        # A "Course Name" label with its value on a following line, caused by table layout.
        if _SUBJECT_LABEL_ONLY.match(raw_line):
            subject_value_budget = 3
            continue

        if subject_value_budget > 0:
            subject_value_budget -= 1
            stripped = raw_line.strip(" :-–")
            if not stripped:
                # A lone separator, so keep looking on the next line.
                subject_value_budget = max(subject_value_budget, 1)
                continue
            candidate = _clean_heading(stripped)
            if _looks_like_subject_value(candidate):
                current_subject = candidate
                structure.setdefault(current_subject, [])
                subject_value_budget = 0
                continue
            subject_value_budget = 0

        inline = _INLINE_SUBJECT.match(raw_line)
        if inline:
            candidate = _clean_heading(inline.group(1))
            if _looks_like_subject_value(candidate):
                current_subject = candidate
                structure.setdefault(current_subject, [])
            continue

        if _is_boilerplate(raw_line):
            continue

        unit_match = _UNIT_PATTERN.match(raw_line)
        if not unit_match:
            continue

        number = unit_match.group(1)
        name = _clean_heading(unit_match.group(2))

        # "Unit 4:" alone means the title sits on the next line.
        if not name and index + 1 < len(raw_lines):
            lookahead = _clean_heading(raw_lines[index + 1])
            if lookahead and not _is_boilerplate(lookahead) and not _UNIT_PATTERN.match(raw_lines[index + 1]):
                name = lookahead

        label = name or (f"Unit {number}" if number else None)
        if not label:
            continue

        if current_subject:
            units = structure[current_subject]
            if label not in units and len(units) < MAX_UNITS_PER_SUBJECT:
                units.append(label)
        elif label not in unassigned_units:
            unassigned_units.append(label)

    # Units seen before any course heading only get their own bucket when no course was
    # ever identified. Otherwise they would pollute a real subject.
    if unassigned_units and not structure:
        inferred = _clean_heading(fallback_title) or "Imported Syllabus"
        structure[inferred] = unassigned_units[:MAX_UNITS_PER_SUBJECT]

    cleaned = {subject: units for subject, units in structure.items() if subject}
    return dict(list(cleaned.items())[:MAX_SUBJECTS])


def parse_syllabus(data: bytes, claimed_mime_type: str | None, filename: str) -> dict[str, list[str]]:
    mime_type = detect_mime_type(data, claimed_mime_type, filename)
    safe_name = safe_filename(filename, mime_type)
    extracted = extract_document(data, mime_type, safe_name)
    metadata = build_metadata(extracted, safe_name, mime_type)
    return parse_syllabus_text(extracted.text, metadata.title or Path(safe_name).stem)
