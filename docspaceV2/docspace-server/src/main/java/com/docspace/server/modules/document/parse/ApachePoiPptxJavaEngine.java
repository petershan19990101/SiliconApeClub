package com.docspace.server.modules.document.parse;

import com.docspace.server.common.exception.BusinessException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.poi.sl.usermodel.Placeholder;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFGroupShape;
import org.apache.poi.xslf.usermodel.XSLFHyperlink;
import org.apache.poi.xslf.usermodel.XSLFNotes;
import org.apache.poi.xslf.usermodel.XSLFPictureData;
import org.apache.poi.xslf.usermodel.XSLFPictureShape;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTable;
import org.apache.poi.xslf.usermodel.XSLFTableCell;
import org.apache.poi.xslf.usermodel.XSLFTableRow;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.springframework.stereotype.Component;

@Component
public class ApachePoiPptxJavaEngine implements DocumentParseEngine {

    @Override
    public String getCode() {
        return "apache_poi_pptx_java_engine";
    }

    @Override
    public String getName() {
        return "Apache_POI_pptx_引擎";
    }

    @Override
    public String getDescription() {
        return "基于 Apache POI 的 PowerPoint OOXML（pptx）解析引擎，提取幻灯片语义结构并输出 Markdown。";
    }

    @Override
    public ParseEngineOutput parse(byte[] sourceBytes) {
        if (sourceBytes == null || sourceBytes.length == 0) {
            throw new BusinessException("PPTX 内容为空，无法解析");
        }

        try (XMLSlideShow slideShow = new XMLSlideShow(new ByteArrayInputStream(sourceBytes))) {
            ParseContext context = new ParseContext();
            List<String> slideMarkdownBlocks = new ArrayList<String>();

            int slideIndex = 0;
            for (XSLFSlide slide : slideShow.getSlides()) {
                slideIndex += 1;
                String markdown = renderSlide(slide, slideIndex, context);
                if (!isBlank(markdown)) {
                    slideMarkdownBlocks.add(markdown.trim());
                }
            }

            return ParseEngineOutput.builder()
                    .pageTexts(context.pageTexts)
                    .images(context.images)
                    .markdownContent(String.join("\n\n", slideMarkdownBlocks).trim())
                    .build();
        } catch (IOException ex) {
            throw new BusinessException("PPTX 解析失败: " + ex.getMessage());
        }
    }

    private String renderSlide(XSLFSlide slide, int slideNo, ParseContext context) {
        List<String> blocks = new ArrayList<String>();
        StringBuilder plainText = new StringBuilder();

        String title = normalizeText(slide.getTitle());
        if (isBlank(title)) {
            blocks.add("## 第 " + slideNo + " 页");
        } else {
            blocks.add("## 第 " + slideNo + " 页 · " + escapeMarkdown(title));
            appendPlainText(plainText, title);
        }

        for (XSLFShape shape : slide.getShapes()) {
            collectShapeContent(shape, slide, slideNo, title, blocks, plainText, context);
        }

        String notesMarkdown = renderNotes(slide.getNotes(), plainText);
        if (!isBlank(notesMarkdown)) {
            blocks.add(notesMarkdown);
        }

        context.pageTexts.add(ParsePageText.builder()
                .pageNo(slideNo)
                .text(normalizeText(plainText.toString()))
                .build());

        return String.join("\n\n", blocks).trim();
    }

    private void collectShapeContent(XSLFShape shape,
                                     XSLFSlide slide,
                                     int slideNo,
                                     String slideTitle,
                                     List<String> blocks,
                                     StringBuilder plainText,
                                     ParseContext context) {
        if (shape instanceof XSLFGroupShape) {
            for (XSLFShape child : ((XSLFGroupShape) shape).getShapes()) {
                collectShapeContent(child, slide, slideNo, slideTitle, blocks, plainText, context);
            }
            return;
        }

        if (shape instanceof XSLFTextShape) {
            XSLFTextShape textShape = (XSLFTextShape) shape;
            String markdown = renderTextShape(textShape, slideTitle, plainText);
            if (!isBlank(markdown)) {
                blocks.add(markdown);
            }
            return;
        }

        if (shape instanceof XSLFTable) {
            String markdown = renderTable((XSLFTable) shape, plainText);
            if (!isBlank(markdown)) {
                blocks.add(markdown);
            }
            return;
        }

        if (shape instanceof XSLFPictureShape) {
            ParseImageArtifact image = toImageArtifact((XSLFPictureShape) shape, slideNo, context.nextImageSequence());
            if (image != null) {
                context.images.add(image);
                blocks.add("{{image:" + slideNo + ":" + image.getSequenceNo() + "}}");
            }
        }
    }

    private String renderTextShape(XSLFTextShape textShape, String slideTitle, StringBuilder plainText) {
        List<String> paragraphs = new ArrayList<String>();
        Placeholder placeholder = textShape.getTextType();

        for (XSLFTextParagraph paragraph : textShape.getTextParagraphs()) {
            String paragraphText = renderParagraph(paragraph);
            String rawParagraphText = normalizeText(extractParagraphPlainText(paragraph));

            if (isBlank(paragraphText)) {
                continue;
            }

            if (isTitlePlaceholder(placeholder) && rawParagraphText.equals(normalizeText(slideTitle))) {
                continue;
            }

            appendPlainText(plainText, rawParagraphText);

            if (placeholder == Placeholder.SUBTITLE) {
                paragraphs.add("> " + paragraphText);
            } else {
                paragraphs.add(paragraphText);
            }
        }

        return String.join("\n\n", paragraphs).trim();
    }

    private String renderParagraph(XSLFTextParagraph paragraph) {
        String inline = renderRuns(paragraph);
        if (isBlank(inline)) {
            return "";
        }

        if (paragraph.isBullet()) {
            String indent = repeat("  ", Math.max(0, paragraph.getIndentLevel()));
            return indent + "- " + inline;
        }

        return inline;
    }

    private String renderRuns(XSLFTextParagraph paragraph) {
        StringBuilder builder = new StringBuilder();
        for (XSLFTextRun run : paragraph.getTextRuns()) {
            String text = normalizeInlineText(run.getRawText());
            if (text.isEmpty()) {
                continue;
            }
            builder.append(applyRunStyle(run, text));
        }
        return normalizeInlineText(builder.toString());
    }

    private String renderTable(XSLFTable table, StringBuilder plainText) {
        List<List<String>> rows = new ArrayList<List<String>>();
        for (XSLFTableRow row : table.getRows()) {
            List<String> cells = new ArrayList<String>();
            for (XSLFTableCell cell : row.getCells()) {
                String cellText = renderTableCell(cell);
                cells.add(cellText);
                appendPlainText(plainText, cellText.replace("<br/>", " "));
            }
            rows.add(cells);
        }

        if (rows.isEmpty()) {
            return "";
        }

        int columnCount = rows.get(0).size();
        if (columnCount == 0) {
            return "";
        }

        StringBuilder builder = new StringBuilder();
        appendTableRow(builder, rows.get(0));
        builder.append("\n");

        List<String> separator = new ArrayList<String>();
        for (int index = 0; index < columnCount; index++) {
            separator.add("---");
        }
        appendTableRow(builder, separator);

        for (int index = 1; index < rows.size(); index++) {
            builder.append("\n");
            appendTableRow(builder, normalizeRowLength(rows.get(index), columnCount));
        }

        return builder.toString();
    }

    private String renderTableCell(XSLFTableCell cell) {
        List<String> parts = new ArrayList<String>();
        for (XSLFTextParagraph paragraph : cell.getTextParagraphs()) {
            String markdown = renderParagraph(paragraph);
            if (!isBlank(markdown)) {
                parts.add(sanitizeTableCell(markdown));
            }
        }
        return String.join("<br/>", parts).trim();
    }

    private String renderNotes(XSLFNotes notes, StringBuilder plainText) {
        if (notes == null || notes.getTextParagraphs() == null) {
            return "";
        }

        List<String> noteParagraphs = new ArrayList<String>();
        for (List<XSLFTextParagraph> paragraphGroup : notes.getTextParagraphs()) {
            for (XSLFTextParagraph paragraph : paragraphGroup) {
                String markdown = renderParagraph(paragraph);
                String rawText = normalizeText(extractParagraphPlainText(paragraph));
                if (isBlank(markdown) || isBlank(rawText)) {
                    continue;
                }
                appendPlainText(plainText, rawText);
                noteParagraphs.add(markdown);
            }
        }

        if (noteParagraphs.isEmpty()) {
            return "";
        }

        return "### 备注\n\n" + String.join("\n\n", noteParagraphs);
    }

    private ParseImageArtifact toImageArtifact(XSLFPictureShape pictureShape, int slideNo, int sequenceNo) {
        XSLFPictureData pictureData = pictureShape.getPictureData();
        if (pictureData == null || pictureData.getData() == null || pictureData.getData().length == 0) {
            return null;
        }

        String extension = pictureData.suggestFileExtension();
        if (isBlank(extension)) {
            extension = "png";
        }

        return ParseImageArtifact.builder()
                .pageNo(slideNo)
                .sequenceNo(sequenceNo)
                .content(pictureData.getData())
                .mimeType(defaultString(pictureData.getContentType(), mimeForExtension(extension.toLowerCase())))
                .extension(extension.toLowerCase())
                .build();
    }

    private String applyRunStyle(XSLFTextRun run, String rawText) {
        String text = escapeMarkdown(rawText);

        XSLFHyperlink hyperlink = run.getHyperlink();
        if (hyperlink != null && !isBlank(hyperlink.getAddress())) {
            text = "[" + text + "](" + hyperlink.getAddress() + ")";
        }

        if (run.isStrikethrough()) {
            text = "~~" + text + "~~";
        }
        if (run.isBold() && run.isItalic()) {
            text = "***" + text + "***";
        } else if (run.isBold()) {
            text = "**" + text + "**";
        } else if (run.isItalic()) {
            text = "*" + text + "*";
        }
        if (run.isUnderlined()) {
            text = "<u>" + text + "</u>";
        }

        return text;
    }

    private String extractParagraphPlainText(XSLFTextParagraph paragraph) {
        StringBuilder builder = new StringBuilder();
        for (XSLFTextRun run : paragraph.getTextRuns()) {
            String text = normalizeInlineText(run.getRawText());
            if (text.isEmpty()) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append(" ");
            }
            builder.append(text);
        }
        return normalizeText(builder.toString());
    }

    private boolean isTitlePlaceholder(Placeholder placeholder) {
        return placeholder == Placeholder.TITLE
                || placeholder == Placeholder.CENTERED_TITLE
                || placeholder == Placeholder.VERTICAL_TEXT_TITLE;
    }

    private void appendTableRow(StringBuilder builder, List<String> cells) {
        builder.append("| ");
        builder.append(String.join(" | ", cells));
        builder.append(" |");
    }

    private List<String> normalizeRowLength(List<String> row, int columnCount) {
        List<String> normalized = new ArrayList<String>(row);
        while (normalized.size() < columnCount) {
            normalized.add("");
        }
        if (normalized.size() > columnCount) {
            return normalized.subList(0, columnCount);
        }
        return normalized;
    }

    private void appendPlainText(StringBuilder builder, String text) {
        String normalized = normalizeText(text);
        if (normalized.isEmpty()) {
            return;
        }
        if (builder.length() > 0) {
            builder.append("\n\n");
        }
        builder.append(normalized);
    }

    private String sanitizeTableCell(String value) {
        return value.replace("\n", "<br/>").replace("|", "\\|").trim();
    }

    private String escapeMarkdown(String text) {
        return text
                .replace("\\", "\\\\")
                .replace("|", "\\|")
                .replace("`", "\\`")
                .replace("*", "\\*")
                .replace("_", "\\_")
                .replace("[", "\\[")
                .replace("]", "\\]")
                .replace("#", "\\#");
    }

    private String normalizeInlineText(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("\u0000", "")
                .replace("\r", "")
                .replace("\n", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String normalizeText(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("\u0000", "").trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String repeat(String value, int count) {
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < count; index++) {
            builder.append(value);
        }
        return builder.toString();
    }

    private String defaultString(String value, String fallback) {
        return isBlank(value) ? fallback : value;
    }

    private String mimeForExtension(String extension) {
        if ("jpg".equals(extension) || "jpeg".equals(extension)) {
            return "image/jpeg";
        }
        if ("png".equals(extension)) {
            return "image/png";
        }
        if ("gif".equals(extension)) {
            return "image/gif";
        }
        if ("bmp".equals(extension)) {
            return "image/bmp";
        }
        if ("tif".equals(extension) || "tiff".equals(extension)) {
            return "image/tiff";
        }
        if ("emf".equals(extension)) {
            return "image/emf";
        }
        if ("wmf".equals(extension)) {
            return "image/wmf";
        }
        return "application/octet-stream";
    }

    private static class ParseContext {
        private final List<ParsePageText> pageTexts = new ArrayList<ParsePageText>();
        private final List<ParseImageArtifact> images = new ArrayList<ParseImageArtifact>();
        private int imageSequence = 0;

        private int nextImageSequence() {
            imageSequence += 1;
            return imageSequence;
        }
    }
}
