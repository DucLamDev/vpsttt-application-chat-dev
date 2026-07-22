package http

import (
	"crypto/aes"
	"crypto/cipher"
	cryptoRand "crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"time"
)

type zegoToken04Claims struct {
	AppID   uint32 `json:"app_id"`
	UserID  string `json:"user_id"`
	Nonce   int32  `json:"nonce"`
	CTime   int64  `json:"ctime"`
	Expire  int64  `json:"expire"`
	Payload string `json:"payload"`
}

func generateZegoToken04(appID uint32, userID string, serverSecret string, effectiveTimeInSeconds int64, payload string) (string, error) {
	if appID == 0 {
		return "", fmt.Errorf("appID invalid")
	}
	if userID == "" || len(userID) > 64 {
		return "", fmt.Errorf("userID invalid")
	}
	if len(serverSecret) != 32 {
		return "", fmt.Errorf("serverSecret must be a 32 byte string")
	}
	if effectiveTimeInSeconds <= 0 {
		return "", fmt.Errorf("effectiveTimeInSeconds invalid")
	}

	createTime := time.Now().Unix()
	claims := zegoToken04Claims{
		AppID:   appID,
		UserID:  userID,
		Nonce:   randomInt32(),
		CTime:   createTime,
		Expire:  createTime + effectiveTimeInSeconds,
		Payload: payload,
	}
	plainText, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("encode zego token claims: %w", err)
	}

	nonce := make([]byte, 12)
	if _, err := cryptoRand.Read(nonce); err != nil {
		return "", fmt.Errorf("generate zego token nonce: %w", err)
	}
	block, err := aes.NewCipher([]byte(serverSecret))
	if err != nil {
		return "", fmt.Errorf("create zego token cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create zego token gcm: %w", err)
	}
	encrypted := gcm.Seal(nil, nonce, plainText, nil)

	tokenBytes := make([]byte, 8+2+len(nonce)+2+len(encrypted)+1)
	binary.BigEndian.PutUint64(tokenBytes[0:8], uint64(claims.Expire))
	binary.BigEndian.PutUint16(tokenBytes[8:10], uint16(len(nonce)))
	offset := 10
	copy(tokenBytes[offset:offset+len(nonce)], nonce)
	offset += len(nonce)
	binary.BigEndian.PutUint16(tokenBytes[offset:offset+2], uint16(len(encrypted)))
	offset += 2
	copy(tokenBytes[offset:offset+len(encrypted)], encrypted)
	offset += len(encrypted)
	tokenBytes[offset] = 1

	return "04" + base64.StdEncoding.EncodeToString(tokenBytes), nil
}

func randomInt32() int32 {
	var buf [4]byte
	if _, err := cryptoRand.Read(buf[:]); err != nil {
		return int32(time.Now().UnixNano())
	}
	return int32(binary.BigEndian.Uint32(buf[:]))
}
