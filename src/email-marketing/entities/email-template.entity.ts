import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('email_templates')
export class EmailTemplate {
    @ApiProperty()
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty()
    @Column()
    name: string;

    @ApiProperty()
    @Column()
    subject: string;

    @ApiProperty()
    @Column({ type: 'text' })
    htmlContent: string;

    @ApiProperty({ required: false })
    @Column({ type: 'text', nullable: true })
    textContent?: string;

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    category?: string;

    @ApiProperty({ type: [String] })
    @Column('simple-array', { nullable: true })
    variables?: string[];

    @ApiProperty({ required: false })
    @Column({ nullable: true })
    thumbnailUrl?: string;

    @ApiProperty()
    @Column({ default: true })
    isActive: boolean;

    @ApiProperty()
    @CreateDateColumn()
    createdAt: Date;

    @ApiProperty()
    @UpdateDateColumn()
    updatedAt: Date;
}
