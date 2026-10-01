package com.warrantyvault.product;

import com.warrantyvault.space.Space;
import com.warrantyvault.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.FetchType;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "products")
@Getter @Setter @NoArgsConstructor
public class Product {
    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "space_id", nullable = false)
    private Space space;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "product_type", nullable = false, length = 60)
    private String productType;

    @Column(nullable = false, length = 60)
    private String brand;

    @Column(name = "model_name", length = 120)
    private String modelName;

    @Column(name = "serial_number", length = 120)
    private String serialNumber;

    @Column(name = "purchased_on", nullable = false)
    private LocalDate purchasedOn;

    @Column(name = "warranty_months", nullable = false)
    private Integer warrantyMonths;

    @Column(name = "expires_on", nullable = false)
    private LocalDate expiresOn;

    @Column(name = "purchase_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal purchasePrice;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(length = 1000)
    private String notes;

    @Column(name = "bill_key", nullable = false)
    private String billKey;

    @Column(name = "bill_content_type", nullable = false)
    private String billContentType;

    @Column(name = "bill_size_bytes", nullable = false)
    private Long billSizeBytes;

    @Column(name = "card_key")
    private String cardKey;

    @Column(name = "card_content_type")
    private String cardContentType;

    @Column(name = "card_size_bytes")
    private Long cardSizeBytes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
