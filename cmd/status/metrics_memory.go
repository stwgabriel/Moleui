package main

import (
	"context"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v4/mem"
)

func collectMemory() (MemoryStatus, error) {
	return collectMemoryWithOptions(true)
}

func collectMemoryFast() (MemoryStatus, error) {
	return collectMemoryWithOptions(false)
}

func collectMemoryWithOptions(includeSlowAnnotations bool) (MemoryStatus, error) {
	vm, err := mem.VirtualMemory()
	if err != nil {
		return MemoryStatus{}, err
	}

	swap, _ := mem.SwapMemory()
	if swap == nil {
		swap = &mem.SwapMemoryStat{}
	}
	var pressure string
	if includeSlowAnnotations {
		pressure = getMemoryPressure()
	}

	// One vm_stat run answers both questions, so read it once and share it.
	var stats vmStatCounters
	if includeSlowAnnotations && runtime.GOOS == "darwin" {
		stats = readVMStat()
	}

	// On macOS, vm.Cached is 0, so we calculate from file-backed pages.
	cached := vm.Cached
	if cached == 0 {
		cached = stats.fileBackedBytes
	}

	return MemoryStatus{
		Used:         vm.Used,
		Total:        vm.Total,
		Available:    vm.Available,
		UsedPercent:  vm.UsedPercent,
		SwapUsed:     swap.Used,
		SwapTotal:    swap.Total,
		Cached:       cached,
		Pressure:     pressure,
		PageInBytes:  stats.pageInBytes,
		PageOutBytes: stats.pageOutBytes,
	}, nil
}

type vmStatCounters struct {
	fileBackedBytes uint64
	// Cumulative since boot. Paging is the only read/write traffic the kernel
	// attributes to memory itself, so it is what a memory throughput graph can
	// honestly plot.
	pageInBytes  uint64
	pageOutBytes uint64
}

func readVMStat() vmStatCounters {
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	out, err := runCmd(ctx, "vm_stat")
	if err != nil {
		return vmStatCounters{}
	}

	// Parse page size from first line: "Mach Virtual Memory Statistics: (page size of 16384 bytes)"
	var counters vmStatCounters
	var pageSize uint64 = 4096 // Default
	firstLine := true
	for line := range strings.Lines(out) {
		if firstLine {
			firstLine = false
			if strings.Contains(line, "page size of") {
				if _, after, found := strings.Cut(line, "page size of "); found {
					if before, _, found := strings.Cut(after, " bytes"); found {
						if size, err := strconv.ParseUint(strings.TrimSpace(before), 10, 64); err == nil {
							pageSize = size
						}
					}
				}
			}
		}

		// Lines look like "File-backed pages:              388975."
		label, after, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		pages, err := strconv.ParseUint(strings.TrimSuffix(strings.TrimSpace(after), "."), 10, 64)
		if err != nil {
			continue
		}

		switch strings.TrimSpace(label) {
		case "File-backed pages":
			counters.fileBackedBytes = pages * pageSize
		case "Pageins":
			counters.pageInBytes = pages * pageSize
		case "Pageouts":
			counters.pageOutBytes = pages * pageSize
		}
	}
	return counters
}

func getMemoryPressure() string {
	if runtime.GOOS != "darwin" {
		return ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	out, err := runCmd(ctx, "memory_pressure")
	if err != nil {
		return ""
	}
	lower := strings.ToLower(out)
	if strings.Contains(lower, "critical") {
		return "critical"
	}
	if strings.Contains(lower, "warn") {
		return "warn"
	}
	if strings.Contains(lower, "normal") {
		return "normal"
	}
	return ""
}
