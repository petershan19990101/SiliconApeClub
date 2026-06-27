ARG MAVEN_BASE_IMAGE=maven:3.9.9-eclipse-temurin-8
ARG JRE_BASE_IMAGE=eclipse-temurin:8-jre

FROM ${JRE_BASE_IMAGE} AS runtime-prebuilt
WORKDIR /app
COPY target/siliconApeClub-server.war /app/siliconApeClub-server.war
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/siliconApeClub-server.war"]

FROM ${MAVEN_BASE_IMAGE} AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

FROM ${JRE_BASE_IMAGE}
WORKDIR /app
COPY --from=build /workspace/target/siliconApeClub-server.war /app/siliconApeClub-server.war
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/siliconApeClub-server.war"]
