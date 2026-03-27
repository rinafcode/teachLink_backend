import { Project, PropertyDeclaration, SyntaxKind } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

// Exclude the ones we already manually instrumented perfectly
const EXCLUDE_FILES = [
  'auth.dto.ts',
  'create-user.dto.ts',
  'create-payment.dto.ts',
  'create-course.dto.ts',
];

const sourceFiles = project.getSourceFiles('src/**/*.dto.ts')
  .filter(sf => !EXCLUDE_FILES.some(ex => sf.getFilePath().endsWith(ex)));

const addedDecoratorsCount = { value: 0 };

function getDecoratorsToAdd(prop: PropertyDeclaration): { name: string, args?: string[] }[] {
  const decorators: { name: string, args?: string[] }[] = [];
  const typeNode = prop.getTypeNode();
  const typeText = typeNode ? typeNode.getText() : prop.getType().getText();
  const name = prop.getName().toLowerCase();
  
  if (prop.hasQuestionToken()) {
    decorators.push({ name: 'IsOptional' });
  } else {
    decorators.push({ name: 'IsNotEmpty' });
  }

  if (name.includes('email')) {
    decorators.push({ name: 'IsEmail' });
  } else if (name.includes('url') || name.includes('link')) {
    decorators.push({ name: 'IsUrl' });
  } else if (name.endsWith('id') || name === 'id') {
    decorators.push({ name: 'IsUUID' });
  }

  if (typeText.includes('string')) {
    decorators.push({ name: 'IsString' });
  } else if (typeText.includes('number')) {
    decorators.push({ name: 'IsNumber' });
  } else if (typeText.includes('boolean')) {
    decorators.push({ name: 'IsBoolean' });
  } else if (typeText.includes('Date')) {
    decorators.push({ name: 'IsDate' });
  } else if (typeText.includes('[]')) {
    decorators.push({ name: 'IsArray' });
  }

  return decorators;
}

for (const sourceFile of sourceFiles) {
  let fileModified = false;
  const classes = sourceFile.getClasses();
  
  const requiredImports = new Set<string>();

  for (const cls of classes) {
    const properties = cls.getProperties();
    for (const prop of properties) {
      const existingDecorators = prop.getDecorators().map(d => d.getName());
      const desiredDecorators = getDecoratorsToAdd(prop);
      
      for (const dec of desiredDecorators) {
        if (!existingDecorators.includes(dec.name)) {
          prop.addDecorator({
            name: dec.name,
            arguments: dec.args || []
          });
          requiredImports.add(dec.name);
          fileModified = true;
          addedDecoratorsCount.value++;
        }
      }
    }
  }

  if (fileModified) {
    // Add imports from class-validator
    let classValidatorImport = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === 'class-validator');
    
    if (!classValidatorImport && requiredImports.size > 0) {
      classValidatorImport = sourceFile.addImportDeclaration({
        moduleSpecifier: 'class-validator',
        namedImports: Array.from(requiredImports).map(name => ({ name }))
      });
    } else if (classValidatorImport) {
      const existingNamedImports = classValidatorImport.getNamedImports().map(ni => ni.getName());
      for (const reqImport of requiredImports) {
        if (!existingNamedImports.includes(reqImport)) {
          classValidatorImport.addNamedImport(reqImport);
        }
      }
    }
  }
}

project.saveSync();
console.log(`Successfully added ${addedDecoratorsCount.value} validation decorators across ${sourceFiles.length} DTO files.`);
