package application

import (
	"strings"
	"testing"
)

func TestFormatDepositQRMessageDoesNotExposeImageURL(t *testing.T) {
	body := formatDepositQRMessage(WalletDepositQRData{
		Amount:    200000,
		Email:     "khach@example.com",
		QRURL:     "https://order.example/qr/private-token.png",
		Reference: "WQR-123",
	})

	if strings.Contains(body, "https://order.example") || strings.Contains(body, "QR:") {
		t.Fatalf("QR URL must stay in message metadata, got %q", body)
	}
	if !strings.Contains(body, "THANH TOÁN · QR NẠP VÍ") {
		t.Fatalf("expected professional response heading, got %q", body)
	}
}

func TestFormatOrderPaymentQRMessageDoesNotExposeImageURL(t *testing.T) {
	body := formatOrderPaymentQRMessage(OrderPaymentQRData{
		Amount:          350000,
		ExternalOrderID: "QO-123",
		QRURL:           "https://order.example/qr/order-token.png",
		Reference:       "PAY-123",
	})

	if strings.Contains(body, "https://order.example") || strings.Contains(body, "QR:") {
		t.Fatalf("QR URL must stay in message metadata, got %q", body)
	}
	if !strings.Contains(body, "THANH TOÁN · QR ĐƠN HÀNG") {
		t.Fatalf("expected professional response heading, got %q", body)
	}
}
