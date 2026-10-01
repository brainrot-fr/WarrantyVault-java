package com.warrantyvault.security;

import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.core.env.Environment;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class RateLimitFilter extends OncePerRequestFilter {
    private static final int LOGIN_BODY_LIMIT = 8 * 1024;
    private static final Pattern EMAIL_FIELD = Pattern.compile("\"email\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"", Pattern.CASE_INSENSITIVE);
    private static final long CLEANUP_INTERVAL = 256;
    private final ConcurrentHashMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong requests = new AtomicLong();
    private final boolean localProfile;

    public RateLimitFilter(Environment environment) {
        this.localProfile = environment.matchesProfiles("local");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, jakarta.servlet.FilterChain chain)
        throws ServletException, IOException {
        if ("OPTIONS".equals(request.getMethod()) || !request.getRequestURI().startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }

        if (requests.incrementAndGet() % CLEANUP_INTERVAL == 0) cleanupStaleBuckets();
        String ip = clientIp(request);
        if (!allow("api:" + ip, 300, Duration.ofMinutes(1), response)) return;

        HttpServletRequest nextRequest = request;
        String path = request.getRequestURI();
        if ("POST".equals(request.getMethod()) && "/api/auth/login".equals(path)) {
            CachedBodyRequest cached;
            try {
                cached = new CachedBodyRequest(request);
            } catch (PayloadTooLargeException exception) {
                response.setStatus(413);
                response.setContentType("application/problem+json");
                response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"PAYLOAD_TOO_LARGE\",\"status\":413,\"detail\":\"Login request is too large\",\"code\":\"PAYLOAD_TOO_LARGE\",\"fieldErrors\":{}}");
                return;
            }
            nextRequest = cached;
            if (!allow("login-ip:" + ip, 30, Duration.ofMinutes(15), response)) return;
            String email = extractEmail(cached.body());
            if (!email.isBlank() && !allow("login:" + ip + ":" + digest(email), 10, Duration.ofMinutes(15), response)) return;
        } else if ("POST".equals(request.getMethod()) && "/api/auth/register".equals(path)) {
            if (!allow("register:" + ip, 5, Duration.ofHours(1), response)) return;
        } else if ("POST".equals(request.getMethod()) && path.matches("/api/spaces/[^/]+/invitations")) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated() && authentication.getName() != null) {
                if (!allow("invitations:" + digest(authentication.getName().toLowerCase()), 30, Duration.ofHours(1), response)) return;
            }
        }
        chain.doFilter(nextRequest, response);
    }

    private boolean allow(String key, int productionCapacity, Duration window, HttpServletResponse response) throws IOException {
        int capacity = localProfile ? productionCapacity * 10 : productionCapacity;
        long retryAfter = buckets.computeIfAbsent(key, ignored -> new TokenBucket(capacity, window))
            .tryConsume(capacity, window);
        if (retryAfter == 0) return true;
        response.setStatus(429);
        response.setContentType("application/problem+json");
        response.setHeader("Retry-After", Long.toString(retryAfter));
        response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"RATE_LIMITED\",\"status\":429,\"detail\":\"Too many requests\",\"code\":\"RATE_LIMITED\",\"fieldErrors\":{}}");
        return false;
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String firstHop = forwarded.split(",", 2)[0].trim();
            if (!firstHop.isBlank()) return firstHop;
        }
        return request.getRemoteAddr();
    }

    private String extractEmail(byte[] body) {
        Matcher matcher = EMAIL_FIELD.matcher(new String(body, StandardCharsets.UTF_8));
        if (!matcher.find()) return "";
        return decodeJsonString(matcher.group(1)).trim().toLowerCase(java.util.Locale.ROOT);
    }

    private String decodeJsonString(String value) {
        StringBuilder decoded = new StringBuilder(value.length());
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character != '\\' || index + 1 >= value.length()) {
                decoded.append(character);
                continue;
            }
            char escape = value.charAt(++index);
            switch (escape) {
                case '"', '\\', '/' -> decoded.append(escape);
                case 'b' -> decoded.append('\b');
                case 'f' -> decoded.append('\f');
                case 'n' -> decoded.append('\n');
                case 'r' -> decoded.append('\r');
                case 't' -> decoded.append('\t');
                case 'u' -> {
                    if (index + 4 >= value.length()) return "";
                    try {
                        decoded.append((char) Integer.parseInt(value.substring(index + 1, index + 5), 16));
                        index += 4;
                    } catch (NumberFormatException exception) {
                        return "";
                    }
                }
                default -> { return ""; }
            }
        }
        return decoded.toString();
    }

    private String digest(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private void cleanupStaleBuckets() {
        long cutoff = System.nanoTime() - Duration.ofHours(1).toNanos();
        buckets.entrySet().removeIf(entry -> entry.getValue().lastTouchedNanos() < cutoff);
    }

    private static final class TokenBucket {
        private double tokens;
        private long lastRefillNanos = System.nanoTime();
        private long lastTouchedNanos = lastRefillNanos;

        private TokenBucket(int capacity, Duration window) {
            this.tokens = capacity;
        }

        private synchronized long tryConsume(int capacity, Duration window) {
            long now = System.nanoTime();
            long elapsed = Math.max(0, now - lastRefillNanos);
            double refillRate = capacity / (double) window.toNanos();
            tokens = Math.min(capacity, tokens + elapsed * refillRate);
            lastRefillNanos = now;
            lastTouchedNanos = now;
            if (tokens >= 1) {
                tokens -= 1;
                return 0;
            }
            return Math.max(1, (long) Math.ceil((1 - tokens) / refillRate / 1_000_000_000d));
        }

        private synchronized long lastTouchedNanos() {
            return lastTouchedNanos;
        }
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        private CachedBodyRequest(HttpServletRequest request) throws IOException {
            super(request);
            long contentLength = request.getContentLengthLong();
            if (contentLength > LOGIN_BODY_LIMIT) throw new PayloadTooLargeException();
            body = request.getInputStream().readNBytes(LOGIN_BODY_LIMIT + 1);
            if (body.length > LOGIN_BODY_LIMIT) throw new PayloadTooLargeException();
        }

        private byte[] body() { return body; }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override public int read() { return input.read(); }
                @Override public boolean isFinished() { return input.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) { }
            };
        }

        @Override
        public BufferedReader getReader() {
            Charset charset = getCharacterEncoding() == null ? StandardCharsets.UTF_8 : Charset.forName(getCharacterEncoding());
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }
    }

    private static final class PayloadTooLargeException extends RuntimeException {}
}
