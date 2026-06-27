/**
 * MybatisPlusConfig 相关文件，用于承载对应模块的实现。
 */
package com.docspace.server.config;

import com.baomidou.mybatisplus.autoconfigure.MybatisPlusProperties;
import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import com.baomidou.mybatisplus.extension.spring.MybatisSqlSessionFactoryBean;
import javax.sql.DataSource;
import org.apache.ibatis.session.SqlSessionFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@Configuration
@EnableConfigurationProperties(MybatisPlusProperties.class)
public class MybatisPlusConfig {

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }

    @Bean
    public SqlSessionFactory sqlSessionFactory(DataSource dataSource,
                                               MybatisPlusProperties properties,
                                               ObjectProvider<MybatisPlusInterceptor> interceptorProvider) throws Exception {
        MybatisSqlSessionFactoryBean factoryBean = new MybatisSqlSessionFactoryBean();
        factoryBean.setDataSource(dataSource);

        if (properties.getMapperLocations() != null && properties.getMapperLocations().length > 0) {
            factoryBean.setMapperLocations(properties.resolveMapperLocations());
        }
        if (properties.getTypeAliasesPackage() != null && !properties.getTypeAliasesPackage().isEmpty()) {
            factoryBean.setTypeAliasesPackage(properties.getTypeAliasesPackage());
        }
        if (properties.getTypeAliasesSuperType() != null) {
            factoryBean.setTypeAliasesSuperType(properties.getTypeAliasesSuperType());
        }
        if (properties.getTypeHandlersPackage() != null && !properties.getTypeHandlersPackage().isEmpty()) {
            factoryBean.setTypeHandlersPackage(properties.getTypeHandlersPackage());
        }
        if (properties.getConfigurationProperties() != null) {
            factoryBean.setConfigurationProperties(properties.getConfigurationProperties());
        }
        if (properties.getGlobalConfig() != null) {
            factoryBean.setGlobalConfig(properties.getGlobalConfig());
        }

        MybatisConfiguration configuration = new MybatisConfiguration();
        if (properties.getConfiguration() != null) {
            properties.getConfiguration().applyTo(configuration);
        }
        factoryBean.setConfiguration(configuration);

        MybatisPlusInterceptor interceptor = interceptorProvider.getIfAvailable();
        if (interceptor != null) {
            factoryBean.setPlugins(interceptor);
        }

        return factoryBean.getObject();
    }
}

