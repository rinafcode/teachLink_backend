import * as Handlebars from 'handlebars';

const templates = {
  'welcome': `Hello {{name}}, welcome to TeachLink!`,
  'course-update': `Hi {{name}}, your course "{{course}}" has been updated.`,
  
};

export function renderTemplate(templateName: string, context: Record<string, any>): string {
  const source = templates[templateName];
  if (!source) throw new Error('Template not found');
  const compiled = Handlebars.compile(source);
  return compiled(context);
} 