package com.warrantyvault.mail;

public interface MailService {
    void send(String to, String subject, String plainText, String htmlBody);
}
