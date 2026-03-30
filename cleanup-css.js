#!/usr/bin/env node

/**
 * CSS 未使用类清理脚本
 * 
 * 使用方法:
 *   node cleanup-css.js
 * 
 * 这个脚本会删除以下未使用的 CSS 类：
 * - 移动端类（15 个）
 * - 工具类（8 个）
 * - 功能类（10 个）
 */

const fs = require('fs');
const path = require('path');

// 未使用的 CSS 类列表
const UNUSED_CLASSES = [
  // 移动端按钮
  'mobile-btn',
  'mobile-btn-danger',
  'mobile-btn-primary',
  'mobile-btn-secondary',
  'mobile-btn-success',
  'mobile-btn-sm',
  
  // 移动端卡片
  'mobile-card',
  'mobile-card-header',
  'mobile-card-title',
  
  // 移动端容器
  'mobile-container',
  
  // 移动端表单
  'mobile-form-control',
  'mobile-form-group',
  'mobile-form-label',
  'mobile-input-group',
  
  // 工具类
  'flex-col',
  'gap-1',
  'gap-4',
  'items-center',
  'justify-between',
  'justify-center',
  'mb-3',
  'p-4',
  
  // 功能类
  'chat-badge',
  'fade-in',
  'font-bold',
  'pulse',
  'radio-group',
  'select-wrapper',
  'text-center',
  'text-lg',
  'tooltip',
  'video-controls'
];

const CSS_FILES = [
  'src/styles/components.css',
  'src/styles/mobile-common.css',
  'src/styles/common.css',
  'src/styles/base.css'
];

function removeUnusedClasses() {
  console.log('🧹 开始清理未使用的 CSS 类...\n');
  
  let totalRemoved = 0;
  
  CSS_FILES.forEach(file => {
    const filePath = path.join(__dirname, file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  文件不存在: ${file}`);
      return;
    }
    
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalSize = content.length;
    
    // 对每个未使用的类进行删除
    UNUSED_CLASSES.forEach(className => {
      // 匹配 .class-name { ... } 的完整块
      const regex = new RegExp(
        `\\/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*\\/\\s*\n\\s*\\.${className}\\s*\\{[^}]*\\}(?:\\s*\n\\s*\\.${className}[^{]*\\{[^}]*\\})*`,
        'g'
      );
      
      const matches = content.match(regex);
      if (matches) {
        console.log(`  ✓ 删除 .${className} (${matches.length} 处)`);
        content = content.replace(regex, '');
        totalRemoved += matches.length;
      }
    });
    
    // 清理多余的空行
    content = content.replace(/\n\n\n+/g, '\n\n');
    
    const newSize = content.length;
    const reduction = originalSize - newSize;
    const percent = ((reduction / originalSize) * 100).toFixed(1);
    
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  📊 ${file}: ${reduction} 字节 (${percent}%)\n`);
  });
  
  console.log(`✅ 清理完成！共删除 ${totalRemoved} 个 CSS 类定义`);
  console.log(`\n📝 建议：`);
  console.log(`  1. 运行测试确保无回归: npm test`);
  console.log(`  2. 检查样式是否正常: npm run dev`);
  console.log(`  3. 提交更改: git add -A && git commit -m "refactor(css): 删除未使用的 CSS 类"`);
}

// 运行清理
removeUnusedClasses();
