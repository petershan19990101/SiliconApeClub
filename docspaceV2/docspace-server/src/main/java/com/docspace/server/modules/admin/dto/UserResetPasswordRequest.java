package com.docspace.server.modules.admin.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UserResetPasswordRequest {

    @NotBlank
    private String newPassword;
}
