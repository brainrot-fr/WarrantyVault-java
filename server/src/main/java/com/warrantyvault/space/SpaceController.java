package com.warrantyvault.space;

import com.warrantyvault.security.CurrentUser;
import com.warrantyvault.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SpaceController {
    private final SpaceService spaceService;
    private final CurrentUser currentUser;

    @GetMapping("/spaces")
    public List<SpaceResponse> listSpaces() {
        User user = currentUser.get();
        return spaceService.listSpaceResponses(user);
    }

    @PostMapping("/spaces")
    public ResponseEntity<SpaceResponse> createSpace(@Valid @RequestBody CreateSpaceRequest request) {
        User user = currentUser.get();
        Space space = spaceService.createSpace(user.getId(), request.name(), request.description());
        return ResponseEntity.status(HttpStatus.CREATED).body(spaceService.createdSpaceResponse(space, user));
    }

    @GetMapping("/spaces/{spaceId}")
    public SpaceResponse getSpace(@PathVariable String spaceId) {
        return spaceService.spaceResponse(spaceId, currentUser.get());
    }

    @PatchMapping("/spaces/{spaceId}")
    public SpaceResponse updateSpace(@PathVariable String spaceId, @Valid @RequestBody UpdateSpaceRequest request) {
        User user = currentUser.get();
        Space space = spaceService.updateSpace(spaceId, user.getId(), request.name(), request.description());
        return spaceService.createdSpaceResponse(space, user);
    }

    @DeleteMapping("/spaces/{spaceId}")
    public ResponseEntity<Void> deleteSpace(@PathVariable String spaceId) {
        spaceService.deleteSpace(spaceId, currentUser.get().getId());
        return ResponseEntity.noContent().build();
    }

    public record CreateSpaceRequest(@NotBlank @Size(max = 80) String name, @Size(max = 255) String description) {}
    public record UpdateSpaceRequest(@Size(min = 1, max = 80) String name, @Size(max = 255) String description) {}
}
