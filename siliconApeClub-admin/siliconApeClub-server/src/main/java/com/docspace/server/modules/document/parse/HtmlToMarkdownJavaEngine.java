package com.docspace.server.modules.document.parse;

import com.docspace.server.common.exception.BusinessException;
import java.io.IOException;
import java.io.StringReader;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Deque;
import javax.swing.text.MutableAttributeSet;
import javax.swing.text.html.HTML;
import javax.swing.text.html.HTMLEditorKit;
import javax.swing.text.html.parser.ParserDelegator;
import org.springframework.stereotype.Component;

@Component
public class HtmlToMarkdownJavaEngine implements DocumentParseEngine {

    @Override
    public String getCode() {
        return "html_to_markdown_java_engine";
    }

    @Override
    public String getName() {
        return "HTML_to_Markdown_引擎";
    }

    @Override
    public String getDescription() {
        return "基于 Java HTML Parser 的 HTML 解析器，将标题、段落、列表、链接、代码块等结构转换为 Markdown。";
    }

    @Override
    public ParseEngineOutput parse(byte[] sourceBytes) {
        if (sourceBytes == null || sourceBytes.length == 0) {
            throw new BusinessException("HTML 内容为空，无法解析");
        }
        String html = decodeText(sourceBytes);
        HtmlMarkdownCallback callback = new HtmlMarkdownCallback();
        try {
            new ParserDelegator().parse(new StringReader(html), callback, true);
        } catch (IOException ex) {
            throw new BusinessException("HTML 解析失败: " + ex.getMessage());
        }
        String markdown = callback.markdown();
        String plainText = callback.plainText();
        return ParseEngineOutput.builder()
                .pageTexts(Collections.singletonList(ParsePageText.builder()
                        .pageNo(1)
                        .text(plainText)
                        .build()))
                .images(Collections.<ParseImageArtifact>emptyList())
                .markdownContent(markdown)
                .build();
    }

    private String decodeText(byte[] sourceBytes) {
        Charset[] charsets = new Charset[] {
                StandardCharsets.UTF_8,
                Charset.forName("GB18030"),
                StandardCharsets.ISO_8859_1
        };
        for (Charset charset : charsets) {
            try {
                CharsetDecoder decoder = charset.newDecoder()
                        .onMalformedInput(CodingErrorAction.REPORT)
                        .onUnmappableCharacter(CodingErrorAction.REPORT);
                return decoder.decode(ByteBuffer.wrap(sourceBytes)).toString();
            } catch (CharacterCodingException ignored) {
                // Try the next charset.
            }
        }
        return new String(sourceBytes, StandardCharsets.UTF_8);
    }

    private static class HtmlMarkdownCallback extends HTMLEditorKit.ParserCallback {
        private final StringBuilder markdown = new StringBuilder();
        private final StringBuilder plainText = new StringBuilder();
        private final Deque<ListContext> listStack = new ArrayDeque<ListContext>();
        private final Deque<LinkContext> linkStack = new ArrayDeque<LinkContext>();
        private boolean inPre = false;
        private boolean inCode = false;
        private boolean skipping = false;
        private int quoteDepth = 0;

        @Override
        public void handleStartTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
            if (tag == HTML.Tag.SCRIPT || tag == HTML.Tag.STYLE) {
                skipping = true;
                return;
            }
            if (isHeading(tag)) {
                newBlock();
                appendRaw(repeat("#", headingLevel(tag)) + " ");
                return;
            }
            if (isBlock(tag)) {
                newBlock();
                return;
            }
            if (tag == HTML.Tag.BLOCKQUOTE) {
                newBlock();
                quoteDepth += 1;
                return;
            }
            if (tag == HTML.Tag.UL || tag == HTML.Tag.OL) {
                listStack.push(new ListContext(tag == HTML.Tag.OL));
                newBlock();
                return;
            }
            if (tag == HTML.Tag.LI) {
                newBlock();
                appendRaw(listPrefix());
                return;
            }
            if (tag == HTML.Tag.PRE) {
                newBlock();
                appendRaw("```");
                appendNewLine();
                inPre = true;
                return;
            }
            if (tag == HTML.Tag.CODE && !inPre) {
                appendRaw("`");
                inCode = true;
                return;
            }
            if (tag == HTML.Tag.A) {
                Object href = attributes.getAttribute(HTML.Attribute.HREF);
                linkStack.push(new LinkContext(href == null ? "" : String.valueOf(href)));
                return;
            }
            if (tag == HTML.Tag.B || tag == HTML.Tag.STRONG) {
                appendRaw("**");
                return;
            }
            if (tag == HTML.Tag.I || tag == HTML.Tag.EM) {
                appendRaw("*");
            }
        }

        @Override
        public void handleEndTag(HTML.Tag tag, int position) {
            if (tag == HTML.Tag.SCRIPT || tag == HTML.Tag.STYLE) {
                skipping = false;
                return;
            }
            if (isHeading(tag) || isBlock(tag) || tag == HTML.Tag.LI) {
                newBlock();
                return;
            }
            if (tag == HTML.Tag.BLOCKQUOTE) {
                quoteDepth = Math.max(0, quoteDepth - 1);
                newBlock();
                return;
            }
            if ((tag == HTML.Tag.UL || tag == HTML.Tag.OL) && !listStack.isEmpty()) {
                listStack.pop();
                newBlock();
                return;
            }
            if (tag == HTML.Tag.PRE) {
                appendNewLine();
                appendRaw("```");
                inPre = false;
                newBlock();
                return;
            }
            if (tag == HTML.Tag.CODE && inCode) {
                appendRaw("`");
                inCode = false;
                return;
            }
            if (tag == HTML.Tag.A && !linkStack.isEmpty()) {
                LinkContext link = linkStack.pop();
                String text = link.text.toString().trim();
                if (!text.isEmpty()) {
                    if (link.href == null || link.href.trim().isEmpty()) {
                        appendRaw(text);
                    } else {
                        appendRaw("[" + text + "](" + link.href.trim() + ")");
                    }
                }
                return;
            }
            if (tag == HTML.Tag.B || tag == HTML.Tag.STRONG) {
                appendRaw("**");
                return;
            }
            if (tag == HTML.Tag.I || tag == HTML.Tag.EM) {
                appendRaw("*");
            }
        }

        @Override
        public void handleSimpleTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
            if (tag == HTML.Tag.BR) {
                appendNewLine();
                return;
            }
            if (tag == HTML.Tag.HR) {
                newBlock();
                appendRaw("---");
                newBlock();
                return;
            }
            if (tag == HTML.Tag.IMG) {
                Object src = attributes.getAttribute(HTML.Attribute.SRC);
                Object alt = attributes.getAttribute(HTML.Attribute.ALT);
                if (src != null) {
                    appendRaw("![" + escapeMarkdown(alt == null ? "" : String.valueOf(alt)) + "](" + src + ")");
                }
            }
        }

        @Override
        public void handleText(char[] data, int position) {
            if (skipping || data == null || data.length == 0) {
                return;
            }
            String text = new String(data);
            appendPlainText(text);
            String markdownText = inPre ? normalizePreText(text) : escapeMarkdown(normalizeInlineText(text));
            if (markdownText.isEmpty()) {
                return;
            }
            if (!linkStack.isEmpty()) {
                linkStack.peek().text.append(markdownText);
                return;
            }
            appendRaw(markdownText);
        }

        private String markdown() {
            return markdown.toString()
                    .replace("\uFEFF", "")
                    .replaceAll("[ \\t]+\\n", "\n")
                    .replaceAll("\\n{3,}", "\n\n")
                    .trim();
        }

        private String plainText() {
            return plainText.toString()
                    .replace("\uFEFF", "")
                    .replaceAll("[ \\t]+\\n", "\n")
                    .replaceAll("\\n{3,}", "\n\n")
                    .trim();
        }

        private void appendRaw(String value) {
            if (value == null || value.isEmpty()) {
                return;
            }
            ensureQuotePrefix();
            markdown.append(value);
        }

        private void appendNewLine() {
            markdown.append("\n");
            appendPlainBreak();
        }

        private void newBlock() {
            String current = markdown.toString();
            if (current.trim().isEmpty()) {
                return;
            }
            if (current.endsWith("\n\n")) {
                return;
            }
            if (current.endsWith("\n")) {
                markdown.append("\n");
            } else {
                markdown.append("\n\n");
            }
            appendPlainBreak();
        }

        private void appendPlainText(String text) {
            String normalized = normalizeInlineText(text);
            if (normalized.isEmpty()) {
                return;
            }
            if (plainText.length() > 0 && !Character.isWhitespace(plainText.charAt(plainText.length() - 1))) {
                plainText.append(" ");
            }
            plainText.append(normalized);
        }

        private void appendPlainBreak() {
            if (plainText.length() == 0 || plainText.toString().endsWith("\n\n")) {
                return;
            }
            if (plainText.toString().endsWith("\n")) {
                plainText.append("\n");
            } else {
                plainText.append("\n\n");
            }
        }

        private void ensureQuotePrefix() {
            if (quoteDepth <= 0) {
                return;
            }
            int length = markdown.length();
            if (length == 0 || markdown.charAt(length - 1) == '\n') {
                markdown.append(repeat("> ", quoteDepth));
            }
        }

        private String listPrefix() {
            int depth = Math.max(0, listStack.size() - 1);
            String indent = repeat("  ", depth);
            if (listStack.isEmpty()) {
                return indent + "- ";
            }
            ListContext context = listStack.peek();
            if (!context.ordered) {
                return indent + "- ";
            }
            int number = context.nextIndex;
            context.nextIndex += 1;
            return indent + number + ". ";
        }

        private boolean isHeading(HTML.Tag tag) {
            return tag == HTML.Tag.H1 || tag == HTML.Tag.H2 || tag == HTML.Tag.H3
                    || tag == HTML.Tag.H4 || tag == HTML.Tag.H5 || tag == HTML.Tag.H6;
        }

        private int headingLevel(HTML.Tag tag) {
            if (tag == HTML.Tag.H1) {
                return 1;
            }
            if (tag == HTML.Tag.H2) {
                return 2;
            }
            if (tag == HTML.Tag.H3) {
                return 3;
            }
            if (tag == HTML.Tag.H4) {
                return 4;
            }
            if (tag == HTML.Tag.H5) {
                return 5;
            }
            return 6;
        }

        private boolean isBlock(HTML.Tag tag) {
            String name = tag == null ? "" : tag.toString().toLowerCase();
            return tag == HTML.Tag.P || tag == HTML.Tag.DIV || tag == HTML.Tag.TR
                    || "section".equals(name) || "article".equals(name)
                    || "header".equals(name) || "footer".equals(name)
                    || "main".equals(name);
        }

        private String normalizeInlineText(String text) {
            if (text == null) {
                return "";
            }
            if (inPre) {
                return normalizePreText(text);
            }
            return text.replace("\u0000", "")
                    .replace("\r", "")
                    .replace("\n", " ")
                    .replaceAll("\\s+", " ")
                    .trim();
        }

        private String normalizePreText(String text) {
            if (text == null) {
                return "";
            }
            return text.replace("\u0000", "")
                    .replace("\r\n", "\n")
                    .replace("\r", "\n");
        }

        private String escapeMarkdown(String text) {
            if (text == null || text.isEmpty()) {
                return "";
            }
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

        private String repeat(String value, int count) {
            StringBuilder builder = new StringBuilder();
            for (int index = 0; index < count; index++) {
                builder.append(value);
            }
            return builder.toString();
        }
    }

    private static class ListContext {
        private final boolean ordered;
        private int nextIndex = 1;

        private ListContext(boolean ordered) {
            this.ordered = ordered;
        }
    }

    private static class LinkContext {
        private final String href;
        private final StringBuilder text = new StringBuilder();

        private LinkContext(String href) {
            this.href = href;
        }
    }
}
