import { Controller, Get, Param, Res, Headers, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Response } from 'express';
import { deepLinkRateLimitConfig } from './deep-link.config';
import { DeepLinkService } from './deep-link.service';

@Controller()
export class DeepLinkController {
  constructor(private readonly deepLinkService: DeepLinkService) {}

  @Get('.well-known/apple-app-site-association')
  getAppleAASA(@Res() res: Response) {
    const aasa = {
      applinks: {
        apps: [],
        details: [
          {
            appID: 'TEAMID.com.teachlink.app',
            paths: ['/course/*', '/deep-link/course/*'],
          },
        ],
      },
    };
    return res.status(200).json(aasa);
  }

  @Get('.well-known/assetlinks.json')
  getAndroidAssetLinks(@Res() res: Response) {
    const assetlinks = [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.teachlink.app',
          sha256_cert_fingerprints: [
            '14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5',
          ],
        },
      },
    ];
    return res.status(200).json(assetlinks);
  }

  @Get('deep-link/course/:id')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: deepLinkRateLimitConfig.redirectLimit,
      ttl: deepLinkRateLimitConfig.ttlMs,
    },
  })
  redirectCourseLink(
    @Param('id') id: string,
    @Headers('user-agent') userAgent: string,
    @Res() res: Response,
  ) {
    const isMobile = /Mobile|Android|iPhone|iPod|iPad/i.test(userAgent || '');
    const type = isMobile ? 'app' : 'web';
    const location = this.deepLinkService.buildDeepLink(type, 'course', id);

    return res.redirect(location);
  }
}
