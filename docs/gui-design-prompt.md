# Mole GUI Design Prompt

Design a premium macOS desktop interface for a product called `Mole`.

Mole is an all-in-one Mac maintenance utility that combines:

- system cleanup
- app uninstallation with leftover file removal
- disk space analysis
- live system health monitoring
- developer artifact cleanup
- installer file cleanup

The interface should be designed for a real desktop app built with `Tauri + React`, but the output here is a visual concept for product direction.

## Product References

Use these as directional references only. Do not copy any of them directly.

### CleanMyMac

Borrow:

- premium Mac-native polish
- strong top-level health framing
- guided care workflow
- high trust visual language

### DaisyDisk

Borrow:

- beautiful storage visualization
- fast sense of drilldown and spatial understanding
- emphasis on large folders and files

### AppCleaner

Borrow:

- focused uninstall review
- clear relationship between app and leftover files
- compact, low-friction interaction model

## Design Goals

- make system maintenance feel clear, calm, and trustworthy
- feel native to macOS rather than like a web admin dashboard
- communicate risk and safety explicitly
- turn heavy terminal workflows into visual, guided, understandable flows
- keep the UI elegant, but avoid empty marketing-style composition

## Core Screens To Visualize

### 1. Dashboard

Show:

- large health score
- CPU, memory, disk, network, battery, and process cards
- recent actions and outcomes
- recommended actions such as cleanup, optimize, or inspect storage

### 2. Smart Care

Show:

- a unified maintenance flow
- scan summary with grouped findings
- estimated space savings and system improvements
- clear safe, review, and advanced states

### 3. Cleanup

Show:

- cleanup categories such as caches, logs, browser leftovers, developer files, and trash
- expected reclaimable space per category
- dry-run preview before the destructive step
- a final confirmation area with strong warning treatment

### 4. Uninstaller

Show:

- searchable app list
- app icon, app name, size, last used, and leftovers count
- detail panel showing related files before deletion
- clear distinction between Trash and permanent delete

### 5. Space Explorer

Show:

- a high-clarity radial, layered, or otherwise original storage visualization
- large directories and files
- selected item inspector
- path drilldown and navigation context

### 6. Job Detail

Show:

- live command output panel
- progress timeline
- warnings and skipped items
- final result summary with reclaimed space or applied changes

## Layout Direction

- left sidebar navigation
- top context header
- central work area
- optional right-side detail panel on dense workflows
- optimized for 13-inch MacBook screens and larger desktops

## Visual Style

- dark mode first
- restrained light mode variant
- midnight, graphite, smoke, silver, and soft teal accents
- subtle translucency and depth, not heavy glassmorphism
- rounded panels and strong spacing rhythm
- clean typography hierarchy with compact utility density
- clear warning, success, and danger colors

## Tone

- premium
- calm
- technical but approachable
- safety-first
- not playful in a toy-like way
- not corporate SaaS

## Avoid

- generic startup dashboard styling
- crypto or trading terminal aesthetics
- bright rainbow gradients everywhere
- visual noise and oversized empty cards
- fake "boost" gimmicks
- vague delete buttons without context

## Image Generation Constraints

- create an original interface, not a clone of any reference product
- show desktop UI, not mobile UI
- include realistic macOS window chrome and spacing
- use legible labels and believable utility UI density
- emphasize trust, clarity, and control

## Desired Output

Generate a high-fidelity desktop product concept that includes:

- one full app shell view
- one Dashboard view
- one Uninstaller view
- one Space Explorer view
- one Smart Care view
- one Job Detail view

The result should look like a serious Mac utility product that could ship, not a generic concept board.
