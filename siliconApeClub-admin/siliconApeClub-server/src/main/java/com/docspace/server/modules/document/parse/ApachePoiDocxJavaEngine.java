package com.docspace.server.modules.document.parse;

import com.docspace.server.common.exception.BusinessException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.poi.xwpf.usermodel.IBody;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.IRunElement;
import org.apache.poi.xwpf.usermodel.UnderlinePatterns;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFHyperlink;
import org.apache.poi.xwpf.usermodel.XWPFHyperlinkRun;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFPicture;
import org.apache.poi.xwpf.usermodel.XWPFPictureData;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.poi.xwpf.usermodel.XWPFStyles;
import org.apache.poi.xwpf.usermodel.XWPFStyle;
import org.springframework.stereotype.Component;

@Component
public class ApachePoiDocxJavaEngine implements DocumentParseEngine {

    private static final Pattern HEADING_LEVEL_PATTERN = Pattern.compile("(?:heading|标题)\\s*([1-6])", Pattern.CASE_INSENSITIVE);

    @Override
    public String getCode() {
        return "apache_poi_docx_java_engine";
    }

    @Override
    public String getName() {
        return "Apache_POI_docx_引擎";
    }

    @Override
    public String getDescription() {
        return "基于 Apache POI 的 Word OOXML（docx）解析引擎，提取语义结构并输出 Markdown。";
    }

    @Override
    public ParseEngineOutput parse(byte[] sourceBytes) {
        if (sourceBytes == null || sourceBytes.length == 0) {
            throw new BusinessException("DOCX 内容为空，无法解析");
        }

        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(sourceBytes))) {
            ParseContext context = new ParseContext();
            String markdown = buildMarkdown(document, context);
            String plainText = normalizeText(context.plainText.toString());

            List<ParsePageText> pageTexts = new ArrayList<ParsePageText>();
            pageTexts.add(ParsePageText.builder()
                    .pageNo(1)
                    .text(plainText)
                    .build());

            return ParseEngineOutput.builder()
                    .pageTexts(pageTexts)
                    .images(context.images)
                    .markdownContent(markdown)
                    .build();
        } catch (IOException ex) {
            throw new BusinessException("DOCX 解析失败: " + ex.getMessage());
        }
    }

    private String buildMarkdown(XWPFDocument document, ParseContext context) {
        List<String> blocks = new ArrayList<String>();
        for (IBodyElement element : document.getBodyElements()) {
            String block = "";
            if (element instanceof XWPFParagraph) {
                block = renderParagraph((XWPFParagraph) element, document, context);
            } else if (element instanceof XWPFTable) {
                block = renderTable((XWPFTable) element, document, context);
            }

            if (!isBlank(block)) {
                blocks.add(block.trim());
            }
        }

        return String.join("\n\n", blocks).trim();
    }

    private String renderParagraph(XWPFParagraph paragraph, XWPFDocument document, ParseContext context) {
        String inlineMarkdown = renderInlineRuns(paragraph, document, context);
        String plainText = normalizeText(paragraph.getText());
        appendPlainText(context, plainText);

        if (isBlank(inlineMarkdown)) {
            return "";
        }

        int headingLevel = resolveHeadingLevel(paragraph, document);
        if (headingLevel > 0) {
            return repeat("#", headingLevel) + " " + inlineMarkdown;
        }

        if (paragraph.getNumID() != null) {
            int level = paragraph.getNumIlvl() == null ? 0 : Math.max(0, paragraph.getNumIlvl().intValue());
            String indent = repeat("  ", level);
            String prefix = isOrderedList(paragraph) ? "1. " : "- ";
            return indent + prefix + inlineMarkdown;
        }

        return inlineMarkdown;
    }

    private String renderTable(XWPFTable table, XWPFDocument document, ParseContext context) {
        List<List<String>> rows = new ArrayList<List<String>>();
        for (XWPFTableRow row : table.getRows()) {
            List<String> cells = new ArrayList<String>();
            for (XWPFTableCell cell : row.getTableCells()) {
                String cellText = renderTableCell(cell, document, context);
                cells.add(cellText);
                appendPlainText(context, cellText.replace("<br/>", " "));
            }
            rows.add(cells);
        }

        if (rows.isEmpty()) {
            return "";
        }

        List<String> header = rows.get(0);
        int columnCount = header.size();
        if (columnCount == 0) {
            return "";
        }

        StringBuilder builder = new StringBuilder();
        appendTableRow(builder, header);
        builder.append("\n");

        List<String> separator = new ArrayList<String>();
        for (int index = 0; index < columnCount; index++) {
            separator.add("---");
        }
        appendTableRow(builder, separator);

        for (int rowIndex = 1; rowIndex < rows.size(); rowIndex++) {
            builder.append("\n");
            appendTableRow(builder, normalizeRowLength(rows.get(rowIndex), columnCount));
        }

        return builder.toString();
    }

    private String renderTableCell(XWPFTableCell cell, XWPFDocument document, ParseContext context) {
        List<String> parts = new ArrayList<String>();
        for (IBodyElement element : cell.getBodyElements()) {
            if (element instanceof XWPFParagraph) {
                String paragraphMarkdown = renderInlineRuns((XWPFParagraph) element, document, context);
                if (!isBlank(paragraphMarkdown)) {
                    parts.add(sanitizeTableCell(paragraphMarkdown));
                }
            } else if (element instanceof XWPFTable) {
                String nestedTableText = renderTable((XWPFTable) element, document, context);
                if (!isBlank(nestedTableText)) {
                    parts.add(sanitizeTableCell(nestedTableText));
                }
            }
        }
        return String.join("<br/>", parts).trim();
    }

    private String renderInlineRuns(XWPFParagraph paragraph, XWPFDocument document, ParseContext context) {
        StringBuilder builder = new StringBuilder();
        for (IRunElement runElement : paragraph.getIRuns()) {
            if (!(runElement instanceof XWPFRun)) {
                continue;
            }

            XWPFRun run = (XWPFRun) runElement;
            String text = normalizeInlineText(run.text());
            if (!text.isEmpty()) {
                builder.append(applyRunStyle(run, text, document));
            }

            for (XWPFPicture picture : run.getEmbeddedPictures()) {
                ParseImageArtifact imageArtifact = toImageArtifact(picture, context.nextImageSequence());
                if (imageArtifact != null) {
                    context.images.add(imageArtifact);
                    if (builder.length() > 0 && !endsWithWhitespace(builder)) {
                        builder.append(" ");
                    }
                    builder.append("{{image:1:").append(imageArtifact.getSequenceNo()).append("}}");
                }
            }
        }

        return normalizeInlineText(builder.toString());
    }

    private ParseImageArtifact toImageArtifact(XWPFPicture picture, int sequenceNo) {
        if (picture == null || picture.getPictureData() == null) {
            return null;
        }

        XWPFPictureData pictureData = picture.getPictureData();
        byte[] content = pictureData.getData();
        if (content == null || content.length == 0) {
            return null;
        }

        String extension = pictureData.suggestFileExtension();
        if (isBlank(extension)) {
            extension = "png";
        }

        return ParseImageArtifact.builder()
                .pageNo(1)
                .sequenceNo(sequenceNo)
                .content(content)
                .mimeType(mimeForExtension(extension.toLowerCase()))
                .extension(extension.toLowerCase())
                .build();
    }

    private String applyRunStyle(XWPFRun run, String rawText, XWPFDocument document) {
        String text = escapeMarkdown(rawText);

        if (run instanceof XWPFHyperlinkRun) {
            XWPFHyperlink hyperlink = ((XWPFHyperlinkRun) run).getHyperlink(document);
            if (hyperlink != null && !isBlank(hyperlink.getURL())) {
                text = "[" + text + "](" + hyperlink.getURL() + ")";
            }
        }

        if (run.isStrike() || run.isStrikeThrough()) {
            text = "~~" + text + "~~";
        }
        if (run.isBold() && run.isItalic()) {
            text = "***" + text + "***";
        } else if (run.isBold()) {
            text = "**" + text + "**";
        } else if (run.isItalic()) {
            text = "*" + text + "*";
        }
        if (run.getUnderline() != null && run.getUnderline() != UnderlinePatterns.NONE) {
            text = "<u>" + text + "</u>";
        }

        return text;
    }

    private int resolveHeadingLevel(XWPFParagraph paragraph, XWPFDocument document) {
        String styleKey = firstNonBlank(paragraph.getStyleID(), paragraph.getStyle());
        if (styleKey == null) {
            return 0;
        }

        String styleName = styleKey;
        XWPFStyles styles = document.getStyles();
        if (styles != null) {
            XWPFStyle style = styles.getStyle(styleKey);
            if (style != null && style.getName() != null) {
                styleName = style.getName();
            }
        }

        String normalized = styleName.toLowerCase();
        if ("title".equals(normalized) || normalized.contains("标题 1")) {
            return 1;
        }

        Matcher matcher = HEADING_LEVEL_PATTERN.matcher(normalized);
        if (matcher.find()) {
            return Integer.parseInt(matcher.group(1));
        }
        return 0;
    }

    private boolean isOrderedList(XWPFParagraph paragraph) {
        String numFmt = paragraph.getNumFmt();
        if (isBlank(numFmt)) {
            return false;
        }
        String normalized = numFmt.toLowerCase();
        return !(normalized.contains("bullet") || normalized.contains("disc") || normalized.contains("circle"));
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

    private void appendPlainText(ParseContext context, String text) {
        String normalized = normalizeText(text);
        if (normalized.isEmpty()) {
            return;
        }
        if (context.plainText.length() > 0) {
            context.plainText.append("\n\n");
        }
        context.plainText.append(normalized);
    }

    private boolean endsWithWhitespace(StringBuilder builder) {
        if (builder.length() == 0) {
            return false;
        }
        return Character.isWhitespace(builder.charAt(builder.length() - 1));
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

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) {
                return value;
            }
        }
        return null;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String repeat(String token, int count) {
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < count; index++) {
            builder.append(token);
        }
        return builder.toString();
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
        private final List<ParseImageArtifact> images = new ArrayList<ParseImageArtifact>();
        private final StringBuilder plainText = new StringBuilder();
        private int imageSequence = 0;

        private int nextImageSequence() {
            imageSequence += 1;
            return imageSequence;
        }
    }
}
