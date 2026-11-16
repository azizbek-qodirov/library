package app

import (
	"context"
	"database/sql"
	"errors"
	"log"

	"github.com/lib/pq"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func handleRPC(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	switch page := req.(type) {
	case interface {
		GetLimit() int64
		GetOffset() int64
	}:
		if page.GetLimit() < 0 || page.GetLimit() > 100 || page.GetOffset() < 0 {
			return nil, status.Error(codes.InvalidArgument, "invalid pagination")
		}
	case interface {
		GetLimit() uint64
		GetOffset() uint64
	}:
		if page.GetLimit() > 100 || page.GetOffset() > uint64(1<<63-1) {
			return nil, status.Error(codes.InvalidArgument, "invalid pagination")
		}
	}

	response, err := handler(ctx, req)
	if err == nil {
		return response, nil
	}
	if _, ok := status.FromError(err); ok {
		return nil, err
	}
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return nil, status.Error(codes.NotFound, "record not found")
	case ctx.Err() != nil:
		return nil, status.FromContextError(ctx.Err()).Err()
	}
	var pgErr *pq.Error
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return nil, status.Error(codes.AlreadyExists, "a record with these values already exists")
		case "23503":
			return nil, status.Error(codes.FailedPrecondition, "a required related record is missing or this record is still in use")
		case "22001", "22007", "22008", "22P02", "23502", "23514":
			return nil, status.Error(codes.InvalidArgument, "invalid or missing record fields")
		}
	}
	log.Printf("%s: %v", info.FullMethod, err)
	return nil, status.Error(codes.Internal, "library operation failed")
}
