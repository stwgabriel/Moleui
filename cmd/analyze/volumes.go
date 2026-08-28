//go:build darwin

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// jsonVolume describes one mounted volume the user can browse.
type jsonVolume struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	FSType   string `json:"fs_type"`
	Total    int64  `json:"total"`
	Free     int64  `json:"free"`
	Used     int64  `json:"used"`
	IsRoot   bool   `json:"is_root"`
	ReadOnly bool   `json:"read_only"`
}

type jsonVolumesOutput struct {
	Volumes []jsonVolume `json:"volumes"`
}

// networkFSTypes names filesystems that must never be offered as a scan target.
// Walking a network mount blocks on the network for as long as the server takes
// to answer, which is the same hazard defaultSkipDirs already encodes for VM
// and container mounts.
var networkFSTypes = map[string]bool{
	"smbfs":   true,
	"nfs":     true,
	"afpfs":   true,
	"webdav":  true,
	"ftp":     true,
	"autofs":  true,
	"osxfuse": true,
}

func runVolumesMode() {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(jsonVolumesOutput{Volumes: listVolumes()}); err != nil {
		fmt.Fprintf(os.Stderr, "failed to encode JSON: %v\n", err)
		os.Exit(1)
	}
}

// listVolumes returns the browsable volumes, startup disk first, then the rest
// by descending capacity.
//
// The filter that does the real work is MNT_DONTBROWSE. macOS sets it on every
// mount Finder hides, which on a stock machine is devfs, all eight
// /System/Volumes/* helper volumes (Data, VM, Preboot, Recovery, Update, xarts,
// iSCPreboot, Hardware), /Volumes/Recovery, the autofs home map, and disk image
// mounts made by installers. Enumerating without it produced fifteen rows on
// the test machine where two are meaningful.
//
// "/" is kept even though it is read-only: on APFS the startup volume is sealed
// and mounted read-only, with the writable data volume firmlinked underneath.
func listVolumes() []jsonVolume {
	count, err := unix.Getfsstat(nil, unix.MNT_NOWAIT)
	if err != nil {
		return nil
	}

	stats := make([]unix.Statfs_t, count)
	count, err = unix.Getfsstat(stats, unix.MNT_NOWAIT)
	if err != nil {
		return nil
	}

	volumes := make([]jsonVolume, 0, count)
	for _, stat := range stats[:count] {
		mountPoint := cString(stat.Mntonname[:])
		fsType := cString(stat.Fstypename[:])
		isRoot := mountPoint == "/"

		if mountPoint == "" || networkFSTypes[fsType] {
			continue
		}
		if stat.Flags&unix.MNT_LOCAL == 0 {
			continue
		}
		if stat.Flags&unix.MNT_DONTBROWSE != 0 {
			continue
		}
		if stat.Flags&unix.MNT_RDONLY != 0 && !isRoot {
			continue
		}

		blockSize := int64(stat.Bsize)
		total := int64(stat.Blocks) * blockSize
		free := int64(stat.Bavail) * blockSize
		if total <= 0 {
			continue
		}

		volumes = append(volumes, jsonVolume{
			Name:     volumeName(mountPoint, isRoot),
			Path:     mountPoint,
			FSType:   fsType,
			Total:    total,
			Free:     free,
			Used:     max(0, total-free),
			IsRoot:   isRoot,
			ReadOnly: stat.Flags&unix.MNT_RDONLY != 0,
		})
	}

	sort.SliceStable(volumes, func(i, j int) bool {
		if volumes[i].IsRoot != volumes[j].IsRoot {
			return volumes[i].IsRoot
		}
		return volumes[i].Total > volumes[j].Total
	})

	return volumes
}

// startupVolumeNameTimeout bounds the only filesystem access in this file.
//
// Reading /Volumes can block forever. A disconnected share, or an external disk
// that stalls or is pulled without ejecting, leaves a mount whose open() never
// returns, and the whole directory becomes unreadable: plain `ls /Volumes` hangs
// with it. Hit for real on 2026-08-27, when an external SSD stalled and left
// `analyze-go --volumes` wedged in __open with no way out, which in the app means
// the disk switcher never resolves and every attempt leaks a stuck process.
//
// Everything else here reads the kernel mount table through Getfsstat, which
// does no I/O and cannot block, so this is the one call that needs a deadline.
const startupVolumeNameTimeout = 400 * time.Millisecond

const fallbackStartupVolumeName = "Macintosh HD"

// volumeName resolves the label the user sees in Finder. Non-root volumes are
// mounted at /Volumes/<name>, so the basename is already right and costs no I/O.
//
// The startup volume has no such mount point. macOS leaves a symlink for it in
// /Volumes ("/Volumes/Mac SSD -> /"), which is the cheapest way to read its real
// name, but see the timeout above for why that lookup cannot be trusted to
// return. A generic name beats a hung disk switcher.
func volumeName(mountPoint string, isRoot bool) string {
	if !isRoot {
		if name := filepath.Base(mountPoint); name != "" && name != "/" && name != "." {
			return name
		}
		return mountPoint
	}

	// Buffered so the goroutine can always finish its send and be collected,
	// even after this function has given up waiting.
	resolved := make(chan string, 1)
	go func() {
		resolved <- startupVolumeNameFromVolumesDir()
	}()

	select {
	case name := <-resolved:
		if name != "" {
			return name
		}
	case <-time.After(startupVolumeNameTimeout):
		// Goroutine stays blocked in the kernel; Go tears it down on exit.
	}

	return fallbackStartupVolumeName
}

func startupVolumeNameFromVolumesDir() string {
	entries, err := os.ReadDir("/Volumes")
	if err != nil {
		return ""
	}

	for _, entry := range entries {
		if entry.Type()&os.ModeSymlink == 0 {
			continue
		}
		target, err := os.Readlink(filepath.Join("/Volumes", entry.Name()))
		if err == nil && filepath.Clean(target) == "/" {
			return entry.Name()
		}
	}

	return ""
}

func cString(raw []byte) string {
	if index := strings.IndexByte(string(raw), 0); index >= 0 {
		return string(raw[:index])
	}
	return string(raw)
}
