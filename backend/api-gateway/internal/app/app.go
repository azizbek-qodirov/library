package app

import (
	"context"
	"fmt"
	api "library-gateway/internal/http"
	"library-gateway/internal/http/handlers"
	"library-gateway/internal/pkg/config"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "library-gateway/internal/http/docs"

	l "github.com/azizbek-qodirov/logger"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func Run(cf config.Config) {
	logger, err := l.NewLogger(&l.LogFileConfigs{
		Directory: "logs",
		Filename:  "app.log",
		Stdout:    true,
		Include:   l.DateTime | l.Loglevel | l.ShortFileName,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}

	// Connect to gRPC
	LibraryServiceConn, err := grpc.NewClient(
		fmt.Sprintf("localhost%s", cf.LIBRARY_GRPC_PORT),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		logger.ERROR.Printf("Failed to connect to gRPC service: %v\n", err)
		os.Exit(1)
	}
	defer LibraryServiceConn.Close()

	handler, err := handlers.NewHandler(LibraryServiceConn, logger, &cf)
	if err != nil {
		logger.ERROR.Printf("Failed to initialize handlers: %v\n", err)
		os.Exit(1)
	}
	router := api.NewRouter(handler, logger, &cf)

	// Create http.Server wrapping Gin
	srv := &http.Server{
		Addr:    cf.GATEWAY_HTTP_PORT,
		Handler: router,
	}

	// Run server in goroutine
	go func() {
		logger.INFO.Println("Server is running on port:", cf.GATEWAY_HTTP_PORT)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.ERROR.Panicln("server failed:", err)
		}
	}()

	// Listen for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.INFO.Println("Shutting down server...")

	// Gracefully stop with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.ERROR.Println("Server forced to shutdown:", err)
	}

	logger.INFO.Println("Server exited cleanly")
}
