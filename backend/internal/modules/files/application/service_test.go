package application

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	apperrors "github.com/duclamdev/application-chat/backend/internal/shared/errors"
)

func TestValidateUploadRejectsDangerousMimeType(t *testing.T) {
	_, _, _, err := validateUpload("tool.exe", "application/x-msdownload", 128, nil)
	if err == nil {
		t.Fatal("validateUpload() phải chặn MIME nguy hiểm")
	}
	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("lỗi = %T, muốn AppError", err)
	}
	if appErr.Code != "VALIDATION_ERROR" {
		t.Fatalf("mã lỗi = %q", appErr.Code)
	}
}

func TestValidateUploadAcceptsMetadataJSON(t *testing.T) {
	_, _, metadata, err := validateUpload("bao-cao.pdf", "application/pdf", 1024, json.RawMessage(`{"module":"test"}`))
	if err != nil {
		t.Fatalf("validateUpload() trả lỗi: %v", err)
	}
	if string(metadata) != `{"module":"test"}` {
		t.Fatalf("metadata = %s", metadata)
	}
}

func TestNewObjectKeySanitizesFilename(t *testing.T) {
	key, err := newObjectKey("workspace-1", "../Báo cáo quý 1.pdf", "files", func() time.Time {
		return time.Date(2026, 7, 6, 0, 0, 0, 0, time.UTC)
	})
	if err != nil {
		t.Fatalf("newObjectKey() trả lỗi: %v", err)
	}
	if strings.Contains(key, "..") || strings.Contains(key, "\\") {
		t.Fatalf("object key không an toàn: %s", key)
	}
	if !strings.HasPrefix(key, "workspaces/workspace-1/files/2026/07/") {
		t.Fatalf("object key = %s", key)
	}
}
