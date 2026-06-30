package sandboxapi

import (
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
	sandboxv1 "github.com/sedorofeevd/project-druzya/services/sandbox/pkg/api/sandbox/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func toProtoCodeRun(run *model.CodeRun) *sandboxv1.CodeRun {
	if run == nil {
		return nil
	}
	out := &sandboxv1.CodeRun{
		Id:           run.ID,
		UserId:       run.UserID,
		Language:     run.Language,
		Status:       run.Status,
		RunType:      run.RunType,
		TestsTotal:   int32(run.TestsTotal),
		TestsPassed:  int32(run.TestsPassed),
		TestResults:  toProtoTestResults(run.TestResults),
		CreatedAt:    timestamppb.New(run.CreatedAt),
		UpdatedAt:   timestamppb.New(run.UpdatedAt),
	}
	if run.Stdout != nil {
		out.Stdout = run.Stdout
	}
	if run.Stderr != nil {
		out.Stderr = run.Stderr
	}
	if run.CompileOutput != nil {
		out.CompileOutput = run.CompileOutput
	}
	if run.Error != nil {
		out.Error = run.Error
	}
	if run.ExitCode != nil {
		v := int32(*run.ExitCode)
		out.ExitCode = &v
	}
	if run.TimeMS != nil {
		v := int32(*run.TimeMS)
		out.TimeMs = &v
	}
	if run.MemoryKB != nil {
		v := int32(*run.MemoryKB)
		out.MemoryKb = &v
	}
	if run.Runner != nil {
		out.Runner = run.Runner
	}
	return out
}

func toProtoTestResults(items []model.TestResult) []*sandboxv1.TestResult {
	out := make([]*sandboxv1.TestResult, 0, len(items))
	for _, item := range items {
		tr := &sandboxv1.TestResult{
			Name:   item.Name,
			Status: item.Status,
		}
		if item.Stdout != nil {
			tr.Stdout = item.Stdout
		}
		if item.Stderr != nil {
			tr.Stderr = item.Stderr
		}
		if item.ExpectedOutput != nil {
			tr.ExpectedOutput = item.ExpectedOutput
		}
		if item.ActualOutput != nil {
			tr.ActualOutput = item.ActualOutput
		}
		if item.TimeMS != nil {
			v := int32(*item.TimeMS)
			tr.TimeMs = &v
		}
		if item.Error != nil {
			tr.Error = item.Error
		}
		out = append(out, tr)
	}
	return out
}
