#!/usr/bin/env bash
# ============================================================
#  AI LÀ TRIỆU PHÚ LIVE — khởi động nhanh cho buổi live
#  Chạy:  ./start-live.sh
#  Việc nó làm:
#    1. (Nếu có) bật tiktok-live-feed ở thư mục anh em ../tiktok-live-feed
#    2. Bật server game ở cổng 3021
#    3. Mở tunnel Cloudflare và in LINK HTTPS để dán vào TikTok LIVE Studio
#  Bấm Ctrl+C để tắt tất cả.
# ============================================================
set -u
cd "$(dirname "$0")"
ROOT="$(pwd)"
GAME_PORT=3021

PIDS=()
cleanup() {
  echo ""
  echo "Đang tắt các tiến trình..."
  for pid in "${PIDS[@]:-}"; do
    [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null
  done
  exit 0
}
trap cleanup INT TERM

# ---------- 1. Kiểm tra Node.js ----------
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Chưa có Node.js. Cài bằng 1 trong 2 cách:"
  echo "   • brew install node        (nếu có Homebrew)"
  echo "   • Tải tại https://nodejs.org (bản LTS)"
  exit 1
fi
echo "✓ Node.js $(node -v)"

# ---------- 2. Chuẩn bị cloudflared ----------
CF=""
if command -v cloudflared >/dev/null 2>&1; then
  CF="$(command -v cloudflared)"
elif [ -x "$ROOT/tools/cloudflared" ]; then
  CF="$ROOT/tools/cloudflared"
else
  echo "Đang tải cloudflared (chỉ lần đầu)..."
  mkdir -p "$ROOT/tools"
  ARCH="$(uname -m)"
  case "$ARCH" in
    arm64)  PKG="cloudflared-darwin-arm64.tgz" ;;
    x86_64) PKG="cloudflared-darwin-amd64.tgz" ;;
    *) echo "❌ Không rõ kiến trúc máy: $ARCH"; exit 1 ;;
  esac
  TMPD="$(mktemp -d)"
  if curl -fL "https://github.com/cloudflare/cloudflared/releases/latest/download/$PKG" -o "$TMPD/cf.tgz" \
     && tar -xzf "$TMPD/cf.tgz" -C "$TMPD"; then
    mv "$TMPD/cloudflared" "$ROOT/tools/cloudflared"
    chmod +x "$ROOT/tools/cloudflared"
    CF="$ROOT/tools/cloudflared"
    echo "✓ Đã tải cloudflared ($ARCH)"
  else
    echo "❌ Tải cloudflared thất bại (kiểm tra mạng). Có thể cài tay: brew install cloudflared"
    exit 1
  fi
  rm -rf "$TMPD"
fi
echo "✓ cloudflared: $CF"

# ---------- 3. Bật tiktok-live-feed (nếu có thư mục anh em + .env) ----------
FEED_DIR="$ROOT/../tiktok-live-feed"
if [ -d "$FEED_DIR" ] && [ -f "$FEED_DIR/.env" ]; then
  if [ ! -d "$FEED_DIR/node_modules" ]; then
    echo "Cài thư viện cho tiktok-live-feed (lần đầu)..."
    (cd "$FEED_DIR" && npm install --silent) || echo "⚠️ npm install feed lỗi — kiểm tra /tmp/tiktok-live-feed.log"
  fi
  (cd "$FEED_DIR" && node index.js > /tmp/tiktok-live-feed.log 2>&1) &
  PIDS+=($!)
  echo "✓ tiktok-live-feed đang chạy (log: /tmp/tiktok-live-feed.log)"
else
  echo "⚠️ Không thấy ../tiktok-live-feed kèm file .env — game vẫn chạy nhưng"
  echo "   CHƯA có sự kiện thật từ TikTok. Clone thêm repo tiktok-live-feed về"
  echo "   cùng thư mục cha, tạo .env từ .env.example (điền key Euler + username)."
fi

# ---------- 4. Bật server game ----------
if [ ! -d "$ROOT/app/node_modules" ]; then
  echo "Cài thư viện cho game (lần đầu)..."
  (cd "$ROOT/app" && npm install --silent) || { echo "❌ npm install game lỗi"; exit 1; }
fi
(cd "$ROOT/app" && PORT=$GAME_PORT node server.js > /tmp/trieu-phu-live.log 2>&1) &
PIDS+=($!)

# Chờ server game sẵn sàng
for i in $(seq 1 30); do
  if curl -s "http://localhost:$GAME_PORT/" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -s "http://localhost:$GAME_PORT/" >/dev/null 2>&1; then
  echo "❌ Server game không lên được — xem log: /tmp/trieu-phu-live.log"
  cleanup
fi
echo "✓ Server game đang chạy ở http://localhost:$GAME_PORT"

# ---------- 5. Mở tunnel Cloudflare ----------
CF_LOG="$(mktemp)"
"$CF" tunnel --url "http://localhost:$GAME_PORT" > "$CF_LOG" 2>&1 &
PIDS+=($!)

TUNNEL_URL=""
for i in $(seq 1 60); do
  TUNNEL_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CF_LOG" | head -1)"
  [ -n "$TUNNEL_URL" ] && break
  sleep 0.5
done

echo ""
echo "============================================================"
if [ -n "$TUNNEL_URL" ]; then
  echo "  🎬 LINK SÂN KHẤU — dán link này vào TikTok LIVE Studio:"
  echo ""
  echo "      $TUNNEL_URL/?obs=1"
  echo ""
  echo "  🛠  Trang quản trị / giả lập khán giả:"
  echo ""
  echo "      $TUNNEL_URL/admin"
  echo ""
  echo "  (Link tunnel ĐỔI MỚI mỗi lần chạy — luôn lấy link của lần này.)"
else
  echo "  ⚠️ Chưa lấy được link tunnel — xem log:"
  echo "      $CF_LOG"
  echo "  Sân khấu local vẫn mở được tại http://localhost:$GAME_PORT/?obs=1"
fi
echo "============================================================"
echo ""
echo "Giữ nguyên cửa sổ này khi đang live. Bấm Ctrl+C để tắt tất cả."

wait
