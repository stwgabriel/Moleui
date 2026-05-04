# Generated Documentation

This directory contains all AI-generated documentation, implementation guides, and reference materials for the Mole project.

## Purpose

The `_GENERATED` directory keeps generated content separate from core documentation, making it easier to:
- Identify which files are AI-generated vs. manually maintained
- Clean up or regenerate documentation as needed
- Maintain a clear project structure

## Content Types

This directory contains:

### Implementation Guides
Complete documentation of feature implementations with technical details:
- `CLEAN_PAGE_COMPLETE.md`
- `ANALYZE_PAGE_COMPLETE.md`
- `OPTIMIZE_PAGE_COMPLETE.md`
- `STATUS_PAGE_COMPLETE.md`

### Visual Guides
Visual design and layout documentation:
- `CLEAN_PAGE_VISUAL_GUIDE.md`
- `ANALYZE_PAGE_VISUAL_GUIDE.md`
- `START_SCREENS_VISUAL_GUIDE.md`
- `STATUS_PAGE_VISUAL_GUIDE.md`

### Quick References
Condensed reference materials for developers:
- `CLEAN_PAGE_QUICK_REFERENCE.md`
- `ANALYZE_PAGE_QUICK_REFERENCE.md`
- `START_SCREENS_QUICK_REFERENCE.md`
- `STATUS_PAGE_QUICK_REFERENCE.md`

### Summaries
High-level overviews of features and implementations:
- `CLEAN_PAGE_SUMMARY.md`
- `ANALYZE_PAGE_SUMMARY.md`
- `START_SCREENS_SUMMARY.md`
- `STATUS_PAGE_SUMMARY.md`

### Fix Documentation
Documentation of bug fixes and improvements:
- `RELOAD_FIX.md`
- `UNINSTALL_FIX.md`
- `ANSI_CLEANUP_FIX.md`

### Other Generated Content
- Implementation comparisons
- Testing documentation
- Update guides
- Quickstart guides

## Convention

**All generated markdown files MUST be placed in this directory.**

Only essential, permanent documentation should remain in application directories:
- `README.md` - Application-specific readme
- `CHANGELOG.md` - Version history

## Maintenance

Generated documentation can be:
- Regenerated as features evolve
- Archived when no longer relevant
- Updated to reflect current implementation

This separation makes it clear which documentation is authoritative (core docs) vs. supplementary (generated guides).
