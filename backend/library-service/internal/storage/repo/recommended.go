package repo

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	pb "library/internal/pkg/genproto"

	"github.com/lib/pq"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type RecommendedRepo struct {
	db *sql.DB
}

func NewRecommendedRepo(db *sql.DB) *RecommendedRepo {
	return &RecommendedRepo{db: db}
}

func (r *RecommendedRepo) CreateRecommended(ctx context.Context, req *pb.RecommendedCreateReq) (*pb.Void, error) {
	query := `INSERT INTO recommendeds (book_id) VALUES ($1)`
	_, err := r.db.ExecContext(ctx, query, req.BookId)
	if err != nil {
		var pgErr *pq.Error
		if errors.As(err, &pgErr) && pgErr.Constraint == "recommendeds_book_id_unique" {
			return nil, status.Error(codes.AlreadyExists, "this book is already recommended")
		}
		return nil, err
	}
	return &pb.Void{}, nil
}

const recommendationJSON = `jsonb_build_object('id', r.id, 'created_at', r.created_at, 'book_id', ` + bookJSON + `)`
const recommendationsFrom = " FROM recommendeds r JOIN books b ON b.id = r.book_id"

func (r *RecommendedRepo) GetRecommended(ctx context.Context, req *pb.ByID) (*pb.RecommendedGetRes, error) {
	return readJSON[pb.RecommendedGetRes](r.db.QueryRowContext(ctx, "SELECT "+recommendationJSON+recommendationsFrom+" WHERE r.id = $1", req.Id))
}

func (r *RecommendedRepo) DeleteRecommended(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return &pb.Void{}, requireAffected(r.db.ExecContext(ctx, "DELETE FROM recommendeds WHERE id = $1", req.Id))
}

func (r *RecommendedRepo) GetAllRecommendeds(ctx context.Context, req *pb.RecommendedsGetAllReq) (*pb.RecommendedsGetAllRes, error) {
	query := listQuery{where: recommendationsFrom + " WHERE TRUE"}
	if term := strings.TrimSpace(req.Search); term != "" {
		query.add(catalogSearch, "%"+searchApostrophes.Replace(term)+"%")
	}
	page, args := query.page(" ORDER BY r.created_at DESC, r.id", req.Limit, req.Offset)
	rows, err := r.db.QueryContext(ctx, "SELECT "+recommendationJSON+page, args...)
	if err != nil {
		return nil, err
	}
	items, err := readJSONList[pb.RecommendedGetRes](rows)
	if err != nil {
		return nil, err
	}
	var total int64
	if err := r.db.QueryRowContext(ctx, "SELECT count(*)"+query.where, query.args...).Scan(&total); err != nil {
		return nil, err
	}
	return &pb.RecommendedsGetAllRes{Recommendeds: items, TotalCount: total}, nil
}
