/**
 * AuthService 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.auth.service;

import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.modules.auth.dto.ChangePasswordRequest;
import com.docspace.server.modules.auth.dto.LoginRequest;
import com.docspace.server.modules.auth.dto.LoginResponse;
import com.docspace.server.persistence.entity.UserEntity;
import com.docspace.server.persistence.mapper.UserMapper;
import com.docspace.server.modules.user.service.UserQueryService;
import com.docspace.server.security.JwtTokenProvider;
import com.docspace.server.security.SecurityUser;
import com.docspace.server.security.UserDetailsServiceImpl;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserDetailsServiceImpl userDetailsService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserQueryService userQueryService;
    private final UserMapper userMapper;

    /**
     * 执行登录校验，并在成功后生成 JWT 访问令牌。
     */
    public LoginResponse login(LoginRequest request) {
        SecurityUser user = userDetailsService.loadUserByUsername(request.getUsername());
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException("用户名或密码错误");
        }
        return LoginResponse.builder()
                .accessToken(jwtTokenProvider.createToken(user))
                .expiresIn(7200L)
                .user(userQueryService.getById(user.getId()))
                .build();
    }

    /**
     * 修改当前登录用户密码。
     */
    @Transactional(rollbackFor = Exception.class)
    public void changePassword(SecurityUser currentUser, ChangePasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException("两次输入的新密码不一致");
        }

        UserEntity user = userMapper.selectById(currentUser.getId());
        if (user == null) {
            throw new BusinessException("当前用户不存在");
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BusinessException("当前密码错误");
        }
        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new BusinessException("新密码不能与当前密码相同");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
    }
}
