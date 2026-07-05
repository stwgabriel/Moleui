//go:build darwin

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
)

func writeFileWithSize(t testing.TB, path string, size int) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}
	content := make([]byte, size)
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func TestShouldFoldDirWithPathFoldsEggInfo(t *testing.T) {
	cases := map[string]bool{
		"mypkg.egg-info":   true, // package-specific egg-info dir, matched by suffix
		"another.egg-info": true,
		"node_modules":     true, // exact-match fold entry
		"src":              false,
		"egg-info":         false, // no leading dot, not a real egg-info dir name
	}
	for name, want := range cases {
		if got := shouldFoldDirWithPath(name, "/tmp/project/"+name); got != want {
			t.Errorf("shouldFoldDirWithPath(%q) = %v, want %v", name, got, want)
		}
	}
}

func TestFoldedDirSizeCacheRoundTrip(t *testing.T) {
	// getCacheDir resolves under $HOME/.cache/mole; isolate it per test.
	t.Setenv("HOME", t.TempDir())

	dir := t.TempDir()

	// Nothing cached yet.
	if size, ok := foldedDirSizeFromCache(dir, true); ok {
		t.Fatalf("expected cache miss, got size=%d ok=%v", size, ok)
	}

	const want int64 = 4096 * 1024
	storeFoldedDirSize(dir, want)

	if size, ok := foldedDirSizeFromCache(dir, true); !ok || size != want {
		t.Fatalf("foldedDirSizeFromCache = (%d, %v), want (%d, true)", size, ok, want)
	}

	// useCache=false must always miss so fresh scans recompute.
	if size, ok := foldedDirSizeFromCache(dir, false); ok {
		t.Fatalf("expected miss with useCache=false, got size=%d", size)
	}

	// Non-positive sizes are never persisted.
	other := t.TempDir()
	storeFoldedDirSize(other, 0)
	if _, ok := foldedDirSizeFromCache(other, true); ok {
		t.Fatalf("expected no cache entry for zero-size store")
	}
}

func TestFoldedDirCacheScanValueEquivalence(t *testing.T) {
	// Isolate the on-disk analyzer cache.
	t.Setenv("HOME", t.TempDir())

	root := t.TempDir()
	// A folded child (node_modules) plus a normal child, on a static tree so
	// the only between-run difference would be a caching bug.
	writeFileWithSize(t, filepath.Join(root, "node_modules", "pkg", "big.bin"), 512*1024)
	writeFileWithSize(t, filepath.Join(root, "node_modules", "small.txt"), 4*1024)
	writeFileWithSize(t, filepath.Join(root, "docs", "readme.md"), 8*1024)

	scan := func() scanResult {
		var f, d, b int64
		cur := &atomic.Value{}
		cur.Store("")
		res, err := scanPathConcurrentAllEntries(root, &f, &d, &b, cur)
		if err != nil {
			t.Fatalf("scan: %v", err)
		}
		return res
	}

	first := scan() // populates the folded cache
	second := scan()

	if first.TotalSize != second.TotalSize {
		t.Fatalf("total size changed across cached scans: %d -> %d", first.TotalSize, second.TotalSize)
	}

	sizeOf := func(res scanResult, name string) (int64, bool) {
		for _, e := range res.Entries {
			if e.Name == name {
				return e.Size, true
			}
		}
		return 0, false
	}
	fs, ok1 := sizeOf(first, "node_modules")
	ss, ok2 := sizeOf(second, "node_modules")
	if !ok1 || !ok2 {
		t.Fatalf("node_modules entry missing: first=%v second=%v", ok1, ok2)
	}
	if fs != ss || fs <= 0 {
		t.Fatalf("folded node_modules size mismatch: %d vs %d", fs, ss)
	}
}

func TestGetDirectoryLogicalSizeWithExclude(t *testing.T) {
	base := t.TempDir()
	homeFile := filepath.Join(base, "fileA")
	libFile := filepath.Join(base, "Library", "fileB")
	projectLibFile := filepath.Join(base, "Projects", "Library", "fileC")

	writeFileWithSize(t, homeFile, 100)
	writeFileWithSize(t, libFile, 200)
	writeFileWithSize(t, projectLibFile, 300)

	total, err := getDirectoryLogicalSizeWithExclude(base, "")
	if err != nil {
		t.Fatalf("getDirectoryLogicalSizeWithExclude (no exclude) error: %v", err)
	}
	if total != 600 {
		t.Fatalf("expected total 600 bytes, got %d", total)
	}

	excluding, err := getDirectoryLogicalSizeWithExclude(base, filepath.Join(base, "Library"))
	if err != nil {
		t.Fatalf("getDirectoryLogicalSizeWithExclude (exclude Library) error: %v", err)
	}
	if excluding != 400 {
		t.Fatalf("expected 400 bytes when excluding top-level Library, got %d", excluding)
	}
}

func TestGetDirectorySizeFromDuSkippingImmediateChildDoesNotMeasureExcludedPath(t *testing.T) {
	base := t.TempDir()
	excluded := filepath.Join(base, "Library")
	included := filepath.Join(base, "Documents")
	if err := os.MkdirAll(excluded, 0o755); err != nil {
		t.Fatalf("mkdir excluded: %v", err)
	}
	if err := os.MkdirAll(included, 0o755); err != nil {
		t.Fatalf("mkdir included: %v", err)
	}

	var measured []string
	size, err := getDirectorySizeFromDuSkippingImmediateChild(base, excluded, func(path string) (int64, error) {
		measured = append(measured, path)
		return 100, nil
	})
	if err != nil {
		t.Fatalf("getDirectorySizeFromDuSkippingImmediateChild: %v", err)
	}
	if size < 100 {
		t.Fatalf("expected included directory size in total, got %d", size)
	}
	if len(measured) != 1 || measured[0] != included {
		t.Fatalf("expected to measure only %s, measured %#v", included, measured)
	}
}

func TestGetDirectorySizeFromDuWithIgnoresSkipsCloudPlaceholderTree(t *testing.T) {
	base := t.TempDir()
	writeFileWithSize(t, filepath.Join(base, "Application Support", "state.dat"), 4096)
	writeFileWithSize(t, filepath.Join(base, "Mobile Documents", "cloud.dat"), 1024*1024)

	withoutIgnore, err := getDirectorySizeFromDuWithExcludeAndIgnores(base, "", nil)
	if err != nil {
		t.Fatalf("getDirectorySizeFromDuWithExcludeAndIgnores without ignore: %v", err)
	}
	withIgnore, err := getDirectorySizeFromDuWithExcludeAndIgnores(base, "", []string{"Mobile Documents"})
	if err != nil {
		t.Fatalf("getDirectorySizeFromDuWithExcludeAndIgnores with ignore: %v", err)
	}
	if withIgnore >= withoutIgnore {
		t.Fatalf("expected ignored Mobile Documents to reduce size, got ignored=%d without=%d", withIgnore, withoutIgnore)
	}
	if withIgnore <= 0 {
		t.Fatalf("expected non-zero size for included files, got %d", withIgnore)
	}
}

func TestValidateDuIgnoreNameRejectsPathPatterns(t *testing.T) {
	for _, name := range []string{"", "../Library", "Library/Developer", "bad\x00name"} {
		if err := validateDuIgnoreName(name); err == nil {
			t.Fatalf("expected %q to be rejected", name)
		}
	}
	if err := validateDuIgnoreName("Mobile Documents"); err != nil {
		t.Fatalf("expected basename ignore to be accepted: %v", err)
	}
}

func BenchmarkGetDirectorySizeFromDuWithExcludeHomeLibrary(b *testing.B) {
	base := b.TempDir()
	libraryDir := filepath.Join(base, "Library")
	for dirIdx := range 250 {
		for fileIdx := range 20 {
			writeFileWithSize(
				b,
				filepath.Join(libraryDir, "bulk", fmt.Sprintf("dir-%03d", dirIdx), "bucket", fmt.Sprintf("file-%03d.dat", fileIdx)),
				16,
			)
		}
	}
	writeFileWithSize(b, filepath.Join(base, "Documents", "keep.dat"), 4096)

	excludePath := filepath.Join(base, "Library")
	b.ReportAllocs()
	b.ResetTimer()

	for b.Loop() {
		size, err := getDirectorySizeFromDuWithExclude(base, excludePath)
		if err != nil {
			b.Fatalf("getDirectorySizeFromDuWithExclude: %v", err)
		}
		if size <= 0 {
			b.Fatalf("expected non-zero size, got %d", size)
		}
	}
}
