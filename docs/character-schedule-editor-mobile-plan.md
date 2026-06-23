# Character Schedule Editor Mobile Plan

## Goal
- Redesign the time block editor so it stays usable on narrow screens without losing the richer desktop overview.
- Keep the 24-hour schedule context visible, but move editing into smaller, clearer interactions.

## Current Problems
- The day rows assume enough horizontal space for a timeline preview plus inline editing.
- The per-block form is dense on mobile, with too many controls visible at once.
- Drag-style or timeline-heavy interactions do not translate well to small touch targets.

## Proposed Shape
- Keep the weekly overview strip as read-only context in the collapsed day row.
- Turn the expanded day view into a mobile-friendly list of block cards.
- Keep the timeline preview, but treat it as a compact summary rather than the primary editor.
- Use a single focused editor surface for each block instead of showing all fields at once.

## Desktop Behavior
- Preserve the weekly overview strip and summary counts.
- Keep the expanded day card showing the block list, but allow a wider two-column or preview-plus-editor layout when space is available.
- Keep quick actions visible for add, delete, and status selection.

## Mobile Behavior
- Collapse the block area into a stacked list with clear cards.
- Make each card tap to expand its editable fields.
- Keep the timeline strip as a thin visual summary above the list.
- Avoid tiny drag handles or side-by-side dense inputs.
- Prefer full-width controls and large tap targets.

## Editing Model
- Use one open block editor at a time on mobile.
- Support quick actions like duplicate, split, and delete from the card header.
- Keep time entry as a simple text field or compact stepper.
- Keep status selection as chips or a short select row.

## Implementation Notes
- Reuse the existing schedule parsing and block update helpers.
- Avoid introducing a separate editing data model.
- Keep the current modal shell and existing save flow.
- Use responsive class switches rather than a separate route or modal.

## Verification
- Confirm the day list is readable at narrow widths.
- Confirm the editor is still usable with one hand on touch devices.
- Check that desktop still shows enough information to edit quickly.
