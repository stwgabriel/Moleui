<!-- unsigned-build-note -->
---

### Installing these builds

These are built on GitHub and are **not signed or notarized**. macOS quarantines
anything downloaded from a browser, so opening the app normally reports that it
is damaged. That is the quarantine flag, not a broken build.

After moving the app to `/Applications`, clear the flag once:

```bash
xattr -dr com.apple.quarantine /Applications/Moleui.app
```

Or right-click the app and choose Open, which offers a one-time override.

Verify a download before running it:

```bash
shasum -a 256 -c SHA256SUMS-arm64.txt
```
