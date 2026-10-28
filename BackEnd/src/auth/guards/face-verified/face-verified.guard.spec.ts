import { ConfigService } from '@nestjs/config';
import { FaceVerifiedGuard } from './face-verified.guard.js';

describe('FaceVerifiedGuard', () => {
  it('should be defined', () => {
    const config = new ConfigService({ FACE_JWT_SECRET: 'secreto-de-prueba' });
    expect(new FaceVerifiedGuard(config)).toBeDefined();
  });
});
