package com.warrantyvault.security;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warrantyvault.config.AppProperties;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
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
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

public class RateLimitFilter extends OncePerRequestFilter {
    private static final int LOGIN_BODY_LIMIT = 8 * 1024;
    private static final long API_BODY_LIMIT = 64 * 1024;
    private static final long CLEANUP_INTERVAL = 256;
    private static final Pattern INVITATION_ACCEPT_PATH = Pattern.compile("/api/invitations/[^/]+/accept");
    private static final ObjectMapper LOGIN_MAPPER = new ObjectMapper()
        .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);

    private final AppProperties appProperties;
    private final ConcurrentHashMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong requests = new AtomicLong();

    public RateLimitFilter(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    jakarta.servlet.FilterChain chain) throws ServletException, IOException {
        String path = UrlPathHelper.defaultInstance.getPathWithinApplication(request);
        if ("OPTIONS".equals(request.getMethod()) || !path.startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }

        if (requests.incrementAndGet() % CLEANUP_INTERVAL == 0) cleanupStaleBuckets();
        String ip = request.getRemoteAddr();
        AppProperties.RateLimit limits = appProperties.getRateLimit();
        if (!allow("api:" + ip, limits.getApiPerMinute(), Duration.ofMinutes(1), response)) return;
        boolean loginRequest = "POST".equals(request.getMethod()) && "/api/auth/login".equals(path);
        if (loginRequest
            && !allow("login-ip:" + ip, limits.getLoginPerIp(), Duration.ofMinutes(15), response)) return;

        HttpServletRequest nextRequest = request;
        CachedBodyRequest cachedBody = null;
        if (isWriteMethod(request.getMethod()) && !isMultipart(request)) {
            long bodyLimit = loginRequest ?
                LOGIN_BODY_LIMIT : API_BODY_LIMIT;
            try {
                cachedBody = new CachedBodyRequest(request, bodyLimit);
            } catch (PayloadTooLargeException exception) {
                writeProblem(response, 413, "PAYLOAD_TOO_LARGE",
                    bodyLimit == LOGIN_BODY_LIMIT ? "Login request is too large" :
                                                    "Request body must be 64 KB or smaller");
                return;
            }
            nextRequest = cachedBody;
            if (isJson(request) && cachedBody.body().length > 0) {
                try {
                    LOGIN_MAPPER.readTree(cachedBody.body());
                } catch (IOException exception) {
                    writeProblem(response, 400, "MALFORMED_JSON",
                        "Request body is invalid or contains duplicate JSON keys");
                    return;
                }
            }
        }
        if (loginRequest) {
            String email = extractEmail(cachedBody.body());
            if (!email.isBlank()) {
                if (!allow("login:" + ip + ":" + digest(email), limits.getLoginPerIpEmail(), Duration.ofMinutes(15), response)) return;
                if (!allow("login-account:" + digest(email), limits.getLoginPerAccount(), Duration.ofMinutes(15), response)) return;
            }
        } else if ("POST".equals(request.getMethod()) && "/api/auth/register".equals(path)) {
            if (!allow("register:" + ip, limits.getRegisterPerHour(), Duration.ofHours(1), response)) return;
        } else if ("POST".equals(request.getMethod()) && path.matches("/api/spaces/[^/]+/invitations")) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (isAuthenticated(authentication)) {
                if (!allow("invitations:" + digest(authentication.getName().toLowerCase(Locale.ROOT)),
                    limits.getInvitationsPerHour(), Duration.ofHours(1), response)) return;
            }
        } else if ("POST".equals(request.getMethod()) && INVITATION_ACCEPT_PATH.matcher(path).matches()) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (isAuthenticated(authentication)
                && !allow("accept:" + authentication.getName(), limits.getAcceptPerUser(), Duration.ofMinutes(15), response)) return;
        }
        chain.doFilter(nextRequest, response);
    }

    private boolean allow(String key, int capacity, Duration window, HttpServletResponse response) throws IOException {
        long retryAfter = buckets.computeIfAbsent(key, ignored -> new TokenBucket(capacity))
            .tryConsume(capacity, window);
        if (retryAfter == 0) return true;
        response.setStatus(429);
        response.setContentType("application/problem+json;charset=UTF-8");
        response.setHeader("Retry-After", Long.toString(retryAfter));
        response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"RATE_LIMITED\",\"status\":429,"
            + "\"detail\":\"Too many requests\",\"code\":\"RATE_LIMITED\",\"fieldErrors\":{}}");
        return false;
    }

    private boolean isAuthenticated(Authentication authentication) {
        return authentication != null && authentication.isAuthenticated() && authentication.getName() != null;
    }

    private boolean isWriteMethod(String method) {
        return "POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method)
            || "DELETE".equals(method);
    }

    private boolean isMultipart(HttpServletRequest request) {
        String contentType = request.getContentType();
        return contentType != null && contentType.toLowerCase(Locale.ROOT).startsWith("multipart/");
    }

    private boolean isJson(HttpServletRequest request) {
        String contentType = request.getContentType();
        return contentType != null &&
            contentType.toLowerCase(Locale.ROOT).startsWith("application/json");
    }

    private void writeProblem(HttpServletResponse response, int status, String code, String detail) throws IOException {
        response.setStatus(status);
        response.setContentType("application/problem+json;charset=UTF-8");
        response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"" + code + "\",\"status\":" + status
            + ",\"detail\":\"" + detail + "\",\"code\":\"" + code + "\",\"fieldErrors\":{}}");
    }

    private String extractEmail(byte[] body) {
        try {
            JsonNode parsed = LOGIN_MAPPER.readTree(body);
            JsonNode email = parsed == null ? null : parsed.get("email");
            return email != null && email.isTextual() ? email.asText().trim().toLowerCase(Locale.ROOT) : "";
        } catch (IOException exception) {
            return "";
        }
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

        private TokenBucket(int capacity) {
            tokens = capacity;
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

        private CachedBodyRequest(HttpServletRequest request, long limit) throws IOException {
            super(request);
            if (request.getContentLengthLong() > limit) throw new PayloadTooLargeException();
            body = request.getInputStream().readNBytes((int) limit + 1);
            if (body.length > limit) throw new PayloadTooLargeException();
        }

        private byte[] body() {
            return body;
        }

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
