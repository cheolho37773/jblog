import { ConfigService } from '@nestjs/config';
import { createApp } from './bootstrap';
import { readProcessEnv } from './config/env.source';

async function bootstrap(): Promise<void> {
  const app = await createApp(readProcessEnv());
  await app.listen(app.get(ConfigService).getOrThrow<number>('API_PORT'));
}

void bootstrap();
