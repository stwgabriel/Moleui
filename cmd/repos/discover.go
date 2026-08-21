package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"
)

// skipDirNames are never walked. They hold no repository we care about and
// dominate walk time; node_modules alone can be most of a project's inodes.
var skipDirNames = map[string]bool{
	"node_modules": true, ".git": true, ".svn": true, ".hg": true,
	"Library": true, ".Trash": true, ".cache": true, ".venv": true,
	"venv": true, "__pycache__": true, ".bundle": true, "Pods": true,
	".terraform": true, ".gradle": true, ".cargo": true, ".rustup": true,
	".bun": true, ".pnpm-store": true, ".turbo": true, ".yarn": true,
}

// artifactDirNames are excluded from the freshness (mtime) scan only. A build
// output touched by a compiler does not mean the source changed, and counting
// it would make every repo look warm.
var artifactDirNames = map[string]bool{
	"node_modules": true, ".git": true, "dist": true, "build": true,
	".next": true, "out": true, "target": true, "vendor": true,
	".turbo": true, "coverage": true, ".cache": true, "dist-electron": true,
	".venv": true, "venv": true, "__pycache__": true, ".svelte-kit": true,
	"DerivedData": true, ".parcel-cache": true, "tmp": true, ".nuxt": true,
}

// markerFiles identify a directory as a project. Used to report folders that
// hold real work but have no git history at all, which is the one category
// this tool can never make safe.
var markerFiles = []string{
	"package.json", "go.mod", "Cargo.toml", "pyproject.toml", "requirements.txt",
	"Gemfile", "composer.json", "pom.xml", "build.gradle", "build.gradle.kts",
	"Package.swift", "pubspec.yaml", "mix.exs", "Makefile", "CMakeLists.txt",
	"docker-compose.yml", "tsconfig.json", "index.html", "main.py", "Dockerfile",
}

// markerDirs are directory-shaped project markers.
var markerDirs = []string{"src", "app", ".claude", ".agents", "lib", "components"}

// riskySuffixes and riskyNames flag files that are almost never reproducible and
// are usually gitignored: credentials, keys, local databases. If any of these
// exist untracked, archiving the directory throws away data that is on no remote.
var riskySuffixes = []string{
	".pem", ".key", ".p12", ".keystore", ".jks", ".mobileprovision",
	".sqlite", ".sqlite3", ".db", ".dump", ".sql.gz", ".kdbx",
}

var riskyNames = []string{
	".env", ".env.local", ".env.production", ".env.development", ".env.staging",
	".env.production.local", ".env.development.local", ".npmrc", ".netrc",
	"credentials.json", "secrets.json", "serviceaccount.json", "id_rsa", "id_ed25519",
	"terraform.tfstate", "auth.json", ".dev.vars",
}

const maxLocalOnlyReported = 40

// candidate is a directory found in the discovery pass.
type candidate struct {
	path     string
	root     string
	isRepo   bool
	gitIsDir bool
	gitPath  string
	markers  []string
}

// discover walks the roots and returns every repository plus every non-repo
// project folder. Repositories are walked into so nested repos are found; a
// plain folder is only reported when it is not inside a repository and has no
// repository underneath it, so a container directory does not masquerade as an
// orphaned project.
func discover(roots []string, maxDepth int) ([]candidate, []string) {
	var out []candidate
	var warnings []string
	seen := make(map[string]bool)

	for _, root := range roots {
		abs, err := filepath.Abs(root)
		if err != nil {
			warnings = append(warnings, "cannot resolve root "+root+": "+err.Error())
			continue
		}
		info, err := os.Stat(abs)
		if err != nil || !info.IsDir() {
			warnings = append(warnings, "skipping unreadable root "+abs)
			continue
		}
		rootDepth := strings.Count(filepath.Clean(abs), string(os.PathSeparator))

		err = filepath.WalkDir(abs, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				// An unreadable subtree is reported, never fatal: one bad
				// permission must not abort the whole inventory.
				warnings = append(warnings, "skipped "+path+": "+err.Error())
				if d != nil && d.IsDir() {
					return fs.SkipDir
				}
				return nil
			}
			if !d.IsDir() {
				return nil
			}
			name := d.Name()
			if path != abs {
				if skipDirNames[name] || strings.HasPrefix(name, ".") && name != ".claude" && name != ".agents" {
					return fs.SkipDir
				}
			}
			if maxDepth > 0 && strings.Count(filepath.Clean(path), string(os.PathSeparator))-rootDepth > maxDepth {
				return fs.SkipDir
			}
			if seen[path] {
				return nil
			}

			gitPath := filepath.Join(path, ".git")
			if st, statErr := os.Lstat(gitPath); statErr == nil {
				seen[path] = true
				out = append(out, candidate{
					path:     path,
					root:     abs,
					isRepo:   true,
					gitIsDir: st.IsDir(),
					gitPath:  gitPath,
				})
				return nil
			}

			if m := projectMarkers(path); len(m) > 0 {
				seen[path] = true
				out = append(out, candidate{path: path, root: abs, markers: m})
			}
			return nil
		})
		if err != nil {
			warnings = append(warnings, "walk failed for "+abs+": "+err.Error())
		}
	}

	sort.Slice(out, func(i, j int) bool { return out[i].path < out[j].path })
	return prunePlain(out), warnings
}

// prunePlain keeps only the outermost non-repo project folders.
//
// A directory inside a repository is already covered by that repository's
// history: reporting `t3code/apps/web` as having no cloud copy would be wrong,
// because t3code tracks it. Likewise a Flutter project's `android/` and `web/`
// subdirectories carry their own build files but belong to the project above
// them, so only the outermost folder is reported.
//
// Repositories are always kept, including nested ones, since a nested repo is
// genuinely separate history that the parent does not track.
func prunePlain(in []candidate) []candidate {
	// Input is sorted by path, so every ancestor is visited before its
	// descendants and the kept set is complete by the time a child is tested.
	kept := make(map[string]bool, len(in))
	out := make([]candidate, 0, len(in))

	for _, c := range in {
		if c.isRepo {
			kept[c.path] = true
			out = append(out, c)
			continue
		}
		if hasKeptAncestor(c.path, kept) {
			continue
		}
		kept[c.path] = true
		out = append(out, c)
	}
	return out
}

// hasKeptAncestor reports whether any parent directory of path was already
// kept, which makes path part of that entry rather than an entry of its own.
func hasKeptAncestor(path string, kept map[string]bool) bool {
	dir := filepath.Dir(path)
	for {
		if kept[dir] {
			return true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return false
		}
		dir = parent
	}
}

func projectMarkers(dir string) []string {
	var found []string
	for _, f := range markerFiles {
		if st, err := os.Stat(filepath.Join(dir, f)); err == nil && !st.IsDir() {
			found = append(found, f)
		}
	}
	if len(found) == 0 {
		return nil
	}
	for _, d := range markerDirs {
		if st, err := os.Stat(filepath.Join(dir, d)); err == nil && st.IsDir() {
			found = append(found, d+"/")
		}
	}
	return found
}

// dirStats walks one directory and returns on-disk size in KB, the newest
// source-file modification time, and any untracked-looking risky files.
//
// Size counts allocated blocks so the number matches du and therefore matches
// the space actually reclaimed. The mtime scan skips build output so freshness
// reflects human edits.
func dirStats(dir string, tracked map[string]bool) (sizeKB int64, newest time.Time, risky []string) {
	var bytesTotal int64

	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			if d != nil && d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		name := d.Name()
		if d.IsDir() {
			// .git counts toward size (it is often most of a repo) but is never
			// scanned for freshness or secrets.
			if path != dir && skipDirNames[name] && name != ".git" {
				if sz, _ := rawDirSize(path); sz > 0 {
					bytesTotal += sz
				}
				return fs.SkipDir
			}
			return nil
		}

		info, statErr := d.Info()
		if statErr != nil {
			return nil
		}
		bytesTotal += onDiskBytes(info)

		rel, relErr := filepath.Rel(dir, path)
		if relErr != nil {
			return nil
		}
		if inArtifactPath(rel) {
			return nil
		}
		if mt := info.ModTime(); mt.After(newest) {
			newest = mt
		}
		if len(risky) < maxLocalOnlyReported && isRisky(name) && !tracked[rel] {
			risky = append(risky, rel)
		}
		return nil
	})

	return bytesTotal / 1024, newest, risky
}

// rawDirSize totals a subtree that the main walk skips (node_modules and
// friends), so reported size still reflects what is on disk.
func rawDirSize(dir string) (int64, error) {
	var total int64
	err := filepath.WalkDir(dir, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			if d != nil && d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		if d.IsDir() {
			return nil
		}
		if info, e := d.Info(); e == nil {
			total += onDiskBytes(info)
		}
		return nil
	})
	return total, err
}

// onDiskBytes prefers allocated blocks (what du reports and what freeing the
// file actually returns) and falls back to apparent size.
func onDiskBytes(info os.FileInfo) int64 {
	if st, ok := info.Sys().(*syscall.Stat_t); ok && st.Blocks > 0 {
		return st.Blocks * 512
	}
	if info.Mode().IsRegular() {
		return info.Size()
	}
	return 0
}

func inArtifactPath(rel string) bool {
	for _, part := range strings.Split(rel, string(os.PathSeparator)) {
		if artifactDirNames[part] {
			return true
		}
	}
	return false
}

func isRisky(name string) bool {
	lower := strings.ToLower(name)
	for _, n := range riskyNames {
		if lower == n {
			return true
		}
	}
	if strings.HasPrefix(lower, ".env") && !strings.HasSuffix(lower, ".example") &&
		!strings.HasSuffix(lower, ".sample") && !strings.HasSuffix(lower, ".template") {
		return true
	}
	for _, s := range riskySuffixes {
		if strings.HasSuffix(lower, s) {
			return true
		}
	}
	return false
}
