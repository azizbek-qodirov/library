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

// CreatePublisher godoc
// @Summary Creates a new publisher
// @Description Creates a new publisher in the database
// @Tags 03-Publisher
// @Accept json
// @Produce json
// @Param message body pb.PublisherCreateReq true "Publisher create request"
// @Success 201 {object} pb.Void "Publisher created successfully"
// @Failure 400 {object} string "Invalid request payload"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /publisher [post]
func (h *HTTPHandler) CreatePublisher(c *gin.Context) {
	req := &pb.PublisherCreateReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	if err := validation.ValidateStringNotEmpty(req.Name, "Name"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.PS.CreatePublisher(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Create publisher")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Publisher created successfully"})
}

// GetPublisherByID godoc
// @Summary Get publisher by ID
// @Description Retrieves a publisher's information by ID
// @Tags 03-Publisher
// @Accept json
// @Produce json
// @Param id path string true "Publisher ID"
// @Success 200 {object} pb.PublisherGetRes "Publisher found"
// @Failure 400 {object} string "Invalid publisher ID"
// @Failure 404 {object} string "Publisher not found"
// @Failure 500 {object} string "Server error"
// @Router /publisher/{id} [get]
func (h *HTTPHandler) GetPublisherByID(c *gin.Context) {
	id := c.Param("id")
	if err := validation.ValidateUUID(id, "Publisher ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.PS.GetPublisher(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get publisher")
		return
	}

	c.JSON(http.StatusOK, resp)
}

// UpdatePublisher godoc
// @Summary Update publisher
// @Description Updates an existing publisher
// @Tags 03-Publisher
// @Accept json
// @Produce json
// @Param id path string true "Publisher ID"
// @Param message body pb.PublisherUpdateBody true "Publisher update request"
// @Success 200 {object} pb.Void "Publisher updated successfully"
// @Failure 400 {object} string "Invalid request payload or publisher ID"
// @Failure 404 {object} string "Publisher not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /publisher/{id} [put]
func (h *HTTPHandler) UpdatePublisher(c *gin.Context) {
	id := c.Param("id")
	if err := validation.ValidateUUID(id, "Publisher ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	body := &pb.PublisherUpdateBody{}
	if err := c.ShouldBindJSON(body); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	if body.Name != "" {
		if err := validation.ValidateStringNotEmpty(body.Name, "Name"); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}

	req := &pb.PublisherUpdateReq{
		Id:   id,
		Body: body,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.PS.UpdatePublisher(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Update publisher")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Publisher updated successfully"})
}

// DeletePublisher godoc
// @Summary Delete publisher
// @Description Deletes a publisher by ID
// @Tags 03-Publisher
// @Accept json
// @Produce json
// @Param id path string true "Publisher ID"
// @Success 200 {object} pb.Void "Publisher deleted successfully"
// @Failure 400 {object} string "Invalid publisher ID"
// @Failure 404 {object} string "Publisher not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /publisher/{id} [delete]
func (h *HTTPHandler) DeletePublisher(c *gin.Context) {
	id := c.Param("id")
	if err := validation.ValidateUUID(id, "Publisher ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.PS.DeletePublisher(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Delete publisher")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Publisher deleted successfully"})
}

// GetAllPublishers godoc
// @Summary Get all publishers
// @Description Retrieves a list of all publishers
// @Tags 03-Publisher
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Param order_by query string false "Order by field"
// @Param search query string false "Search query"
// @Success 200 {object} pb.GetAllPublishersRes "List of publishers"
// @Failure 500 {object} string "Server error"
// @Router /publishers [get]
func (h *HTTPHandler) GetAllPublishers(c *gin.Context) {
	limit, offset, ok := pagination(c)
	if !ok {
		return
	}

	orderBy := c.Query("order_by")
	search := c.Query("search")

	// Validate orderBy to prevent SQL injection

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.PS.GetAllPublishers(ctx, &pb.PublishersGetAllReq{
		Limit:   uint64(limit),
		Offset:  uint64(offset),
		OrderBy: orderBy,
		Search:  search,
	})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get all publishers")
		return
	}

	c.JSON(http.StatusOK, resp)
}
