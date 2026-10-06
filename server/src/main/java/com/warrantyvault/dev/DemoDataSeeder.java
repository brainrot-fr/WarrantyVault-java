package com.warrantyvault.dev;

import com.warrantyvault.common.UuidGenerator;
import com.warrantyvault.config.AppProperties;
import com.warrantyvault.auth.CommonPasswordPolicy;
import com.warrantyvault.invitation.Invitation;
import com.warrantyvault.invitation.InvitationRepository;
import com.warrantyvault.member.SpaceMember;
import com.warrantyvault.member.SpaceMemberRepository;
import com.warrantyvault.product.Product;
import com.warrantyvault.product.ProductRepository;
import com.warrantyvault.security.RefreshTokenRepository;
import com.warrantyvault.space.Space;
import com.warrantyvault.space.SpaceRepository;
import com.warrantyvault.space.SpaceRole;
import com.warrantyvault.storage.StorageService;
import com.warrantyvault.user.User;
import com.warrantyvault.user.UserRepository;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Font;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.ArrayList;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import javax.imageio.ImageIO;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.multipart.MultipartFile;

@Configuration
public class DemoDataSeeder {
    private static final Logger logger = LoggerFactory.getLogger(DemoDataSeeder.class);
    private final UserRepository userRepository;
    private final SpaceRepository spaceRepository;
    private final SpaceMemberRepository spaceMemberRepository;
    private final InvitationRepository invitationRepository;
    private final ProductRepository productRepository;
    private final StorageService storageService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final TransactionTemplate transactionTemplate;
    private final AppProperties appProperties;
    private final String serverAddress;
    private final String demoPassword;
    private final CommonPasswordPolicy commonPasswordPolicy;

    public DemoDataSeeder(UserRepository userRepository, SpaceRepository spaceRepository,
                          SpaceMemberRepository spaceMemberRepository, InvitationRepository invitationRepository,
                          ProductRepository productRepository, StorageService storageService,
                          PasswordEncoder passwordEncoder, Clock clock, PlatformTransactionManager transactionManager,
                          AppProperties appProperties, @Value("${server.address:}") String serverAddress,
                          @Value("${app.seed-demo-password:}") String demoPassword,
                          CommonPasswordPolicy commonPasswordPolicy) {
        this.userRepository = userRepository;
        this.spaceRepository = spaceRepository;
        this.spaceMemberRepository = spaceMemberRepository;
        this.invitationRepository = invitationRepository;
        this.productRepository = productRepository;
        this.storageService = storageService;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.appProperties = appProperties;
        this.serverAddress = serverAddress;
        this.demoPassword = demoPassword;
        this.commonPasswordPolicy = commonPasswordPolicy;
    }

    @Bean
    @ConditionalOnProperty(name = "app.seed-demo-data", havingValue = "true")
    ApplicationRunner seedLocalDemoData() {
        return args -> {
            if (!isLoopback(serverAddress)) {
                throw new IllegalStateException("Demo data can only be enabled when server.address is a loopback address.");
            }
            if (!appProperties.isSeedDemoData()) return;
            List<String> writtenFiles = new ArrayList<>();
            try {
                Boolean seeded = transactionTemplate.execute(status -> {
                    if (userRepository.count() > 0) return false;
                    validateDemoPassword();
                    seed(writtenFiles);
                    return true;
                });
                if (Boolean.TRUE.equals(seeded))
                    logger.warn("Local demo accounts and data were created. Keep the configured demo password private.");
            } catch (RuntimeException exception) {
                for (String key : writtenFiles) {
                    try {
                        storageService.delete(key);
                    } catch (RuntimeException cleanupFailure) {
                        logger.warn("Could not remove failed demo seed file {}", key);
                    }
                }
                throw exception;
            }
        };
    }

    private void validateDemoPassword() {
        if (demoPassword == null
            || demoPassword.getBytes(StandardCharsets.UTF_8).length < 8
            || demoPassword.getBytes(StandardCharsets.UTF_8).length > 72
            || commonPasswordPolicy.isCommon(demoPassword)
            || demoPassword.equalsIgnoreCase("demo@warrantyvault.local")
            || demoPassword.equalsIgnoreCase("family@warrantyvault.local")) {
            throw new IllegalStateException(
                "APP_DEMO_PASSWORD must be a unique, non-common password between 8 and 72 UTF-8 bytes.");
        }
    }

    private boolean isLoopback(String address) {
        return "127.0.0.1".equals(address) || "localhost".equalsIgnoreCase(address) || "::1".equals(address);
    }

    private void seed(List<String> writtenFiles) {
        Instant now = Instant.now(clock);
        User demo = createUser("demo@warrantyvault.local", "Demo Household", now);
        User family = createUser("family@warrantyvault.local", "Family Member", now);
        Space home = createSpace(demo, "Home", now);
        Space farmhouse = createSpace(demo, "Farmhouse", now);
        addMember(home, demo, SpaceRole.OWNER, now);
        addMember(farmhouse, demo, SpaceRole.OWNER, now);
        addMember(home, family, SpaceRole.VIEWER, now);
        createInvitation(home, demo, "family@warrantyvault.local", SpaceRole.VIEWER, now, "ACCEPTED");

        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of(demo.getTimezone())));
        seedSpaceProducts(home, demo, today, homeProducts(), now, writtenFiles);
        seedSpaceProducts(farmhouse, demo, today, farmhouseProducts(), now, writtenFiles);
    }

    static List<SeedProduct> homeProducts() {
        return List.of(
            new SeedProduct("Refrigerator", "LG", 10, 24, "48999.00"),
            new SeedProduct("Air Conditioner", "Daikin", 25, 12, "55999.00"),
            new SeedProduct("Washing Machine", "Bosch", 80, 24, "32990.00"),
            new SeedProduct("Television", "Sony", 160, 36, "65900.00")
        );
    }

    static List<SeedProduct> farmhouseProducts() {
        return List.of(
            new SeedProduct("Microwave", "Panasonic", -5, 12, "14990.00"),
            new SeedProduct("Water Purifier", "Kent", -35, 24, "12999.00"),
            new SeedProduct("Vacuum Cleaner", "Dyson", 50, 24, "27900.00"),
            new SeedProduct("Dishwasher", "IFB", 200, 36, "41990.00")
        );
    }

    private User createUser(String email, String name, Instant now) {
        User user = new User();
        user.setId(UuidGenerator.nextId());
        user.setEmail(email);
        user.setName(name);
        user.setPasswordHash(passwordEncoder.encode(demoPassword));
        user.setTimezone("Asia/Kolkata");
        user.setCurrency("INR");
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private Space createSpace(User owner, String name, Instant now) {
        Space space = new Space();
        space.setId(UuidGenerator.nextId());
        space.setOwner(owner);
        space.setName(name);
        space.setCreatedAt(now);
        space.setUpdatedAt(now);
        return spaceRepository.save(space);
    }

    private void addMember(Space space, User user, SpaceRole role, Instant now) {
        SpaceMember member = new SpaceMember();
        member.setSpace(space);
        member.setUser(user);
        member.setRole(role);
        member.setAddedAt(now);
        spaceMemberRepository.save(member);
    }

    private void createInvitation(Space space, User inviter, String email, SpaceRole role, Instant now, String status) {
        Invitation invitation = new Invitation();
        invitation.setId(UuidGenerator.nextId());
        invitation.setSpace(space);
        invitation.setInvitedEmail(email);
        invitation.setRole(role);
        invitation.setInvitedBy(inviter);
        invitation.setStatus(status);
        invitation.setCreatedAt(now);
        invitation.setExpiresAt(now.plusSeconds(14L * 24 * 60 * 60));
        if ("ACCEPTED".equals(status)) invitation.setRespondedAt(now);
        invitationRepository.save(invitation);
    }

    private void seedSpaceProducts(Space space, User creator, LocalDate today, List<SeedProduct> seeds, Instant now,
                                   List<String> writtenFiles) {
        for (SeedProduct seed : seeds) {
            LocalDate expiresOn = today.plusDays(seed.expiryOffsetDays());
            LocalDate purchasedOn = expiresOn.minusMonths(seed.warrantyMonths());
            LocalDate computedExpiry = purchasedOn.plusMonths(seed.warrantyMonths());
            StorageService.StoredFile bill;
            try {
                bill = storageService.store(new SeedBill(seed.type(), seed.brand(), seed.price(), purchasedOn), space.getId());
            } catch (IOException exception) {
                throw new IllegalStateException("Could not create demo bill", exception);
            }
            writtenFiles.add(bill.key());
            Product product = new Product();
            product.setId(UuidGenerator.nextId());
            product.setSpace(space);
            product.setCreatedBy(creator);
            product.setProductType(seed.type());
            product.setBrand(seed.brand());
            product.setPurchasedOn(purchasedOn);
            product.setWarrantyMonths(seed.warrantyMonths());
            product.setExpiresOn(computedExpiry);
            product.setPurchasePrice(new BigDecimal(seed.price()));
            product.setCurrency("INR");
            product.setBillKey(bill.key());
            product.setBillContentType(bill.contentType());
            product.setBillSizeBytes(bill.sizeBytes());
            product.setCreatedAt(now);
            product.setUpdatedAt(now);
            productRepository.save(product);
        }
    }

    record SeedProduct(String type, String brand, int expiryOffsetDays, int warrantyMonths, String price) {}

    private static final class SeedBill implements MultipartFile {
        private final String label;
        private final byte[] bytes;

        private SeedBill(String type, String brand, String price, LocalDate purchasedOn) throws IOException {
            label = type + " " + brand + " INR " + price;
            BufferedImage image = new BufferedImage(640, 800, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = image.createGraphics();
            try {
                graphics.setColor(new Color(248, 245, 237));
                graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
                graphics.setColor(new Color(44, 59, 50));
                graphics.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 28));
                graphics.drawString("HOME APPLIANCES", 48, 68);
                graphics.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 22));
                graphics.setColor(new Color(91, 101, 96));
                graphics.drawString("Store receipt", 48, 110);
                graphics.drawString("Date: " + purchasedOn, 48, 152);
                graphics.drawString("Model: " + brand + " " + type, 48, 194);
                graphics.drawLine(48, 222, 592, 222);
                graphics.setColor(new Color(44, 59, 50));
                graphics.drawString("Item: " + label, 48, 266);
                graphics.drawLine(48, 292, 592, 292);
                graphics.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 26));
                graphics.drawString("TOTAL: INR " + price, 48, 342);
            } finally {
                graphics.dispose();
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            if (!ImageIO.write(image, "png", output))
                throw new IOException("No PNG image writer is available");
            bytes = output.toByteArray();
        }

        @Override public String getName() { return "bill"; }
        @Override public String getOriginalFilename() { return UUID.randomUUID() + ".png"; }
        @Override public String getContentType() { return "image/png"; }
        @Override public boolean isEmpty() { return bytes.length == 0; }
        @Override public long getSize() { return bytes.length; }
        @Override public byte[] getBytes() { return bytes.clone(); }
        @Override public InputStream getInputStream() { return new ByteArrayInputStream(bytes); }
        @Override public void transferTo(File destination) throws IOException { java.nio.file.Files.write(destination.toPath(), bytes); }
    }
}
