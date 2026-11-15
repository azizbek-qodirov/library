package handlers

import (
	"fmt"

	"library-gateway/internal/pkg/config"
	pb "library-gateway/internal/pkg/genproto"
	minio_connect "library-gateway/internal/pkg/minio"

	l "github.com/azizbek-qodirov/logger"
	"google.golang.org/grpc"
)

type HTTPHandler struct {
	Logger *l.Logger
	Config *config.Config
	Minio  *minio_connect.MinioClient
	US     pb.UserServiceClient
	CS     pb.CategoryServiceClient
	PS     pb.PublisherServiceClient
	AS     pb.AuthorServiceClient
	BookS  pb.BookServiceClient
	BS     pb.BorrowingServiceClient
	RS     pb.RecommendedServiceClient
	FS     pb.FileServiceClient
}

func NewHandler(conn *grpc.ClientConn, logger *l.Logger, cfg *config.Config) (*HTTPHandler, error) {
	mc, err := minio_connect.NewMinioClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MinIO: %w", err)
	}

	return &HTTPHandler{
		Logger: logger,
		Config: cfg,
		Minio:  mc,
		US:     pb.NewUserServiceClient(conn),
		CS:     pb.NewCategoryServiceClient(conn),
		PS:     pb.NewPublisherServiceClient(conn),
		AS:     pb.NewAuthorServiceClient(conn),
		BookS:  pb.NewBookServiceClient(conn),
		BS:     pb.NewBorrowingServiceClient(conn),
		RS:     pb.NewRecommendedServiceClient(conn),
		FS:     pb.NewFileServiceClient(conn),
	}, nil
}
