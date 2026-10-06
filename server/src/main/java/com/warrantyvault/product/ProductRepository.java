package com.warrantyvault.product;

import com.warrantyvault.space.Space;
import java.util.List;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.warrantyvault.space.SpaceProductAggregate;
import com.warrantyvault.space.SpaceNextExpiry;

public interface ProductRepository extends JpaRepository<Product, String> {
    @Query("select coalesce(sum(product.billSizeBytes), 0) + coalesce(sum(product.cardSizeBytes), 0) "
        + "from Product product where product.space.id = :spaceId")
    long sumStoredBytesBySpaceId(@Param("spaceId") String spaceId);

    List<Product> findBySpaceOrderByExpiresOnAsc(Space space);
    List<Product> findBySpace(Space space);
    long countBySpace(Space space);

    @Query("select p from Product p join fetch p.space join fetch p.createdBy where p.id = :productId")
    Optional<Product> findByIdWithResponseDetails(@Param("productId") String productId);

    @Query("""
        select p from Product p join fetch p.space join fetch p.createdBy
        where p.space.id = :spaceId
          and (:type is null or lower(p.productType) = :type)
          and (:query is null or lower(concat(p.productType, ' ', p.brand, ' ',
              coalesce(p.modelName, ''), ' ', coalesce(p.serialNumber, ''), ' ', coalesce(p.notes, '')))
              like :query escape '\\')
          and (:status is null
            or (:status = 'ACTIVE' and p.expiresOn > :lastSoonDay)
            or (:status = 'EXPIRING_SOON' and p.expiresOn between :today and :lastSoonDay)
            or (:status = 'EXPIRED' and p.expiresOn < :today))
        order by case when :sort = 'expiry' and p.expiresOn < :today then 1 else 0 end,
          case when :sort = 'expiry' then p.expiresOn end asc,
          case when :sort = 'purchased' then p.purchasedOn end desc,
          case when :sort = 'name' then lower(p.brand) end asc,
          case when :sort = 'name' then lower(p.productType) end asc,
          p.id asc
        """)
    Page<Product> findPageByFilters(@Param("spaceId") String spaceId, @Param("today") LocalDate today,
                                    @Param("lastSoonDay") LocalDate lastSoonDay, @Param("status") String status,
                                    @Param("type") String type, @Param("query") String query,
                                    @Param("sort") String sort, Pageable pageable);

    @Query("""
        select new com.warrantyvault.product.DashboardCounts(
          sum(case when product.expiresOn > :lastSoonDay then 1L else 0L end),
          sum(case when product.expiresOn between :today and :lastSoonDay then 1L else 0L end),
          sum(case when product.expiresOn < :today then 1L else 0L end))
        from SpaceMember membership left join Product product on product.space = membership.space
        where membership.user.id = :userId
        """)
    DashboardCounts findDashboardCounts(@Param("userId") String userId, @Param("today") LocalDate today,
                                        @Param("lastSoonDay") LocalDate lastSoonDay);

    @Query("""
        select product from Product product join fetch product.space join fetch product.createdBy
        where product.space.id in (select membership.space.id from SpaceMember membership where membership.user.id = :userId)
          and product.expiresOn >= :today
        order by product.expiresOn asc, product.productType asc, product.brand asc
        """)
    List<Product> findUpcomingForDashboard(@Param("userId") String userId, @Param("today") LocalDate today,
                                           Pageable pageable);

    @Query("""
        select product from Product product join fetch product.space join fetch product.createdBy
        where product.space.id in (select membership.space.id from SpaceMember membership where membership.user.id = :userId)
          and product.expiresOn between :from and :until
        order by product.expiresOn desc
        """)
    List<Product> findRecentlyExpiredForDashboard(@Param("userId") String userId, @Param("from") LocalDate from,
                                                  @Param("until") LocalDate until, Pageable pageable);

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
        select new com.warrantyvault.space.SpaceProductAggregate(
          space.id, count(product.id),
          sum(case when product.expiresOn between :today and :lastSoonDay then 1L else 0L end),
          sum(case when product.expiresOn < :today then 1L else 0L end))
        from Space space left join Product product on product.space = space
        where space.id = :spaceId
        group by space.id
        """)
    SpaceProductAggregate findSpaceProductAggregate(@Param("spaceId") String spaceId,
                                                     @Param("today") LocalDate today,
                                                     @Param("lastSoonDay") LocalDate lastSoonDay);

    @Query("""
        select new com.warrantyvault.space.SpaceNextExpiry(
          product.space.id, product.id, product.productType, product.brand, product.expiresOn)
        from Product product
        where product.space.id = :spaceId and product.expiresOn >= :today
        order by product.expiresOn asc, product.productType asc, product.brand asc
        """)
    List<SpaceNextExpiry> findNextExpiryForSpace(@Param("spaceId") String spaceId,
                                                 @Param("today") LocalDate today,
                                                 Pageable pageable);

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
