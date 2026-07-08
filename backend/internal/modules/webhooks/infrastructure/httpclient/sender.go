package httpclient

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"strconv"
	"time"

	webhooksapp "github.com/duclamdev/application-chat/backend/internal/modules/webhooks/application"
	webhooksdomain "github.com/duclamdev/application-chat/backend/internal/modules/webhooks/domain"
)

type Sender struct {
	client *http.Client
	now    func() time.Time
}

func NewSender() *Sender {
	return &Sender{
		client: &http.Client{Timeout: 10 * time.Second},
		now:    time.Now,
	}
}

func (s *Sender) Send(ctx context.Context, delivery webhooksdomain.Delivery) (webhooksapp.DeliveryResult, error) {
	timestamp := strconv.FormatInt(s.now().UTC().Unix(), 10)
	signature := sign(delivery.SecretHash, timestamp, delivery.RequestBody)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, delivery.TargetURL, bytes.NewReader(delivery.RequestBody))
	if err != nil {
		return webhooksapp.DeliveryResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-WebTui-Event-ID", valueOrEmpty(delivery.EventID))
	req.Header.Set("X-WebTui-Event-Type", delivery.EventType)
	req.Header.Set("X-WebTui-Timestamp", timestamp)
	req.Header.Set("X-WebTui-Signature", signature)

	resp, err := s.client.Do(req)
	if err != nil {
		return webhooksapp.DeliveryResult{}, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	result := webhooksapp.DeliveryResult{StatusCode: resp.StatusCode, Body: string(body)}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return result, errNon2xx{}
	}
	return result, nil
}

func sign(secretHash string, timestamp string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secretHash))
	_, _ = mac.Write([]byte(timestamp))
	_, _ = mac.Write([]byte("."))
	_, _ = mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

type errNon2xx struct{}

func (errNon2xx) Error() string {
	return "webhook trả về trạng thái không thành công"
}
