# Notifications

Pflanzn can tell you when a **reminder** is due and, once a day, which **plants need water**. It
doesn't talk to Telegram, ntfy, Matrix, Discord or mail itself: it hands each message to an
[Apprise](https://github.com/caronc/apprise-api) server, which knows about
[more than a hundred services](https://github.com/caronc/apprise/wiki).

## Setting it up

The compose example has an `apprise` service (the latest `caronc/apprise` image, reachable for the
backend as `pflanzn-apprise`). If you already run Apprise, leave that service out and point
Pflanzn at yours instead. Either way, set in `.env`:

| Variable | What it does |
| --- | --- |
| `APPRISE_URL` | The Apprise server, e.g. `http://pflanzn-apprise:8000` for the bundled one. Empty: notifications are off. |
| `APPRISE_KEY` | A configuration stored in Apprise under this key; Pflanzn posts to `/notify/{key}`. |
| `APPRISE_TAG` | Optional, with `APPRISE_KEY`: only the URLs with this tag. |
| `APPRISE_URLS` | Instead of a key: the notification URLs themselves, comma or space separated (e.g. `ntfy://ntfy.sh/my-plants`). |

Then restart the backend.

**With a key** you keep the targets in Apprise: open its web UI (the compose example publishes it
on `127.0.0.1:8001`), create a configuration under a key such as `pflanzn` and add your URLs there.
**With `APPRISE_URLS`** there is nothing to set up in Apprise; the URLs travel with every message.
They carry tokens, so the admin page shows only their kind ("ntfy, tgram"), never the URLs.

## What gets sent

Admins choose under **Manage → Integrations**:

- **Reminders, when they are due.** A reminder is a note with a *Remind me* date and time (see
  [Timeline, calendar and notes](guide/plants.md#timeline-calendar-and-notes)). It is sent once,
  within a minute of its time, with a link to the plant. Reminders more than two days late (the
  backend was down, or notifications were off) are skipped rather than sent long after the fact.
- **Plants that need water, every day at** a time you pick (08:00 by default, in `TZ`). One message
  lists every plant whose watering schedule says *today* or *overdue*, most overdue first. Plants
  without a schedule, and archived ones, never count. Nothing is sent when no plant is due.

*Send a test* sends the digest as it would look right now, or a short test message when nothing is
due. If it fails, the error says why (Apprise unreachable, or the HTTP status it answered).

With several backend workers, each message still goes out once: a reminder is claimed in the
database before it is sent, and the daily digest is claimed in Redis.
