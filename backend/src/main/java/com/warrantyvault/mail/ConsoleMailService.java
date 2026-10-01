package com.warrantyvault.mail;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("local")
public class ConsoleMailService implements MailService {
    @Override
    public void send(String to, String subject, String plainText, String htmlBody) {
        System.out.println("\n===== WARRANTYVAULT EMAIL =====");
        System.out.println("To: " + to);
        System.out.println("Subject: " + subject);
        System.out.println("Body:\n" + plainText);
        System.out.println("===== END EMAIL =====\n");
    }
}
