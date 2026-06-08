import {
  Module,
} from "@nestjs/common";

@Module({
  controllers: [
    GdprController,
  ],

  providers: [
    GdprService,
  ],
})
export class GdprModule {}