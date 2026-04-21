import { ConfigService } from '@nestjs/config';
import { ElasticsearchModuleOptions } from '@nestjs/elasticsearch';

export const createElasticsearchConfig = (
  configService: ConfigService,
): ElasticsearchModuleOptions => {
  const node = configService.get<string>('ELASTICSEARCH_NODE') ?? 'http://localhost:9200';
  const username = configService.get<string>('ELASTICSEARCH_USERNAME');
  const password = configService.get<string>('ELASTICSEARCH_PASSWORD');
  const apiKey = configService.get<string>('ELASTICSEARCH_API_KEY');
  const caFingerprint = configService.get<string>('ELASTICSEARCH_CA_FINGERPRINT');
  const requestTimeout = configService.get<number>('ELASTICSEARCH_REQUEST_TIMEOUT') ?? 30000;
  const maxRetries = configService.get<number>('ELASTICSEARCH_MAX_RETRIES') ?? 3;

  const options: ElasticsearchModuleOptions = {
    node,
    maxRetries,
    requestTimeout,
    sniffOnStart: false,
    compression: true,
  };

  if (apiKey) {
    options.auth = { apiKey };
  } else if (username && password) {
    options.auth = { username, password };
  }

  if (caFingerprint) {
    options.caFingerprint = caFingerprint;
  }

  return options;
};
