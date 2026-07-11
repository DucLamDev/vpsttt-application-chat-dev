package application

import "testing"

func TestDetectDeviceName(t *testing.T) {
	tests := []struct {
		name      string
		userAgent string
		want      string
	}{
		{
			name:      "windows chrome",
			userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
			want:      "Windows - Chrome",
		},
		{
			name:      "iphone safari",
			userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
			want:      "iPhone - Safari",
		},
		{
			name:      "unknown",
			userAgent: "",
			want:      "Thiết bị không xác định",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := detectDeviceName(tt.userAgent); got != tt.want {
				t.Fatalf("detectDeviceName() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestNormalizeClientInfoKeepsExplicitDeviceName(t *testing.T) {
	deviceName, ipAddress, userAgent := normalizeClientInfo("Laptop kế toán", "127.0.0.1", "Mozilla/5.0")

	if deviceName != "Laptop kế toán" {
		t.Fatalf("deviceName = %q", deviceName)
	}
	if ipAddress != "127.0.0.1" {
		t.Fatalf("ipAddress = %q", ipAddress)
	}
	if userAgent != "Mozilla/5.0" {
		t.Fatalf("userAgent = %q", userAgent)
	}
}

func TestGoogleUsernameIsStableAndValid(t *testing.T) {
	username := googleUsername("Ho.Duc.Lam@example.com", "google-subject-123")
	if !usernamePattern.MatchString(username) {
		t.Fatalf("googleUsername() = %q không hợp lệ", username)
	}
	if username != googleUsername("Ho.Duc.Lam@example.com", "google-subject-123") {
		t.Fatal("googleUsername() phải ổn định với cùng Google subject")
	}
}
