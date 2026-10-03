import { FaceVerifiedGuard } from './face-verified.guard.js';

describe('FaceVerifiedGuard', () => {
  it('should be defined', () => {
    expect(new FaceVerifiedGuard()).toBeDefined();
  });
});
