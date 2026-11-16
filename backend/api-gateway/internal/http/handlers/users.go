package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"library-gateway/internal/pkg/errors"
	pb "library-gateway/internal/pkg/genproto"
	"library-gateway/internal/pkg/validation"

	"github.com/gin-gonic/gin"
)

// CreateUser godoc
// @Summary Creates a new user
// @Description Creates a new user in the database with specified roles either student or teacher
// @Tags 01-User
// @Accept json
// @Produce json
// @Param message body pb.UserCreateReq true "User create request"
// @Success 201 {object} pb.Void "User created successfully"
// @Failure 400 {object} string "Invalid request payload"
// @Failure 401 {object} string "Unauthorized"
// @Failure 429 {object} string "Too many requests, please try again later"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /user [post]
func (h *HTTPHandler) CreateUser(c *gin.Context) {
	req := &pb.UserCreateReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	// Validate required fields
	if err := validation.ValidateStringNotEmpty(req.FullName, "Full name"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := validation.ValidateEmail(req.Email); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	phone, err := validation.NormalizePhone(req.Phone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Phone = phone
	req.Role = strings.ToLower(strings.TrimSpace(req.Role))
	if err := validation.ValidateRole(req.Role); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err = h.US.CreateUser(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Create user")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "User created successfully"})
}

// GetUserByID godoc
// @Summary Get user by ID
// @Description Retrieves a user's information by their ID
// @Tags 01-User
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} pb.UserGetRes "User found"
// @Failure 400 {object} string "Invalid user ID"
// @Failure 404 {object} string "User not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /user/{id} [get]
func (h *HTTPHandler) GetUserByID(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "User ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.US.GetUser(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get user")
		return
	}

	c.JSON(http.StatusOK, resp)
}

// UpdateUser godoc
// @Summary Update user
// @Description Updates an existing user's information
// @Tags 01-User
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param message body pb.UserUpdateBody true "User update request"
// @Success 200 {object} pb.Void "User updated successfully"
// @Failure 400 {object} string "Invalid request payload or user ID"
// @Failure 404 {object} string "User not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /user/{id} [put]
func (h *HTTPHandler) UpdateUser(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "User ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	body := &pb.UserUpdateBody{}
	if err := c.ShouldBindJSON(body); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	if err := validation.ValidateStringNotEmpty(body.FullName, "Full name"); err != nil {
		errors.ValidationError(c, err)
		return
	}
	if err := validation.ValidateEmail(body.Email); err != nil {
		errors.ValidationError(c, err)
		return
	}
	phone, err := validation.NormalizePhone(body.Phone)
	if err != nil {
		errors.ValidationError(c, err)
		return
	}
	body.Phone = phone
	body.Role = strings.ToLower(strings.TrimSpace(body.Role))
	if err := validation.ValidateRole(body.Role); err != nil {
		errors.ValidationError(c, err)
		return
	}

	req := &pb.UserUpdateReq{
		Id:   id,
		Body: body,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err = h.US.UpdateUser(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Update user")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully"})
}

// DeleteUser godoc
// @Summary Delete user
// @Description Deletes a user by their ID
// @Tags 01-User
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} pb.Void "User deleted successfully"
// @Failure 400 {object} string "Invalid user ID"
// @Failure 404 {object} string "User not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /user/{id} [delete]
func (h *HTTPHandler) DeleteUser(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "User ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.US.DeleteUser(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Delete user")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

// GetAllUsers godoc
// @Summary Get all users
// @Description Retrieves a list of all users
// @Tags 01-User
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Param search query string false "Search query"
// @Param group_name query string false "Group name"
// @Param role query string false "Role"
// @Success 200 {object} pb.UsersGetAllRes "List of users"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /users [get]
func (h *HTTPHandler) GetAllUsers(c *gin.Context) {
	limit, offset, ok := pagination(c)
	if !ok {
		return
	}

	search := c.Query("search")
	group_name := c.Query("group_name")
	role := strings.ToLower(strings.TrimSpace(c.Query("role")))

	// Validate role filter if provided
	if role != "" {
		if err := validation.ValidateRole(role); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.US.GetAllUsers(ctx, &pb.UsersGetAllReq{
		Limit:     int64(limit),
		Offset:    int64(offset),
		Search:    search,
		GroupName: group_name,
		Role:      role,
	})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get all users")
		return
	}

	c.JSON(http.StatusOK, resp)
}
