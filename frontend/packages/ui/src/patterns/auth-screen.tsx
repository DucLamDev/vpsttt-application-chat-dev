"use client";

import { type FormEvent, useState } from "react";
import { Button } from "../components/button";
import { Input } from "../components/input";

export type LoginFormValues = {
  identifier: string;
  password: string;
};

export type RegisterFormValues = {
  displayName: string;
  email: string;
  password: string;
  username: string;
};

export type AuthMode = "login" | "register";

export type AuthScreenProps = {
  error?: string | null;
  isPending?: boolean;
  mode: AuthMode;
  onLogin: (values: LoginFormValues) => void;
  onModeChange: (mode: AuthMode) => void;
  onRegister: (values: RegisterFormValues) => void;
  subtitle?: string;
  title?: string;
};

export function AuthScreen({
  error,
  isPending = false,
  mode,
  onLogin,
  onModeChange,
  onRegister,
  subtitle = "Nền tảng chat nội bộ dự án cho doanh nghiệp Việt",
  title = "WEBTUI CHAT"
}: AuthScreenProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (mode === "login") {
      onLogin({ identifier, password });
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Mật khẩu xác nhận không khớp.");
      return;
    }

    onRegister({ displayName, email, password, username });
  }

  const visibleError = localError || error;

  return (
    <main className={`auth-screen auth-screen--${mode}`} aria-label="Xác thực WebTui Chat">
      <section className="auth-hero" aria-hidden="true">
        <div className="auth-header-brand">
          <span className="auth-header-brand__logo">W</span>
          <span>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
        </div>
        <div className="auth-visual auth-visual--left">
          <span />
          <span />
          <span />
        </div>
        <div className="auth-visual auth-visual--right">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="auth-panel" aria-label={mode === "login" ? "Đăng nhập" : "Đăng ký"}>
        <div className="auth-panel__header">
          <h2>{mode === "login" ? "Đăng nhập hệ thống" : "Tạo tài khoản mới"}</h2>
          <p>
            {mode === "login"
              ? "Chào mừng bạn quay trở lại! Vui lòng đăng nhập để tiếp tục."
              : "Tham gia WebTui Chat để kết nối và làm việc hiệu quả hơn."}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <>
              <label>
                Họ và tên
                <Input
                  autoComplete="name"
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Nhập họ và tên của bạn"
                  required
                  value={displayName}
                />
              </label>
              <label>
                Email công việc
                <Input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Nhập email công việc"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                Tên đăng nhập
                <Input
                  autoComplete="username"
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Nhập tên đăng nhập"
                  required
                  value={username}
                />
              </label>
            </>
          ) : (
            <label>
              Email hoặc tên đăng nhập
              <Input
                autoComplete="username"
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Nhập email hoặc tên đăng nhập"
                required
                value={identifier}
              />
            </label>
          )}

          <label>
            Mật khẩu
            <Input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "login" ? "Nhập mật khẩu của bạn" : "Tạo mật khẩu ít nhất 6 ký tự"}
              required
              type="password"
              value={password}
            />
          </label>

          {mode === "register" ? (
            <label>
              Xác nhận mật khẩu
              <Input
                autoComplete="new-password"
                minLength={6}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Nhập lại mật khẩu"
                required
                type="password"
                value={confirmPassword}
              />
            </label>
          ) : (
            <div className="auth-helper-row">
              <label className="auth-check">
                <input type="checkbox" />
                Ghi nhớ đăng nhập
              </label>
              <span>Quên mật khẩu? Liên hệ quản trị viên</span>
            </div>
          )}

          {visibleError ? <p className="auth-error">{visibleError}</p> : null}

          <Button className="auth-submit" disabled={isPending} type="submit">
            {isPending ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký tài khoản"}
            <span className="auth-submit__arrow" aria-hidden="true">
              →
            </span>
          </Button>
        </form>

        <p className="auth-mode-link">
          {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <button onClick={() => onModeChange(mode === "login" ? "register" : "login")} type="button">
            {mode === "login" ? "Đăng ký ngay" : "Đăng nhập ngay"}
          </button>
        </p>
      </section>

      <div className="auth-trust-row" aria-hidden="true">
        <span>Bảo mật dữ liệu</span>
        <span>Mã hóa SSL/TLS</span>
        <span>Uptime 99.9%</span>
      </div>
    </main>
  );
}
