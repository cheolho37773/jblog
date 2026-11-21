import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// 골격 단계: 기동만 확인한다. 포트·prefix·보안 설정은 환경변수 검증과 함께 추가한다.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(0);
}

void bootstrap();
