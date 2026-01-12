#!/bin/bash
# 体重记录插件 - 依赖安装脚本
# 用于安装matplotlib等必需的Python库

echo "================================================"
echo "  体重记录插件 v2.1.0 - 依赖安装"
echo "================================================"
echo ""

# 检测操作系统
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo "检测到操作系统: $MACHINE"
echo ""

# 检查Python版本
echo "检查Python版本..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✓ $PYTHON_VERSION"
else
    echo "✗ 未找到Python3,请先安装Python 3.6+"
    exit 1
fi
echo ""

# 检查pip
echo "检查pip..."
if command -v pip3 &> /dev/null; then
    PIP_VERSION=$(pip3 --version)
    echo "✓ $PIP_VERSION"
else
    echo "✗ 未找到pip3,请先安装pip"
    exit 1
fi
echo ""

# 安装matplotlib
echo "安装matplotlib..."
pip3 install matplotlib

if [ $? -eq 0 ]; then
    echo "✓ matplotlib安装成功"
else
    echo "✗ matplotlib安装失败"
    exit 1
fi
echo ""

# 检查matplotlib版本
echo "验证matplotlib安装..."
MATPLOTLIB_VERSION=$(python3 -c "import matplotlib; print(matplotlib.__version__)" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✓ matplotlib $MATPLOTLIB_VERSION 已安装"
else
    echo "✗ matplotlib验证失败"
    exit 1
fi
echo ""

# 根据操作系统安装中文字体
if [ "$MACHINE" = "Linux" ]; then
    echo "检测到Linux系统,安装中文字体..."
    
    # 检测包管理器
    if command -v apt-get &> /dev/null; then
        echo "使用apt-get安装字体..."
        sudo apt-get update
        sudo apt-get install -y fonts-wqy-microhei fonts-wqy-zenhei
        echo "✓ 中文字体安装完成"
    elif command -v yum &> /dev/null; then
        echo "使用yum安装字体..."
        sudo yum install -y wqy-microhei-fonts wqy-zenhei-fonts
        echo "✓ 中文字体安装完成"
    else
        echo "⚠ 未检测到包管理器,请手动安装中文字体"
    fi
    
    # 清除matplotlib缓存
    echo "清除matplotlib缓存..."
    rm -rf ~/.cache/matplotlib
    echo "✓ 缓存已清除"
    
elif [ "$MACHINE" = "Mac" ]; then
    echo "检测到macOS系统"
    echo "✓ macOS通常已内置中文字体(Arial Unicode MS)"
    echo "  如果中文显示异常,请安装额外字体"
fi

echo ""
echo "================================================"
echo "  安装完成!"
echo "================================================"
echo ""
echo "下一步:"
echo "1. 将体重记录_v2.py复制到autMan插件目录"
echo "2. 重启autMan"
echo "3. 发送「体重帮助」测试插件"
echo ""
echo "如有问题,请查看 CHART_FEATURE.md 文档"
echo ""
