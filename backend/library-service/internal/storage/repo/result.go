package repo

import (
	"database/sql"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func requireAffected(result sql.Result, err error) error {
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return status.Error(codes.NotFound, "record not found")
	}
	return nil
}
