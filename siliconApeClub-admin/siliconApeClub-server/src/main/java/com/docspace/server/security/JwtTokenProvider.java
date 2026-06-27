/**
 * JWT 工具类，负责生成、校验和解析访问令牌。
 */
package com.docspace.server.security;

import com.docspace.server.config.properties.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.util.Date;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {

    private final JwtProperties properties;
    private final Key signingKey;

    public JwtTokenProvider(JwtProperties properties) {
        this.properties = properties;
        this.signingKey = Keys.hmacShaKeyFor(properties.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    /** 根据当前认证用户生成访问令牌。 */
    public String createToken(SecurityUser user) {
        Instant now = Instant.now();
        Instant expireAt = now.plusSeconds(properties.getExpireSeconds());
        return Jwts.builder()
                .setSubject(user.getUsername())
                .claim("uid", user.getId())
                .claim("role", user.getRole().name())
                .claim("name", user.getDisplayName())
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(expireAt))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    /** 从令牌中提取用户名。 */
    public String getUsername(String token) {
        return parseClaims(token).getSubject();
    }

    /** 校验令牌是否合法且未过期。 */
    public boolean validateToken(String token) {
        parseClaims(token);
        return true;
    }

    /** 统一解析 JWT Claims，供用户名提取和签名校验复用。 */
    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
