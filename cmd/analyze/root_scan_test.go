//go:build darwin

package main

import (
	"os"
	"sync/atomic"
	"testing"
)

func TestIsFirmlinkVolumesDir(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		{"/System/Volumes", true},
		{"/System/Volumes/", true},
		{"/System/Volumes/Data", false},
		{"/Volumes", false},
		{"/Users/example/System/Volumes", false},
	}

	for _, tc := range cases {
		if got := isFirmlinkVolumesDir(tc.path); got != tc.want {
			t.Errorf("isFirmlinkVolumesDir(%q) = %v, want %v", tc.path, got, tc.want)
		}
	}
}

// A scan of "/" must cover the OS, not just the parts of it that walk cheaply.
// Before rootSizeOnlyDirs, /System and /private were skipped outright, which on
// a stock macOS 15 install left roughly 33 GB of used space out of the total
// with nothing in the output to show it was missing.
func TestRootScanCoversTheSystemDirectories(t *testing.T) {
	if _, err := os.Stat("/System/Library"); err != nil {
		t.Skip("not a standard macOS root")
	}

	var files, dirs, bytes int64
	current := &atomic.Value{}
	current.Store("")

	result, err := scanPathConcurrentAllEntries("/", &files, &dirs, &bytes, current)
	if err != nil {
		t.Fatalf("scan of / failed: %v", err)
	}

	sizes := make(map[string]int64, len(result.Entries))
	for _, entry := range result.Entries {
		sizes[entry.Path] = entry.Size
	}

	for _, path := range []string{"/System", "/private", "/Applications", "/Users", "/Library"} {
		if _, ok := sizes[path]; !ok {
			t.Errorf("root scan is missing %s", path)
		}
	}

	// /System is only ~19 GB once the firmlinked data volume is excluded. If the
	// exclusion breaks, this entry balloons past the whole data volume because
	// /System/Volumes/Data re-counts /Users, /Applications and /Library.
	if systemSize := sizes["/System"]; systemSize > 0 {
		if usersSize := sizes["/Users"]; usersSize > 0 && systemSize > usersSize {
			t.Errorf("/System (%d) is larger than /Users (%d): the /System/Volumes exclusion is not holding", systemSize, usersSize)
		}
	}

	// The compatibility symlinks at "/" point into private/ and the data volume,
	// so they duplicate real entries and add nothing but noise.
	for _, path := range []string{"/var", "/tmp", "/etc", "/home", "/.file", "/dev", "/Volumes"} {
		if _, ok := sizes[path]; ok {
			t.Errorf("root scan should not list %s", path)
		}
	}
}

func TestRootSizeOnlyAndSkipListsDoNotOverlap(t *testing.T) {
	for name := range rootSizeOnlyDirs {
		if skipSystemDirs[name] {
			t.Errorf("%q is both size-only and skipped at root; the skip wins and the bytes go missing", name)
		}
	}
}
