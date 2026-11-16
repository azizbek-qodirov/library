package minio_connect

import (
	"context"
	"fmt"
	"log"
	"time"

	"library-gateway/internal/pkg/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinioClient struct {
	Client     *minio.Client
	bucketName string
}

func NewMinioClient(cfg *config.Config) (*MinioClient, error) {
	if cfg.MINIO_ACCESS_KEY == "" || cfg.MINIO_SECRET_KEY == "" {
		return nil, fmt.Errorf("MINIO_ACCESS_KEY and MINIO_SECRET_KEY are required")
	}
	minioClient, err := minio.New(cfg.MINIO_ENDPOINT, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MINIO_ACCESS_KEY, cfg.MINIO_SECRET_KEY, ""),
		Secure: cfg.MINIO_USE_SSL,
	})
	if err != nil {
		log.Println("Error creating Minio client:", err)
		return nil, err
	}

	bucketName := cfg.MINIO_BUCKET_NAME
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = minioClient.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
	if err != nil {
		exists, errBucketExists := minioClient.BucketExists(ctx, bucketName)
		if errBucketExists != nil {
			return nil, errBucketExists
		}
		if exists {
			log.Println("Bucket already exists:", bucketName)
		} else {
			log.Println("Error creating bucket:", err)
			return nil, err
		}
	}

	policy := fmt.Sprintf(`{
      "Version": "2012-10-17",
      "Statement": [
          {
              "Effect": "Allow",
              "Principal": "*",
              "Action": ["s3:GetObject"],
              "Resource": ["arn:aws:s3:::%s/*"]
          }
      ]
  }`, bucketName)

	err = minioClient.SetBucketPolicy(ctx, bucketName, policy)
	if err != nil {
		log.Println("Error while setting bucket policy:", err)
		return nil, err
	}

	return &MinioClient{Client: minioClient, bucketName: bucketName}, nil
}

func (m *MinioClient) DefaultBucket() string {
	return m.bucketName
}
