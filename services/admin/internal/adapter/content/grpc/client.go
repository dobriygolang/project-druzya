package contentgrpc

import (
	"context"
	"encoding/json"
	"fmt"

	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/structpb"
)

const adminTokenHeader = "x-admin-token"

// Client calls content-service public and admin gRPC APIs.
type Client struct {
	read   contentv1.ContentServiceClient
	admin  contentv1.ContentAdminServiceClient
	conn   *grpc.ClientConn
	token  string
}

// NewClient dials content-service gRPC endpoint.
func NewClient(ctx context.Context, addr, adminToken string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial content grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		read:  contentv1.NewContentServiceClient(conn),
		admin: contentv1.NewContentAdminServiceClient(conn),
		conn:  conn,
		token: adminToken,
	}, nil
}

// Close releases the gRPC connection.
func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) adminCtx(ctx context.Context) context.Context {
	return metadata.AppendToOutgoingContext(ctx, adminTokenHeader, c.token)
}

// Ping verifies content-service is reachable.
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.read.ListCompanies(ctx, &contentv1.ListCompaniesRequest{Limit: 1})
	return err
}

func (c *Client) ListCompanies(ctx context.Context, filter contentadapter.ListCompaniesFilter) ([]contentadapter.Company, error) {
	resp, err := c.read.ListCompanies(ctx, &contentv1.ListCompaniesRequest{
		ActiveOnly: filter.ActiveOnly,
		Limit:      int32(filter.Limit),
		Offset:     int32(filter.Offset),
	})
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	out := make([]contentadapter.Company, 0, len(resp.GetCompanies()))
	for _, item := range resp.GetCompanies() {
		out = append(out, fromProtoCompany(item))
	}
	return out, nil
}

func (c *Client) UpsertCompany(ctx context.Context, input contentadapter.UpsertCompanyInput) (*contentadapter.Company, error) {
	req := &contentv1.UpsertCompanyRequest{
		Slug:        input.Slug,
		Name:        input.Name,
		Description: input.Description,
		IsActive:    input.IsActive,
	}
	if input.ID != nil {
		req.Id = input.ID
	}
	resp, err := c.admin.UpsertCompany(c.adminCtx(ctx), req)
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	company := fromProtoCompany(resp.GetCompany())
	return &company, nil
}

func (c *Client) ListTasks(ctx context.Context, filter contentadapter.ListTasksFilter) ([]contentadapter.Task, error) {
	req := &contentv1.ListTasksRequest{
		Limit:  int32(filter.Limit),
		Offset: int32(filter.Offset),
	}
	if filter.Type != nil {
		req.Type = filter.Type
	}
	if filter.Difficulty != nil {
		req.Difficulty = filter.Difficulty
	}
	if filter.Status != nil {
		req.Status = filter.Status
	}
	resp, err := c.read.ListTasks(ctx, req)
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	out := make([]contentadapter.Task, 0, len(resp.GetTasks()))
	for _, item := range resp.GetTasks() {
		task, err := fromProtoTask(item)
		if err != nil {
			return nil, err
		}
		out = append(out, task)
	}
	return out, nil
}

func (c *Client) GetTask(ctx context.Context, id, slug string) (*contentadapter.Task, error) {
	resp, err := c.read.GetTask(ctx, &contentv1.GetTaskRequest{Id: id, Slug: slug})
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	task, err := fromProtoTask(resp.GetTask())
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (c *Client) UpsertTask(ctx context.Context, input contentadapter.UpsertTaskInput) (*contentadapter.Task, error) {
	meta, err := rawJSONToStruct(input.Metadata)
	if err != nil {
		return nil, fmt.Errorf("metadata: %w", err)
	}
	req := &contentv1.UpsertTaskRequest{
		Slug:        input.Slug,
		Type:        input.Type,
		Title:       input.Title,
		Description: input.Description,
		Difficulty:  input.Difficulty,
		Metadata:    meta,
		Status:      input.Status,
	}
	if input.ID != nil {
		req.Id = input.ID
	}
	if input.EstimatedMinutes != nil {
		v := int32(*input.EstimatedMinutes)
		req.EstimatedMinutes = &v
	}
	resp, err := c.admin.UpsertTask(c.adminCtx(ctx), req)
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	task, err := fromProtoTask(resp.GetTask())
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (c *Client) ListArticles(ctx context.Context, filter contentadapter.ListArticlesFilter) ([]contentadapter.Article, error) {
	req := &contentv1.ListArticlesRequest{
		IncludeAllStatuses: filter.IncludeAll,
		Limit:              int32(filter.Limit),
		Offset:             int32(filter.Offset),
	}
	if filter.Status != nil {
		if st, ok := articleStatusToProto(*filter.Status); ok {
			req.Status = st
		}
	}
	resp, err := c.read.ListArticles(ctx, req)
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	out := make([]contentadapter.Article, 0, len(resp.GetArticles()))
	for _, item := range resp.GetArticles() {
		out = append(out, fromProtoArticleSummary(item))
	}
	return out, nil
}

func (c *Client) GetArticle(ctx context.Context, id, slug string) (*contentadapter.Article, error) {
	resp, err := c.admin.GetArticleForAdmin(c.adminCtx(ctx), &contentv1.GetArticleRequest{Id: id, Slug: slug})
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	article := fromProtoArticle(resp.GetArticle())
	return &article, nil
}

func (c *Client) UpsertArticle(ctx context.Context, input contentadapter.UpsertArticleInput) (*contentadapter.Article, error) {
	req := &contentv1.UpsertArticleRequest{
		Slug:    input.Slug,
		Title:   input.Title,
		Summary: input.Summary,
		Body:    input.Body,
		Status:  contentv1.ArticleStatus_ARTICLE_STATUS_DRAFT,
	}
	if input.ID != nil {
		req.Id = input.ID
	}
	if st, ok := articleStatusToProto(input.Status); ok {
		req.Status = st
	}
	if input.ReadingMinutes != nil {
		v := int32(*input.ReadingMinutes)
		req.ReadingMinutes = &v
	}
	if len(input.SkillKeys) > 0 {
		req.SkillKeys = append([]string(nil), input.SkillKeys...)
	}
	for _, v := range input.Videos {
		item := &contentv1.ArticleVideo{
			Title:    v.Title,
			Url:      v.URL,
			Position: int32(v.Position),
		}
		if p, ok := articleVideoProviderToProto(v.Provider); ok {
			item.Provider = p
		}
		if v.DurationSeconds != nil {
			d := int32(*v.DurationSeconds)
			item.DurationSeconds = &d
		}
		req.Videos = append(req.Videos, item)
	}
	if len(input.TaskSlugs) > 0 {
		req.TaskSlugs = append([]string(nil), input.TaskSlugs...)
	}
	resp, err := c.admin.UpsertArticle(c.adminCtx(ctx), req)
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	article := fromProtoArticle(resp.GetArticle())
	return &article, nil
}

func (c *Client) ListInterviewTemplates(ctx context.Context, filter contentadapter.ListInterviewTemplatesFilter) ([]contentadapter.InterviewTemplate, error) {
	req := &contentv1.ListInterviewTemplatesRequest{
		ActiveOnly: filter.ActiveOnly,
		Limit:      int32(filter.Limit),
		Offset:     int32(filter.Offset),
	}
	if filter.CompanyID != nil {
		req.CompanyId = filter.CompanyID
	}
	resp, err := c.read.ListInterviewTemplates(ctx, req)
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	out := make([]contentadapter.InterviewTemplate, 0, len(resp.GetTemplates()))
	for _, item := range resp.GetTemplates() {
		out = append(out, fromProtoTemplate(item))
	}
	return out, nil
}

func (c *Client) GetInterviewTemplateDetail(ctx context.Context, id, slug string) (*contentadapter.InterviewTemplateDetail, error) {
	resp, err := c.read.GetInterviewTemplateDetail(ctx, &contentv1.GetInterviewTemplateDetailRequest{Id: id, Slug: slug})
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	return fromProtoTemplateDetail(resp), nil
}

func (c *Client) UpsertInterviewTemplate(ctx context.Context, input contentadapter.UpsertInterviewTemplateInput) (*contentadapter.InterviewTemplate, error) {
	req := &contentv1.UpsertInterviewTemplateRequest{
		Slug:         input.Slug,
		Title:        input.Title,
		Description:  input.Description,
		TargetRole:   input.TargetRole,
		TargetLevel:  input.TargetLevel,
		PassingScore: int32(input.PassingScore),
		IsActive:     input.IsActive,
	}
	if input.ID != nil {
		req.Id = input.ID
	}
	if input.CompanyID != nil {
		req.CompanyId = input.CompanyID
	}
	resp, err := c.admin.UpsertInterviewTemplate(c.adminCtx(ctx), req)
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	template := fromProtoTemplate(resp.GetTemplate())
	return &template, nil
}

func (c *Client) UpsertTemplateSection(ctx context.Context, input contentadapter.UpsertTemplateSectionInput) (*contentadapter.TemplateSection, error) {
	req := &contentv1.UpsertTemplateSectionRequest{
		TemplateId:  input.TemplateID,
		SectionType: input.SectionType,
		Title:       input.Title,
		Description: input.Description,
		Position:    int32(input.Position),
	}
	if input.ID != nil {
		req.Id = input.ID
	}
	if input.PassingScore != nil {
		v := int32(*input.PassingScore)
		req.PassingScore = &v
	}
	resp, err := c.admin.UpsertTemplateSection(c.adminCtx(ctx), req)
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	section := fromProtoSection(resp.GetSection())
	return &section, nil
}

func (c *Client) ReplaceTemplateStructure(
	ctx context.Context,
	templateID string,
	sections []contentadapter.TemplateStructureSectionInput,
) (*contentadapter.InterviewTemplateDetail, error) {
	protoSections := make([]*contentv1.TemplateStructureSection, 0, len(sections))
	for _, item := range sections {
		sec := &contentv1.TemplateStructureSection{
			SectionType: item.SectionType,
			Title:       item.Title,
			Description: item.Description,
			Position:    int32(item.Position),
			TaskIds:     item.TaskIDs,
		}
		if item.ID != nil {
			sec.Id = item.ID
		}
		if item.PassingScore != nil {
			v := int32(*item.PassingScore)
			sec.PassingScore = &v
		}
		protoSections = append(protoSections, sec)
	}
	resp, err := c.admin.ReplaceTemplateStructure(c.adminCtx(ctx), &contentv1.ReplaceTemplateStructureRequest{
		TemplateId: templateID,
		Sections:   protoSections,
	})
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	return fromProtoTemplateDetail(&contentv1.GetInterviewTemplateDetailResponse{
		Template: resp.GetTemplate(),
		Sections: resp.GetSections(),
	}), nil
}

func fromProtoCompany(c *contentv1.Company) contentadapter.Company {
	if c == nil {
		return contentadapter.Company{}
	}
	return contentadapter.Company{
		ID:          c.GetId(),
		Slug:        c.GetSlug(),
		Name:        c.GetName(),
		Description: c.Description,
		IsActive:    c.GetIsActive(),
		CreatedAt:   c.GetCreatedAt().AsTime(),
		UpdatedAt:   c.GetUpdatedAt().AsTime(),
	}
}

func articleStatusToProto(raw string) (contentv1.ArticleStatus, bool) {
	switch raw {
	case "draft":
		return contentv1.ArticleStatus_ARTICLE_STATUS_DRAFT, true
	case "published":
		return contentv1.ArticleStatus_ARTICLE_STATUS_PUBLISHED, true
	case "archived":
		return contentv1.ArticleStatus_ARTICLE_STATUS_ARCHIVED, true
	default:
		return contentv1.ArticleStatus_ARTICLE_STATUS_UNSPECIFIED, false
	}
}

func articleStatusFromProto(s contentv1.ArticleStatus) string {
	switch s {
	case contentv1.ArticleStatus_ARTICLE_STATUS_DRAFT:
		return "draft"
	case contentv1.ArticleStatus_ARTICLE_STATUS_PUBLISHED:
		return "published"
	case contentv1.ArticleStatus_ARTICLE_STATUS_ARCHIVED:
		return "archived"
	default:
		return ""
	}
}

func articleVideoProviderToProto(raw string) (contentv1.ArticleVideoProvider, bool) {
	switch raw {
	case "youtube":
		return contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_YOUTUBE, true
	case "vimeo":
		return contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_VIMEO, true
	case "other":
		return contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_OTHER, true
	default:
		return contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_UNSPECIFIED, false
	}
}

func articleVideoProviderFromProto(p contentv1.ArticleVideoProvider) string {
	switch p {
	case contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_YOUTUBE:
		return "youtube"
	case contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_VIMEO:
		return "vimeo"
	case contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_OTHER:
		return "other"
	default:
		return "youtube"
	}
}

func fromProtoArticleVideos(videos []*contentv1.ArticleVideo) []contentadapter.ArticleVideo {
	if len(videos) == 0 {
		return nil
	}
	out := make([]contentadapter.ArticleVideo, 0, len(videos))
	for _, v := range videos {
		if v == nil {
			continue
		}
		item := contentadapter.ArticleVideo{
			Title:    v.GetTitle(),
			URL:      v.GetUrl(),
			Provider: articleVideoProviderFromProto(v.GetProvider()),
			Position: int(v.GetPosition()),
		}
		if v.DurationSeconds != nil {
			d := int(v.GetDurationSeconds())
			item.DurationSeconds = &d
		}
		out = append(out, item)
	}
	return out
}

func fromProtoArticleTaskLinks(links []*contentv1.ArticleTaskLink) []contentadapter.ArticleTaskLink {
	if len(links) == 0 {
		return nil
	}
	out := make([]contentadapter.ArticleTaskLink, 0, len(links))
	for _, link := range links {
		if link == nil {
			continue
		}
		out = append(out, contentadapter.ArticleTaskLink{
			TaskID:     link.GetTaskId(),
			Slug:       link.GetSlug(),
			Title:      link.GetTitle(),
			Type:       link.GetType(),
			Difficulty: link.GetDifficulty(),
			Position:   int(link.GetPosition()),
		})
	}
	return out
}

func fromProtoArticleSummary(a *contentv1.ArticleSummary) contentadapter.Article {
	if a == nil {
		return contentadapter.Article{}
	}
	var reading *int
	if a.ReadingMinutes != nil {
		v := int(a.GetReadingMinutes())
		reading = &v
	}
	return contentadapter.Article{
		ID:             a.GetId(),
		Slug:           a.GetSlug(),
		Title:          a.GetTitle(),
		Summary:        a.GetSummary(),
		Status:         articleStatusFromProto(a.GetStatus()),
		ReadingMinutes: reading,
		SkillKeys:      append([]string(nil), a.GetSkillKeys()...),
		CreatedAt:      a.GetCreatedAt().AsTime(),
		UpdatedAt:      a.GetUpdatedAt().AsTime(),
	}
}

func fromProtoArticle(a *contentv1.Article) contentadapter.Article {
	if a == nil {
		return contentadapter.Article{}
	}
	var reading *int
	if a.ReadingMinutes != nil {
		v := int(a.GetReadingMinutes())
		reading = &v
	}
	return contentadapter.Article{
		ID:             a.GetId(),
		Slug:           a.GetSlug(),
		Title:          a.GetTitle(),
		Summary:        a.GetSummary(),
		Body:           a.GetBody(),
		Status:         articleStatusFromProto(a.GetStatus()),
		ReadingMinutes: reading,
		SkillKeys:      append([]string(nil), a.GetSkillKeys()...),
		Videos:         fromProtoArticleVideos(a.GetVideos()),
		LinkedTasks:    fromProtoArticleTaskLinks(a.GetLinkedTasks()),
		CreatedAt:      a.GetCreatedAt().AsTime(),
		UpdatedAt:      a.GetUpdatedAt().AsTime(),
	}
}

func fromProtoTask(t *contentv1.Task) (contentadapter.Task, error) {
	if t == nil {
		return contentadapter.Task{}, contentadapter.ErrNotFound
	}
	meta := []byte("{}")
	if t.GetMetadata() != nil {
		raw, err := t.GetMetadata().MarshalJSON()
		if err != nil {
			return contentadapter.Task{}, err
		}
		meta = raw
	}
	var est *int
	if t.EstimatedMinutes != nil {
		v := int(t.GetEstimatedMinutes())
		est = &v
	}
	return contentadapter.Task{
		ID:               t.GetId(),
		Slug:             t.GetSlug(),
		Type:             t.GetType(),
		Title:            t.GetTitle(),
		Description:      t.GetDescription(),
		Difficulty:       t.GetDifficulty(),
		EstimatedMinutes: est,
		Metadata:         meta,
		Status:           t.GetStatus(),
		CreatedAt:        t.GetCreatedAt().AsTime(),
		UpdatedAt:        t.GetUpdatedAt().AsTime(),
	}, nil
}

func fromProtoTemplate(t *contentv1.InterviewTemplate) contentadapter.InterviewTemplate {
	if t == nil {
		return contentadapter.InterviewTemplate{}
	}
	return contentadapter.InterviewTemplate{
		ID:           t.GetId(),
		CompanyID:    t.CompanyId,
		Slug:         t.GetSlug(),
		Title:        t.GetTitle(),
		Description:  t.Description,
		TargetRole:   t.TargetRole,
		TargetLevel:  t.TargetLevel,
		PassingScore: int(t.GetPassingScore()),
		IsActive:     t.GetIsActive(),
		CreatedAt:    t.GetCreatedAt().AsTime(),
		UpdatedAt:    t.GetUpdatedAt().AsTime(),
	}
}

func fromProtoSection(s *contentv1.TemplateSection) contentadapter.TemplateSection {
	if s == nil {
		return contentadapter.TemplateSection{}
	}
	var passingScore *int
	if s.PassingScore != nil {
		v := int(s.GetPassingScore())
		passingScore = &v
	}
	return contentadapter.TemplateSection{
		ID:           s.GetId(),
		TemplateID:   s.GetTemplateId(),
		SectionType:  s.GetSectionType(),
		Title:        s.GetTitle(),
		Description:  s.Description,
		Position:     int(s.GetPosition()),
		PassingScore: passingScore,
		TasksCount:   int(s.GetTasksCount()),
		TaskIDs:      s.GetTaskIds(),
		CreatedAt:    s.GetCreatedAt().AsTime(),
		UpdatedAt:    s.GetUpdatedAt().AsTime(),
	}
}

func fromProtoTemplateDetail(resp *contentv1.GetInterviewTemplateDetailResponse) *contentadapter.InterviewTemplateDetail {
	if resp == nil {
		return nil
	}
	sections := make([]contentadapter.TemplateSection, 0, len(resp.GetSections()))
	for _, item := range resp.GetSections() {
		sections = append(sections, fromProtoSection(item))
	}
	return &contentadapter.InterviewTemplateDetail{
		Template: fromProtoTemplate(resp.GetTemplate()),
		Sections: sections,
	}
}

func rawJSONToStruct(raw []byte) (*structpb.Struct, error) {
	if len(raw) == 0 {
		return &structpb.Struct{}, nil
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	return structpb.NewStruct(m)
}

func (c *Client) GetOpsStats(ctx context.Context) (*contentadapter.OpsStats, error) {
	resp, err := c.admin.GetOpsStats(c.adminCtx(ctx), &contentv1.GetOpsStatsRequest{})
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	return &contentadapter.OpsStats{
		ServiceName:       resp.GetServiceName(),
		DatabaseName:      resp.GetDatabaseName(),
		DatabaseSizeBytes: resp.GetDatabaseSizeBytes(),
		MemoryAllocBytes:  resp.GetMemoryAllocBytes(),
		MemorySysBytes:    resp.GetMemorySysBytes(),
		Goroutines:        int(resp.GetGoroutines()),
		HTTPRPS:           resp.GetHttpRps(),
	}, nil
}

var _ contentadapter.Client = (*Client)(nil)