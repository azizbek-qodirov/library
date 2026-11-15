package service

import (
	"context"
	"database/sql"
	"fmt"

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
	if *req.PublishedDate == "" {
		req.PublishedDate = nil
	}
	_, err := s.repo.CreateBook(ctx, req)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (s *BookService) GetBook(ctx context.Context, req *pb.ByID) (*pb.BookGetRes, error) {
	return s.repo.GetBook(ctx, req)
}

func (s *BookService) UpdateBook(ctx context.Context, req *pb.BookUpdateReq) (*pb.Void, error) {
	if req.Body.PublishedDate != nil && *req.Body.PublishedDate == "" {
		req.Body.PublishedDate = nil
	}
	fmt.Println(req)
	return s.repo.UpdateBook(ctx, req)
}

func (s *BookService) DeleteBook(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.repo.DeleteBook(ctx, req)
}

func (s *BookService) GetAllBooks(ctx context.Context, req *pb.BooksGetAllReq) (*pb.BooksGetAllRes, error) {
	return s.repo.GetAllBooks(ctx, req)
}
