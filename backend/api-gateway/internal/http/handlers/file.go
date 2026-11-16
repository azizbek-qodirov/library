package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"library-gateway/internal/pkg/errors"
	pb "library-gateway/internal/pkg/genproto"
	"library-gateway/internal/pkg/validation"

	"github.com/gin-gonic/gin"
	"github.com/minio/minio-go/v7"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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
// @Security StaffAuth
// @Router /file [post]
func (h *HTTPHandler) CreateFile(c *gin.Context) {
	const maxImageBytes = 5 << 20
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxImageBytes+(64<<10))
	defer func() {
		if c.Request.MultipartForm != nil {
			_ = c.Request.MultipartForm.RemoveAll()
		}
	}()
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		errors.BadRequest(c, "Invalid file upload or file exceeds 5 MB")
		return
	}
	defer file.Close()
	if header.Size > maxImageBytes {
		errors.BadRequest(c, "File exceeds 5 MB")
		return
	}

	var signature [512]byte
	n, err := io.ReadFull(file, signature[:])
	if err != nil && err != io.ErrUnexpectedEOF {
		errors.BadRequest(c, "Could not read image")
		return
	}
	mimeType := http.DetectContentType(signature[:n])
	var extension string
	switch mimeType {
	case "image/jpeg":
		extension = ".jpg"
	case "image/png":
		extension = ".png"
	case "image/gif":
		extension = ".gif"
	case "image/webp":
		extension = ".webp"
	default:
		errors.BadRequest(c, "Cover must be a JPEG, PNG, GIF, or WebP image")
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		errors.InternalError(c, "Read image")
		return
	}

	var randomID [16]byte
	if _, err := rand.Read(randomID[:]); err != nil {
		errors.InternalError(c, "Generate file key")
		return
	}
	key := hex.EncodeToString(randomID[:]) + extension
	publicURL := strings.TrimRight(h.Config.MINIO_PUBLIC_URL, "/")
	if publicURL == "" {
		protocol := "http"
		if h.Config.MINIO_USE_SSL {
			protocol = "https"
		}
		publicURL = protocol + "://" + h.Config.MINIO_ENDPOINT
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Reserve metadata first so an interrupted upload remains visible for cleanup.
	record, err := h.FS.CreateFile(ctx, &pb.FileCreateReq{
		Url:      fmt.Sprintf("%s/%s/%s", publicURL, h.Minio.DefaultBucket(), key),
		MimeType: mimeType, Size: header.Size, ObjectKey: key, PendingUpload: true,
	})
	if err != nil {
		errors.HandleGRPCError(c, err, "Reserve file record")
		return
	}

	_, err = h.Minio.Client.PutObject(ctx, h.Minio.DefaultBucket(), key, file, header.Size,
		minio.PutObjectOptions{ContentType: mimeType})
	if err != nil {
		h.Logger.ERROR.Printf("Upload for file %s did not complete: %v", record.Id, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Cover upload failed", "file_id": record.Id})
		return
	}
	ready, err := h.FS.ActivateFile(ctx, &pb.ByID{Id: record.Id})
	if err != nil {
		h.Logger.ERROR.Printf("Could not confirm activation for file %s: %v", record.Id, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Could not confirm cover upload", "file_id": record.Id})
		return
	}
	c.JSON(http.StatusCreated, ready)
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
// @Security StaffAuth
// @Router /file/{id} [get]
func (h *HTTPHandler) GetFile(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "File ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	res, err := h.FS.GetFile(ctx, &pb.ByID{Id: id})
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
// @Security StaffAuth
// @Router /file/{id} [delete]
func (h *HTTPHandler) DeleteFile(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "File ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	req := &pb.ByID{Id: id}
	file, err := h.FS.PrepareFileDeletion(ctx, req)
	if status.Code(err) == codes.NotFound {
		c.JSON(http.StatusOK, gin.H{"message": "File deleted successfully"})
		return
	}
	if err != nil {
		errors.HandleGRPCError(c, err, "Prepare file deletion")
		return
	}

	key := file.ObjectKey
	if key == "" {
		// Legacy records used the full URL and did not persist the object key.
		legacyURL, err := url.Parse(file.Url)
		prefix := "/" + h.Minio.DefaultBucket() + "/"
		if err != nil || !strings.HasPrefix(legacyURL.Path, prefix) {
			errors.InternalError(c, "Resolve legacy file key")
			return
		}
		key = strings.TrimPrefix(legacyURL.Path, prefix)
		if key == "" {
			errors.InternalError(c, "Resolve legacy file key")
			return
		}
	}
	if err := h.Minio.Client.RemoveObject(ctx, h.Minio.DefaultBucket(), key, minio.RemoveObjectOptions{}); err != nil {
		h.Logger.ERROR.Printf("Could not remove object for file %s: %v", id, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Could not remove the cover. Retry the same deletion."})
		return
	}
	if _, err := h.FS.DeleteFile(ctx, req); err != nil {
		errors.HandleGRPCError(c, err, "Finalize file deletion")
		return
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
// @Security StaffAuth
// @Router /files [get]
func (h *HTTPHandler) GetAllFiles(c *gin.Context) {
	limit, offset, ok := pagination(c)
	if !ok {
		return
	}
	req := &pb.FilesGetAllReq{Offset: offset, Limit: limit, MimeType: c.Query("mime_type")}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	res, err := h.FS.GetAllFiles(ctx, req)
	if err != nil {
		h.Logger.ERROR.Printf("Error getting all files: %v", err)
		errors.HandleGRPCError(c, err, "Get all files")
		return
	}

	c.JSON(http.StatusOK, res)
}
