package service

import (
	"context"
	"database/sql"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "library/internal/pkg/genproto"
	"library/internal/storage/repo"
)

type AuthorService struct {
	repo *repo.AuthorRepo
	pb.UnimplementedAuthorServiceServer
}

func NewAuthorService(db *sql.DB) *AuthorService {
	return &AuthorService{repo: repo.NewAuthorRepo(db)}
}

func (s *AuthorService) CreateAuthor(ctx context.Context, req *pb.AuthorCreateReq) (*pb.Void, error) {
	if req.GetBirthDate() == "" {
		req.BirthDate = nil
	}
	return s.repo.CreateAuthor(ctx, req)
}

func (s *AuthorService) GetAuthor(ctx context.Context, req *pb.ByID) (*pb.AuthorGetRes, error) {
	return s.repo.GetAuthor(ctx, req)
}

func (s *AuthorService) UpdateAuthor(ctx context.Context, req *pb.AuthorUpdateReq) (*pb.Void, error) {
	if req.Body == nil {
		return nil, status.Error(codes.InvalidArgument, "author update body is required")
	}
	if req.Body.BirthDate != nil && *req.Body.BirthDate == "" {
		req.Body.BirthDate = nil
	}
	return s.repo.UpdateAuthor(ctx, req)
}

func (s *AuthorService) DeleteAuthor(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.repo.DeleteAuthor(ctx, req)
}

func (s *AuthorService) GetAllAuthors(ctx context.Context, req *pb.AuthorsGetAllReq) (*pb.GetAllAuthorsRes, error) {
	// default limit if not set
	if req.Limit == 0 {
		req.Limit = 10
	}
	return s.repo.GetAllAuthors(ctx, req)
}
