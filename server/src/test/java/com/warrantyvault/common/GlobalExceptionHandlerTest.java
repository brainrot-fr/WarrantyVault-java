package com.warrantyvault.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void mapsUnknownRouteToProblemJson() {
        assertProblem(handler.handleNoResource(new NoResourceFoundException(HttpMethod.GET, "/missing", "/missing")),
            HttpStatus.NOT_FOUND, "NOT_FOUND");
    }

    @Test
    void mapsMalformedJsonToProblemJson() {
        HttpMessageNotReadableException error = new HttpMessageNotReadableException(
            "Malformed JSON", new MockHttpInputMessage(new byte[]{'{'}));
        assertProblem(handler.handleUnreadableBody(error), HttpStatus.BAD_REQUEST, "MALFORMED_JSON");
    }

    @Test
    void mapsOversizedUploadToProblemJson() {
        assertProblem(handler.handleUploadTooLarge(new MaxUploadSizeExceededException(10)),
            HttpStatus.PAYLOAD_TOO_LARGE, "UPLOAD_TOO_LARGE");
    }

    @Test
    void doesNotExposeUnexpectedExceptionDetails() {
        var response = handler.handleUnexpected(new IllegalStateException("sensitive internal detail"));

        assertProblem(response, HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
        assertTrue(response.getBody().get("detail").toString().startsWith("The request could not be completed. Reference: "));
        assertTrue(!response.getBody().get("detail").toString().contains("sensitive internal detail"));
    }

    private void assertProblem(org.springframework.http.ResponseEntity<Map<String, Object>> response,
                               HttpStatus status, String code) {
        assertEquals(status, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertInstanceOf(Map.class, body);
        assertEquals(code, body.get("code"));
        assertEquals(status.value(), body.get("status"));
        assertTrue(body.get("fieldErrors") instanceof Map);
    }
}
