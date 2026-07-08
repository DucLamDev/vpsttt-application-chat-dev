package response

import (
	stderrors "errors"
	"net/http"
	"time"

	apperrors "github.com/duclamdev/application-chat/backend/internal/shared/errors"
	"github.com/gin-gonic/gin"
)

type Body struct {
	Success   bool       `json:"success"`
	Data      any        `json:"data,omitempty"`
	Error     *ErrorBody `json:"error,omitempty"`
	Meta      any        `json:"meta,omitempty"`
	RequestID string     `json:"request_id,omitempty"`
	Timestamp time.Time  `json:"timestamp"`
}

type ErrorBody struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

func OK(c *gin.Context, status int, data any) {
	c.JSON(status, Body{
		Success:   true,
		Data:      data,
		RequestID: requestID(c),
		Timestamp: time.Now().UTC(),
	})
}

func OKWithMeta(c *gin.Context, status int, data any, meta any) {
	c.JSON(status, Body{
		Success:   true,
		Data:      data,
		Meta:      meta,
		RequestID: requestID(c),
		Timestamp: time.Now().UTC(),
	})
}

func Created(c *gin.Context, data any) {
	OK(c, http.StatusCreated, data)
}

func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

func Fail(c *gin.Context, status int, code string, message string, details map[string]any) {
	c.JSON(status, Body{
		Success: false,
		Error: &ErrorBody{
			Code:    code,
			Message: message,
			Details: details,
		},
		RequestID: requestID(c),
		Timestamp: time.Now().UTC(),
	})
}

func Error(c *gin.Context, err error) {
	var appErr *apperrors.AppError
	if stderrors.As(err, &appErr) {
		Fail(c, appErr.Status, appErr.Code, appErr.Message, appErr.Details)
		return
	}

	Fail(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Hệ thống đang bận, vui lòng thử lại sau.", nil)
}

func requestID(c *gin.Context) string {
	value, ok := c.Get("request_id")
	if !ok {
		return ""
	}

	requestID, _ := value.(string)
	return requestID
}
