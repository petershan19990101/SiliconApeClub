package com.docspace.server.infrastructure.preview.impl;

import com.docspace.server.common.exception.BusinessException;
import com.docspace.server.infrastructure.preview.PreviewConversionService;
import com.docspace.server.infrastructure.storage.StoredResource;
import com.docspace.server.persistence.entity.DocumentEntity;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

@Service
public class LibreOfficePreviewConversionService implements PreviewConversionService {

    private final String libreOfficeCommand;
    private final long timeoutSeconds;

    public LibreOfficePreviewConversionService(
            @Value("${docspace.preview.libreoffice-command:soffice}") String libreOfficeCommand,
            @Value("${docspace.preview.libreoffice-timeout-seconds:120}") long timeoutSeconds) {
        this.libreOfficeCommand = libreOfficeCommand;
        this.timeoutSeconds = timeoutSeconds;
    }

    @Override
    public boolean supports(DocumentEntity document) {
        if (document == null || document.getLatestSourceFile() == null) {
            return false;
        }
        String fileName = document.getLatestSourceFile().toLowerCase(Locale.ROOT);
        return fileName.endsWith(".pptx");
    }

    @Override
    public StoredResource convert(DocumentEntity document, StoredResource sourceResource) {
        if (sourceResource == null || sourceResource.getContent() == null || sourceResource.getContent().length == 0) {
            throw new BusinessException("原始 PPTX 文件为空，无法转换预览。");
        }

        Path cacheDir = Paths.get("data", "preview-cache");
        Path tempDir = null;
        try {
            Files.createDirectories(cacheDir);
            String cacheFileName = "document-" + document.getId() + "-v" + document.getCurrentVersion() + ".pdf";
            Path cachedPdf = cacheDir.resolve(cacheFileName).toAbsolutePath();
            if (Files.exists(cachedPdf) && Files.size(cachedPdf) > 0) {
                return toPdfResource(document.getLatestSourceFile(), Files.readAllBytes(cachedPdf));
            }

            tempDir = Files.createTempDirectory(cacheDir, "pptx-preview-");
            Path inputFile = tempDir.resolve("source.pptx");
            Path outputDir = tempDir.resolve("out");
            Path outputFile = outputDir.resolve("source.pdf");
            Files.createDirectories(outputDir);
            Files.write(inputFile, sourceResource.getContent());

            executeLibreOfficeExport(inputFile.toAbsolutePath(), outputDir.toAbsolutePath());

            if (!Files.exists(outputFile) || Files.size(outputFile) == 0) {
                throw new BusinessException("当前环境暂不支持 PPTX 在线预览，请联系管理员配置 LibreOffice 文档转换服务。");
            }

            Files.copy(outputFile, cachedPdf, StandardCopyOption.REPLACE_EXISTING);
            return toPdfResource(document.getLatestSourceFile(), Files.readAllBytes(cachedPdf));
        } catch (IOException ex) {
            throw new BusinessException("PPTX 预览转换失败: " + ex.getMessage());
        } finally {
            if (tempDir != null) {
                deleteQuietly(tempDir);
            }
        }
    }

    private void executeLibreOfficeExport(Path inputFile, Path outputDir) {
        ProcessBuilder processBuilder = new ProcessBuilder(
                libreOfficeCommand,
                "--headless",
                "--nologo",
                "--norestore",
                "--nolockcheck",
                "--convert-to",
                "pdf",
                "--outdir",
                outputDir.toString(),
                inputFile.toString()
        );
        processBuilder.redirectErrorStream(true);

        try {
            Process process = processBuilder.start();
            String output = new String(StreamUtils.copyToByteArray(process.getInputStream()), StandardCharsets.UTF_8);
            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new BusinessException("PPTX 预览转换超时，请联系管理员检查 LibreOffice 服务。");
            }
            if (process.exitValue() != 0) {
                throw new BusinessException(buildLibreOfficeErrorMessage(output));
            }
        } catch (IOException ex) {
            throw new BusinessException("当前环境暂不支持 PPTX 在线预览，请联系管理员配置 LibreOffice 文档转换服务。");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException("PPTX 预览转换被中断。");
        }
    }

    private String buildLibreOfficeErrorMessage(String output) {
        String normalized = output == null ? "" : output.trim();
        if (normalized.isEmpty()) {
            return "当前环境暂不支持 PPTX 在线预览，请联系管理员配置 LibreOffice 文档转换服务。";
        }
        return "PPTX 预览转换失败: " + normalized;
    }

    private StoredResource toPdfResource(String sourceFileName, byte[] content) {
        String fileName = sourceFileName == null
                ? "preview.pdf"
                : sourceFileName.replaceAll("(?i)\\.pptx$", ".pdf");
        return StoredResource.builder()
                .fileName(fileName)
                .contentType("application/pdf")
                .content(content)
                .build();
    }

    private void deleteQuietly(Path root) {
        try {
            if (Files.notExists(root)) {
                return;
            }
            Files.walk(root)
                    .sorted(Comparator.reverseOrder())
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException ignored) {
                        }
                    });
        } catch (IOException ignored) {
        }
    }
}
