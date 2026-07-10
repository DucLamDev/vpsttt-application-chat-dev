"use client";

import { type FormEvent, useState } from "react";
import { Button } from "../components/button";
import { Input } from "../components/input";

export type LoginFormValues = { identifier: string; password: string; remember: boolean };
export type RegisterFormValues = { displayName: string; email: string; password: string; username: string };
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
  subtitle = "Kết nối – Trò chuyện – Hiệu quả",
  title = "WEBTUI CHAT"
}: AuthScreenProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (mode === "login") {
      onLogin({ identifier, password, remember });
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Mật khẩu xác nhận không khớp.");
      return;
    }
    onRegister({ displayName, email, password, username });
  }

  return (
    <main className={`auth-screen auth-screen--${mode}`} aria-label="Xác thực WebTui Chat">
      <section className="auth-hero">
        <div className="auth-header-brand">
          <span className="auth-header-brand__logo">W</span>
          <span><strong>{title}</strong><small>{subtitle}</small></span>
        </div>
        <div className="auth-hero__copy">
          <p className="auth-hero__eyebrow">Không gian giao tiếp dành cho đội ngũ</p>
          <h1>Giao tiếp thông minh,<span> kết nối không giới hạn</span></h1>
          <p>Trò chuyện, chia sẻ và cộng tác liền mạch trên mọi thiết bị.</p>
        </div>
        <div className="auth-visual" aria-hidden="true">
          <div className="auth-product-preview">
            <div className="auth-product-preview__rail"><i /><i /><i /><i /></div>
            <div className="auth-product-preview__contacts">
              <span />
              <p><i /><b /></p>
              <p><i /><b /></p>
              <p><i /><b /></p>
            </div>
            <div className="auth-product-preview__chat">
              <header><i /><span /></header>
              <div className="auth-preview-message auth-preview-message--incoming"><i /><i /></div>
              <div className="auth-preview-message auth-preview-message--outgoing"><i /><i /></div>
              <footer><span /><b><i /><i /><i /></b></footer>
            </div>
          </div>
        </div>
        <div className="auth-benefits" aria-label="Ưu điểm của WebTui Chat">
          <span><b>✓</b><strong>Bảo mật cao</strong><small>Mã hóa dữ liệu</small></span>
          <span><b>↯</b><strong>Tốc độ nhanh</strong><small>Trải nghiệm mượt</small></span>
          <span><b>▣</b><strong>Đa nền tảng</strong><small>Web và mobile</small></span>
        </div>
      </section>

      <section className="auth-panel" aria-label={mode === "login" ? "Đăng nhập" : "Đăng ký"}>
        <span className="auth-panel__icon" aria-hidden="true">{mode === "login" ? "⌑" : "+"}</span>
        <div className="auth-panel__header">
          <h2>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản mới"}</h2>
          <p>{mode === "login" ? "Chào mừng bạn trở lại 👋" : "Tham gia cùng chúng tôi ngay hôm nay 🚀"}</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" ? <>
            <label>Họ và tên<Input autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} placeholder="Nhập họ và tên của bạn" required value={displayName} /></label>
            <label>Email công việc<Input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="Nhập email công việc" required type="email" value={email} /></label>
            <label>Tên đăng nhập<Input autoComplete="username" onChange={(event) => setUsername(event.target.value)} placeholder="Nhập tên đăng nhập" required value={username} /></label>
          </> : <label>Email hoặc tên đăng nhập<Input autoComplete="username" onChange={(event) => setIdentifier(event.target.value)} placeholder="Nhập email hoặc tên đăng nhập" required value={identifier} /></label>}
          <label>Mật khẩu<Input autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "login" ? "Nhập mật khẩu của bạn" : "Tạo mật khẩu ít nhất 6 ký tự"} required type="password" value={password} /></label>
          {mode === "register" ? <label>Xác nhận mật khẩu<Input autoComplete="new-password" minLength={6} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu" required type="password" value={confirmPassword} /></label> : <div className="auth-helper-row"><label className="auth-check"><input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />Ghi nhớ đăng nhập</label><span>Quên mật khẩu?</span></div>}
          {localError || error ? <p className="auth-error">{localError || error}</p> : null}
          <Button className="auth-submit" disabled={isPending} type="submit">
            {isPending ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký tài khoản"}
            <span className="auth-submit__arrow" aria-hidden="true">→</span>
          </Button>
        </form>
        <p className="auth-mode-link">
          {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <button onClick={() => onModeChange(mode === "login" ? "register" : "login")} type="button">{mode === "login" ? "Đăng ký ngay" : "Đăng nhập ngay"}</button>
        </p>
      </section>
      <div className="auth-trust-row" aria-hidden="true"><span>Mã hóa đầu cuối</span><span>Không lưu trữ nội dung</span><span>99.9% uptime</span></div>
    </main>
  );
}
