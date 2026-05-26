const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../src');

function replaceAny(node, context) {
  if (node.kind === ts.SyntaxKind.AnyKeyword) {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }

  if (ts.isAsExpression(node) && node.type.kind === ts.SyntaxKind.AnyKeyword) {
    return ts.factory.createAsExpression(node.expression, ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword));
  }

  return ts.visitEachChild(node, (child) => replaceAny(child, context), context);
}

function transformerFactory(context) {
  return (rootNode) => ts.visitNode(rootNode, (node) => replaceAny(node, context));
}

function transformSourceText(text, filePath) {
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const result = ts.transform(sourceFile, [transformerFactory]);
  const transformed = result.transformed[0];
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const output = printer.printFile(transformed);
  result.dispose();
  return output;
}

function walkDir(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (entry.isFile() && fullPath.endsWith('.ts')) {
      callback(fullPath);
    }
  }
}

const changed = [];

walkDir(SRC_DIR, (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const transformed = transformSourceText(content, filePath);
  if (transformed !== content) {
    fs.writeFileSync(filePath, transformed, 'utf8');
    changed.push(filePath);
  }
});

console.log(`Processed ${changed.length} files`);
if (changed.length > 0) {
  console.log(changed.join('\n'));
}
