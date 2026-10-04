package com.warrantyvault.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.env.MockEnvironment;

class RateLimitFilterTest {
    @Test
    void limitsLoginAttemptsByClientAndNormalizedEmail() throws Exception {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        RateLimitFilter filter = new RateLimitFilter(environment);
        AtomicInteger passedThrough = new AtomicInteger();
        jakarta.servlet.FilterChain chain = (request, response) -> passedThrough.incrementAndGet();

        for (int attempt = 0; attempt < 10; attempt++) {
            MockHttpServletResponse response = sendLogin(filter, chain, "Person@example.test");
            assertEquals(200, response.getStatus());
        }
        MockHttpServletResponse limited = sendLogin(filter, chain, "person@example.test");
        assertEquals(429, limited.getStatus());
        assertTrue(limited.getContentAsString().contains("\"code\":\"RATE_LIMITED\""));

        MockHttpServletResponse differentEmail = sendLogin(filter, chain, "other@example.test");
        assertEquals(200, differentEmail.getStatus());
        assertEquals(11, passedThrough.get());
    }

    private MockHttpServletResponse sendLogin(RateLimitFilter filter, jakarta.servlet.FilterChain chain, String email) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr("192.0.2.10");
        request.setContentType("application/json");
        request.setContent(("{\"email\":\"" + email + "\",\"password\":\"ignored\"}").getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        return response;
    }
}
