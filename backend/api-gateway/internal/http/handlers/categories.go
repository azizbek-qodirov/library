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

type CategoryCreateResponse struct {
	Message  string             `json:"message"`
	Category *pb.CategoryGetRes `json:"category"`
}

// CreateCategory godoc
// @Summary Creates a new category
// @Description Creates a new category in the database
// @Tags 02-Category
// @Accept json
// @Produce json
// @Param message body pb.CategoryCreateReq true "Category create request"
// @Success 201 {object} CategoryCreateResponse "Category created successfully"
// @Failure 400 {object} string "Invalid request payload"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /category [post]
func (h *HTTPHandler) CreateCategory(c *gin.Context) {
	req := &pb.CategoryCreateReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	// Validate required fields
	if err := validation.ValidateStringNotEmpty(req.Name, "Name"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	created, err := h.CS.CreateCategory(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Create category")
		return
	}

	c.JSON(http.StatusCreated, CategoryCreateResponse{Message: "Category created successfully", Category: created})
}

// GetCategoryByID godoc
// @Summary Get category by ID
// @Description Retrieves a category's information by ID
// @Tags 02-Category
// @Accept json
// @Produce json
// @Param id path string true "Category ID"
// @Success 200 {object} pb.CategoryGetRes "Category found"
// @Failure 400 {object} string "Invalid category ID"
// @Failure 404 {object} string "Category not found"
// @Failure 500 {object} string "Server error"
// @Router /category/{id} [get]
func (h *HTTPHandler) GetCategoryByID(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "Category ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.CS.GetCategory(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get category")
		return
	}

	c.JSON(http.StatusOK, resp)
}

// UpdateCategory godoc
// @Summary Update category
// @Description Updates an existing category
// @Tags 02-Category
// @Accept json
// @Produce json
// @Param id path string true "Category ID"
// @Param message body pb.CategoryUpdateBody true "Category update request"
// @Success 200 {object} pb.Void "Category updated successfully"
// @Failure 400 {object} string "Invalid request payload or category ID"
// @Failure 404 {object} string "Category not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /category/{id} [put]
func (h *HTTPHandler) UpdateCategory(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "Category ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	body := &pb.CategoryUpdateBody{}
	if err := c.ShouldBindJSON(body); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	// Validate fields if present
	if body.Name != "" {
		if err := validation.ValidateStringNotEmpty(body.Name, "Name"); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}

	req := &pb.CategoryUpdateReq{
		Id:   id,
		Body: body,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.CS.UpdateCategory(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Update category")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Category updated successfully"})
}

// DeleteCategory godoc
// @Summary Delete category
// @Description Deletes a category by ID
// @Tags 02-Category
// @Accept json
// @Produce json
// @Param id path string true "Category ID"
// @Success 200 {object} pb.Void "Category deleted successfully"
// @Failure 400 {object} string "Invalid category ID"
// @Failure 404 {object} string "Category not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /category/{id} [delete]
func (h *HTTPHandler) DeleteCategory(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "Category ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.CS.DeleteCategory(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Delete category")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Category deleted successfully"})
}

// GetAllCategories godoc
// @Summary Get all categories
// @Description Retrieves a list of all categories
// @Tags 02-Category
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Param search query string false "Search query"
// @Param sort query string false "Use book_count to rank by title count"
// @Success 200 {object} pb.GetAllCategoriesRes "List of categories"
// @Failure 500 {object} string "Server error"
// @Router /categories [get]
func (h *HTTPHandler) GetAllCategories(c *gin.Context) {
	limit, offset, ok := pagination(c)
	if !ok {
		return
	}

	search := c.Query("search")

	sort := c.Query("sort")
	if sort != "" && sort != "book_count" {
		errors.BadRequest(c, "sort must be book_count when supplied")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.CS.GetAllCategories(ctx, &pb.CategoriesGetAllReq{
		Limit:           uint64(limit),
		Offset:          uint64(offset),
		Search:          search,
		SortByBookCount: sort == "book_count",
	})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get all categories")
		return
	}

	c.JSON(http.StatusOK, resp)
}
