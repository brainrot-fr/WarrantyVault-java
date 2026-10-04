package com.warrantyvault.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

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
            .andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("text/css")));

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
}
