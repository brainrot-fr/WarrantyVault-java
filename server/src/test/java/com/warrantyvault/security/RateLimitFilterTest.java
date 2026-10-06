package com.warrantyvault.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.warrantyvault.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {
    @Test
    void limitsLoginAttemptsByClientAndNormalizedEmail() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new AppProperties());
        AtomicInteger passedThrough = new AtomicInteger();
        jakarta.servlet.FilterChain chain = (request, response) -> passedThrough.incrementAndGet();

        for (int attempt = 0; attempt < 10; attempt++)
            assertEquals(200, sendLogin(filter, chain, "Person@example.test").getStatus());
        MockHttpServletResponse limited = sendLogin(filter, chain, "person@example.test");
        assertEquals(429, limited.getStatus());
        assertTrue(limited.getContentAsString().contains("\"code\":\"RATE_LIMITED\""));
        assertTrue(limited.containsHeader("Retry-After"));
        assertEquals(200, sendLogin(filter, chain, "other@example.test").getStatus());
        assertEquals(11, passedThrough.get());
    }

    @Test
    void percentEncodedLoginPathUsesTheSameBucket() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new AppProperties());
        jakarta.servlet.FilterChain chain = (request, response) -> {};
        for (int attempt = 0; attempt < 10; attempt++)
            assertEquals(200, sendLogin(filter, chain, "encoded@example.test").getStatus());
        assertEquals(429, sendLoginPath(filter, chain, "encoded@example.test", "/api/auth/lo%67in").getStatus());
    }

    @Test
    void appliesPerAccountLimitAcrossClientIps() throws Exception {
        AppProperties properties = new AppProperties();
        properties.getRateLimit().setLoginPerAccount(2);
        RateLimitFilter filter = new RateLimitFilter(properties);
        jakarta.servlet.FilterChain chain = (request, response) -> {};
        assertEquals(200, sendLoginFromIp(filter, chain, "shared@example.test", "192.0.2.1").getStatus());
        assertEquals(200, sendLoginFromIp(filter, chain, "shared@example.test", "192.0.2.2").getStatus());
        assertEquals(429, sendLoginFromIp(filter, chain, "shared@example.test", "192.0.2.3").getStatus());
    }

    @Test
    void rejectsOversizedBodiesAndDuplicateJsonKeys() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new AppProperties());
        jakarta.servlet.FilterChain chain = (request, response) -> {};
        MockHttpServletRequest large = new MockHttpServletRequest("POST", "/api/auth/register");
        large.setContentType("application/json");
        large.setContent(new byte[64 * 1024 + 1]);
        MockHttpServletResponse tooLarge = new MockHttpServletResponse();
        filter.doFilter(large, tooLarge, chain);
        assertEquals(413, tooLarge.getStatus());

        MockHttpServletRequest unknownLength = new MockHttpServletRequest("POST", "/api/spaces") {
            @Override
            public long getContentLengthLong() {
                return -1;
            }
        };
        unknownLength.setContentType("application/json");
        unknownLength.setContent(new byte[64 * 1024 + 1]);
        MockHttpServletResponse unknownLengthTooLarge = new MockHttpServletResponse();
        filter.doFilter(unknownLength, unknownLengthTooLarge, chain);
        assertEquals(413, unknownLengthTooLarge.getStatus());

        String duplicate = "{\"email\":\"dupe@example.test\",\"email\":\"dupe@example.test\"}";
        for (int attempt = 0; attempt < 21; attempt++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("192.0.2.50");
            request.setContentType("application/json");
            request.setContent(duplicate.getBytes(StandardCharsets.UTF_8));
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, chain);
            assertEquals(400, response.getStatus());
            assertTrue(response.getContentAsString().contains("\"code\":\"MALFORMED_JSON\""));
        }
    }

    private MockHttpServletResponse sendLogin(RateLimitFilter filter, jakarta.servlet.FilterChain chain,
                                              String email) throws Exception {
        return sendLoginFromIp(filter, chain, email, "192.0.2.10");
    }

    private MockHttpServletResponse sendLoginFromIp(RateLimitFilter filter, jakarta.servlet.FilterChain chain,
                                                    String email, String ip) throws Exception {
        return sendLoginPathFromIp(filter, chain, email, "/api/auth/login", ip);
    }

    private MockHttpServletResponse sendLoginPath(RateLimitFilter filter, jakarta.servlet.FilterChain chain,
                                                  String email, String path) throws Exception {
        return sendLoginPathFromIp(filter, chain, email, path, "192.0.2.10");
    }

    private MockHttpServletResponse sendLoginPathFromIp(RateLimitFilter filter, jakarta.servlet.FilterChain chain,
                                                        String email, String path, String ip) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setRemoteAddr(ip);
        request.setContentType("application/json");
        request.setContent(("{\"email\":\"" + email + "\",\"password\":\"ignored\"}").getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        return response;
    }
}
