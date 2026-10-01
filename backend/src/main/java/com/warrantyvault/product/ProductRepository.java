package com.warrantyvault.product;

import com.warrantyvault.space.Space;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, String> {
    List<Product> findBySpaceOrderByExpiresOnAsc(Space space);
    List<Product> findBySpace(Space space);
    long countBySpace(Space space);
}
