package com.docspace.server.modules.admin.dto;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UserUpsertRequest {

    @NotBlank
    private String username;
    @NotBlank
    private String displayName;
    @Email
    @NotBlank
    private String email;
    @NotNull
    private Long departmentId;
    private String password;
    @NotNull
    private Boolean enabled;
}
