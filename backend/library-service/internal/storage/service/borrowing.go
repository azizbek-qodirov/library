package service

import (
	"context"
	"database/sql"

	pb "library/internal/pkg/genproto"
	"library/internal/storage/repo"
)

type BorrowingService struct {
	repo *repo.BorrowingRepo
	pb.UnimplementedBorrowingServiceServer
}

func NewBorrowingService(db *sql.DB) *BorrowingService {
	return &BorrowingService{repo: repo.NewBorrowingRepo(db)}
}

func (s *BorrowingService) CreateBorrowing(ctx context.Context, req *pb.BorrowingCreateReq) (*pb.Void, error) {
	return s.repo.Create(ctx, req)
}

func (s *BorrowingService) GetBorrowing(ctx context.Context, req *pb.ByID) (*pb.BorrowingGetRes, error) {
	return s.repo.Get(ctx, req)
}

func (s *BorrowingService) UpdateBorrowing(ctx context.Context, req *pb.BorrowingUpdateReq) (*pb.Void, error) {
	if req.Body.ReturnedAt != nil && *req.Body.ReturnedAt == "" {
		req.Body.ReturnedAt = nil
	}
	if req.Body.ExtensionDate != nil && *req.Body.ExtensionDate == "" {
		req.Body.ExtensionDate = nil
	}
	return s.repo.Update(ctx, req)
}

func (s *BorrowingService) DeleteBorrowing(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.repo.Delete(ctx, req)
}

func (s *BorrowingService) GetAllBorrowings(ctx context.Context, req *pb.BorrowingsGetAllReq) (*pb.BorrowingsGetAllRes, error) {
	return s.repo.GetAll(ctx, req)
}
