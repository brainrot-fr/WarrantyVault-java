package com.warrantyvault.product;

import com.warrantyvault.space.Space;
import java.util.List;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import com.warrantyvault.space.SpaceProductAggregate;
import com.warrantyvault.space.SpaceNextExpiry;

public interface ProductRepository extends JpaRepository<Product, String> {
    List<Product> findBySpaceOrderByExpiresOnAsc(Space space);
    List<Product> findBySpace(Space space);
    long countBySpace(Space space);

    @Query("""
        select distinct p from Product p
        join fetch p.space
        join SpaceMember membership on membership.space = p.space
        where membership.user.id = :userId
          and p.expiresOn between :today and :lastCoveredDay
          and not exists (
            select log.id from ReminderLog log
            where log.user.id = :userId and log.product = p and log.expiresOn = p.expiresOn
          )
        """)
    List<Product> findUnloggedReminderProducts(@Param("userId") String userId,
                                               @Param("today") LocalDate today,
                                               @Param("lastCoveredDay") LocalDate lastCoveredDay);

    @Query("select p from Product p join fetch p.space join fetch p.createdBy where p.space.id = :spaceId")
    List<Product> findBySpaceIdWithResponseDetails(@Param("spaceId") String spaceId);

    @Query("select p from Product p join fetch p.space join fetch p.createdBy where p.id = :productId")
    Optional<Product> findByIdWithResponseDetails(@Param("productId") String productId);

    @Query("""
        select p from Product p join fetch p.space
        where p.space.id in (select membership.space.id from SpaceMember membership where membership.user.id = :userId)
        order by p.expiresOn asc
        """)
    List<Product> findAllForDashboard(@Param("userId") String userId);

    @Query("""
        select distinct new com.warrantyvault.product.ProductFacetValue(p.productType, p.brand)
        from Product p join SpaceMember membership on membership.space = p.space
        where membership.user.id = :userId
        """)
    List<ProductFacetValue> findDistinctFacetsForUser(@Param("userId") String userId);

    @Query("""
        select new com.warrantyvault.space.SpaceProductAggregate(
          space.id, count(product.id),
          sum(case when product.expiresOn between :today and :lastSoonDay then 1L else 0L end),
          sum(case when product.expiresOn < :today then 1L else 0L end))
        from Space space join SpaceMember membership on membership.space = space
        left join Product product on product.space = space
        where membership.user.id = :userId
        group by space.id
        """)
    List<SpaceProductAggregate> findSpaceProductAggregates(@Param("userId") String userId,
                                                           @Param("today") LocalDate today,
                                                           @Param("lastSoonDay") LocalDate lastSoonDay);

    @Query("""
        select new com.warrantyvault.space.SpaceNextExpiry(
          product.space.id, product.id, product.productType, product.brand, product.expiresOn)
        from Product product join SpaceMember membership on membership.space = product.space
        where membership.user.id = :userId
          and product.expiresOn >= :today
          and product.expiresOn = (
            select min(candidate.expiresOn) from Product candidate
            where candidate.space = product.space and candidate.expiresOn >= :today
          )
        """)
    List<SpaceNextExpiry> findNextExpiryForUser(@Param("userId") String userId, @Param("today") LocalDate today);

    @Query("""
        select new com.warrantyvault.product.CurrencyValueTotal(product.currency, sum(product.purchasePrice))
        from Product product join SpaceMember membership on membership.space = product.space
        where membership.user.id = :userId and product.expiresOn >= :today
        group by product.currency
        """)
    List<CurrencyValueTotal> findCoveredValueTotals(@Param("userId") String userId, @Param("today") LocalDate today);
}
