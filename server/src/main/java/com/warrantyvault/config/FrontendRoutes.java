package com.warrantyvault.config;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaTypeFactory;
import org.springframework.stereotype.Controller;
import org.springframework.http.CacheControl;
import java.io.IOException;

@Controller
public class FrontendRoutes {
    @RequestMapping(value = "/{*path}", method = {RequestMethod.GET, RequestMethod.HEAD})
    public ResponseEntity<Resource> forwardToFrontend(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path.equals("/api") || path.startsWith("/api/") || unsafe(path)) {
            return ResponseEntity.notFound().build();
        }
        if (path.equals("/index.html")) return shell();
        if (path.startsWith("/assets/") && hasExtension(path)) {
            Resource asset = new ClassPathResource("static" + path);
            if (!asset.exists()) return ResponseEntity.notFound().build();
            ResponseEntity.BodyBuilder response = ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(asset).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofHours(1))
                    .cachePublic().mustRevalidate());
            try {
                response.lastModified(asset.lastModified());
            } catch (IOException ignored) {
                // Conditional revalidation is optional when the resource has no readable timestamp.
            }
            return response.body(asset);
        }
        if (path.startsWith("/assets") || hasExtension(path)) return ResponseEntity.notFound().build();
        return shell();
    }

    private ResponseEntity<Resource> shell() {
        Resource index = new ClassPathResource("static/index.html");
        ResponseEntity.BodyBuilder response = ResponseEntity.ok()
            .contentType(MediaType.TEXT_HTML)
            .cacheControl(CacheControl.noCache());
        try {
            response.lastModified(index.lastModified());
        } catch (IOException ignored) {
            // The shell remains available if the classpath resource has no timestamp.
        }
        return response.body(index);
    }

    private boolean unsafe(String path) {
        return path.contains("..") || path.contains("\\") || path.contains("%")
            || path.indexOf('\0') >= 0 || path.contains("//");
    }

    private boolean hasExtension(String path) {
        String name = path.substring(path.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        return dot > 0 && dot < name.length() - 1;
    }
}
