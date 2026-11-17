package service

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "library/internal/pkg/genproto"
	"library/internal/storage/repo"
)

type BookService struct {
	repo *repo.BookRepo
	pb.UnimplementedBookServiceServer
}

func NewBookService(db *sql.DB) *BookService {
	return &BookService{repo: repo.NewBookRepo(db)}
}

func (s *BookService) CreateBook(ctx context.Context, req *pb.BookCreateReq) (*pb.Void, error) {
	if err := validateBook(req.Title, req.GetPublishedDate(), req.PageCount, req.TotalCopies, req.GetPublicationYear()); err != nil {
		return nil, err
	}
	return s.repo.CreateBook(ctx, req)
}

func (s *BookService) GetBook(ctx context.Context, req *pb.ByID) (*pb.BookGetRes, error) {
	return s.repo.GetBook(ctx, req)
}

func (s *BookService) UpdateBook(ctx context.Context, req *pb.BookUpdateReq) (*pb.Void, error) {
	body := req.GetBody()
	if body == nil {
		return nil, status.Error(codes.InvalidArgument, "book update body is required")
	}
	if err := validateBook(body.Title, body.GetPublishedDate(), body.PageCount, body.TotalCopies, body.GetPublicationYear()); err != nil {
		return nil, err
	}
	return s.repo.UpdateBook(ctx, req)
}

func (s *BookService) DeleteBook(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.repo.DeleteBook(ctx, req)
}

func (s *BookService) GetAllBooks(ctx context.Context, req *pb.BooksGetAllReq) (*pb.BooksGetAllRes, error) {
	return s.repo.GetAllBooks(ctx, req)
}

func validateBook(title, publishedDate string, pages, copies, year int32) error {
	if strings.TrimSpace(title) == "" {
		return status.Error(codes.InvalidArgument, "title is required")
	}
	if pages <= 0 || copies < 0 {
		return status.Error(codes.InvalidArgument, "page count must be positive and total copies cannot be negative")
	}
	if year < 0 || year > 9999 {
		return status.Error(codes.InvalidArgument, "publication year must be between 1 and 9999, or zero to clear it")
	}
	if publishedDate != "" {
		date, err := time.Parse(time.DateOnly, publishedDate)
		if err != nil {
			return status.Error(codes.InvalidArgument, "publication date must use YYYY-MM-DD")
		}
		if year > 0 && date.Year() != int(year) {
			return status.Error(codes.InvalidArgument, "publication date and year must agree")
		}
	}
	return nil
}

func (s *BookService) GetCopyByBarcode(ctx context.Context, req *pb.CopyBarcodeReq) (*pb.CopyLookupRes, error) {
	return s.repo.GetCopyByBarcode(ctx, strings.ToUpper(strings.TrimSpace(req.GetBarcode())))
}

func (s *BookService) ListBookCopies(ctx context.Context, req *pb.ByID) (*pb.BookCopiesRes, error) {
	return s.repo.ListBookCopies(ctx, req.Id)
}
