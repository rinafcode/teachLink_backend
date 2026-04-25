import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
@Entity('user_progress')
export class UserProgress {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @OneToOne(() => User)
    @JoinColumn()
    @Index()
    user: User;
    @Column({ default: 0 })
    @Index()
    totalPoints: number;
    @Column({ default: 1 })
    @Index()
    level: number;
    @Column({ default: 0 })
    @Index()
    xp: number;
}
