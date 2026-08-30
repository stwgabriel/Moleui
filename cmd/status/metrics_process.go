package main

import (
	"container/heap"
	"context"
	"fmt"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"time"
)

var collectProcessesFunc = collectProcesses

func collectProcesses() ([]ProcessInfo, error) {
	if runtime.GOOS != "darwin" {
		return nil, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	out, err := runCmd(ctx, "ps", "-Aceo", "pid=,ppid=,pcpu=,pmem=,rss=,comm=", "-r")
	if err != nil {
		out, err = runCmd(ctx, "ps", "aux")
		if err != nil {
			return nil, err
		}
		return withExecutablePaths(ctx, parsePsAuxOutput(out)), nil
	}
	return withExecutablePaths(ctx, parseProcessOutput(out)), nil
}

// withExecutablePaths fills ProcessInfo.Path from a second ps pass.
//
// The primary pass uses -c so Command holds the bare accounting name, which is
// what the dashboard prints. Dropping -c makes comm= print the full executable
// path instead, and that is the only cheap way to learn which .app bundle a PID
// belongs to. Path lookup is best effort: on failure every process keeps an
// empty Path and callers fall back to name matching.
func withExecutablePaths(ctx context.Context, procs []ProcessInfo) []ProcessInfo {
	if len(procs) == 0 {
		return procs
	}
	out, err := runCmd(ctx, "ps", "-Awwo", "pid=,comm=")
	if err != nil {
		return procs
	}
	paths := parseProcessPathOutput(out)
	if len(paths) == 0 {
		return procs
	}
	for i := range procs {
		if path, ok := paths[procs[i].PID]; ok {
			procs[i].Path = path
		}
	}
	return procs
}

// parseProcessPathOutput maps PID to executable path from `ps -o pid=,comm=`.
// Executable paths contain spaces often enough (every "/Applications/Some
// App.app/Contents/MacOS/Some App") that the remainder of the line has to be
// taken whole rather than split into fields.
func parseProcessPathOutput(raw string) map[int]string {
	paths := make(map[int]string, strings.Count(raw, "\n"))
	for line := range strings.Lines(strings.TrimSpace(raw)) {
		trimmed := strings.TrimSpace(line)
		sep := strings.IndexByte(trimmed, ' ')
		if sep <= 0 {
			continue
		}
		pid, err := strconv.Atoi(trimmed[:sep])
		if err != nil || pid <= 0 {
			continue
		}
		path := strings.TrimSpace(trimmed[sep+1:])
		if !strings.HasPrefix(path, "/") {
			continue
		}
		paths[pid] = path
	}
	return paths
}

func parseProcessOutput(raw string) []ProcessInfo {
	procs := make([]ProcessInfo, 0, strings.Count(raw, "\n"))
	for line := range strings.Lines(strings.TrimSpace(raw)) {
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}

		pid, err := strconv.Atoi(fields[0])
		if err != nil || pid <= 0 {
			continue
		}
		ppid, _ := strconv.Atoi(fields[1])
		cpuVal, err := strconv.ParseFloat(fields[2], 64)
		if err != nil {
			continue
		}
		memVal, err := strconv.ParseFloat(fields[3], 64)
		if err != nil {
			continue
		}

		memoryBytes := uint64(0)
		commandStart := 4
		if len(fields) >= 6 {
			if rssKB, err := strconv.ParseUint(fields[4], 10, 64); err == nil {
				memoryBytes = rssKB * 1024
				commandStart = 5
			}
		}

		command := strings.Join(fields[commandStart:], " ")
		if command == "" {
			continue
		}
		procs = append(procs, ProcessInfo{
			PID:         pid,
			PPID:        ppid,
			Name:        processNameFromCommand(command),
			Command:     command,
			CPU:         cpuVal,
			Memory:      memVal,
			MemoryBytes: memoryBytes,
		})
	}
	return procs
}

// parsePsAuxOutput parses the fallback "ps aux" format.
// Columns: USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND
func parsePsAuxOutput(raw string) []ProcessInfo {
	procs := make([]ProcessInfo, 0, strings.Count(raw, "\n"))
	first := true
	for line := range strings.Lines(strings.TrimSpace(raw)) {
		if first {
			first = false
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 11 {
			continue
		}
		pid, err := strconv.Atoi(fields[1])
		if err != nil || pid <= 0 {
			continue
		}
		cpuVal, err := strconv.ParseFloat(fields[2], 64)
		if err != nil {
			continue
		}
		memVal, err := strconv.ParseFloat(fields[3], 64)
		if err != nil {
			continue
		}
		memoryBytes := uint64(0)
		if rssKB, err := strconv.ParseUint(fields[5], 10, 64); err == nil {
			memoryBytes = rssKB * 1024
		}
		command := strings.Join(fields[10:], " ")
		if command == "" {
			continue
		}
		procs = append(procs, ProcessInfo{
			PID:         pid,
			PPID:        0,
			Name:        processNameFromCommand(command),
			Command:     command,
			CPU:         cpuVal,
			Memory:      memVal,
			MemoryBytes: memoryBytes,
		})
	}
	return procs
}

func processNameFromCommand(command string) string {
	name := command
	if idx := strings.LastIndex(name, "/"); idx >= 0 {
		name = name[idx+1:]
	}
	if spIdx := strings.Index(name, " "); spIdx >= 0 {
		name = name[:spIdx]
	}
	return name
}

func topProcesses(processes []ProcessInfo, limit int) []ProcessInfo {
	if limit < 0 || len(processes) == 0 {
		return nil
	}
	if limit == 0 || limit >= len(processes) {
		top := slices.Clone(processes)
		slices.SortFunc(top, func(a, b ProcessInfo) int {
			if processRanksBefore(a, b) {
				return -1
			}
			if processRanksBefore(b, a) {
				return 1
			}
			return 0
		})
		return top
	}

	h := &processHeap{}
	heap.Init(h)
	for _, proc := range processes {
		if h.Len() < limit {
			heap.Push(h, proc)
			continue
		}
		if processRanksBefore(proc, (*h)[0]) {
			heap.Pop(h)
			heap.Push(h, proc)
		}
	}

	top := make([]ProcessInfo, h.Len())
	for i := range slices.Backward(top) {
		top[i] = heap.Pop(h).(ProcessInfo)
	}
	return top
}

func formatProcessLabel(proc ProcessInfo) string {
	if proc.Name != "" {
		return fmt.Sprintf("%s (%d)", proc.Name, proc.PID)
	}
	return fmt.Sprintf("pid %d", proc.PID)
}

func processRanksBefore(a, b ProcessInfo) bool {
	if a.CPU != b.CPU {
		return a.CPU > b.CPU
	}
	if a.Memory != b.Memory {
		return a.Memory > b.Memory
	}
	return a.PID < b.PID
}

type processHeap []ProcessInfo

func (h processHeap) Len() int { return len(h) }

func (h processHeap) Less(i, j int) bool {
	return processRanksBefore(h[j], h[i])
}

func (h processHeap) Swap(i, j int) {
	h[i], h[j] = h[j], h[i]
}

func (h *processHeap) Push(x any) {
	*h = append(*h, x.(ProcessInfo))
}

func (h *processHeap) Pop() any {
	old := *h
	n := len(old)
	x := old[n-1]
	*h = old[:n-1]
	return x
}
