package com.warrantyvault.dev;

import com.warrantyvault.common.UuidGenerator;
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
import javax.imageio.ImageIO;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.multipart.MultipartFile;

@Configuration
@Profile("local")
public class DemoDataSeeder {
    private final UserRepository userRepository;
    private final SpaceRepository spaceRepository;
    private final SpaceMemberRepository spaceMemberRepository;
    private final InvitationRepository invitationRepository;
    private final ProductRepository productRepository;
    private final StorageService storageService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public DemoDataSeeder(UserRepository userRepository, SpaceRepository spaceRepository,
                          SpaceMemberRepository spaceMemberRepository, InvitationRepository invitationRepository,
                          ProductRepository productRepository, StorageService storageService,
                          PasswordEncoder passwordEncoder, Clock clock) {
        this.userRepository = userRepository;
        this.spaceRepository = spaceRepository;
        this.spaceMemberRepository = spaceMemberRepository;
        this.invitationRepository = invitationRepository;
        this.productRepository = productRepository;
        this.storageService = storageService;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    @Bean
    ApplicationRunner seedLocalDemoData() {
        return args -> {
            if (userRepository.count() == 0) seed();
        };
    }

    private void seed() throws IOException {
        Instant now = Instant.now(clock);
        User demo = createUser("demo@warrantyvault.local", "Demo Household", now);
        User family = createUser("family@warrantyvault.local", "Family Member", now);
        Space home = createSpace(demo, "Home", now);
        Space farmhouse = createSpace(demo, "Farmhouse", now);
        addMember(home, demo, SpaceRole.OWNER, now);
        addMember(farmhouse, demo, SpaceRole.OWNER, now);
        addMember(home, family, SpaceRole.VIEWER, now);
        createInvitation(farmhouse, demo, "family@warrantyvault.local", SpaceRole.EDITOR, now);

        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of(demo.getTimezone())));
        seedSpaceProducts(home, demo, today, List.of(
            new SeedProduct("Refrigerator", "LG", 10, "48999.00"),
            new SeedProduct("Air Conditioner", "Daikin", 25, "55999.00"),
            new SeedProduct("Washing Machine", "Bosch", 80, "32990.00"),
            new SeedProduct("Television", "Sony", 160, "65900.00")
        ), now);
        seedSpaceProducts(farmhouse, demo, today, List.of(
            new SeedProduct("Microwave", "Panasonic", -5, "14990.00"),
            new SeedProduct("Water Purifier", "Kent", -35, "12999.00"),
            new SeedProduct("Vacuum Cleaner", "Dyson", 50, "27900.00"),
            new SeedProduct("Dishwasher", "IFB", 200, "41990.00")
        ), now);
    }

    private User createUser(String email, String name, Instant now) {
        User user = new User();
        user.setId(UuidGenerator.nextId());
        user.setEmail(email);
        user.setName(name);
        user.setPasswordHash(passwordEncoder.encode("Password123!"));
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

    private void createInvitation(Space space, User inviter, String email, SpaceRole role, Instant now) {
        Invitation invitation = new Invitation();
        invitation.setId(UuidGenerator.nextId());
        invitation.setSpace(space);
        invitation.setInvitedEmail(email);
        invitation.setRole(role);
        invitation.setInvitedBy(inviter);
        invitation.setStatus("PENDING");
        invitation.setCreatedAt(now);
        invitation.setExpiresAt(now.plusSeconds(14L * 24 * 60 * 60));
        invitationRepository.save(invitation);
    }

    private void seedSpaceProducts(Space space, User creator, LocalDate today, List<SeedProduct> seeds, Instant now) throws IOException {
        for (SeedProduct seed : seeds) {
            LocalDate expiresOn = today.plusDays(seed.expiryOffsetDays());
            LocalDate purchasedOn = expiresOn.minusMonths(1);
            StorageService.StoredFile bill = storageService.store(new SeedBill(seed.type(), seed.brand(), seed.price()), space.getId());
            Product product = new Product();
            product.setId(UuidGenerator.nextId());
            product.setSpace(space);
            product.setCreatedBy(creator);
            product.setProductType(seed.type());
            product.setBrand(seed.brand());
            product.setPurchasedOn(purchasedOn);
            product.setWarrantyMonths(1);
            product.setExpiresOn(purchasedOn.plusMonths(1));
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

    private record SeedProduct(String type, String brand, int expiryOffsetDays, String price) {}

    private static final class SeedBill implements MultipartFile {
        private final String label;
        private final byte[] bytes;

        private SeedBill(String type, String brand, String price) throws IOException {
            label = type + " " + brand + " • INR " + price;
            BufferedImage image = new BufferedImage(640, 800, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = image.createGraphics();
            graphics.setColor(new Color(248, 245, 237));
            graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
            graphics.setColor(new Color(44, 59, 50));
            graphics.drawString("WARRANTYVAULT DEMO RECEIPT", 48, 72);
            graphics.setColor(new Color(91, 101, 96));
            graphics.drawString(label, 48, 118);
            graphics.drawLine(48, 142, 592, 142);
            graphics.dispose();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(image, "png", output);
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
