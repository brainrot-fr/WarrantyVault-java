package com.warrantyvault.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.core.io.ClassPathResource;
import java.util.Date;

class FrontendRoutesTest {
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new FrontendRoutes()).build();
    }

    @Test
    void servesApplicationShellForRootAndDeepLinksInLocalProfile() throws Exception {
        mockMvc.perform(get("/"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("/assets/app.js")));

        mockMvc.perform(get("/spaces/example/products/new"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
    }

    @Test
    void servesStaticAssetsAndReturns404ForMissingAssets() throws Exception {
        mockMvc.perform(get("/assets/styles/base.css"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("text/css")))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .header().string("Cache-Control", org.hamcrest.Matchers.containsString("max-age=3600")));

        mockMvc.perform(get("/assets/pages/product-form.js"))
            .andExpect(status().isOk());

        mockMvc.perform(get("/assets/app.css"))
            .andExpect(status().isNotFound());

        mockMvc.perform(get("/assets/missing.js"))
            .andExpect(status().isNotFound());

        mockMvc.perform(get("/assets"))
            .andExpect(status().isNotFound());
    }

    @Test
    void doesNotForwardApiPathsToTheApplicationShell() throws Exception {
        mockMvc.perform(get("/api"))
            .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/unknown"))
            .andExpect(status().isNotFound());
    }

    @Test
    void unknownExtensionlessPathsRemainClientRoutes() throws Exception {
        mockMvc.perform(get("/this-is-not-an-api-route"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
    }

    @Test
    void rejectsTraversalAndDoesNotServeUnknownFavicon() throws Exception {
        mockMvc.perform(get("/assets/../application.properties"))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/assets/%2e%2e/application.properties"))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/assets/a%5cb.js"))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/favicon.ico"))
            .andExpect(status().isNotFound());
    }

    @Test
    void supportsConditionalAssetRevalidation() throws Exception {
        long modified = new ClassPathResource("static/assets/styles/base.css").lastModified();
        mockMvc.perform(get("/assets/styles/base.css")
                .header("If-Modified-Since", java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME.format(
                    java.time.Instant.ofEpochMilli(modified / 1000 * 1000).atZone(java.time.ZoneOffset.UTC))))
            .andExpect(status().isNotModified());
    }
}
