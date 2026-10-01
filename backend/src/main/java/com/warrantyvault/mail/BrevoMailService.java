package com.warrantyvault.mail;

import com.warrantyvault.config.AppProperties;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
@Profile("prod")
@RequiredArgsConstructor
public class BrevoMailService implements MailService {
    private final AppProperties appProperties;
    private final RestClient restClient = RestClient.builder().baseUrl("https://api.brevo.com").build();

    @Override
    public void send(String to, String subject, String plainText, String htmlBody) {
        Map<String, Object> payload = Map.of(
            "sender", Map.of("email", appProperties.getBrevo().getSender()),
            "to", java.util.List.of(Map.of("email", to)),
            "subject", subject,
            "htmlContent", htmlBody,
            "textContent", plainText
        );
        restClient.post()
            .uri("/v3/smtp/email")
            .header("api-key", appProperties.getBrevo().getApiKey())
            .contentType(MediaType.APPLICATION_JSON)
            .body(payload)
            .retrieve()
            .toBodilessEntity();
    }
}
