# Locations & Floor Plans

## Locations

Locations are places outside your home that you want to remember: a field, a forest clearing, a
meadow, a public spot where elderflower grows. Each one has GPS coordinates, a type, photos, tags,
notes and harvest times. Locations need `ENABLE_LOCATIONS=true`.

**On the map.** The locations list shows every spot on an interactive map, and each location page
has its own map. *Use my location* fills in the coordinates from your phone's position.

**Harvest times.** Note what can be harvested at a location and when, for example a crop or herb
with its date. Harvest times show up in the location's calendar, next to its photos and notes.

**Description.** Write your own, or let the AI write one with seasonal advice on what to look for
at that spot (see [Identification & AI](ai.md)).

**Visibility.** Every location has a status that decides who sees it, independent of your plants:

| Status | Visible to |
| --- | --- |
| `private` (default) | Logged-in users only |
| `shared` | Logged-in users and share-link viewers |
| `public` | Everyone who may read the collection |

A hidden location hides its photos, tags, notes and harvest times too. The details are under
[Access & Visibility](../access.md#locations).

## Floor plans

A floor plan is a picture of your home with your plants placed on it. You see at a glance where
each plant is and which ones need water, which helps when someone else waters for you.

- An admin turns floor plans on under **Manage → Floor plans** (*Enable floor plans for everyone*).
- Upload a plan, an image of your flat or a sketch, and place plants on it. On a phone, pinch to
  zoom and tap to place.
- A plant's page links to its spot on the plan.

Floor plans show the inside of someone's home, so they are for logged-in members only. They never
appear on share links or to anonymous visitors, and the offline cache never stores them.
