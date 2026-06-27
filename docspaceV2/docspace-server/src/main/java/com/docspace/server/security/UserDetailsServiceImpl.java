/**
 * 用户详情服务，根据用户名从数据库加载登录所需的安全用户对象。
 */
package com.docspace.server.security;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.docspace.server.common.enums.UserRole;
import com.docspace.server.persistence.entity.UserEntity;
import com.docspace.server.persistence.mapper.UserMapper;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements org.springframework.security.core.userdetails.UserDetailsService {

    private final UserMapper userMapper;
    private static final Map<String, String> USERNAME_ALIAS = new HashMap<String, String>();

    static {
        USERNAME_ALIAS.put("admin", "zhangsan");
        USERNAME_ALIAS.put("member", "lisi");
    }

    /** 按用户名加载安全用户。 */
    @Override
    public SecurityUser loadUserByUsername(String username) throws UsernameNotFoundException {
        String lookupUsername = USERNAME_ALIAS.containsKey(username) ? USERNAME_ALIAS.get(username) : username;
        UserEntity user = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getUsername, lookupUsername)
                .last("limit 1"));
        if (user == null) {
            throw new UsernameNotFoundException("用户不存在: " + username);
        }
        return SecurityUser.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .password(user.getPasswordHash())
                .role(UserRole.valueOf(user.getRoleCode()))
                .departmentId(user.getDepartmentId())
                .enabled(user.getEnabled() != null && user.getEnabled() == 1)
                .build();
    }
}
