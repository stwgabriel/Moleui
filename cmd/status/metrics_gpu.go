package main

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const (
	systemProfilerTimeout = 4 * time.Second
	macGPUInfoTTL         = 10 * time.Minute
	macGPUUsageTTL        = 1 * time.Second
	ioregGPUTimeout       = 600 * time.Millisecond
	powermetricsTimeout   = 2 * time.Second
)

// Regex for GPU usage parsing.
var (
	gpuActiveResidencyRe = regexp.MustCompile(`GPU HW active residency:\s+([\d.]+)%`)
	gpuIdleResidencyRe   = regexp.MustCompile(`GPU idle residency:\s+([\d.]+)%`)
	gpuTemperatureRe     = regexp.MustCompile(`(?i)GPU(?:\s+die)?\s+temperature:\s+([\d.]+)\s*C`)
	gpuIORegMetricRe     = regexp.MustCompile(`"(Device|Renderer|Tiler) Utilization %"\s*=\s*([\d.]+)`)
)

func (c *Collector) collectGPU(now time.Time) ([]GPUStatus, error) {
	if runtime.GOOS == "darwin" {
		// Static GPU info (cached 10 min).
		if len(c.cachedGPU) == 0 || c.lastGPUAt.IsZero() || now.Sub(c.lastGPUAt) >= macGPUInfoTTL {
			if gpus, err := readMacGPUInfo(); err == nil && len(gpus) > 0 {
				c.cachedGPU = gpus
				c.lastGPUAt = now
			}
		}

		// Real-time GPU usage.
		if len(c.cachedGPU) > 0 {
			usage := c.getMacGPUUsage(now)
			result := make([]GPUStatus, len(c.cachedGPU))
			copy(result, c.cachedGPU)
			// Apply usage to first GPU (Apple Silicon).
			if len(result) > 0 {
				result[0].Usage = usage
			}
			return result, nil
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 600*time.Millisecond)
	defer cancel()

	if !commandExists("nvidia-smi") {
		return []GPUStatus{{
			Name: "No GPU metrics available",
			Note: "Install nvidia-smi or use platform-specific metrics",
		}}, nil
	}

	out, err := runCmd(ctx, "nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total,name", "--format=csv,noheader,nounits")
	if err != nil {
		return nil, err
	}

	var gpus []GPUStatus
	for line := range strings.Lines(strings.TrimSpace(out)) {
		fields := strings.Split(line, ",")
		if len(fields) < 4 {
			continue
		}
		util, _ := strconv.ParseFloat(strings.TrimSpace(fields[0]), 64)
		memUsed, _ := strconv.ParseFloat(strings.TrimSpace(fields[1]), 64)
		memTotal, _ := strconv.ParseFloat(strings.TrimSpace(fields[2]), 64)
		name := strings.TrimSpace(fields[3])

		gpus = append(gpus, GPUStatus{
			Name:        name,
			Usage:       util,
			MemoryUsed:  memUsed,
			MemoryTotal: memTotal,
		})
	}

	if len(gpus) == 0 {
		return []GPUStatus{{
			Name: "GPU read failed",
			Note: "Verify nvidia-smi availability",
		}}, nil
	}

	return gpus, nil
}

func readMacGPUInfo() ([]GPUStatus, error) {
	ctx, cancel := context.WithTimeout(context.Background(), systemProfilerTimeout)
	defer cancel()

	if !commandExists("system_profiler") {
		return nil, errors.New("system_profiler unavailable")
	}

	out, err := runCmd(ctx, "system_profiler", "-json", "SPDisplaysDataType")
	if err != nil {
		return nil, err
	}

	var data struct {
		Displays []struct {
			Name       string `json:"_name"`
			Model      string `json:"sppci_model"`
			VRAM       string `json:"spdisplays_vram"`
			Vendor     string `json:"spdisplays_vendor"`
			Metal      string `json:"spdisplays_metal"`
			MetalGPU   string `json:"spdisplays_mtlgpufamilysupport"`
			Cores      string `json:"sppci_cores"`
			DeviceType string `json:"sppci_device_type"`
		} `json:"SPDisplaysDataType"`
	}
	if err := json.Unmarshal([]byte(out), &data); err != nil {
		return nil, err
	}

	var gpus []GPUStatus
	for _, d := range data.Displays {
		name := strings.TrimSpace(d.Model)
		if name == "" {
			name = strings.TrimSpace(d.Name)
		}
		if name == "" || (d.DeviceType != "" && d.DeviceType != "spdisplays_gpu") {
			continue
		}
		coreCount, _ := strconv.Atoi(d.Cores)
		metal := normalizeMacProfilerToken(firstNonEmpty(d.MetalGPU, d.Metal))
		vendor := normalizeMacProfilerToken(d.Vendor)

		noteParts := []string{}
		if d.VRAM != "" {
			noteParts = append(noteParts, "VRAM "+d.VRAM)
		}
		if metal != "" {
			noteParts = append(noteParts, metal)
		}
		if vendor != "" {
			noteParts = append(noteParts, vendor)
		}
		note := strings.Join(noteParts, " · ")
		gpus = append(gpus, GPUStatus{
			Name:      formatMacGPUName(name, coreCount),
			Usage:     -1, // Will be updated with real-time data
			CoreCount: coreCount,
			Note:      note,
		})
	}

	if len(gpus) == 0 {
		return []GPUStatus{{
			Name: "GPU info unavailable",
			Note: "Unable to parse system_profiler output",
		}}, nil
	}

	return gpus, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func formatMacGPUName(name string, coreCount int) string {
	name = strings.TrimSpace(name)
	if coreCount <= 0 || strings.Contains(strings.ToLower(name), "gpu") {
		return name
	}
	return name + " " + strconv.Itoa(coreCount) + "-core GPU"
}

func normalizeMacProfilerToken(value string) string {
	value = strings.TrimSpace(value)
	switch {
	case value == "sppci_vendor_Apple":
		return "Apple"
	case strings.HasPrefix(value, "spdisplays_metal"):
		version := strings.TrimPrefix(value, "spdisplays_metal")
		if version == "" {
			return "Metal"
		}
		return "Metal " + version
	default:
		return value
	}
}

func (c *Collector) getMacGPUUsage(now time.Time) float64 {
	if !c.lastGPUUsageAt.IsZero() && now.Sub(c.lastGPUUsageAt) < macGPUUsageTTL {
		return c.cachedGPUUsage
	}

	usage := getMacGPUUsage()
	c.cachedGPUUsage = usage
	c.lastGPUUsageAt = now
	return usage
}

// getMacGPUUsage prefers non-privileged IORegistry utilization and falls back to powermetrics.
func getMacGPUUsage() float64 {
	if usage := getMacIORegGPUUsage(); usage >= 0 {
		return usage
	}

	ctx, cancel := context.WithTimeout(context.Background(), powermetricsTimeout)
	defer cancel()

	// powermetrics may require root.
	out, err := runCmd(ctx, "powermetrics", "--samplers", "gpu_power", "-i", "500", "-n", "1")
	if err != nil {
		return -1
	}

	// Parse "GPU HW active residency: X.XX%".
	matches := gpuActiveResidencyRe.FindStringSubmatch(out)
	if len(matches) >= 2 {
		usage, err := strconv.ParseFloat(matches[1], 64)
		if err == nil {
			return usage
		}
	}

	// Fallback: parse idle residency and derive active.
	matchesIdle := gpuIdleResidencyRe.FindStringSubmatch(out)
	if len(matchesIdle) >= 2 {
		idle, err := strconv.ParseFloat(matchesIdle[1], 64)
		if err == nil {
			return 100.0 - idle
		}
	}

	return -1
}

func getMacIORegGPUUsage() float64 {
	ctx, cancel := context.WithTimeout(context.Background(), ioregGPUTimeout)
	defer cancel()

	if !commandExists("ioreg") {
		return -1
	}

	out, err := runCmd(ctx, "ioreg", "-r", "-c", "IOAccelerator", "-d", "1", "-l")
	if err != nil {
		return -1
	}

	return parseMacIORegGPUUsage(out)
}

func parseMacIORegGPUUsage(raw string) float64 {
	matches := gpuIORegMetricRe.FindAllStringSubmatch(raw, -1)
	if len(matches) == 0 {
		return -1
	}

	bestFallback := -1.0
	for _, match := range matches {
		if len(match) < 3 {
			continue
		}
		value, err := strconv.ParseFloat(match[2], 64)
		if err != nil {
			continue
		}
		value = clampPercent(value)
		if match[1] == "Device" {
			return value
		}
		if value > bestFallback {
			bestFallback = value
		}
	}

	return bestFallback
}

func clampPercent(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return value
}

func getMacGPUTemperature() float64 {
	if runtime.GOOS != "darwin" || !commandExists("powermetrics") {
		return 0
	}

	ctx, cancel := context.WithTimeout(context.Background(), 700*time.Millisecond)
	defer cancel()

	out, err := runCmd(ctx, "powermetrics", "--samplers", "smc", "-i", "250", "-n", "1")
	if err != nil {
		return 0
	}

	matches := gpuTemperatureRe.FindStringSubmatch(out)
	if len(matches) < 2 {
		return 0
	}

	temp, err := strconv.ParseFloat(matches[1], 64)
	if err != nil || temp <= 0 || temp > 150 {
		return 0
	}
	return temp
}
