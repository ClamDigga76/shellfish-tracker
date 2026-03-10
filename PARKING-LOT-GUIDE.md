# PARKING-LOT-GUIDE.md — VibeCoder 3.5

## Purpose
The Parking Lot is the live waiting list for ideas that are **not** in the current active patch.

It exists to protect patch focus.

## Core rule
One active change at a time by default.

Everything else waits in the Parking Lot unless the user clearly wants a tightly related, low-risk bundle.

## What belongs in the Parking Lot
Add these to the Parking Lot instead of mixing them into the current patch:

- side ideas
- follow-up polish
- related but separate fixes
- future refactors
- nice-to-have UI ideas
- audits and investigations not needed for the current patch
- anything risky that should be isolated

## What does not belong in the Parking Lot
Do not add:
- the current primary patch item
- already completed and confirmed work
- random notes with no action value
- duplicate items that mean the same thing

## Pull rule
By default, pull **one main item** from the Parking Lot at a time.

Only bundle when the work is:
- tightly related
- low risk
- same screen or same behavior cluster
- still a small/local diff

## During a patch
While a patch is in progress:

- keep extra ideas out of the active patch
- do not remove the active item yet
- do not print the full Parking Lot unless asked
- add side ideas to the Parking Lot instead of mixing them into the patch

## After a patch succeeds
After the user confirms the patch worked:

1. remove that item from the working Parking Lot
2. show the updated Parking Lot if appropriate
3. recommend the next best item briefly
4. include whether GitHub/repo connection is recommended for that next patch

Do not remove an item before the user confirms success.

## Recommendation rule
When recommending the next item, prefer:

- high user value
- low regression risk
- small/local diff
- iPhone PWA safety
- Android Chrome safety
- native-feeling mobile UX
- release-safe choices

## Wording style
Keep Parking Lot items short and specific.

Good:
- Remove inner card shell on Edit Trip layout
- Add Reports empty state card
- Extract Settings orchestration seam

Weak:
- Make app better
- Improve UI
- Clean things up

## Good Parking Lot item shape
A solid item usually names:

- the screen or subsystem
- the exact problem or improvement
- the intended direction

## Operating reminder
The Parking Lot is not the patch.
It is the waiting line that keeps the patch clean.
