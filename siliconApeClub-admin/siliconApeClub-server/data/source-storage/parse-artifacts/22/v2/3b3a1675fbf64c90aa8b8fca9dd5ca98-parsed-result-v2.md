## 第 1 页

**运维工具使用分享**

## 第 2 页

系统组成

![Page 2 Image 1](/api/documents/22/parse-artifacts/350/content)

## 第 3 页

生产常见问题

页面卡顿

报未知系统异常

运维报异常

业务异常

卡单

## 第 4 页

统一监控平台

![Page 4 Image 2](/api/documents/22/parse-artifacts/351/content)

统一监控平台基本整合了全部运维能力

elk+数据库工具+统一监控平台即可

建议向运维申请标准信贷战队角色

## 第 5 页

日志分析工具

性能分析工具

机器资源分析工具

目录

中间件分析手段

## 第 6 页

日志分析工具-elk

日志分析主要依赖elk，新牌坊水土两个域名。通过关键字查到异常请求后，如有需要可提取traceId分析链路。

![Page 6 Image 3](/api/documents/22/parse-artifacts/352/content)

## 第 7 页

日志分析工具

性能分析工具

机器资源分析工具

目录

中间件分析手段

## 第 8 页

性能分析工具-链路追踪

通过”统一监控平台》应用监控》调用链路“，根据traceId搜索，可进入分析页面。

![Page 8 Image 4](/api/documents/22/parse-artifacts/353/content)

## 第 9 页

性能分析工具-skywalking

拿到traceId，可分析链路上的耗时情况，发现异常节点。

![Page 9 Image 5](/api/documents/22/parse-artifacts/354/content)

注意：

1、链路追踪有延迟，出现问题后最好选较早的请求

待确认：skywalking会上报所有数据吗

## 第 10 页

性能分析工具-skywalking

关注节点的自执行耗时

![Page 10 Image 6](/api/documents/22/parse-artifacts/355/content)

## 第 11 页

性能分析工具-接口调用

通过点击系统名称，进入”应用总览-接口调用“，选择关注的接口，可分析阶段时间内的接口响应情况。

![Page 11 Image 7](/api/documents/22/parse-artifacts/356/content)

## 第 12 页

性能分析工具-mq处理

同样地，我们可以分析阶段时间应用维度的MQ收发情况，尤其是消费端可以看到处理耗时。

![Page 12 Image 8](/api/documents/22/parse-artifacts/357/content)

## 第 13 页

日志分析工具

性能分析工具

机器资源分析工具

目录

中间件分析手段

## 第 14 页

jvm监控

应用详情可以看虚拟机情况，比对可以分析服务健康状态。

![Page 14 Image 9](/api/documents/22/parse-artifacts/358/content)

## 第 15 页

应用概览

应用概览可以查看机器实时资源情况，包含关联数据库情况。

![Page 15 Image 10](/api/documents/22/parse-artifacts/359/content)

## 第 16 页

业务视图

目前默认的资源监控页面都缺乏更详细（线程、tcp网络状况等）且直观的数据，推荐各应用接入普米指标系统。

实现方式上可以开发统一jar包，使用相同表盘文件，无需重发开发。

推和拉模式都有一定的性能开销，需评估影响。

![Page 16 Image 11](/api/documents/22/parse-artifacts/360/content)

## 第 17 页

日志分析工具

性能分析工具

机器资源分析工具

目录

中间件分析手段

## 第 18 页

慢sql

在慢sql菜单下，可以直接通过数据库去查，也可以通过子系统(应用名)去查询慢sql记录。

![Page 18 Image 12](/api/documents/22/parse-artifacts/361/content)

## 第 19 页

数据库服务器状态查询

通过应用概览》数据库表查询全部。进入数据库性能监控页面

可以通过配置的实例名称或者ip查询对应的数据库，点击对应的ip可以查看实例各项数据。

![Page 19 Image 13](/api/documents/22/parse-artifacts/362/content)

## 第 20 页

数据库服务器-资源监控

通过应用概览》数据库表查询全部。进入数据库性能监控页面

可以通过配置的实例名称或者ip查询对应的数据库，点击对应的ip可以查看实例各项数据。

![Page 20 Image 14](/api/documents/22/parse-artifacts/363/content)

## 第 21 页

数据库服务器-引擎监控

![Page 21 Image 15](/api/documents/22/parse-artifacts/364/content)

查看数据库引擎处理的行数、线程、事务趋势

## 第 22 页

mq消费情况

日常问题排查中，请提供NameServer地址以及准确的topic和key到控制台查询。

日常开发中，最好直接把消息key生成好，且在发送前打印完整消息日志。

## 第 23 页

redis数据查询

提供集群信息以及准确key,让运维去查询

## 第 24 页

es数据查询

提供集群信息以及完整命令让运维去查询

## 第 25 页

sftp/ftp服务器文件查询

提供服务器地址以及文件路径让运维查看

## 第 26 页

总结

推荐：

1、合理的sql告警、日志告警比日常巡检效果更好，可以在迭代版本的详细设计方案加入告警设计模块。

2、重要的系统设计《应用发布check方案》，并共享在知识库中。

3、重要系统可以维护一个生产环境中间件信息文档，包含地址、账号等，紧急时不浪费时间。