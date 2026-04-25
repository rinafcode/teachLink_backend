import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Repository, UpdateDateColumn, } from 'typeorm';
import { Job, Queue } from 'bull';
import { User } from '../../users/entities/user.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
export type ExportFormat = 'json' | 'pdf';
export enum UserExportStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    FAILED = 'failed'
}
@Entity('user_export_history')
@Index(['userId', 'createdAt'])
export class UserExportHistory {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ name: 'user_id' })
    @Index()
    userId: string;
    @Column({ type: 'varchar' })
    format: ExportFormat;
    @Column({
        type: 'enum',
        enum: UserExportStatus,
        default: UserExportStatus.PENDING,
    })
    @Index()
    status: UserExportStatus;
    @Column({ name: 'file_name', nullable: true })
    fileName?: string;
    @Column({ name: 'mime_type', nullable: true })
    mimeType?: string;
    @Column({ name: 'file_content', type: 'text', nullable: true })
    fileContent?: string;
    @Column({ name: 'error_message', type: 'text', nullable: true })
    errorMessage?: string;
    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;
    @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
    completedAt?: Date;
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
interface ExportJobData {
    exportId: string;
    userId: string;
    format: ExportFormat;
}
interface PreparedExportData {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        status: string;
        tenantId?: string;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt?: Date;
    };
    courseProgress: Array<{
        enrollmentId: string;
        courseId: string;
        courseTitle: string;
        progress: number;
        status: string;
        enrolledAt: Date;
        lastAccessedAt: Date;
    }>;
    exportMeta: {
        generatedAt: string;
        totalEnrollments: number;
        completedCourses: number;
        averageProgress: number;
    };
}
@Injectable()
export class ExportService {
    private readonly logger = new Logger(ExportService.name);
    private static readonly QUEUE_NAME = 'user-data-export';
    private static readonly JOB_NAME = 'generate-user-data-export';
    constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>, 
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>, 
    @InjectRepository(UserExportHistory)
    private readonly exportHistoryRepository: Repository<UserExportHistory>, 
    @InjectQueue(ExportService.QUEUE_NAME)
    private readonly exportQueue: Queue) { }
    async requestUserDataExport(userId: string, format: ExportFormat = 'json') {
        this.ensureValidFormat(format);
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        const exportRecord = this.exportHistoryRepository.create({
            userId,
            format,
            status: UserExportStatus.PENDING,
            metadata: {
                requestedAt: new Date().toISOString(),
            },
        });
        const savedRecord = await this.exportHistoryRepository.save(exportRecord);
        await this.exportQueue.add(ExportService.JOB_NAME, {
            exportId: savedRecord.id,
            userId,
            format,
        } as ExportJobData, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
            removeOnComplete: 50,
            removeOnFail: 50,
        });
        return {
            exportId: savedRecord.id,
            status: savedRecord.status,
            message: 'Export request accepted and queued for background processing',
        };
    }
    async getUserExportHistory(userId: string) {
        const history = await this.exportHistoryRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
        return history.map((item) => ({
            id: item.id,
            format: item.format,
            status: item.status,
            fileName: item.fileName,
            mimeType: item.mimeType,
            errorMessage: item.errorMessage,
            metadata: item.metadata,
            completedAt: item.completedAt,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        }));
    }
    async getCompletedExportFile(userId: string, exportId: string): Promise<{
        fileName: string;
        mimeType: string;
        content: Buffer;
    }> {
        const record = await this.exportHistoryRepository.findOne({
            where: { id: exportId, userId },
        });
        if (!record) {
            throw new NotFoundException('Export record not found');
        }
        if (record.status !== UserExportStatus.COMPLETED || !record.fileContent) {
            throw new BadRequestException('Export is not ready yet');
        }
        return {
            fileName: record.fileName || `user-export-${record.id}.${record.format}`,
            mimeType: record.mimeType || 'application/octet-stream',
            content: Buffer.from(record.fileContent, 'base64'),
        };
    }
    async processExportJob(jobData: ExportJobData): Promise<void> {
        const { exportId, userId, format } = jobData;
        const exportRecord = await this.exportHistoryRepository.findOne({ where: { id: exportId } });
        if (!exportRecord) {
            this.logger.warn(`Export record not found: ${exportId}`);
            return;
        }
        try {
            await this.exportHistoryRepository.update(exportId, {
                status: UserExportStatus.IN_PROGRESS,
                metadata: {
                    ...(exportRecord.metadata || {}),
                    startedAt: new Date().toISOString(),
                },
            });
            const exportData = await this.prepareExportData(userId);
            const preparedFile = format === 'pdf' ? this.generatePdfExport(exportData) : this.generateJsonExport(exportData);
            await this.exportHistoryRepository.update(exportId, {
                status: UserExportStatus.COMPLETED,
                fileName: preparedFile.fileName,
                mimeType: preparedFile.mimeType,
                fileContent: preparedFile.content.toString('base64'),
                completedAt: new Date(),
                metadata: {
                    ...(exportRecord.metadata || {}),
                    completedAt: new Date().toISOString(),
                    payloadBytes: preparedFile.content.length,
                },
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown export error';
            this.logger.error(`Export processing failed for ${exportId}`, message);
            await this.exportHistoryRepository.update(exportId, {
                status: UserExportStatus.FAILED,
                errorMessage: message,
                metadata: {
                    ...(exportRecord.metadata || {}),
                    failedAt: new Date().toISOString(),
                },
            });
            throw error;
        }
    }
    private ensureValidFormat(format: string): asserts format is ExportFormat {
        if (format !== 'json' && format !== 'pdf') {
            throw new BadRequestException('Unsupported export format. Supported formats: json, pdf');
        }
    }
    private async prepareExportData(userId: string): Promise<PreparedExportData> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        const enrollments = await this.enrollmentRepository.find({
            where: { userId },
            relations: ['course'],
            order: { enrolledAt: 'DESC' },
        });
        const completedCourses = enrollments.filter((item) => item.progress >= 100).length;
        const totalProgress = enrollments.reduce((sum, item) => sum + Number(item.progress || 0), 0);
        const averageProgress = enrollments.length > 0 ? totalProgress / enrollments.length : 0;
        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                status: user.status,
                tenantId: user.tenantId,
                isEmailVerified: user.isEmailVerified,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                lastLoginAt: user.lastLoginAt,
            },
            courseProgress: enrollments.map((enrollment) => ({
                enrollmentId: enrollment.id,
                courseId: enrollment.courseId,
                courseTitle: enrollment.course?.title || 'Unknown course',
                progress: Number(enrollment.progress || 0),
                status: enrollment.status,
                enrolledAt: enrollment.enrolledAt,
                lastAccessedAt: enrollment.lastAccessedAt,
            })),
            exportMeta: {
                generatedAt: new Date().toISOString(),
                totalEnrollments: enrollments.length,
                completedCourses,
                averageProgress: Number(averageProgress.toFixed(2)),
            },
        };
    }
    private generateJsonExport(data: PreparedExportData): {
        fileName: string;
        mimeType: string;
        content: Buffer;
    } {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return {
            fileName: `user-data-export-${data.user.id}-${timestamp}.json`,
            mimeType: 'application/json',
            content: Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
        };
    }
    private generatePdfExport(data: PreparedExportData): {
        fileName: string;
        mimeType: string;
        content: Buffer;
    } {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const lines = [
            'TeachLink User Data Export',
            '',
            `Generated: ${data.exportMeta.generatedAt}`,
            '',
            `User: ${data.user.firstName} ${data.user.lastName} (${data.user.email})`,
            `Role: ${data.user.role}`,
            `Status: ${data.user.status}`,
            `Email Verified: ${data.user.isEmailVerified ? 'Yes' : 'No'}`,
            '',
            `Total Enrollments: ${data.exportMeta.totalEnrollments}`,
            `Completed Courses: ${data.exportMeta.completedCourses}`,
            `Average Progress: ${data.exportMeta.averageProgress}%`,
            '',
            'Course Progress',
            ...data.courseProgress.map((item, index) => `${index + 1}. ${item.courseTitle} | Progress: ${item.progress}% | Status: ${item.status}`),
        ];
        return {
            fileName: `user-data-export-${data.user.id}-${timestamp}.pdf`,
            mimeType: 'application/pdf',
            content: this.buildSimplePdf(lines),
        };
    }
    // Lightweight PDF writer to avoid additional dependencies for a simple report export.
    private buildSimplePdf(lines: string[]): Buffer {
        const escapePdfText = (value: string): string => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
        const bodyLines: string[] = ['BT', '/F1 11 Tf', '50 780 Td', '14 TL'];
        lines.forEach((line, index) => {
            const command = index === 0 ? 'Tj' : 'T*';
            bodyLines.push(`(${escapePdfText(line)}) ${command}`);
        });
        bodyLines.push('ET');
        const stream = bodyLines.join('\n');
        const object1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
        const object2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
        const object3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n';
        const object4 = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
        const object5 = `5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`;
        const header = '%PDF-1.4\n';
        const offset1 = header.length;
        const offset2 = offset1 + object1.length;
        const offset3 = offset2 + object2.length;
        const offset4 = offset3 + object3.length;
        const offset5 = offset4 + object4.length;
        const body = object1 + object2 + object3 + object4 + object5;
        const xrefOffset = header.length + body.length;
        const xref = [
            'xref',
            '0 6',
            '0000000000 65535 f ',
            `${offset1.toString().padStart(10, '0')} 00000 n `,
            `${offset2.toString().padStart(10, '0')} 00000 n `,
            `${offset3.toString().padStart(10, '0')} 00000 n `,
            `${offset4.toString().padStart(10, '0')} 00000 n `,
            `${offset5.toString().padStart(10, '0')} 00000 n `,
            'trailer',
            '<< /Size 6 /Root 1 0 R >>',
            'startxref',
            `${xrefOffset}`,
            '%%EOF',
        ].join('\n');
        return Buffer.from(header + body + xref, 'utf8');
    }
}
@Processor('user-data-export')
export class UserDataExportProcessor {
    private readonly logger = new Logger(UserDataExportProcessor.name);
    constructor(private readonly exportService: ExportService) { }
    @Process('generate-user-data-export')
    async handleGenerateUserDataExport(job: Job<ExportJobData>): Promise<void> {
        this.logger.log(`Processing user export job: ${job.id}`);
        await job.progress(20);
        await this.exportService.processExportJob(job.data);
        await job.progress(100);
    }
}
