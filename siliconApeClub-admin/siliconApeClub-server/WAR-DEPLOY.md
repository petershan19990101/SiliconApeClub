# WAR Packaging Guide

## Changes

- Maven packaging is set to `war`
- `SiliconApeClubServerApplication` now supports servlet container startup
- Embedded Tomcat is marked as `provided` for external container deployment

## Build

```bash
./mvnw clean package -DskipTests
```

Windows:

```powershell
.\mvnw.cmd clean package -DskipTests
```

## Artifact

```text
target/siliconApeClub-server.war
```

## Startup Options

Standalone startup:

```bash
java -jar target/siliconApeClub-server.war
```

Deploy to external Tomcat:

1. Build the WAR package
2. Copy `target/siliconApeClub-server.war` to Tomcat `webapps/`
3. Start Tomcat

If you want the app to be deployed as ROOT in Tomcat, rename the file to `ROOT.war`.

## Apollo Template

The repository now includes `apollo-prod.properties.example` in the project root.

- Copy it to `apollo-prod.properties` on the target server.
- Fill in the real production bootstrap values such as `app.id` and `apollo.meta`.
- Keep the namespace keys in Apollo Portal under the `application` namespace.
- The template is prepared for Redis cluster mode via `spring.redis.cluster.nodes`.

`apollo-prod.properties` is ignored by Git so production secrets do not get committed.
