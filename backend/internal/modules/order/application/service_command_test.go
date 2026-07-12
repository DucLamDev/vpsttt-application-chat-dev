package application

import "testing"

func TestParseAutoBotCommandRecognizesQuickOrderPayment(t *testing.T) {
	command := parseAutoBotCommand("Tạo QR cho đơn hàng QOIABCD1234EFGH5678")

	if !command.HasOrderPayment {
		t.Fatal("expected Quick Order payment intent")
	}
	if command.IntentCode != "QOIABCD1234EFGH5678" {
		t.Fatalf("IntentCode = %q", command.IntentCode)
	}
}

func TestParseAutoBotCommandKeepsWalletDepositSeparate(t *testing.T) {
	command := parseAutoBotCommand("Email: khach@example.com\nSố tiền: 200000")

	if command.HasOrderPayment {
		t.Fatal("wallet deposit must not be parsed as an order payment")
	}
	if !command.HasAmount || command.Amount != 200000 {
		t.Fatalf("Amount = %d, HasAmount = %v", command.Amount, command.HasAmount)
	}
}
