package com.docspace.server.modules.document.parse;

import com.docspace.server.common.exception.BusinessException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import javax.imageio.ImageIO;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

@Component
public class ApachePdfBoxJavaEngine implements DocumentParseEngine {

    @Override
    public String getCode() {
        return "apache_pdfbox_java_engine";
    }

    @Override
    public String getName() {
        return "Apache_PDFBox_java_引擎";
    }

    @Override
    public String getDescription() {
        return "基于 Apache PDFBox 的 PDF 解析引擎，支持页级文本与图片提取。";
    }

    @Override
    public ParseEngineOutput parse(byte[] sourceBytes) {
        if (sourceBytes == null || sourceBytes.length == 0) {
            throw new BusinessException("PDF 内容为空，无法解析");
        }
        List<ParsePageText> pageTexts = new ArrayList<ParsePageText>();
        List<ParseImageArtifact> images = new ArrayList<ParseImageArtifact>();
        try (PDDocument document = PDDocument.load(sourceBytes)) {
            PDFTextStripper textStripper = new PDFTextStripper();
            int pageCount = document.getNumberOfPages();
            for (int index = 0; index < pageCount; index++) {
                int pageNo = index + 1;
                textStripper.setStartPage(pageNo);
                textStripper.setEndPage(pageNo);
                pageTexts.add(ParsePageText.builder()
                        .pageNo(pageNo)
                        .text(normalizeText(textStripper.getText(document)))
                        .build());

                PDPage page = document.getPage(index);
                collectPageImages(page.getResources(), pageNo, new int[]{0}, images);
            }
            return ParseEngineOutput.builder()
                    .pageTexts(pageTexts)
                    .images(images)
                    .build();
        } catch (IOException ex) {
            throw new BusinessException("PDF 解析失败: " + ex.getMessage());
        }
    }

    private void collectPageImages(PDResources resources,
                                   int pageNo,
                                   int[] sequenceCounter,
                                   List<ParseImageArtifact> output) throws IOException {
        if (resources == null) {
            return;
        }
        for (COSName name : resources.getXObjectNames()) {
            PDXObject xObject = resources.getXObject(name);
            if (xObject instanceof PDImageXObject) {
                sequenceCounter[0] = sequenceCounter[0] + 1;
                output.add(ParseImageArtifact.builder()
                        .pageNo(pageNo)
                        .sequenceNo(sequenceCounter[0])
                        .content(toPngBytes((PDImageXObject) xObject))
                        .mimeType("image/png")
                        .extension("png")
                        .build());
                continue;
            }
            if (xObject instanceof PDFormXObject) {
                collectPageImages(((PDFormXObject) xObject).getResources(), pageNo, sequenceCounter, output);
            }
        }
    }

    private byte[] toPngBytes(PDImageXObject image) throws IOException {
        BufferedImage bufferedImage = image.getImage();
        if (bufferedImage == null) {
            return new byte[0];
        }
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        ImageIO.write(bufferedImage, "png", outputStream);
        return outputStream.toByteArray();
    }

    private String normalizeText(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("\u0000", "").trim();
    }
}
