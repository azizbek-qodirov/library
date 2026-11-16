package handlers

import (
	"context"
	"net/http"
	"time"

	"library-gateway/internal/pkg/errors"
	pb "library-gateway/internal/pkg/genproto"
	"library-gateway/internal/pkg/validation"

	"github.com/gin-gonic/gin"
)

// CreateRecommended godoc
// @Summary Create a recommended book
// @Description Marks a book as recommended
// @Tags 07-Recommended
// @Accept json
// @Produce json
// @Param message body pb.RecommendedCreateReq true "Recommended create request"
// @Success 201 {object} pb.Void "Recommended created successfully"
// @Failure 400 {object} string "Invalid request payload"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /recommended [post]
func (h *HTTPHandler) CreateRecommendedBook(c *gin.Context) {
	req := &pb.RecommendedCreateReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	// Validate book ID
	if err := validation.ValidateUUID(req.BookId, "Book ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.RS.CreateRecommended(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Create recommended")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Recommended book created successfully"})
}

// GetRecommendedBook godoc
// @Summary Get recommended book by ID
// @Description Retrieves a recommended book (with nested book, author, publisher, categories)
// @Tags 07-Recommended
// @Accept json
// @Produce json
// @Param id path string true "Recommended ID"
// @Success 200 {object} pb.RecommendedGetRes "Recommended book"
// @Failure 400 {object} string "Invalid ID"
// @Failure 404 {object} string "Recommended book not found"
// @Failure 500 {object} string "Server error"
// @Router /recommended/{id} [get]
func (h *HTTPHandler) GetRecommendedBook(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "Recommended ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.RS.GetRecommended(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get recommended")
		return
	}

	c.JSON(http.StatusOK, resp)
}

// DeleteRecommendedBook godoc
// @Summary Delete recommended book
// @Description Removes a recommended book by ID
// @Tags 07-Recommended
// @Accept json
// @Produce json
// @Param id path string true "Recommended ID"
// @Success 200 {object} pb.Void "Recommended deleted successfully"
// @Failure 400 {object} string "Invalid ID"
// @Failure 404 {object} string "Recommended not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /recommended/{id} [delete]
func (h *HTTPHandler) DeleteRecommendedBook(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "Recommended ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.RS.DeleteRecommended(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Delete recommended")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Recommended book deleted successfully"})
}

// GetRecommendedBooks godoc
// @Summary Get all recommended books
// @Description Retrieves a paginated list of recommended books
// @Tags 07-Recommended
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Param search query string false "Search title, ISBN, or author"
// @Success 200 {object} pb.RecommendedsGetAllRes "List of recommended books"
// @Failure 500 {object} string "Server error"
// @Router /recommended [get]
func (h *HTTPHandler) GetRecommendedBooks(c *gin.Context) {
	limit, offset, ok := pagination(c)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.RS.GetAllRecommendeds(ctx, &pb.RecommendedsGetAllReq{
		Limit:  int64(limit),
		Offset: int64(offset),
		Search: c.Query("search"),
	})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get all recommended")
		return
	}

	c.JSON(http.StatusOK, resp)
}
