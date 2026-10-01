package com.warrantyvault.meta;

import org.springframework.core.env.Environment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MetaController {
    private final Environment environment;

    @Value("${app.max-upload-bytes:10485760}")
    private long maxUploadBytes;

    @GetMapping("/meta/config")
    public MetaConfig config() {
        return new MetaConfig(environment.matchesProfiles("prod") ? "production" : "local", maxUploadBytes, new int[]{7,14,30,60,90,120});
    }

    public record MetaConfig(String mode, long maxUploadBytes, int[] reminderDaysOptions) {}
}
