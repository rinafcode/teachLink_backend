import { Project } from 'ts-morph';
import * as path from 'path';

async function run() {
  const project = new Project({
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
  });

  const sourceFiles = project.getSourceFiles('src/**/*.dto.ts');

  const decoratorMessages = {
    IsString: "{ message: 'Must be a valid string' }",
    IsNumber: "{ message: 'Must be a valid number' }",
    IsBoolean: "{ message: 'Must be a boolean value' }",
    IsNotEmpty: "{ message: 'Field is required' }",
  };

  let updatedCount = 0;

  for (const sourceFile of sourceFiles) {
    // Skip explicitly modified files
    const filePath = sourceFile.getFilePath();
    if (filePath.includes('auth.dto.ts') || 
        filePath.includes('create-user.dto.ts') || 
        filePath.includes('create-payment.dto.ts') || 
        filePath.includes('create-course.dto.ts')) {
      continue;
    }

    let fileChanged = false;
    const classes = sourceFile.getClasses();
    const requiredImports = new Set<string>();

    for (const cls of classes) {
      const properties = cls.getProperties();

      for (const prop of properties) {
        const typeNode = prop.getTypeNode();
        if (!typeNode) continue;
        const typeText = typeNode.getText();
        
        const hasOptionalToken = prop.hasQuestionToken();
        let hasValidation = false;

        for (const dec of prop.getDecorators()) {
          const decName = dec.getName();
          if (['IsString', 'IsNumber', 'IsBoolean', 'IsEmail', 'IsOptional', 'IsNotEmpty', 'IsEnum', 'IsUUID'].includes(decName)) {
            hasValidation = true;
            break;
          }
        }

        if (hasValidation) continue;

        fileChanged = true;

        if (hasOptionalToken) {
          prop.addDecorator({ name: 'IsOptional', arguments: [] });
          requiredImports.add('IsOptional');
        } else {
          prop.addDecorator({ name: 'IsNotEmpty', arguments: [decoratorMessages.IsNotEmpty] });
          requiredImports.add('IsNotEmpty');
        }

        if (typeText === 'string') {
          prop.addDecorator({ name: 'IsString', arguments: [decoratorMessages.IsString] });
          requiredImports.add('IsString');
        } else if (typeText === 'number') {
          prop.addDecorator({ name: 'IsNumber', arguments: ['{}', decoratorMessages.IsNumber] });
          requiredImports.add('IsNumber');
        } else if (typeText === 'boolean') {
          prop.addDecorator({ name: 'IsBoolean', arguments: [decoratorMessages.IsBoolean] });
          requiredImports.add('IsBoolean');
        }
      }
    }

    if (fileChanged) {
      const existingImport = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === 'class-validator');
      if (existingImport) {
        for (const imp of requiredImports) {
          if (!existingImport.getNamedImports().some(ni => ni.getName() === imp)) {
            existingImport.addNamedImport(imp);
          }
        }
      } else if (requiredImports.size > 0) {
        sourceFile.addImportDeclaration({
          namedImports: Array.from(requiredImports),
          moduleSpecifier: 'class-validator'
        });
      }
      sourceFile.saveSync();
      updatedCount++;
    }
  }

  console.log(`Successfully auto-validated ${updatedCount} DTO files.`);
}

run().catch(console.error);
