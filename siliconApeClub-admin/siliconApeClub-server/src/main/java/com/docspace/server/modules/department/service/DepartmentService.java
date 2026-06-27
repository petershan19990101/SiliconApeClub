/**
 * DepartmentService 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.modules.department.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.docspace.server.persistence.entity.DepartmentEntity;
import com.docspace.server.persistence.mapper.DepartmentMapper;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DepartmentService {

    private final DepartmentMapper departmentMapper;

    public List<DepartmentDto> listDepartments() {
        return departmentMapper.selectList(new LambdaQueryWrapper<DepartmentEntity>()
                        .orderByAsc(DepartmentEntity::getId))
                .stream()
                .map(entity -> DepartmentDto.builder()
                        .id(entity.getId())
                        .parentId(entity.getParentId())
                        .name(entity.getName())
                        .build())
                .collect(Collectors.toList());
    }
}

