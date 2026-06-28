package gopls

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/runner"
)

const mainGoName = "main.go"

// Session runs gopls in an isolated workspace and proxies LSP over stdio.
type Session struct {
	Dir    string
	DocURI string
	RootURI string

	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout *bufio.Reader
	done   chan struct{}
	once   sync.Once
}

// NewSession creates a workspace, writes go.mod, and starts gopls.
func NewSession(ctx context.Context, workRoot, goplsPath string) (*Session, error) {
	if workRoot == "" {
		workRoot = os.TempDir()
	}
	lspRoot := filepath.Join(workRoot, "lsp")
	if err := os.MkdirAll(lspRoot, 0o700); err != nil {
		return nil, err
	}
	dir, err := os.MkdirTemp(lspRoot, "go-*")
	if err != nil {
		return nil, err
	}

	if err := runner.PrepareGoWorkspace(dir); err != nil {
		_ = os.RemoveAll(dir)
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(dir, mainGoName), []byte("package main\n\nfunc main() {\n}\n"), 0o600); err != nil {
		_ = os.RemoveAll(dir)
		return nil, err
	}

	docPath := filepath.Join(dir, mainGoName)
	docURI := fileURI(docPath)
	rootURI := fileURI(dir)

	if goplsPath == "" {
		goplsPath = "gopls"
	}
	cmd := exec.CommandContext(ctx, goplsPath, "serve")
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GOWORK=off")
	stdin, err := cmd.StdinPipe()
	if err != nil {
		_ = os.RemoveAll(dir)
		return nil, err
	}
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		_ = os.RemoveAll(dir)
		return nil, err
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		_ = os.RemoveAll(dir)
		return nil, fmt.Errorf("start gopls: %w", err)
	}

	s := &Session{
		Dir:     dir,
		DocURI:  docURI,
		RootURI: rootURI,
		cmd:     cmd,
		stdin:   stdin,
		stdout:  bufio.NewReader(stdoutPipe),
		done:    make(chan struct{}),
	}
	go func() {
		_ = cmd.Wait()
		close(s.done)
	}()
	return s, nil
}

func fileURI(path string) string {
	abs, err := filepath.Abs(path)
	if err != nil {
		abs = path
	}
	return "file://" + filepath.ToSlash(abs)
}

// WriteToServer sends a JSON-RPC message to gopls (without LSP headers).
func (s *Session) WriteToServer(payload []byte) error {
	return writeMessage(s.stdin, payload)
}

// ReadFromServer reads the next JSON-RPC message from gopls.
func (s *Session) ReadFromServer() ([]byte, error) {
	return readMessage(s.stdout)
}

// Close stops gopls and removes the workspace.
func (s *Session) Close() {
	s.once.Do(func() {
		if s.stdin != nil {
			_ = s.stdin.Close()
		}
		if s.cmd != nil && s.cmd.Process != nil {
			_ = s.cmd.Process.Kill()
		}
		<-s.done
		_ = os.RemoveAll(s.Dir)
	})
}
