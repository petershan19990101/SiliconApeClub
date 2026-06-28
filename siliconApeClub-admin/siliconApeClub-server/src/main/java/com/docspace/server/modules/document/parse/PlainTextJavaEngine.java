package com.docspace.server.modules.document.parse;

import com.docspace.server.common.exception.BusinessException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import org.springframework.stereotype.Component;

@Component
public class PlainTextJavaEngine implements DocumentParseEngine {

    @Override
    public String getCode() {
        return "plain_text_java_engine";
    }

    @Override
    public String getName() {
        return "通用文本直读引擎";
    }

    @Override
    public String getDescription() {
        return "面向 Markdown、TXT、SQL、LOG、JSON、YAML 等文本文件的默认解析器，按文本内容直接生成 Markdown。";
    }

    @Override
    public ParseEngineOutput parse(byte[] sourceBytes) {
        if (sourceBytes == null || sourceBytes.length == 0) {
            throw new BusinessException("文本内容为空，无法解析");
        }
        String text = normalizeText(decodeText(sourceBytes));
        return ParseEngineOutput.builder()
                .pageTexts(Collections.singletonList(ParsePageText.builder()
                        .pageNo(1)
                        .text(text)
                        .build()))
                .images(Collections.<ParseImageArtifact>emptyList())
                .markdownContent(text)
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

    private String normalizeText(String text) {
        if (text == null) {
            return "";
        }
        return text
                .replace("\uFEFF", "")
                .replace("\u0000", "")
                .replace("\r\n", "\n")
                .replace("\r", "\n")
                .trim();
    }
}
