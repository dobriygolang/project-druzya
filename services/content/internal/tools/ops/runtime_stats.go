package ops

import "runtime"

// RuntimeStats is in-process resource usage for ops dashboards.
type RuntimeStats struct {
	MemoryAllocBytes uint64
	MemorySysBytes   uint64
	Goroutines       int
	HTTPRPS          float64
}

// CollectRuntimeStats snapshots process memory, goroutines and HTTP throughput.
func CollectRuntimeStats() RuntimeStats {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	return RuntimeStats{
		MemoryAllocBytes: ms.Alloc,
		MemorySysBytes:   ms.Sys,
		Goroutines:       runtime.NumGoroutine(),
		HTTPRPS:          HTTPRPS(),
	}
}
