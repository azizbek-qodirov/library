package repo

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "library/internal/pkg/genproto"
)

type PublisherRepo struct {
	db *sql.DB
}

func NewPublisherRepo(db *sql.DB) *PublisherRepo {
	return &PublisherRepo{db: db}
}

func (r *PublisherRepo) CreatePublisher(ctx context.Context, req *pb.PublisherCreateReq) (*pb.PublisherGetRes, error) {
	var publisher pb.PublisherGetRes
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO publishers (name, description) VALUES ($1, $2) RETURNING id, name, description`,
		strings.TrimSpace(req.Name), req.Description,
	).Scan(&publisher.Id, &publisher.Name, &publisher.Description)
	if err != nil {
		return nil, err
	}
	return &publisher, nil
}

func (r *PublisherRepo) GetPublisher(ctx context.Context, req *pb.ByID) (*pb.PublisherGetRes, error) {
	query := `SELECT id, name, coalesce(description, '') FROM publishers WHERE id = $1`
	var pub pb.PublisherGetRes
	err := r.db.QueryRowContext(ctx, query, req.Id).Scan(
		&pub.Id,
		&pub.Name,
		&pub.Description,
	)
	if err != nil {
		return nil, err
	}
	return &pub, nil
}

func (r *PublisherRepo) UpdatePublisher(ctx context.Context, req *pb.PublisherUpdateReq) (*pb.Void, error) {
	query := `UPDATE publishers SET name = $1, description = $2 WHERE id = $3`
	result, err := r.db.ExecContext(ctx, query, req.Body.Name, req.Body.Description, req.Id)
	if err := requireAffected(result, err); err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *PublisherRepo) DeletePublisher(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	query := `DELETE FROM publishers WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, req.Id)
	if err := requireAffected(result, err); err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *PublisherRepo) GetAllPublishers(ctx context.Context, req *pb.PublishersGetAllReq) (*pb.GetAllPublishersRes, error) {
	query := `SELECT id, name, coalesce(description, '') FROM publishers WHERE 1=1`
	var args []interface{}
	argCount := 1

	// search
	if req.Search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argCount, argCount+1)
		args = append(args, "%"+req.Search+"%", "%"+req.Search+"%")
		argCount += 2
	}

	// order by
	switch strings.ToLower(strings.TrimSpace(req.OrderBy)) {
	case "":
		query += " ORDER BY created_at DESC, id"
	case "name":
		query += " ORDER BY name, id"
	case "created_at":
		query += " ORDER BY created_at, id"
	default:
		return nil, status.Error(codes.InvalidArgument, "unsupported sort order")
	}

	// pagination
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argCount, argCount+1)
	args = append(args, req.Limit, req.Offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var publishers []*pb.PublisherGetRes
	for rows.Next() {
		var pub pb.PublisherGetRes
		if err := rows.Scan(&pub.Id, &pub.Name, &pub.Description); err != nil {
			return nil, err
		}
		publishers = append(publishers, &pub)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	// Count query
	countQuery := "SELECT count(id) FROM publishers WHERE 1=1"
	var countArgs []interface{}
	argCount = 1

	if req.Search != "" {
		countQuery += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argCount, argCount+1)
		countArgs = append(countArgs, "%"+req.Search+"%", "%"+req.Search+"%")
	}

	var total uint64
	if err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, err
	}

	return &pb.GetAllPublishersRes{
		Publishers: publishers,
		TotalCount: total,
	}, nil
}
