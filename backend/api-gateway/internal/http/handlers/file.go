package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"library-gateway/internal/pkg/config"
	"library-gateway/internal/pkg/errors"
	pb "library-gateway/internal/pkg/genproto"
	"library-gateway/internal/pkg/validation"

	"github.com/gin-gonic/gin"
	"github.com/minio/minio-go/v7"
)

// CreateFile godoc
// @Summary Upload a new file
// @Description Uploads a file to Minio and stores metadata in the FileService.
// @Tags 08-File
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "File to upload"
// @Success 201 {object} pb.FileGetRes "File created successfully"
// @Failure 400 {object} string "Invalid file upload"
// @Failure 500 {object} string "Server error"
// @Router /file [post]
func (h *HTTPHandler) CreateFile(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file upload", "details": err.Error()})
		return
	}
	defer file.Close()

	if header.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File size too large. Maximum allowed size is 5MB"})
		return
	}

	uniqueFileName := config.GenRandomNum() + "_" + header.Filename

	uploadInfo, err := h.Minio.Client.PutObject(
		c.Request.Context(),
		h.Minio.DefaultBucket(),
		uniqueFileName,
		file,
		header.Size,
		minio.PutObjectOptions{ContentType: header.Header.Get("Content-Type")},
	)
	if err != nil {
		h.Logger.ERROR.Printf("Error uploading file to Minio: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload file to Minio", "details": err.Error()})
		return
	}

	// Construct URL using MinIO endpoint from config
	protocol := "http"
	if h.Config.MINIO_USE_SSL {
		protocol = "https"
	}
	fileUrl := fmt.Sprintf("%s://%s/%s/%s", protocol, h.Config.MINIO_ENDPOINT, h.Minio.DefaultBucket(), uploadInfo.Key)
	req := &pb.FileCreateReq{
		Url:      fileUrl,
		MimeType: header.Header.Get("Content-Type"),
		Size:     header.Size,
	}

	res, err := h.FS.CreateFile(c.Request.Context(), req)
	if err != nil {
		h.Logger.ERROR.Printf("Error creating file record: %v", err)
		errors.HandleGRPCError(c, err, "Create file record")
		return
	}

	c.JSON(http.StatusCreated, res)
}

// GetFile godoc
// @Summary Get a file by ID
// @Description Retrieves a file record by its ID.
// @Tags 08-File
// @Produce json
// @Param id path string true "File ID"
// @Success 200 {object} pb.FileGetRes "File retrieved successfully"
// @Failure 404 {object} string "File not found"
// @Failure 500 {object} string "Server error"
// @Router /file/{id} [get]
func (h *HTTPHandler) GetFile(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "File ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	res, err := h.FS.GetFile(c.Request.Context(), &pb.ByID{Id: id})
	if err != nil {
		h.Logger.ERROR.Printf("Error getting file: %v", err)
		errors.HandleGRPCError(c, err, "Get file")
		return
	}

	c.JSON(http.StatusOK, res)
}

// DeleteFile godoc
// @Summary Delete a file
// @Description Deletes a file record and removes it from Minio.
// @Tags 08-File
// @Param id path string true "File ID"
// @Success 200 {object} string "File deleted successfully"
// @Failure 404 {object} string "File not found"
// @Failure 500 {object} string "Server error"
// @Router /file/{id} [delete]
func (h *HTTPHandler) DeleteFile(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "File ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	// Fetch file info to know object key
	file, err := h.FS.GetFile(c.Request.Context(), &pb.ByID{Id: id})
	if err != nil {
		h.Logger.ERROR.Printf("Error fetching file before deletion: %v", err)
		errors.HandleGRPCError(c, err, "Get file before deletion")
		return
	}

	_, err = h.FS.DeleteFile(c.Request.Context(), &pb.ByID{Id: id})
	if err != nil {
		h.Logger.ERROR.Printf("Error deleting file record: %v", err)
		errors.HandleGRPCError(c, err, "Delete file record")
		return
	}

	// Remove from Minio
	file_name := file.Url[strings.LastIndex(file.Url, "/")+1:]
	if err = h.Minio.Client.RemoveObject(
		c.Request.Context(),
		h.Minio.DefaultBucket(),
		file_name, // ⚠️ If this is a full URL, trim bucket/key part
		minio.RemoveObjectOptions{},
	); err != nil {
		h.Logger.ERROR.Printf("Error deleting file from Minio: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "File deleted successfully"})
}

// GetAllFiles godoc
// @Summary List all files
// @Description Retrieves all files with pagination and optional MIME type filter.
// @Tags 08-File
// @Produce json
// @Param offset query int false "Offset for pagination"
// @Param limit query int false "Limit per page"
// @Param mime_type query string false "Filter by MIME type"
// @Success 200 {object} pb.GetAllFilesRes "Files retrieved successfully"
// @Failure 500 {object} string "Server error"
// @Router /files [get]
func (h *HTTPHandler) GetAllFiles(c *gin.Context) {
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 64)
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "10"), 10, 64)
	mimeType := c.Query("mime_type")

	req := &pb.FilesGetAllReq{
		Offset:   offset,
		Limit:    limit,
		MimeType: mimeType,
	}

	// Validate pagination
	if err := validation.ValidatePagination(int32(limit), int32(offset)); err != nil {
		errors.ValidationError(c, err)
		return
	}

	res, err := h.FS.GetAllFiles(c.Request.Context(), req)
	if err != nil {
		h.Logger.ERROR.Printf("Error getting all files: %v", err)
		errors.HandleGRPCError(c, err, "Get all files")
		return
	}

	c.JSON(http.StatusOK, res)
}
