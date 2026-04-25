import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from './entities/notification.entity';
export interface NotificationTemplate {
    title: string;
    content: string;
}
@Injectable()
export class NotificationTemplatesService {
    private readonly logger = new Logger(NotificationTemplatesService.name);
    private readonly templates: Map<string, (data: unknown) => NotificationTemplate> = new Map();
    constructor() {
        this.registerTemplates();
    }
    private registerTemplates() {
        this.templates.set('COURSE_ENROLLMENT', (data: unknown) => ({
            title: 'Course Enrollment',
            content: `Welcome to the course ${data.courseName}! You have been successfully enrolled.`,
        }));
        this.templates.set('PAYMENT_RECEIVED', (data: unknown) => ({
            title: 'Payment Confirmed',
            content: `A payment of ${data.amount} ${data.currency} for the course ${data.courseName} was successfully processed.`,
        }));
        this.templates.set('NEW_MESSAGE', (data: unknown) => ({
            title: 'New Message',
            content: `You have received a new message from ${data.senderName}.`,
        }));
        this.templates.set('COURSE_REPLY', (data: unknown) => ({
            title: 'Course Discussion Reply',
            content: `${data.senderName} replied to your comment in ${data.courseName}.`,
        }));
    }
    renderTemplate(type: string, data: unknown): NotificationTemplate {
        const templateFn = this.templates.get(type);
        if (!templateFn) {
            this.logger.warn(`Template callback not found for type: ${type}`);
            return {
                title: 'Notification',
                content: JSON.stringify(data),
            };
        }
        return templateFn(data);
    }
    formatForType(n: NotificationTemplate, type: NotificationType): string {
        switch (type) {
            case NotificationType.EMAIL:
                return `<h1>${n.title}</h1><p>${n.content}</p>`;
            case NotificationType.PUSH:
                return n.content;
            case NotificationType.IN_APP:
                return n.content;
            case NotificationType.SMS:
                return `${n.title}: ${n.content}`;
            default:
                return n.content;
        }
    }
}
