package com.warrantyvault.dashboard;

import com.warrantyvault.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DashboardController {
    private final CurrentUser currentUser;
    private final DashboardService dashboardService;

    @GetMapping("/dashboard")
    public DashboardService.DashboardResponse dashboard() {
        return dashboardService.getDashboard(currentUser.get());
    }
}
