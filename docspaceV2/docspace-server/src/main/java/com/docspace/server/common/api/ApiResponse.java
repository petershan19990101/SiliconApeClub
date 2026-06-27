/**
 * 统一接口响应对象，约定 success / message / data 三段式返回结构。
 */
package com.docspace.server.common.api;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {

    /** 是否成功。 */
    private boolean success;
    /** 提示消息。 */
    private String message;
    /** 业务数据。 */
    private T data;

    /** 返回成功结果，默认消息为 OK。 */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<T>(true, "OK", data);
    }

    /** 返回成功结果，并附带自定义消息。 */
    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<T>(true, message, data);
    }

    /** 返回失败结果。 */
    public static <T> ApiResponse<T> failure(String message) {
        return new ApiResponse<T>(false, message, null);
    }
}
