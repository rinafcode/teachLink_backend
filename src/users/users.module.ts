import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { CurrencyModule } from '../currency/currency.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CurrencyModule],
  providers: [],
  exports: [TypeOrmModule],
})
export class UsersModule {}
