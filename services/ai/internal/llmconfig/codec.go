package llmconfig

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
)

type storedVirtualCandidate struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

type storedConfig struct {
	ChainOrder    []string                          `json:"chain_order,omitempty"`
	TaskMap       map[string]map[string]string      `json:"task_map,omitempty"`
	VirtualChains map[string][]storedVirtualCandidate `json:"virtual_chains,omitempty"`
}

// DecodeStored parses DB JSON into RuntimeConfig.
func DecodeStored(version int64, raw []byte) (*llmchain.RuntimeConfig, error) {
	if len(raw) == 0 || string(raw) == "{}" {
		return &llmchain.RuntimeConfig{Version: version}, nil
	}
	var stored storedConfig
	if err := json.Unmarshal(raw, &stored); err != nil {
		return nil, fmt.Errorf("decode llm config: %w", err)
	}
	out := &llmchain.RuntimeConfig{Version: version}
	if len(stored.ChainOrder) > 0 {
		out.ChainOrder = make([]llmchain.Provider, 0, len(stored.ChainOrder))
		for _, p := range stored.ChainOrder {
			if p = trim(p); p != "" {
				out.ChainOrder = append(out.ChainOrder, llmchain.Provider(p))
			}
		}
	}
	if len(stored.TaskMap) > 0 {
		out.TaskMap = make(llmchain.TaskModelMap, len(stored.TaskMap))
		for task, providers := range stored.TaskMap {
			out.TaskMap[llmchain.Task(task)] = make(map[llmchain.Provider]string, len(providers))
			for provider, model := range providers {
				out.TaskMap[llmchain.Task(task)][llmchain.Provider(provider)] = model
			}
		}
	}
	if len(stored.VirtualChains) > 0 {
		out.VirtualChains = make(map[string][]llmchain.VirtualCandidate, len(stored.VirtualChains))
		for id, items := range stored.VirtualChains {
			candidates := make([]llmchain.VirtualCandidate, 0, len(items))
			for _, item := range items {
				candidates = append(candidates, llmchain.VirtualCandidate{
					Provider: llmchain.Provider(item.Provider),
					Model:    item.Model,
				})
			}
			out.VirtualChains[id] = candidates
		}
	}
	return out, nil
}

// EncodeStored serializes RuntimeConfig overrides to DB JSON.
func EncodeStored(cfg *llmchain.RuntimeConfig) ([]byte, error) {
	if cfg == nil {
		return []byte("{}"), nil
	}
	stored := storedConfig{}
	if len(cfg.ChainOrder) > 0 {
		stored.ChainOrder = make([]string, 0, len(cfg.ChainOrder))
		for _, p := range cfg.ChainOrder {
			stored.ChainOrder = append(stored.ChainOrder, string(p))
		}
	}
	if len(cfg.TaskMap) > 0 {
		stored.TaskMap = make(map[string]map[string]string, len(cfg.TaskMap))
		for task, providers := range cfg.TaskMap {
			stored.TaskMap[string(task)] = make(map[string]string, len(providers))
			for provider, model := range providers {
				stored.TaskMap[string(task)][string(provider)] = model
			}
		}
	}
	if len(cfg.VirtualChains) > 0 {
		stored.VirtualChains = make(map[string][]storedVirtualCandidate, len(cfg.VirtualChains))
		for id, items := range cfg.VirtualChains {
			candidates := make([]storedVirtualCandidate, 0, len(items))
			for _, item := range items {
				candidates = append(candidates, storedVirtualCandidate{
					Provider: string(item.Provider),
					Model:    item.Model,
				})
			}
			stored.VirtualChains[id] = candidates
		}
	}
	raw, err := json.Marshal(stored)
	if err != nil {
		return nil, fmt.Errorf("encode llm config: %w", err)
	}
	return raw, nil
}

// View is the admin-facing LLM config snapshot.
type View struct {
	Version            int64
	ChainOrder         []string
	TaskMapJSON        string
	VirtualChainsJSON  string
}

// ViewFromRuntime maps runtime config to admin view.
func ViewFromRuntime(cfg *llmchain.RuntimeConfig) View {
	if cfg == nil {
		return View{}
	}
	out := View{Version: cfg.Version}
	if len(cfg.ChainOrder) > 0 {
		out.ChainOrder = make([]string, 0, len(cfg.ChainOrder))
		for _, p := range cfg.ChainOrder {
			out.ChainOrder = append(out.ChainOrder, string(p))
		}
	}
	if len(cfg.TaskMap) > 0 {
		stored := storedConfig{TaskMap: make(map[string]map[string]string, len(cfg.TaskMap))}
		for task, providers := range cfg.TaskMap {
			stored.TaskMap[string(task)] = make(map[string]string, len(providers))
			for provider, model := range providers {
				stored.TaskMap[string(task)][string(provider)] = model
			}
		}
		if raw, err := json.Marshal(stored.TaskMap); err == nil {
			out.TaskMapJSON = string(raw)
		}
	}
	if len(cfg.VirtualChains) > 0 {
		stored := make(map[string][]storedVirtualCandidate, len(cfg.VirtualChains))
		for id, items := range cfg.VirtualChains {
			candidates := make([]storedVirtualCandidate, 0, len(items))
			for _, item := range items {
				candidates = append(candidates, storedVirtualCandidate{
					Provider: string(item.Provider),
					Model:    item.Model,
				})
			}
			stored[id] = candidates
		}
		if raw, err := json.Marshal(stored); err == nil {
			out.VirtualChainsJSON = string(raw)
		}
	}
	return out
}

// RuntimeFromUpdate parses admin update payload.
func RuntimeFromUpdate(version int64, chainOrder []string, taskMapJSON, virtualChainsJSON string) (*llmchain.RuntimeConfig, error) {
	cfg := &llmchain.RuntimeConfig{Version: version}
	if len(chainOrder) > 0 {
		cfg.ChainOrder = make([]llmchain.Provider, 0, len(chainOrder))
		for _, p := range chainOrder {
			if p = trim(p); p != "" {
				cfg.ChainOrder = append(cfg.ChainOrder, llmchain.Provider(p))
			}
		}
	}
	if taskMapJSON = trim(taskMapJSON); taskMapJSON != "" {
		var taskMap map[string]map[string]string
		if err := json.Unmarshal([]byte(taskMapJSON), &taskMap); err != nil {
			return nil, fmt.Errorf("invalid task_map_json: %w", err)
		}
		cfg.TaskMap = make(llmchain.TaskModelMap, len(taskMap))
		for task, providers := range taskMap {
			cfg.TaskMap[llmchain.Task(task)] = make(map[llmchain.Provider]string, len(providers))
			for provider, model := range providers {
				cfg.TaskMap[llmchain.Task(task)][llmchain.Provider(provider)] = model
			}
		}
	}
	if virtualChainsJSON = trim(virtualChainsJSON); virtualChainsJSON != "" {
		var chains map[string][]storedVirtualCandidate
		if err := json.Unmarshal([]byte(virtualChainsJSON), &chains); err != nil {
			return nil, fmt.Errorf("invalid virtual_chains_json: %w", err)
		}
		cfg.VirtualChains = make(map[string][]llmchain.VirtualCandidate, len(chains))
		for id, items := range chains {
			candidates := make([]llmchain.VirtualCandidate, 0, len(items))
			for _, item := range items {
				candidates = append(candidates, llmchain.VirtualCandidate{
					Provider: llmchain.Provider(item.Provider),
					Model:    item.Model,
				})
			}
			cfg.VirtualChains[id] = candidates
		}
	}
	return cfg, nil
}

func trim(s string) string {
	return strings.TrimSpace(s)
}
