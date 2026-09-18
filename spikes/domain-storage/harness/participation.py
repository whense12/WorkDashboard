"""Participation plan resolution (C2).

A plan is (period, pattern). Per-date deviations are exception rows.
Resolution order, fixed and total:

    dates(period, pattern)  -  {exclude dates}  +  {include dates}

Both exception kinds are clamped to the plan period. A date can hold only
one verdict (UNIQUE(plan_id, on_date)), so include/exclude cannot conflict.

Nothing in here writes. Resolution is a pure read over plan + exception
rows, which is what makes "edit one date" and "edit the plan" separable.
"""

from __future__ import annotations

import datetime as dt
import json

PATTERNS = ("daily", "weekdays", "weekends", "selected_weekdays", "selected_dates")

# Python weekday(): Mon=0 .. Sun=6
_WEEKEND = {5, 6}


def _parse(d: str) -> dt.date:
    return dt.date.fromisoformat(d)


def _days(period_start: str, period_end: str):
    day = _parse(period_start)
    last = _parse(period_end)
    while day <= last:
        yield day
        day += dt.timedelta(days=1)


def pattern_dates(period_start: str, period_end: str, pattern: str, detail):
    """Dates the recurrence pattern alone produces, exceptions not applied."""
    if pattern not in PATTERNS:
        raise ValueError("unknown pattern %r" % pattern)
    detail = json.loads(detail) if isinstance(detail, str) else detail

    if pattern == "selected_dates":
        chosen = {_parse(x) for x in detail}
        return [d for d in _days(period_start, period_end) if d in chosen]

    if pattern == "selected_weekdays":
        chosen = set(detail)
        unknown = chosen - set(range(7))
        if unknown:
            raise ValueError("weekday out of range: %r" % sorted(unknown))
        keep = lambda d: d.weekday() in chosen
    elif pattern == "daily":
        keep = lambda d: True
    elif pattern == "weekdays":
        keep = lambda d: d.weekday() not in _WEEKEND
    else:  # weekends
        keep = lambda d: d.weekday() in _WEEKEND

    return [d for d in _days(period_start, period_end) if keep(d)]


def resolve(conn, plan_id):
    """Effective participation dates for a plan, as ISO strings, ascending."""
    plan = conn.execute(
        "SELECT * FROM participation_plan WHERE id = ?", (plan_id,)
    ).fetchone()
    if plan is None:
        raise LookupError("no participation_plan %r" % plan_id)

    start, end = plan["period_start"], plan["period_end"]
    dates = set(
        pattern_dates(start, end, plan["pattern"], plan["pattern_detail"])
    )

    lo, hi = _parse(start), _parse(end)
    for row in conn.execute(
        "SELECT on_date, kind FROM participation_exception WHERE plan_id = ?",
        (plan_id,),
    ):
        day = _parse(row["on_date"])
        if not (lo <= day <= hi):
            # Retained in storage, simply outside the current period.
            # Whether a plan edit should PRUNE such rows is a product
            # decision - see NOTES.md OPEN-2. Storage does not decide it.
            continue
        if row["kind"] == "exclude":
            dates.discard(day)
        else:
            dates.add(day)

    return [d.isoformat() for d in sorted(dates)]


def vendor_names_on(conn, on_date):
    """Kernel MUST 2: the calendar must be able to name participating
    vendors for a day, not just count them. Read-only helper, no UI."""
    names = []
    for plan in conn.execute(
        "SELECT p.id, v.name FROM participation_plan p "
        "JOIN vendor v ON v.id = p.vendor_id ORDER BY v.name"
    ):
        if on_date in resolve(conn, plan["id"]):
            names.append(plan["name"])
    return names
