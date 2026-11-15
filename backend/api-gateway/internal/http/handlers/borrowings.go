package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"library-gateway/internal/pkg/errors"
	pb "library-gateway/internal/pkg/genproto"
	"library-gateway/internal/pkg/validation"

	"github.com/gin-gonic/gin"
)

// CreateBorrowing godoc
// @Summary Creates a new borrowing
// @Description Creates a new borrowing record in the database
// @Tags 06-Borrowing
// @Accept json
// @Produce json
// @Param message body pb.BorrowingCreateReq true "Borrowing create request"
// @Success 201 {object} pb.Void "Borrowing created successfully"
// @Failure 400 {object} string "Invalid request payload"
// @Failure 500 {object} string "Server error"
// @Router /borrowing [post]
func (h *HTTPHandler) CreateBorrowing(c *gin.Context) {
	req := &pb.BorrowingCreateReq{}
	if err := c.BindJSON(req); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	// Validate required fields
	if err := validation.ValidateUUID(req.BookId, "Book ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}
	if err := validation.ValidateUUID(req.UserId, "User ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.BS.CreateBorrowing(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Create borrowing")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Borrowing created successfully"})
}

// GetBorrowing godoc
// @Summary Get borrowing by ID
// @Description Retrieves a borrowing record by ID
// @Tags 06-Borrowing
// @Accept json
// @Produce json
// @Param id path string true "Borrowing ID"
// @Success 200 {object} pb.BorrowingGetRes "Borrowing found"
// @Failure 400 {object} string "Invalid borrowing ID"
// @Failure 404 {object} string "Borrowing not found"
// @Failure 500 {object} string "Server error"
// @Router /borrowing/{id} [get]
func (h *HTTPHandler) GetBorrowing(c *gin.Context) {
	id := c.Param("id")
	if err := validation.ValidateUUID(id, "Borrowing ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.BS.GetBorrowing(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get borrowing")
		return
	}

	c.JSON(http.StatusOK, resp)
}

// UpdateBorrowing godoc
// @Summary Update borrowing
// @Description Updates an existing borrowing record
// @Tags 06-Borrowing
// @Accept json
// @Produce json
// @Param id path string true "Borrowing ID"
// @Param message body pb.BorrowingUpdateBody true "Borrowing update request"
// @Success 200 {object} pb.Void "Borrowing updated successfully"
// @Failure 400 {object} string "Invalid request payload or borrowing ID"
// @Failure 404 {object} string "Borrowing not found"
// @Failure 500 {object} string "Server error"
// @Router /borrowing/{id} [put]
func (h *HTTPHandler) UpdateBorrowing(c *gin.Context) {
	id := c.Param("id")
	if err := validation.ValidateUUID(id, "Borrowing ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	body := &pb.BorrowingUpdateBody{}
	if err := c.BindJSON(body); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	// Validate status if present
	if body.Status != "" {
		validStatuses := map[string]bool{"borrowed": true, "returned": true, "lost": true}
		if !validStatuses[body.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Must be: borrowed, returned, or lost"})
			return
		}
	}

	req := &pb.BorrowingUpdateReq{
		Id:   id,
		Body: body,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.BS.UpdateBorrowing(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Update borrowing")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Borrowing updated successfully"})
}

// DeleteBorrowing godoc
// @Summary Delete borrowing
// @Description Deletes a borrowing record by ID
// @Tags 06-Borrowing
// @Accept json
// @Produce json
// @Param id path string true "Borrowing ID"
// @Success 200 {object} pb.Void "Borrowing deleted successfully"
// @Failure 400 {object} string "Invalid borrowing ID"
// @Failure 404 {object} string "Borrowing not found"
// @Failure 500 {object} string "Server error"
// @Router /borrowing/{id} [delete]
func (h *HTTPHandler) DeleteBorrowing(c *gin.Context) {
	id := c.Param("id")
	if err := validation.ValidateUUID(id, "Borrowing ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.BS.DeleteBorrowing(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Delete borrowing")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Borrowing deleted successfully"})
}

// GetAllBorrowings godoc
// @Summary Get all borrowings
// @Description Retrieves a list of borrowings with filters
// @Tags 06-Borrowing
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Param search query string false "Search by book title, author, or borrower name"
// @Param from_date query string false "Filter by start date (YYYY-MM-DD)"
// @Param due_date query string false "Filter by due date (YYYY-MM-DD)"
// @Param status query string false "Filter by status"
// @Success 200 {object} pb.BorrowingsGetAllRes "List of borrowings"
// @Failure 500 {object} string "Server error"
// @Router /borrowings [get]
func (h *HTTPHandler) GetAllBorrowings(c *gin.Context) {
	limitStr := c.Query("limit")
	offsetStr := c.Query("offset")

	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 10
	}
	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		offset = 0
	}

	if err := validation.ValidatePagination(int32(limit), int32(offset)); err != nil {
		errors.ValidationError(c, err)
		return
	}

	search := c.Query("search")
	fromDate := c.Query("from_date")
	dueDate := c.Query("due_date")
	status := c.Query("status")

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.BS.GetAllBorrowings(ctx, &pb.BorrowingsGetAllReq{
		Limit:    int64(limit),
		Offset:   int64(offset),
		Search:   search,
		FromDate: fromDate,
		DueDate:  dueDate,
		Status:   status,
	})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get all borrowings")
		return
	}

	c.JSON(http.StatusOK, resp)
}
