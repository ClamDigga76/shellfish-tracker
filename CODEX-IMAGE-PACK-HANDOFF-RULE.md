# CODEX-IMAGE-PACK-HANDOFF-RULE.md

## Purpose

Use this rule whenever a Codex patch includes screenshots, mockups, crops, or other visual references.

The image pack is only for transporting the images.

The actual patch prompt stays outside the zip and gets pasted directly into Codex.

This file is the Visual Patch Protocol for Vibe Coder 5.0 screenshot, mockup, crop, and image-pack work.

This file supports visual Codex patches. It does not replace `AGENTS.md`, `PATCH-SAFETY-STACK.md`, `patch-prompt-style.md`, or the project workflow files.

---

## Image Pack Rule

When preparing a Codex image pack:

1. Rename each image with a clear role-based filename.
2. Put only the renamed image files inside the zip.
3. Do not put the patch prompt, notes, markdown files, repo notes, or instructions inside the zip.
4. Reference the zip name and every image filename inside the Codex prompt.
5. Explain what each image is for.
6. Tell Codex what visual details to use from the images.
7. Tell Codex what not to change.

---

## Naming Pattern

Use names based on the image’s role in the patch.

Examples:

```text
CURRENT-HOME-TOP.png
CURRENT-HOME-TOP-CROP.png
TARGET-HOME-TOP.png
TARGET-HOME-TOP-CROP.png
REFERENCE-CARD-SPACING.png
REFERENCE-LOCKED-STATE.png
```

Use these prefixes:

| Prefix | Meaning |
|---|---|
| `CURRENT` | The app as it exists now |
| `TARGET` | The desired direction, mockup, or edited visual |
| `REFERENCE` | Supporting visual detail only |

Use these suffixes when helpful:

| Suffix | Meaning |
|---|---|
| `CROP` | Tight crop of the patch area |
| `FULL` | Wider screen context |
| `WITH-CONTEXT` | Includes nearby UI for spacing or hierarchy |

---

## What Goes Inside the Zip

The zip should contain only image files.

Allowed:

- PNG
- JPEG
- JPG
- WEBP

Do not include:

- patch prompts
- markdown files
- repo notes
- instructions
- unrelated screenshots
- duplicate images
- old versions that are no longer relevant

---

## Codex Prompt Image Block

Use this kind of block inside the actual Codex patch prompt:

```text
Image pack attached:
<IMAGE_PACK_NAME>.zip

Images inside:

- <CURRENT-IMAGE-NAME>
- <TARGET-IMAGE-NAME>
- <REFERENCE-IMAGE-NAME>

Image roles:

- CURRENT images show the existing app state.
- TARGET images show the desired design direction.
- REFERENCE images show supporting details only.

How to use the images:

- Use TARGET images for layout direction, spacing, hierarchy, chip/card shape, alignment, and visual rhythm.
- Use CURRENT images to understand the existing implementation and preserve nearby working areas.
- Use REFERENCE images only for the specific detail named in the filename.
- Do not pixel-copy unless the patch specifically says to match something exactly.

Scope reminder:

Use the images only for the active patch seam.
Do not widen into unrelated screens, routing, data logic, subscription logic, or broader styling unless explicitly requested.
```

---

## Paid / Locked Visual Reminder

When screenshots show locked, paid, premium, or upgrade visual direction, include this reminder if relevant:

```text
This pass is groundwork only.

Do not implement final paid gating, purchase logic, subscription enforcement, or a full upgrade flow unless the patch specifically requests it.

Locked or premium visuals in the images are visual direction only unless the prompt says otherwise.
```

---

## Visual Use Rules

Use this file with `PATCH-SAFETY-STACK.md` when a visual patch also needs Patch Risk, Do Not Touch, Smallest Safe Path, or Repo Truth vs Plan labels.

Codex should use screenshots and mockups for:

- hierarchy
- spacing
- layout direction
- style direction
- alignment
- visual rhythm
- card/chip shape guidance
- relative placement

Codex should not use screenshots to:

- pixel-copy the mockup unless explicitly requested
- widen into unrelated screens
- infer new business logic
- implement paid gating unless requested
- alter routing, data models, subscription logic, or storage behavior unless in scope

---

## Best Practice

A good Codex image pack should be small and focused.

Use:

- one current full/context image when helpful
- one current crop of the patch seam
- one target full/context image when helpful
- one target crop of the patch seam
- optional reference images only when they clarify a specific visual detail

The patch prompt is the source of truth.

The images support the prompt; they do not replace it.

---

## Image Pack Preflight

Before delivering an image pack zip, check:

- file count
- filenames are role-based and clear
- zip contains only image files
- no patch prompt or markdown file is inside the zip
- no unrelated screenshots are included
- no duplicate or obsolete images are included
- image formats are allowed
- transparency is preserved when relevant

Report the result as PASS or FAIL.

If the preflight fails, fix the pack before delivery when possible.
