package com.warrantyvault.product;

import com.warrantyvault.common.ApiException;
import com.warrantyvault.product.dto.ProductCreateRequest;
import com.warrantyvault.product.dto.ProductUpdateRequest;
import com.warrantyvault.security.CurrentUser;
import com.warrantyvault.storage.StorageService;
import com.warrantyvault.user.User;
import jakarta.validation.Valid;
import java.io.InputStream;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.MimeTypeUtils;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ProductController {
    private final ProductService productService;
    private final CurrentUser currentUser;
    private final StorageService storageService;

    @GetMapping("/spaces/{spaceId}/products")
    public ProductService.ProductPage listProducts(@PathVariable String spaceId,
                                                   @org.springframework.web.bind.annotation.RequestParam(required = false) String q,
                                                   @org.springframework.web.bind.annotation.RequestParam(required = false) String status,
                                                   @org.springframework.web.bind.annotation.RequestParam(required = false) String type,
                                                   @org.springframework.web.bind.annotation.RequestParam(required = false) String sort,
                                                   @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
                                                   @org.springframework.web.bind.annotation.RequestParam(defaultValue = "50") int size) {
        User user = currentUser.get();
        return productService.listProductResponses(spaceId, user.getId(), q, status, type, sort, page, size);
    }

    @PostMapping("/spaces/{spaceId}/products")
    public ResponseEntity<ProductResponse> createProduct(@PathVariable String spaceId,
                                               @Valid @RequestPart("data") ProductCreateRequest request,
                                               @RequestPart("bill") MultipartFile bill,
                                               @RequestPart(value = "warrantyCard", required = false) MultipartFile warrantyCard) {
        User user = currentUser.get();
        Product product = productService.createProduct(spaceId, user.getId(), request, bill, warrantyCard);
        return ResponseEntity.status(HttpStatus.CREATED).body(productService.productResponse(product, user.getId()));
    }

    @PutMapping("/products/{productId}")
    public ProductResponse updateProduct(@PathVariable String productId,
                                         @Valid @RequestPart("data") ProductUpdateRequest request,
                                         @RequestPart(value = "bill", required = false) MultipartFile bill,
                                         @RequestPart(value = "warrantyCard", required = false) MultipartFile warrantyCard) {
        User user = currentUser.get();
        Product product = productService.updateProduct(productId, user.getId(), request, bill, warrantyCard);
        return productService.productResponse(product, user.getId());
    }

    @GetMapping("/products/{productId}")
    public ProductResponse getProduct(@PathVariable String productId) {
        User user = currentUser.get();
        return productService.productResponse(productService.getProduct(productId, user.getId()), user.getId());
    }

    @GetMapping("/products/{productId}/images/{imageType}")
    public ResponseEntity<Resource> getImage(@PathVariable String productId, @PathVariable String imageType) {
        Product product = productService.getProduct(productId, currentUser.get().getId());
        String key;
        String contentType;
        if ("bill".equals(imageType)) {
            key = product.getBillKey();
            contentType = product.getBillContentType();
        } else if ("warranty-card".equals(imageType) && product.getCardKey() != null) {
            key = product.getCardKey();
            contentType = product.getCardContentType();
        } else {
            throw new ApiException("NOT_FOUND", "Image not found", 404);
        }
        InputStream stream = storageService.open(key);
        MediaType mediaType = MediaType.parseMediaType(contentType);
        return ResponseEntity.ok()
            .contentType(mediaType)
            .cacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(5)).cachePrivate())
            .header("X-Content-Type-Options", "nosniff")
            .body(new InputStreamResource(stream));
    }

    @DeleteMapping("/products/{productId}")
    public ResponseEntity<Void> deleteProduct(@PathVariable String productId) {
        productService.deleteProduct(productId, currentUser.get().getId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/products/facets")
    public ProductFacets facets() {
        return productService.facets(currentUser.get().getId());
    }

    public record ProductFacets(List<String> types, List<String> brands) {}
}
