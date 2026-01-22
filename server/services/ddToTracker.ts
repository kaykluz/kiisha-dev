/**
 * DD Template to Tracker Auto-Conversion Service
 */

export interface DDTemplate { id: string; name: string; sections: DDSection[]; }
export interface DDSection { id: string; title: string; items: DDItem[]; order: number; }
export interface DDItem { id: string; question: string; type: 'text' | 'number' | 'date' | 'file' | 'checkbox'; required: boolean; guidance?: string; }
export interface TrackerProject { id: string; name: string; checklists: TrackerChecklist[]; createdAt: Date; }
export interface TrackerChecklist { id: string; name: string; items: TrackerItem[]; order: number; }
export interface TrackerItem { id: string; name: string; status: 'not_started' | 'in_progress' | 'completed' | 'na'; dueDate?: Date; notes?: string; }

export class DDToTrackerConverter {
  convert(template: DDTemplate, projectName?: string): TrackerProject {
    const project: TrackerProject = { id: `proj_${Date.now()}`, name: projectName || template.name, checklists: [], createdAt: new Date() };
    for (const section of template.sections) {
      const checklist: TrackerChecklist = { id: `cl_${Date.now()}_${section.order}`, name: section.title, items: [], order: section.order };
      for (const item of section.items) {
        const due = new Date(); due.setDate(due.getDate() + 14);
        checklist.items.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: item.question.replace(/\?/g, '').substring(0, 100),
          status: 'not_started',
          dueDate: item.required ? due : undefined,
          notes: item.guidance
        });
      }
      project.checklists.push(checklist);
    }
    return project;
  }

  parseTemplate(content: string, format: 'json' | 'csv' | 'markdown'): DDTemplate {
    if (format === 'json') return JSON.parse(content);
    if (format === 'csv') return this.parseCsv(content);
    return this.parseMarkdown(content);
  }

  private parseCsv(content: string): DDTemplate {
    const lines = content.split('\n').filter(l => l.trim());
    const template: DDTemplate = { id: `dd_${Date.now()}`, name: 'Imported DD', sections: [] };
    let currentSection: DDSection | null = null;
    let order = 0;
    for (const line of lines.slice(1)) {
      const [section, question, type, required] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      if (!currentSection || currentSection.title !== section) {
        if (currentSection) template.sections.push(currentSection);
        currentSection = { id: `sec_${order}`, title: section, items: [], order: order++ };
      }
      currentSection.items.push({ id: `item_${currentSection.items.length}`, question, type: (type as DDItem['type']) || 'text', required: required?.toLowerCase() === 'yes' });
    }
    if (currentSection) template.sections.push(currentSection);
    return template;
  }

  private parseMarkdown(content: string): DDTemplate {
    const template: DDTemplate = { id: `dd_${Date.now()}`, name: 'Imported DD', sections: [] };
    const lines = content.split('\n');
    let currentSection: DDSection | null = null;
    let order = 0;
    for (const line of lines) {
      const sectionMatch = line.match(/^#{2,3}\s+(.+)/);
      if (sectionMatch) {
        if (currentSection) template.sections.push(currentSection);
        currentSection = { id: `sec_${order}`, title: sectionMatch[1].trim(), items: [], order: order++ };
        continue;
      }
      const itemMatch = line.match(/^[-*]\s+(.+)/);
      if (itemMatch && currentSection) {
        const q = itemMatch[1].trim();
        currentSection.items.push({ id: `item_${currentSection.items.length}`, question: q.replace(/\*+/g, '').trim(), type: 'text', required: q.includes('*') });
      }
    }
    if (currentSection) template.sections.push(currentSection);
    const titleMatch = content.match(/^#\s+(.+)/m);
    if (titleMatch) template.name = titleMatch[1].trim();
    return template;
  }

  mergeTemplates(templates: DDTemplate[], projectName: string): TrackerProject {
    const merged: DDTemplate = { id: `merged_${Date.now()}`, name: projectName, sections: [] };
    let order = 0;
    for (const t of templates) for (const s of t.sections) merged.sections.push({ ...s, id: `sec_${order}`, title: `${t.name} - ${s.title}`, order: order++ });
    return this.convert(merged, projectName);
  }
}

export const ddToTrackerConverter = new DDToTrackerConverter();
export default ddToTrackerConverter;
