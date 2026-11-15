package app

import (
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	cf "library/internal/pkg/config"
	pb "library/internal/pkg/genproto"
	"library/internal/pkg/postgres"
	"library/internal/storage/service"

	"google.golang.org/grpc"
)

func Run(cfg *cf.Config) {
	// connect to db
	pgm, err := postgres.New(cfg)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer pgm.Close()

	// init services
	userService := service.NewUserService(pgm.DB)
	categoryService := service.NewCategoryService(pgm.DB)
	publisherService := service.NewPublisherService(pgm.DB)
	authorService := service.NewAuthorService(pgm.DB)
	bookService := service.NewBookService(pgm.DB)
	borrowingService := service.NewBorrowingService(pgm.DB)
	recommendedService := service.NewRecommendedService(pgm.DB)
	fileService := service.NewFileService(pgm.DB)

	// listen on port
	lis, err := net.Listen("tcp", cfg.GRPCPort)
	if err != nil {
		log.Fatal("Failed to listen:", err)
	}
	defer lis.Close()

	// gRPC server
	server := grpc.NewServer()
	pb.RegisterUserServiceServer(server, userService)
	pb.RegisterCategoryServiceServer(server, categoryService)
	pb.RegisterPublisherServiceServer(server, publisherService)
	pb.RegisterAuthorServiceServer(server, authorService)
	pb.RegisterBookServiceServer(server, bookService)
	pb.RegisterBorrowingServiceServer(server, borrowingService)
	pb.RegisterRecommendedServiceServer(server, recommendedService)
	pb.RegisterFileServiceServer(server, fileService)

	// Run server in goroutine
	go func() {
		log.Println("gRPC server is running on", cfg.GRPCPort)
		if err := server.Serve(lis); err != nil {
			log.Fatalf("Failed to serve: %v", err)
		}
	}()

	// Handle shutdown signals
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	<-quit // wait for signal

	log.Println("Shutting down gracefully...")

	// Give in-flight requests a chance to finish
	stopped := make(chan struct{})
	go func() {
		server.GracefulStop()
		close(stopped)
	}()

	select {
	case <-stopped:
		log.Println("gRPC server stopped")
	case <-time.After(5 * time.Second):
		log.Println("Force stopping gRPC server")
		server.Stop()
	}
}
