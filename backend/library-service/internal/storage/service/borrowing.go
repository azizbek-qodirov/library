package service

import (
	"context"
	"database/sql"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

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
	if err := validateLoanDates(req.FromDate, req.DueDate, "", ""); err != nil {
		return nil, err
	}
	return s.repo.Create(ctx, req)
}

func (s *BorrowingService) GetBorrowing(ctx context.Context, req *pb.ByID) (*pb.BorrowingGetRes, error) {
	return s.repo.Get(ctx, req)
}

func (s *BorrowingService) UpdateBorrowing(ctx context.Context, req *pb.BorrowingUpdateReq) (*pb.Void, error) {
	body := req.GetBody()
	if body == nil {
		return nil, status.Error(codes.InvalidArgument, "loan update body is required")
	}
	switch body.Status {
	case "borrowed", "returned", "lost":
	default:
		return nil, status.Error(codes.InvalidArgument, "unknown loan status")
	}
	if body.Status != "returned" && body.GetReturnedAt() != "" {
		return nil, status.Error(codes.InvalidArgument, "only returned loans can have a return date")
	}
	if err := validateLoanDates(body.FromDate, body.DueDate, body.GetExtensionDate(), body.GetReturnedAt()); err != nil {
		return nil, err
	}
	return s.repo.Update(ctx, req)
}

func (s *BorrowingService) DeleteBorrowing(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.repo.Delete(ctx, req)
}

func (s *BorrowingService) GetAllBorrowings(ctx context.Context, req *pb.BorrowingsGetAllReq) (*pb.BorrowingsGetAllRes, error) {
	return s.repo.GetAll(ctx, req)
}

func (s *BorrowingService) ReturnBorrowing(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.repo.SetStatus(ctx, req.Id, "returned")
}

func (s *BorrowingService) RenewBorrowing(ctx context.Context, req *pb.BorrowingRenewReq) (*pb.Void, error) {
	extension, err := time.Parse(time.DateOnly, req.ExtensionDate)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "extension date must use YYYY-MM-DD")
	}
	return s.repo.Renew(ctx, req.Id, extension)
}

func (s *BorrowingService) MarkBorrowingLost(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.repo.SetStatus(ctx, req.Id, "lost")
}

func validateLoanDates(from, due, extension, returned string) error {
	start, startErr := time.Parse(time.DateOnly, from)
	deadline, dueErr := time.Parse(time.DateOnly, due)
	if startErr != nil || dueErr != nil || deadline.Before(start) {
		return status.Error(codes.InvalidArgument, "due date must be on or after the checkout date")
	}
	if extension != "" {
		extended, err := time.Parse(time.DateOnly, extension)
		if err != nil || extended.Before(deadline) {
			return status.Error(codes.InvalidArgument, "extension date must be on or after the due date")
		}
	}
	if returned != "" {
		date, err := time.Parse(time.DateOnly, returned)
		if err != nil || date.Before(start) {
			return status.Error(codes.InvalidArgument, "return date must be on or after the checkout date")
		}
	}
	return nil
}
