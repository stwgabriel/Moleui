//go:build darwin

package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestListVolumesIncludesStartupDiskAndHidesHelperVolumes(t *testing.T) {
	volumes := listVolumes()
	if len(volumes) == 0 {
		t.Fatal("expected at least the startup volume")
	}

	// The startup volume sorts first so the switcher opens on it.
	if !volumes[0].IsRoot || volumes[0].Path != "/" {
		t.Fatalf("expected the startup volume first, got %+v", volumes[0])
	}

	for _, volume := range volumes {
		// Every /System/Volumes/* helper volume carries MNT_DONTBROWSE, as do
		// devfs, /Volumes/Recovery, the autofs home map, and installer disk
		// image mounts. None of them belong in a disk picker.
		if volume.Path != "/" && filepath.Dir(volume.Path) != "/Volumes" {
			t.Errorf("volume %q is neither the startup disk nor mounted under /Volumes", volume.Path)
		}
		if volume.Total <= 0 {
			t.Errorf("volume %q reported no capacity", volume.Path)
		}
		if volume.Used != volume.Total-volume.Free {
			t.Errorf("volume %q used (%d) does not match total-free (%d)", volume.Path, volume.Used, volume.Total-volume.Free)
		}
		if volume.Name == "" {
			t.Errorf("volume %q has no name", volume.Path)
		}
		if networkFSTypes[volume.FSType] {
			t.Errorf("volume %q is a network mount (%s) and must not be offered as a scan target", volume.Path, volume.FSType)
		}
	}
}

func TestVolumeNameUsesTheMountPointBasename(t *testing.T) {
	if got := volumeName("/Volumes/Backup HD", false); got != "Backup HD" {
		t.Errorf("volumeName = %q, want %q", got, "Backup HD")
	}
}

func TestVolumeNameForStartupDiskResolvesTheVolumesSymlink(t *testing.T) {
	// macOS leaves a symlink for the startup volume in /Volumes, which is where
	// its Finder name comes from. When that is absent we still need a label.
	name := volumeName("/", true)
	if name == "" {
		t.Fatal("startup volume has no name")
	}

	entries, err := os.ReadDir("/Volumes")
	if err != nil {
		t.Skip("cannot read /Volumes")
	}

	for _, entry := range entries {
		if entry.Type()&os.ModeSymlink == 0 {
			continue
		}
		target, err := os.Readlink(filepath.Join("/Volumes", entry.Name()))
		if err == nil && filepath.Clean(target) == "/" {
			if name != entry.Name() {
				t.Errorf("volumeName = %q, want %q from the /Volumes symlink", name, entry.Name())
			}
			return
		}
	}

	if name != "Macintosh HD" {
		t.Errorf("with no /Volumes symlink, volumeName = %q, want the %q fallback", name, "Macintosh HD")
	}
}

// The startup-volume name lookup is the only filesystem access in volumes.go,
// and it must never be able to hang the caller. An external SSD stalling on
// 2026-08-27 left an unbounded version of it wedged in open() indefinitely,
// which in the app means the disk switcher never resolves.
func TestVolumeNameForStartupDiskAlwaysReturnsPromptly(t *testing.T) {
	done := make(chan string, 1)
	start := time.Now()
	go func() {
		done <- volumeName("/", true)
	}()

	select {
	case name := <-done:
		if name == "" {
			t.Fatal("startup volume name is empty")
		}
		// Generous headroom over startupVolumeNameTimeout so a slow but healthy
		// disk does not make this flaky; the point is that it is bounded at all.
		if elapsed := time.Since(start); elapsed > 5*time.Second {
			t.Errorf("took %v, which means the deadline is not being applied", elapsed)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("volumeName(\"/\") did not return: the timeout around the /Volumes read is gone")
	}
}

// Non-root names come from the mount point string, so they must involve no I/O
// at all and cannot be affected by an unresponsive volume.
func TestVolumeNameForMountedVolumeDoesNoIO(t *testing.T) {
	if got := volumeName("/Volumes/Definitely Not Mounted 12345", false); got != "Definitely Not Mounted 12345" {
		t.Errorf("volumeName = %q, want the basename of a path that does not exist", got)
	}
}
