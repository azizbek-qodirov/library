package service

import (
	"context"
	"database/sql"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "library/internal/pkg/genproto"
	"library/internal/storage/repo"
)

type PublisherService struct {
	repo *repo.PublisherRepo
	pb.UnimplementedPublisherServiceServer
}

func NewPublisherService(db *sql.DB) *PublisherService {
	return &PublisherService{repo: repo.NewPublisherRepo(db)}
}

func (s *PublisherService) CreatePublisher(ctx context.Context, req *pb.PublisherCreateReq) (*pb.Void, error) {
	return s.repo.CreatePublisher(ctx, req)
}

func (s *PublisherService) GetPublisher(ctx context.Context, req *pb.ByID) (*pb.PublisherGetRes, error) {
	return s.repo.GetPublisher(ctx, req)
}

func (s *PublisherService) UpdatePublisher(ctx context.Context, req *pb.PublisherUpdateReq) (*pb.Void, error) {
	if req.GetBody() == nil {
		return nil, status.Error(codes.InvalidArgument, "publisher update body is required")
	}
	return s.repo.UpdatePublisher(ctx, req)
}

func (s *PublisherService) DeletePublisher(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.repo.DeletePublisher(ctx, req)
}

func (s *PublisherService) GetAllPublishers(ctx context.Context, req *pb.PublishersGetAllReq) (*pb.GetAllPublishersRes, error) {
	if req.Limit == 0 {
		req.Limit = 10
	}
	return s.repo.GetAllPublishers(ctx, req)
}
