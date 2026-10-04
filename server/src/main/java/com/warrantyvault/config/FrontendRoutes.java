package com.warrantyvault.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaTypeFactory;
import org.springframework.stereotype.Controller;

@Configuration
@Controller
public class FrontendRoutes {
    @RequestMapping(value = "/{*path}", method = {RequestMethod.GET, RequestMethod.HEAD})
    public ResponseEntity<Resource> forwardToFrontend(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path.equals("/api") || path.startsWith("/api/")) {
            return ResponseEntity.notFound().build();
        }
        if (isAssetPath(path)) {
            if (path.startsWith("/assets") && !path.substring(path.lastIndexOf('/') + 1).contains(".")) {
                return ResponseEntity.notFound().build();
            }
            Resource asset = new ClassPathResource("static" + path);
            if (!asset.exists()) return ResponseEntity.notFound().build();
            return ResponseEntity.ok()
                .contentType(MediaTypeFactory.getMediaType(asset).orElse(MediaType.APPLICATION_OCTET_STREAM))
                .body(asset);
        }
        Resource index = new ClassPathResource("static/index.html");
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_HTML)
            .body(index);
    }

    private boolean isAssetPath(String path) {
        return path.contains(".") || path.equals("/assets") || path.startsWith("/assets/");
    }

}
