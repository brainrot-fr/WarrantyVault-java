package com.warrantyvault.mail;

import com.warrantyvault.config.AppProperties;
import java.util.Map;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClientException;

@Service
@Profile("prod")
@RequiredArgsConstructor
public class BrevoMailService implements MailService {
    private final AppProperties appProperties;
    private final RestClient restClient = createRestClient();

    private static RestClient createRestClient() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(10));
        return RestClient.builder().baseUrl("https://api.brevo.com").requestFactory(requestFactory).build();
    }

    @Override
    public void send(String to, String subject, String plainText, String htmlBody) {
        Map<String, Object> payload = Map.of(
            "sender", Map.of("email", appProperties.getBrevo().getSender()),
            "to", java.util.List.of(Map.of("email", to)),
            "subject", subject,
            "htmlContent", htmlBody,
            "textContent", plainText
        );
        try {
            restClient.post()
                .uri("/v3/smtp/email")
                .header("api-key", appProperties.getBrevo().getApiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientException exception) {
            throw new MailDeliveryException("Brevo could not deliver the message", exception);
        }
    }
}
