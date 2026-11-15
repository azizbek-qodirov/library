package service

import (
	"context"
	"database/sql"

	pb "library/internal/pkg/genproto"
	"library/internal/storage/repo"
)

type RecommendedService struct {
	repo *repo.RecommendedRepo
	pb.UnimplementedRecommendedServiceServer
}

func NewRecommendedService(db *sql.DB) *RecommendedService {
	return &RecommendedService{repo: repo.NewRecommendedRepo(db)}
}

func (s *RecommendedService) CreateRecommended(ctx context.Context, req *pb.RecommendedCreateReq) (*pb.Void, error) {
	return s.repo.CreateRecommended(ctx, req)
}

func (s *RecommendedService) GetRecommended(ctx context.Context, req *pb.ByID) (*pb.RecommendedGetRes, error) {
	return s.repo.GetRecommended(ctx, req)
}

func (s *RecommendedService) DeleteRecommended(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.repo.DeleteRecommended(ctx, req)
}

func (s *RecommendedService) GetAllRecommendeds(ctx context.Context, req *pb.RecommendedsGetAllReq) (*pb.RecommendedsGetAllRes, error) {
	if req.Limit == 0 {
		req.Limit = 10
	}
	if req.Limit > 100 {
		req.Limit = 100
	}
	return s.repo.GetAllRecommendeds(ctx, req)
}
