package main

import "testing"

func TestParseMacIORegGPUUsageUsesDeviceUtilization(t *testing.T) {
	raw := `+-o AGXAcceleratorG16G  <class AGXAcceleratorG16G, id 0x1000004f9, registered, matched, active, busy 0 (5515 ms), retain 81>
    {
      "PerformanceStatistics" = {"In use system memory (driver)"=0,"Alloc system memory"=7524302848,"Tiler Utilization %"=88,"Renderer Utilization %"=87,"Device Utilization %"=88,"SplitSceneCount"=0}
    }`

	got := parseMacIORegGPUUsage(raw)
	if got != 88 {
		t.Fatalf("parseMacIORegGPUUsage() = %v, want 88", got)
	}
}

func TestParseMacIORegGPUUsageFallsBackToRendererAndTiler(t *testing.T) {
	raw := `+-o AGXAcceleratorG16G  <class AGXAcceleratorG16G, id 0x1000004f9, registered, matched, active, busy 0 (5515 ms), retain 81>
    {
      "PerformanceStatistics" = {"In use system memory (driver)"=0,"Tiler Utilization %"=42,"Renderer Utilization %"=51}
    }`

	got := parseMacIORegGPUUsage(raw)
	if got != 51 {
		t.Fatalf("parseMacIORegGPUUsage() = %v, want 51", got)
	}
}

func TestParseMacIORegGPUUsageReturnsUnavailableForMissingStats(t *testing.T) {
	got := parseMacIORegGPUUsage(`+-o AGXAcceleratorG16G {}`)
	if got != -1 {
		t.Fatalf("parseMacIORegGPUUsage() = %v, want -1", got)
	}
}
