import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("email_templates")
export class EmailTemplate {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    unique: true,
  })
  key: string;

  @Column()
  name: string;

  @Column()
  subject: string;

  @Column({
    type: "text",
  })
  body: string;

  @Column({
    type: "json",
    default: [],
  })
  variables: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}