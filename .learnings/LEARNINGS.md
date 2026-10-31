## [LRN-20261031-A7B] correction

**Priority**: critical
**Status**: resolved
**Area**: tools

### 内容
朝堂布局修改只验证了 b.x/z 和人物站位，却没有验证经过合批的真实建筑网格。旧合批器将 matrixWorld 烘焙进几何体并把匾额挪到 scene，后续移动原始建筑根节点不起作用；铺装组也已脱离场景。多轮坐标测试全过，用户画面仍然错位。

### 建议修复
需要后续布局的模型按根节点局部坐标合批，保留模型、匾额、拾取目标共同父节点。回归检查真实 Box3、世界变换与场景父子关系；界面修复必须启动真实渲染并看截图。通用“没有 WebGL”提示不能作为判断硬件问题的证据，先取具体异常。验证失败时不要把未验证安装包交给用户当第一轮测试。

### 元数据
- Source: user_feedback
- Pattern-Key: render-geometry-versus-layout-metadata

---
