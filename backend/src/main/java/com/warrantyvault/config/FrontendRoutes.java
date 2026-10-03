package com.warrantyvault.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaTypeFactory;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.ResponseStatus;

@Configuration
@Profile("prod")
@Controller
public class FrontendRoutes {
    @RequestMapping(value = "/{*path}", method = {RequestMethod.GET, RequestMethod.HEAD})
    public ResponseEntity<Resource> forwardToFrontend(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path.startsWith("/api/")) {
            throw new FrontendRouteNotFoundException();
        }
        if (path.contains(".") && !path.equals("/index.html")) {
            Resource asset = new ClassPathResource("static" + path);
            if (!asset.exists()) throw new FrontendRouteNotFoundException();
            return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(asset).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .body(asset);
        }
        Resource index = new ClassPathResource("static/index.html");
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_HTML)
            .body(index);
    }

    @ResponseStatus(HttpStatus.NOT_FOUND)
    private static final class FrontendRouteNotFoundException extends RuntimeException {
    }
}
